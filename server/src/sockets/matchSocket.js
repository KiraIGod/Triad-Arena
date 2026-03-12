const db = require("../db/models");
const { playCard, attack, endTurn } = require("../game/engine");
const { INVALID_ACTION, STATE_OUTDATED } = require("../game/constants");
const { serializeGameState } = require("../game/stateSerializer");
const { validateGameState } = require("../game/stateValidator");
const { enqueueMatchAction, clearMatchQueue } = require("../game/actionQueue");
const {
  loadMatchState,
  saveMatchState,
  getPlayerFromSocket,
  appendMatchEvents,
  clearMatchRuntime
} = require("../services/matchService");
const { getActiveDeckId } = require("../services/deckBuilderService");
const {
  registerActiveMatch,
  unregisterActiveMatch,
  findActiveMatchByUser
} = require("../services/activeMatchTracker");

const DEBUG_GAME_STATE = String(process.env.DEBUG_GAME_STATE || "").toLowerCase() === "true";
const RATE_LIMIT_WINDOW_MS = 1000;
const RATE_LIMIT_MAX_ACTIONS = 10;

let waitingQueueEntry = null;
const reconnectTimers = new Map();
const runtimeMatchState = new Map();
const turnTimers = new Map();

// Tracks players that reconnected on a new socket before their old socket fired "disconnect".
// Used to prevent the old socket's disconnect from starting the 30-second defeat timer.
const reconnectedPlayers = new Set();

// ─── Match tracking helpers ───────────────────────────────────────────────────

function getOpponentId(match, userId) {
  if (String(match.player_one_id) === String(userId)) return match.player_two_id;
  if (String(match.player_two_id) === String(userId)) return match.player_one_id;
  return null;
}

// ─── Error helpers ────────────────────────────────────────────────────────────

function createSocketError(type, message) {
  return { type, message };
}

function emitSocketError(socket, error) {
  const type = error?.type || INVALID_ACTION;
  const message = error?.message || "Match action failed";
  socket.emit("match:error", { type, message });
}

// ─── Version / rate-limit guards ─────────────────────────────────────────────

function parseIncomingVersion(version) {
  const normalized = Number(version);
  if (!Number.isFinite(normalized)) {
    throw createSocketError(INVALID_ACTION, "version is required");
  }
  return normalized;
}

function enforceActionRateLimit(socket) {
  const now = Date.now();
  const windowStart = now - RATE_LIMIT_WINDOW_MS;
  const history = Array.isArray(socket?.data?.matchActionHistory)
    ? socket.data.matchActionHistory.filter((stamp) => stamp > windowStart)
    : [];

  if (history.length >= RATE_LIMIT_MAX_ACTIONS) {
    throw createSocketError("RATE_LIMIT", "Too many actions");
  }

  history.push(now);
  socket.data.matchActionHistory = history;
}

// ─── State serialization ──────────────────────────────────────────────────────

function getSerializedState(matchId, gameState) {
  const safeState = serializeGameState({ ...(gameState || {}), matchId: String(matchId) });
  validateGameState(safeState);
  if (DEBUG_GAME_STATE) {
    console.log("GAME STATE UPDATE", safeState);
  }
  return safeState;
}

function buildMatchStatePayload(match, safeState) {
  return {
    matchId: String(match.id),
    players: [match.player_one_id, match.player_two_id].filter(Boolean),
    state: safeState
  };
}

// ─── Deck / access validators ─────────────────────────────────────────────────

async function ensurePlayerDeckId(userId) {
  return getActiveDeckId(userId);
}

function validateMatchAccess(match, playerId) {
  if (!playerId) {
    throw createSocketError(INVALID_ACTION, "Player not identified");
  }
  if (match.player_one_id !== playerId && match.player_two_id !== playerId) {
    throw createSocketError(INVALID_ACTION, "Player is not part of this match");
  }
}

