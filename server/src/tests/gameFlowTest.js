const path = require("path");
const { spawn } = require("child_process");
const jwt = require("jsonwebtoken");
const { io } = require("socket.io-client");
const { Op } = require("sequelize");
const db = require("../db/models");

require("dotenv").config({ path: path.resolve(__dirname, "../../.env") });

const TEST_TIMEOUT_MS = 10000;
const SERVER_URL = process.env.TEST_SOCKET_URL || `http://localhost:${process.env.PORT || 3001}`;
const JWT_SECRET = process.env.JWT_SECRET || "dev_secret";

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function waitForEvent(socket, eventName, options = {}) {
  const timeoutMs = options.timeoutMs || TEST_TIMEOUT_MS;
  const predicate = typeof options.predicate === "function" ? options.predicate : () => true;

  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      socket.off(eventName, onEvent);
      reject(new Error(`Timeout waiting for ${eventName}`));
    }, timeoutMs);

    const onEvent = (...args) => {
      const payload = args[0];
      if (!predicate(payload)) {
        return;
      }
      clearTimeout(timer);
      socket.off(eventName, onEvent);
      resolve(payload);
    };

    socket.on(eventName, onEvent);
  });
}

async function createTestUser(label) {
  const suffix = `${Date.now()}_${Math.floor(Math.random() * 100000)}`;
  const nickname = `flow_${label}_${suffix}`;
  const email = `${nickname}@triad-arena.local`;
  return db.User.create({
    nickname,
    email,
    password_hash: "test_hash"
  });
}

async function ensurePlayableCards() {
  const cards = await db.Card.findAll({
    where: { mana_cost: { [Op.lte]: 4 } },
    order: [
      ["mana_cost", "ASC"],
      ["name", "ASC"]
    ],
    limit: 20
  });

  const uniqueById = [];
  const seen = new Set();
  for (const card of cards) {
    if (!seen.has(card.id)) {
      seen.add(card.id);
      uniqueById.push(card.get({ plain: true }));
    }
  }

  assert(uniqueById.length >= 4, "Need at least 4 distinct cards with low mana for flow test");
  const firstThreeCost = uniqueById[0].mana_cost + uniqueById[1].mana_cost + uniqueById[2].mana_cost;
  assert(firstThreeCost <= 10, "First three test cards exceed available first-turn energy");
  return uniqueById.slice(0, 4);
}

function connectClient(token) {
  const socket = io(SERVER_URL, {
    auth: { token },
    transports: ["websocket"],
    reconnection: false
  });
  return socket;
}

async function canConnectToSocketServer() {
  const probeToken = jwt.sign({ userId: "probe-user" }, JWT_SECRET, { expiresIn: "5m" });
  const probe = connectClient(probeToken);
  try {
    await waitForEvent(probe, "connect", { timeoutMs: 1500 });
    return true;
  } catch (_error) {
    return false;
  } finally {
    probe.disconnect();
  }
}

async function ensureServerRunning() {
  if (await canConnectToSocketServer()) {
    return null;
  }

  const child = spawn(process.execPath, ["src/index.js"], {
    cwd: path.resolve(__dirname, "../.."),
    env: process.env,
    stdio: "ignore"
  });

  const deadline = Date.now() + 10000;
  while (Date.now() < deadline) {
    if (await canConnectToSocketServer()) {
      return child;
    }
    await delay(250);
  }

  if (!child.killed) {
    child.kill("SIGTERM");
  }
  throw new Error("Unable to start server for game flow test");
}