function resolvePlayerState(state, playerId) {
  if (state?.player1?.id === playerId) return state.player1;
  if (state?.player2?.id === playerId) return state.player2;
  return null;
}

function validateCardPlayPreconditions(state, playerId, card) {
  if (state?.finished) {
    throw createSocketError("MATCH_FINISHED", "Game already finished");
  }
  if (state?.activePlayer !== playerId) {
    throw createSocketError("INVALID_TURN", "Not your turn");
  }

  const playerState = resolvePlayerState(state, playerId);
  if (!playerState) {
    throw createSocketError(INVALID_ACTION, "Invalid player");
  }

  const actionCount = (state?.turnActions || []).filter((a) => a?.playerId === playerId).length;
  if (actionCount >= 3) {
    throw createSocketError(INVALID_ACTION, "Card limit reached for this turn");
  }

  if ((playerState.energy || 0) < card.mana_cost) {
    throw createSocketError(INVALID_ACTION, "Not enough energy");
  }
}

async function validateActiveDeckSize(userId) {
  const deckId = await getActiveDeckId(userId);
  if (!deckId) {
    throw createSocketError("INVALID_DECK", "Deck must contain 20 cards");
  }

  const rawDeckCards = await db.DeckCard.findAll({ where: { deck_id: deckId } });
  const rawTotalCards = rawDeckCards.reduce((sum, dc) => sum + (Number(dc.quantity) || 0), 0);

  const validDeckCards = await db.DeckCard.findAll({
    where: { deck_id: deckId },
    include: [{ model: db.Card, required: true }]
  });
  const validTotalCards = validDeckCards.reduce((sum, dc) => sum + (Number(dc.quantity) || 0), 0);

  if (rawTotalCards !== 20 || validTotalCards !== 20) {
    throw createSocketError("INVALID_DECK", "Deck must contain 20 cards");
  }
  return deckId;
}

// ─── Match lifecycle ──────────────────────────────────────────────────────────

async function finalizeMatch(match, winnerId, state) {
  const now = new Date();

  await db.Match.update(
    {
      status: "finished",
      winner_id: winnerId || null,
      finished_at: now
    },
    { where: { id: match.id } }
  );

  try {
    await db.MatchHistory.create({
      match_id: match.id,
      player_one_id: match.player_one_id,
      player_two_id: match.player_two_id,
      winner_id: winnerId || null,
      total_turns: state?.turn ?? 0,
      player_one_final_hp: state?.player1?.hp ?? 0,
      player_two_final_hp: state?.player2?.hp ?? 0,
      finished_at: now
    });
  } catch (err) {
    console.error("[finalizeMatch] Failed to create MatchHistory:", err?.message || err);
  }
}

function getWinnerId(match, state) {
  const player1Hp = state?.player1?.hp ?? 0;
  const player2Hp = state?.player2?.hp ?? 0;

  if (player1Hp <= 0 && player2Hp <= 0) return null;
  if (player1Hp <= 0) return state?.player2?.id || match.player_two_id || null;
  if (player2Hp <= 0) return state?.player1?.id || match.player_one_id || null;
  return null;
}

function clearSocketMatchRuntime(matchId) {
  clearMatchQueue(matchId);
  runtimeMatchState.delete(String(matchId));
  clearMatchRuntime(matchId);
}

async function cleanupFinishedMatch(io, match, persistedState, safeState, matchId, events) {
  const winnerId = getWinnerId(match, persistedState);
  events.push(
    ...appendMatchEvents(matchId, {
      turn: persistedState.turn,
      type: "MATCH_FINISHED",
      payload: { winnerId }
    })
  );
  await finalizeMatch(match, winnerId, persistedState);
  unregisterActiveMatch(match);
  clearSocketMatchRuntime(matchId);
  clearTurnTimer(matchId);

  const pendingTimer = reconnectTimers.get(String(matchId));
  if (pendingTimer) {
    clearTimeout(pendingTimer);
    reconnectTimers.delete(String(matchId));
  }

  io.to(String(matchId)).emit("match:update", {
    ...buildMatchStatePayload(match, safeState),
    events
  });
  io.to(String(matchId)).emit("match:finish", { winnerId });
  clearSocketMatchRuntime(matchId);
}

// ─── Turn timer ───────────────────────────────────────────────────────────────

const TURN_DURATION = 45;

function clearTurnTimer(matchId) {
  const entry = turnTimers.get(String(matchId));
  if (entry) {
    clearInterval(entry.interval);
    turnTimers.delete(String(matchId));
  }
}

function startTurnTimer(io, matchId, playerId) {
  clearTurnTimer(matchId);

  // Use wall-clock time so the remaining value stays accurate even under server load.
  const turnStartedAt = Date.now();
  const getRemaining = () => {
    const elapsed = Math.floor((Date.now() - turnStartedAt) / 1000);
    return Math.max(0, TURN_DURATION - elapsed);
  };

  io.to(String(matchId)).emit("match:timer", { remaining: TURN_DURATION });

  const interval = setInterval(() => {
    const remaining = getRemaining();
    io.to(String(matchId)).emit("match:timer", { remaining });

    if (remaining <= 0) {
      clearInterval(interval);
      turnTimers.delete(String(matchId));
      forceEndTurn(io, matchId, playerId).catch((err) =>
        console.error("[turnTimer] forceEndTurn failed:", err?.message || err)
      );
    }
  }, 1000);

  turnTimers.set(String(matchId), { interval, getRemaining });
}

async function forceEndTurn(io, matchId, playerId) {
  try {
    const { match, state } = await loadMatchState(matchId);
    if (!state || state.finished || state.activePlayer !== playerId) return;

    const nextState = endTurn(state, { playerId, expectedVersion: state.version });
    const persistedState = await saveMatchState(matchId, nextState, state.version);
    const safeState = getSerializedState(matchId, persistedState);
    runtimeMatchState.set(String(matchId), safeState);

    appendMatchEvents(matchId, {
      turn: state.turn,
      type: "TURN_ENDED",
      payload: { playerId, forced: true, nextActivePlayer: safeState.activePlayer }
    });

    if (persistedState.finished) {
      const winnerId = getWinnerId(match, persistedState);
      await finalizeMatch(match, winnerId, persistedState);
      unregisterActiveMatch(match);
      clearSocketMatchRuntime(matchId);
      clearTurnTimer(matchId);
      const pendingTimer = reconnectTimers.get(String(matchId));
      if (pendingTimer) {
        clearTimeout(pendingTimer);
        reconnectTimers.delete(String(matchId));
      }
      io.to(String(matchId)).emit("match:update", {
        ...buildMatchStatePayload(match, safeState),
        events: [{ type: "TURN_TIMEOUT" }]
      });
      io.to(String(matchId)).emit("match:finish", { winnerId });
      clearSocketMatchRuntime(matchId);
      return;
    }

    io.to(String(matchId)).emit("match:update", {
      ...buildMatchStatePayload(match, safeState),
      events: [{ type: "TURN_TIMEOUT" }]
    });
    startTurnTimer(io, matchId, safeState.activePlayer);
  } catch (err) {
    console.error("[turnTimer] forceEndTurn failed:", err?.message || err);
  }
}

// ─── Socket handlers ──────────────────────────────────────────────────────────

async function handleJoin(io, socket, payload = {}) {
  const { matchId } = payload;
  if (!matchId) throw createSocketError(INVALID_ACTION, "matchId is required");

  const playerId = getPlayerFromSocket(socket);
  const { match, state } = await loadMatchState(matchId);
  validateMatchAccess(match, playerId);

  const safeState = getSerializedState(matchId, state);
  console.log(`[MATCH] Player ${playerId} joined match ${matchId}`);
  if (match.player_one_id && match.player_two_id) {
    console.log(`[MATCH] Match started: ${match.player_one_id} vs ${match.player_two_id}`);
  }

  const matchRoom = io.sockets.adapter.rooms.get(String(matchId));
  if (matchRoom && matchRoom.size >= 2 && !matchRoom.has(socket.id)) {
    throw createSocketError("MATCH_FULL", "Match is full");
  }

  socket.join(String(matchId));
  socket.emit("match:state", buildMatchStatePayload(match, safeState));
}