async function run() {
  const checks = {
    matchmaking: false,
    roomJoin: false,
    stateInitialization: false,
    playCard: false,
    threeCardLimit: false,
    endTurn: false,
    engineState: false
  };

  const user1 = await createTestUser("p1");
  const user2 = await createTestUser("p2");
  const cards = await ensurePlayableCards();

  const token1 = jwt.sign({ userId: user1.id }, JWT_SECRET, { expiresIn: "1h" });
  const token2 = jwt.sign({ userId: user2.id }, JWT_SECRET, { expiresIn: "1h" });

  let player1 = null;
  let player2 = null;
  let serverProcess = null;

  try {
    serverProcess = await ensureServerRunning();
    player1 = connectClient(token1);
    player2 = connectClient(token2);
    await Promise.all([
      waitForEvent(player1, "connect"),
      waitForEvent(player2, "connect")
    ]);

    const p1StatePromise = waitForEvent(player1, "match:state");
    const p2StatePromise = waitForEvent(player2, "match:state");

    player1.emit("match:queue");
    await delay(100);
    player2.emit("match:queue");

    const p1StatePayload = await p1StatePromise;
    const p2StatePayload = await p2StatePromise;

    const matchId = p1StatePayload?.matchId;
    const state0 = p1StatePayload?.state;
    assert(typeof matchId === "string" && matchId.length > 0, "matchId missing after matchmaking");
    assert(p2StatePayload?.matchId === matchId, "Players received different matchId values");
    checks.matchmaking = true;
    console.log("TEST: Match created");

    const players = Array.isArray(p1StatePayload?.players) ? p1StatePayload.players : [];
    assert(players.includes(user1.id) && players.includes(user2.id), "match players list is incomplete");
    checks.roomJoin = true;
    console.log("TEST: Players joined match");

    assert(state0?.turn === 1, "Initial turn must be 1");
    assert(state0?.activePlayer === user1.id, "Initial activePlayer should be player1");
    assert(state0?.players?.player1?.energy === 10, "Initial player1 energy should be 10");
    assert(state0?.players?.player2?.energy === 10, "Initial player2 energy should be 10");
    checks.stateInitialization = true;
    console.log("TEST: First turn initialized");

    let currentState = state0;
    for (let index = 0; index < 3; index += 1) {
      const updatePromise = waitForEvent(player1, "match:update", {
        predicate: (payload) => payload?.matchId === matchId
      });
      player1.emit("match:playCard", {
        matchId,
        cardId: cards[index].id,
        actionId: `flow-a-${index + 1}`,
        version: currentState.version
      });

      const updatePayload = await updatePromise;
      currentState = updatePayload.state;
      assert(currentState?.turnActions?.length === index + 1, `turnActions length expected ${index + 1}`);
    }
    checks.playCard = true;
    console.log("TEST: Card played successfully");

    assert(currentState.turnActions.length === 3, "Three card limit setup failed");
    checks.threeCardLimit = true;
    console.log("TEST: Three card limit reached");

    const errorPromise = waitForEvent(player1, "match:error");
    player1.emit("match:playCard", {
      matchId,
      cardId: cards[3].id,
      actionId: "flow-a-4",
      version: currentState.version
    });
    const errorPayload = await errorPromise;
    assert(errorPayload?.type === "INVALID_ACTION", "Fourth card should return INVALID_ACTION");
    console.log("TEST: Fourth card rejected");

    const endTurnPromise = waitForEvent(player1, "match:update", {
      predicate: (payload) => payload?.matchId === matchId
    });
    player1.emit("match:endTurn", {
      matchId,
      version: currentState.version
    });
    const endTurnPayload = await endTurnPromise;
    currentState = endTurnPayload.state;

    assert(currentState?.activePlayer === user2.id, "activePlayer did not switch to player2");
    assert(currentState?.turn === 2, "turn did not increment");
    assert(currentState?.players?.player2?.energy === 10, "next player energy did not reset to 10");
    checks.endTurn = true;
    console.log("TEST: Turn ended successfully");

    const p1 = currentState?.players?.player1;
    const p2 = currentState?.players?.player2;
    assert(p1?.hp <= 30 && p2?.hp <= 30, "hp out of range");
    assert(p1?.shield <= 30 && p2?.shield <= 30, "shield out of range");
    assert(p1?.energy >= 0 && p2?.energy >= 0, "energy below zero");
    assert(currentState?.version > state0.version, "version did not increment");
    checks.engineState = true;
    console.log("TEST: Engine state valid");

    console.log("GAME FLOW TEST RESULTS");
    console.log("✓ matchmaking");
    console.log("✓ room join");
    console.log("✓ state initialization");
    console.log("✓ playCard");
    console.log("✓ 3 card limit");
    console.log("✓ endTurn");
    console.log("✓ engine state");
    console.log("GAME SERVER READY");
  } catch (error) {
    console.log("TEST FAILED");
    console.log(error?.message || String(error));
    process.exitCode = 1;
  } finally {
    if (player1) {
      player1.disconnect();
    }
    if (player2) {
      player2.disconnect();
    }
    if (serverProcess && !serverProcess.killed) {
      serverProcess.kill("SIGTERM");
    }
    await db.sequelize.close().catch(() => {});
  }
}

run();