async function handleQueue(io, socket) {
  const playerId = getPlayerFromSocket(socket);
  if (!playerId) throw createSocketError(INVALID_ACTION, "Player not identified");

  if (socket.data.inMatch || findActiveMatchByUser(playerId)) {
    throw createSocketError(INVALID_ACTION, "Already in a match");
  }

  if (waitingQueueEntry?.userId === playerId) {
    socket.emit("match:searching");
    return;
  }

  await validateActiveDeckSize(playerId);

  if (!waitingQueueEntry) {
    waitingQueueEntry = { socketId: socket.id, userId: playerId, queuedAt: Date.now() };
    socket.emit("match:searching");
    return;
  }

  const waitingSocket = io.sockets.sockets.get(waitingQueueEntry.socketId);
  if (!waitingSocket || !waitingSocket.connected || waitingQueueEntry.userId === playerId) {
    waitingQueueEntry = { socketId: socket.id, userId: playerId, queuedAt: Date.now() };
    socket.emit("match:searching");
    return;
  }

  const playerOneId = waitingQueueEntry.userId;
  const playerTwoId = playerId;
  waitingQueueEntry = null;

  const [playerOneDeckId, playerTwoDeckId] = await Promise.all([
    ensurePlayerDeckId(playerOneId),
    ensurePlayerDeckId(playerTwoId)
  ]);

  const match = await db.Match.create({
    player_one_id: playerOneId,
    player_two_id: playerTwoId,
    player_one_deck_id: playerOneDeckId,
    player_two_deck_id: playerTwoDeckId,
    status: "active",
    started_at: new Date()
  });

  registerActiveMatch(match);

  const { state } = await loadMatchState(match.id);
  const safeState = getSerializedState(match.id, state);
  runtimeMatchState.set(String(match.id), safeState);
  const matchPayload = buildMatchStatePayload(match, safeState);

  const matchId = String(match.id);
  const existingRoom = io.sockets.adapter.rooms.get(matchId);
  if (existingRoom && existingRoom.size >= 2) {
    throw createSocketError("MATCH_FULL", "Match is full");
  }

  waitingSocket.join(matchId);
  socket.join(matchId);
  waitingSocket.data.inMatch = true;
  socket.data.inMatch = true;

  waitingSocket.emit("match:state", matchPayload);
  socket.emit("match:state", matchPayload);

  startTurnTimer(io, matchId, safeState.activePlayer);
}

async function handlePlayCard(io, socket, payload = {}) {
  const { matchId, cardId, version, actionId } = payload;
  if (!matchId || !cardId) {
    throw createSocketError(INVALID_ACTION, "matchId and cardId are required");
  }

  const incomingVersion = parseIncomingVersion(version);
  enforceActionRateLimit(socket);

  const { match, state } = await loadMatchState(matchId);
  const playerId = getPlayerFromSocket(socket);
  validateMatchAccess(match, playerId);

  if (incomingVersion !== state.version) {
    throw createSocketError(STATE_OUTDATED, "Client state outdated");
  }
  if (state?.finished) throw createSocketError("MATCH_FINISHED", "Game already finished");
  if (state?.activePlayer !== playerId) throw createSocketError("INVALID_TURN", "Not your turn");

  const card = await db.Card.findByPk(cardId);
  if (!card) throw createSocketError("INVALID_CARD", "Card not found");

  const cardData = card.get({ plain: true });
  validateCardPlayPreconditions(state, playerId, cardData);
  console.log(`[ACTION] ${playerId} played card ${cardId}`);

  const nextState = playCard(
    state,
    { playerId, expectedVersion: incomingVersion },
    { ...cardData, actionId }
  );
  const persistedState = await saveMatchState(matchId, nextState, incomingVersion);
  const safeState = getSerializedState(matchId, persistedState);
  runtimeMatchState.set(String(matchId), safeState);

  const events = appendMatchEvents(matchId, {
    turn: state.turn,
    type: "CARD_PLAYED",
    payload: {
      playerId,
      cardId,
      actionId: actionId || null,
      card: {
        id: cardData.id,
        name: cardData.name,
        type: cardData.type,
        triad_type: cardData.triad_type,
        mana_cost: cardData.mana_cost,
        attack: cardData.attack,
        hp: cardData.hp,
        description: cardData.description,
        image: cardData.image,
        created_at: cardData.created_at
      }
    }
  });

  if (persistedState.finished) {
    await cleanupFinishedMatch(io, match, persistedState, safeState, matchId, events);
    return;
  }

  const lastTurnAction = persistedState.turnActions[persistedState.turnActions.length - 1];
  if (lastTurnAction && Number.isFinite(lastTurnAction.actionIndex)) {
    console.log(`[ACTION] Turn action #${lastTurnAction.actionIndex}`);
  }

  io.to(String(matchId)).emit("match:update", {
    ...buildMatchStatePayload(match, safeState),
    events
  });
}

async function handleAttack(io, socket, payload = {}) {
  const { matchId, unitId, targetType, targetId, actionId, version } = payload;

  if (!matchId) throw createSocketError(INVALID_ACTION, "matchId is required");
  if (!unitId) throw createSocketError(INVALID_ACTION, "unitId is required");
  if (!targetType) throw createSocketError(INVALID_ACTION, "targetType is required");
  if (!targetId) throw createSocketError(INVALID_ACTION, "targetId is required");
  if (!actionId) throw createSocketError(INVALID_ACTION, "actionId is required");

  const incomingVersion = parseIncomingVersion(version);
  enforceActionRateLimit(socket);

  const { match, state } = await loadMatchState(matchId);
  const playerId = getPlayerFromSocket(socket);
  validateMatchAccess(match, playerId);

  if (incomingVersion !== state.version) {
    throw createSocketError(STATE_OUTDATED, "Client state outdated");
  }
  if (state?.finished) throw createSocketError("MATCH_FINISHED", "Game already finished");
  if (state?.activePlayer !== playerId) throw createSocketError("INVALID_TURN", "Not your turn");

  console.log(`[ATTACK] ${playerId} attacking with ${unitId} → ${targetType}:${targetId}`);

  const nextState = attack(
    state,
    { playerId, expectedVersion: incomingVersion },
    { unitId, targetType, targetId, actionId, version: incomingVersion }
  );
  const persistedState = await saveMatchState(matchId, nextState, incomingVersion);
  const safeState = getSerializedState(matchId, persistedState);
  runtimeMatchState.set(String(matchId), safeState);

  const events = appendMatchEvents(matchId, {
    turn: state.turn,
    type: "UNIT_ATTACKED",
    payload: { playerId, unitId, targetType, targetId, actionId }
  });

  if (persistedState.finished) {
    await cleanupFinishedMatch(io, match, persistedState, safeState, matchId, events);
    return;
  }

  io.to(String(matchId)).emit("match:update", {
    ...buildMatchStatePayload(match, safeState),
    events
  });
}

async function handleEndTurn(io, socket, payload = {}) {
  const { matchId, version } = payload;
  if (!matchId) throw createSocketError(INVALID_ACTION, "matchId is required");

  const incomingVersion = parseIncomingVersion(version);
  enforceActionRateLimit(socket);
  clearTurnTimer(matchId);

  const { match, state } = await loadMatchState(matchId);
  const playerId = getPlayerFromSocket(socket);
  validateMatchAccess(match, playerId);

  if (incomingVersion !== state.version) {
    throw createSocketError(STATE_OUTDATED, "Client state outdated");
  }
  if (state?.finished) throw createSocketError("MATCH_FINISHED", "Game already finished");
  if (state?.activePlayer !== playerId) throw createSocketError("INVALID_TURN", "Not your turn");

  console.log(`[TURN] ${playerId} ended turn`);

  const nextState = endTurn(state, { playerId, expectedVersion: incomingVersion });
  const persistedState = await saveMatchState(matchId, nextState, incomingVersion);
  const safeState = getSerializedState(matchId, persistedState);
  runtimeMatchState.set(String(matchId), safeState);

  const events = appendMatchEvents(matchId, {
    turn: state.turn,
    type: "TURN_ENDED",
    payload: { playerId, nextActivePlayer: safeState.activePlayer }
  });

  if (persistedState.finished) {
    await cleanupFinishedMatch(io, match, persistedState, safeState, matchId, events);
    return;
  }

  io.to(String(matchId)).emit("match:update", {
    ...buildMatchStatePayload(match, safeState),
    events
  });

  startTurnTimer(io, matchId, safeState.activePlayer);
}

async function handleSync(io, socket) {
  const userId = socket.data?.userId;
  if (!userId) return;

  const match = findActiveMatchByUser(userId);
  if (!match) return;

  // Cancel any existing defeat timer that was already started (normal reconnect path).
  const pendingTimer = reconnectTimers.get(String(match.id));
  if (pendingTimer) {
    clearTimeout(pendingTimer);
    reconnectTimers.delete(String(match.id));
    console.log(`[reconnect] Cancelled defeat timer for player ${userId} match ${match.id}`);
  }

  // Restore socket room membership so the player receives broadcasts again.
  socket.join(String(match.id));

  // Guard against the race condition where this sync fires BEFORE the old socket's
  // "disconnect" event. Marking the player here prevents disconnect from re-starting
  // the defeat timer. The mark auto-expires after 10 s to avoid a memory leak.
  reconnectedPlayers.add(String(userId));
  setTimeout(() => reconnectedPlayers.delete(String(userId)), 10_000);

  console.log(`[reconnect] Player ${userId} rejoined match ${match.id}`);

  // Immediately send the current timer so the client UI is in sync.
  const timerEntry = turnTimers.get(String(match.id));
  if (timerEntry) {
    socket.emit("match:timer", { remaining: timerEntry.getRemaining() });
  }

  // Restore latest match state.
  const cachedState = runtimeMatchState.get(String(match.id));
  if (cachedState) {
    socket.emit("match:state", buildMatchStatePayload(match, cachedState));
    return;
  }

  const { state } = await loadMatchState(match.id);
  const safeState = getSerializedState(match.id, state);
  runtimeMatchState.set(String(match.id), safeState);
  socket.emit("match:state", buildMatchStatePayload(match, safeState));
}

async function handleLeave(io, socket, payload = {}) {
  const matchId = String(payload?.matchId || "");
  if (!matchId) throw createSocketError(INVALID_ACTION, "matchId is required");

  const playerId = getPlayerFromSocket(socket);
  const match = await db.Match.findByPk(matchId);
  if (!match) throw createSocketError(INVALID_ACTION, "Match not found");

  validateMatchAccess(match, playerId);
  const opponentId = getOpponentId(match, playerId);

  socket.leave(matchId);
  socket.data.inMatch = false;
  console.log(`[MATCH] Player ${socket.data?.userId || "unknown"} left match ${matchId}`);

  if (match.status === "finished") return;

  clearTurnTimer(matchId);
  const reconnectTimer = reconnectTimers.get(String(matchId));
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimers.delete(String(matchId));
  }

  let leaveState = null;
  try {
    const loaded = await loadMatchState(matchId);
    leaveState = loaded.state;
  } catch (_) {}

  await finalizeMatch(match, opponentId, leaveState);
  unregisterActiveMatch(match);
  clearSocketMatchRuntime(matchId);

  socket.to(matchId).emit("match:finish", {
    winnerId: opponentId || null,
    reason: "opponent_left",
    message: "Opponent cowardly left the arena"
  });
}

// ─── Wrapper & registration ───────────────────────────────────────────────────

function wrapSocketHandler(socket, handler) {
  return async (payload) => {
    try {
      await handler(payload);
    } catch (error) {
      emitSocketError(socket, error);
    }
  };
}

module.exports = function registerMatchSocket(io) {
  io.on("connection", (socket) => {
    socket.data.matchActionHistory = [];

    socket.on("match:queue", wrapSocketHandler(socket, () => handleQueue(io, socket)));

    socket.on("match:cancel", () => {
      if (
        waitingQueueEntry?.socketId === socket.id ||
        waitingQueueEntry?.userId === socket.data?.userId
      ) {
        waitingQueueEntry = null;
        console.log(`[match:cancel] Player ${socket.data?.userId} left queue`);
      }
    });

    socket.on("match:join", wrapSocketHandler(socket, (payload) => handleJoin(io, socket, payload)));
    socket.on("match:leave", wrapSocketHandler(socket, (payload) => handleLeave(io, socket, payload)));

    socket.on(
      "match:playCard",
      wrapSocketHandler(socket, (payload) =>
        enqueueMatchAction(payload?.matchId, () => handlePlayCard(io, socket, payload))
      )
    );

    socket.on(
      "match:attack",
      wrapSocketHandler(socket, (payload) =>
        enqueueMatchAction(payload?.matchId, () => handleAttack(io, socket, payload))
      )
    );

    socket.on(
      "match:endTurn",
      wrapSocketHandler(socket, (payload) =>
        enqueueMatchAction(payload?.matchId, () => handleEndTurn(io, socket, payload))
      )
    );

    socket.on("match:sync", wrapSocketHandler(socket, () => handleSync(io, socket)));

    socket.on("match:check-active", (callback) => {
      const userId = socket.data?.userId;
      if (!userId || typeof callback !== "function") return;

      const match = findActiveMatchByUser(userId);
      if (match) {
        callback({ hasActiveMatch: true, matchId: String(match.id) });
      } else {
        callback({ hasActiveMatch: false, matchId: null });
      }
    });

    socket.on("disconnect", () => {
      if (waitingQueueEntry?.socketId === socket.id) {
        waitingQueueEntry = null;
      }

      const userId = socket.data?.userId;
      if (!userId) return;

      const match = findActiveMatchByUser(userId);
      if (!match) return;

      // If the player already reconnected on a new socket (race condition: sync fired before
      // this disconnect event), skip the defeat timer entirely.
      if (reconnectedPlayers.has(String(userId))) {
        reconnectedPlayers.delete(String(userId));
        console.log(`[disconnect] Player ${userId} reconnected on new socket — skipping defeat timer for match ${match.id}`);
        return;
      }

      const opponentId = getOpponentId(match, userId);

      if (!reconnectTimers.has(String(match.id))) {
        const timer = setTimeout(async () => {
          try {
            let dcState = null;
            try {
              const loaded = await loadMatchState(match.id);
              dcState = loaded.state;
            } catch (_) {}

            unregisterActiveMatch(match);
            reconnectTimers.delete(String(match.id));
            clearSocketMatchRuntime(match.id);
            await finalizeMatch(match, opponentId, dcState);
            io.to(String(match.id)).emit("match:finish", {
              winnerId: opponentId,
              reason: "disconnect"
            });
            clearSocketMatchRuntime(match.id);
          } catch (err) {
            console.error("[reconnect:timeout] failed:", err?.message || err);
          }
        }, 30000);

        reconnectTimers.set(String(match.id), timer);
      }
    });
  });
};
