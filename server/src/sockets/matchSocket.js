const db = require("../db/models");
const { playCard, endTurn } = require("../game/engine");
const { INVALID_ACTION, STATE_OUTDATED } = require("../game/constants");
const { serializeGameState } = require("../game/stateSerializer");
const { validateGameState } = require("../game/stateValidator");
const {
  loadMatchState,
  saveMatchState,
  getPlayerFromSocket,
  appendMatchEvents,
  clearMatchRuntime
} = require("../services/matchService");
const { getActiveDeckId } = require("../services/deckBuilderService");
const DEBUG_GAME_STATE = String(process.env.DEBUG_GAME_STATE || "").toLowerCase() === "true";
const RATE_LIMIT_WINDOW_MS = 1000;
const RATE_LIMIT_MAX_ACTIONS = 10;
let waitingQueueEntry = null;
const reconnectTimers = new Map();
const activeMatchByUser = new Map();
const runtimeMatchState = new Map();
const turnTimers = new Map();

function findActiveMatchByUser(userId) {
  return activeMatchByUser.get(userId) || null;
}

function getOpponentId(match, userId) {
  if (match.player_one_id === userId) return match.player_two_id;
  if (match.player_two_id === userId) return match.player_one_id;
  return null;
}

function registerActiveMatch(match) {
  activeMatchByUser.set(match.player_one_id, match);
  activeMatchByUser.set(match.player_two_id, match);
}

function unregisterActiveMatch(match) {
  activeMatchByUser.delete(match.player_one_id);
  activeMatchByUser.delete(match.player_two_id);
}

function createSocketError(type, message) {
  return { type, message };
}

function parseIncomingVersion(version) {
  const normalized = Number(version);
  if (!Number.isFinite(normalized)) {
    throw createSocketError(INVALID_ACTION, "version is required");
  }
  return normalized;
}

function emitSocketError(socket, error) {
  const type = error?.type || INVALID_ACTION;
  const message = error?.message || "Match action failed";
  socket.emit("match:error", { type, message });
}

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

async function ensurePlayerDeckId(userId) {
  return getActiveDeckId(userId);
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

function validateMatchAccess(match, playerId) {
  if (!playerId) {
    throw createSocketError(INVALID_ACTION, "Player not identified");
  }

  if (match.player_one_id !== playerId && match.player_two_id !== playerId) {
    throw createSocketError(INVALID_ACTION, "Player is not part of this match");
  }
}

function resolvePlayerState(state, playerId) {
  if (state?.player1?.id === playerId) {
    return state.player1;
  }

  if (state?.player2?.id === playerId) {
    return state.player2;
  }

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

  const actionCount = (state?.turnActions || []).filter((action) => action?.playerId === playerId).length;
  if (actionCount >= 3) {
    throw createSocketError(INVALID_ACTION, "Card limit reached for this turn");
  }

  if ((playerState.energy || 0) < card.mana_cost) {
    throw createSocketError(INVALID_ACTION, "Not enough energy");
  }
}

async function finalizeMatch(match, winnerId) {
  await db.Match.update(
    {
      status: "finished",
      winner_id: winnerId || null,
      finished_at: new Date()
    },
    { where: { id: match.id } }
  );
}

function getWinnerId(match, state) {
  const player1Hp = state?.player1?.hp ?? 0;
  const player2Hp = state?.player2?.hp ?? 0;

  if (player1Hp <= 0 && player2Hp <= 0) {
    return null;
  }

  if (player1Hp <= 0) {
    return state?.player2?.id || match.player_two_id || null;
  }

  if (player2Hp <= 0) {
    return state?.player1?.id || match.player_one_id || null;
  }

  return null;
}

function clearTurnTimer(matchId) {
  const timer = turnTimers.get(String(matchId));
  if (timer) {
    clearTimeout(timer);
    turnTimers.delete(String(matchId));
  }
}

function startTurnTimer(io, matchId, playerId) {
  clearTurnTimer(matchId);
  const timer = setTimeout(() => forceEndTurn(io, matchId, playerId), 30000);
  turnTimers.set(String(matchId), timer);
}

async function forceEndTurn(io, matchId, playerId) {
  try {
    const { match, state } = await loadMatchState(matchId);

    if (!state || state.finished || state.activePlayer !== playerId) {
      return;
    }

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
      await finalizeMatch(match, winnerId);
      unregisterActiveMatch(match);
      runtimeMatchState.delete(String(matchId));
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
      clearMatchRuntime(matchId);
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

async function validateActiveDeckSize(userId) {
  const deckId = await getActiveDeckId(userId);
  if (!deckId) {
    throw createSocketError("INVALID_DECK", "Deck must contain 20 cards");
  }
  const deckCards = await db.DeckCard.findAll({ where: { deck_id: deckId } });
  const totalCards = deckCards.reduce((sum, dc) => sum + (Number(dc.quantity) || 0), 0);
  if (totalCards !== 20) {
    throw createSocketError("INVALID_DECK", "Deck must contain 20 cards");
  }
  return deckId;
}

async function handleJoin(io, socket, payload = {}) {
  const { matchId } = payload;
  if (!matchId) {
    throw createSocketError(INVALID_ACTION, "matchId is required");
  }

  const playerId = getPlayerFromSocket(socket);
  const { match, state } = await loadMatchState(matchId);
  validateMatchAccess(match, playerId);
  const safeState = getSerializedState(matchId, state);
  console.log(`[MATCH] Player ${playerId} joined match ${matchId}`);
  if (match.player_one_id && match.player_two_id) {
    console.log(`[MATCH] Match started: ${match.player_one_id} vs ${match.player_two_id}`);
  }

  const matchRoom = io.sockets.adapter.rooms.get(String(matchId));
  if (matchRoom && matchRoom.size >= 2) {
    throw createSocketError("MATCH_FULL", "Match is full");
  }

  socket.join(String(matchId));
  socket.emit("match:state", buildMatchStatePayload(match, safeState));
  return io;
}

async function handleQueue(io, socket) {
  const playerId = getPlayerFromSocket(socket);
  if (!playerId) {
    throw createSocketError(INVALID_ACTION, "Player not identified");
  }

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
  const payload = buildMatchStatePayload(match, safeState);

  const matchId = String(match.id);
  const existingRoom = io.sockets.adapter.rooms.get(matchId);
  if (existingRoom && existingRoom.size >= 2) {
    throw createSocketError("MATCH_FULL", "Match is full");
  }

  waitingSocket.join(matchId);
  socket.join(matchId);

  waitingSocket.data.inMatch = true;
  socket.data.inMatch = true;

  waitingSocket.emit("match:state", payload);
  socket.emit("match:state", payload);

  startTurnTimer(io, matchId, safeState.activePlayer);
}

async function handlePlayCard(io, socket, payload = {}) {
  const { matchId, cardId, version, actionId } = payload;
  if (!matchId || !cardId) {
    throw createSocketError(INVALID_ACTION, "matchId and cardId are required");
  }
  const incomingVersion = parseIncomingVersion(version);
  enforceActionRateLimit(socket);
  clearTurnTimer(matchId);

  const { match, state } = await loadMatchState(matchId);
  const playerId = getPlayerFromSocket(socket);
  validateMatchAccess(match, playerId);

  if (incomingVersion !== state.version) {
    throw createSocketError(STATE_OUTDATED, "Client state outdated");
  }
  if (state?.finished) {
    throw createSocketError("MATCH_FINISHED", "Game already finished");
  }
  if (state?.activePlayer !== playerId) {
    throw createSocketError("INVALID_TURN", "Not your turn");
  }

  const card = await db.Card.findByPk(cardId);
  if (!card) {
    throw createSocketError("INVALID_CARD", "Card not found");
  }

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
    payload: { playerId, cardId, actionId: actionId || null }
  });

  if (persistedState.finished) {
    const winnerId = getWinnerId(match, persistedState);
    events.push(
      ...appendMatchEvents(matchId, {
        turn: persistedState.turn,
        type: "MATCH_FINISHED",
        payload: { winnerId }
      })
    );
    const latestAction = events.find((event) => event.type === "CARD_PLAYED");
    if (latestAction) {
      const lastTurnAction = persistedState.turnActions[persistedState.turnActions.length - 1];
      if (lastTurnAction && Number.isFinite(lastTurnAction.actionIndex)) {
        console.log(`[ACTION] Turn action #${lastTurnAction.actionIndex}`);
      }
    }
    await finalizeMatch(match, winnerId);
    unregisterActiveMatch(match);
    runtimeMatchState.delete(String(matchId));
    clearTurnTimer(matchId);
    const pendingTimerPlayCard = reconnectTimers.get(String(matchId));
    if (pendingTimerPlayCard) {
      clearTimeout(pendingTimerPlayCard);
      reconnectTimers.delete(String(matchId));
    }
    io.to(String(matchId)).emit("match:update", {
      ...buildMatchStatePayload(match, safeState),
      events
    });
    io.to(String(matchId)).emit("match:finish", { winnerId });
    clearMatchRuntime(matchId);
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

async function handleEndTurn(io, socket, payload = {}) {
  const { matchId, version } = payload;
  if (!matchId) {
    throw createSocketError(INVALID_ACTION, "matchId is required");
  }
  const incomingVersion = parseIncomingVersion(version);
  enforceActionRateLimit(socket);
  clearTurnTimer(matchId);

  const { match, state } = await loadMatchState(matchId);
  const playerId = getPlayerFromSocket(socket);
  validateMatchAccess(match, playerId);

  if (incomingVersion !== state.version) {
    throw createSocketError(STATE_OUTDATED, "Client state outdated");
  }
  if (state?.finished) {
    throw createSocketError("MATCH_FINISHED", "Game already finished");
  }
  if (state?.activePlayer !== playerId) {
    throw createSocketError("INVALID_TURN", "Not your turn");
  }
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
    const winnerId = getWinnerId(match, persistedState);
    events.push(
      ...appendMatchEvents(matchId, {
        turn: persistedState.turn,
        type: "MATCH_FINISHED",
        payload: { winnerId }
      })
    );
    await finalizeMatch(match, winnerId);
    unregisterActiveMatch(match);
    runtimeMatchState.delete(String(matchId));
    clearTurnTimer(matchId);
    const pendingTimerEndTurn = reconnectTimers.get(String(matchId));
    if (pendingTimerEndTurn) {
      clearTimeout(pendingTimerEndTurn);
      reconnectTimers.delete(String(matchId));
    }
    io.to(String(matchId)).emit("match:update", {
      ...buildMatchStatePayload(match, safeState),
      events
    });
    io.to(String(matchId)).emit("match:finish", { winnerId });
    clearMatchRuntime(matchId);
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

  const timer = reconnectTimers.get(String(match.id));
  if (timer) {
    clearTimeout(timer);
    reconnectTimers.delete(String(match.id));
  }

  socket.join(String(match.id));

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
      if (waitingQueueEntry?.socketId === socket.id || waitingQueueEntry?.userId === socket.data?.userId) {
        waitingQueueEntry = null;
        console.log(`[match:cancel] Player ${socket.data?.userId} left queue`);
      }
    });
    socket.on("match:join", wrapSocketHandler(socket, (payload) => handleJoin(io, socket, payload)));
    socket.on("match:playCard", wrapSocketHandler(socket, (payload) => handlePlayCard(io, socket, payload)));
    socket.on("match:endTurn", wrapSocketHandler(socket, (payload) => handleEndTurn(io, socket, payload)));
    socket.on("match:sync", wrapSocketHandler(socket, () => handleSync(io, socket)));
    socket.on("disconnect", () => {
      if (waitingQueueEntry?.socketId === socket.id) {
        waitingQueueEntry = null;
      }

      const userId = socket.data?.userId;
      if (!userId) return;

      const match = findActiveMatchByUser(userId);
      if (!match) return;

      const opponentId = getOpponentId(match, userId);

      if (!reconnectTimers.has(String(match.id))) {
        const timer = setTimeout(async () => {
          try {
            unregisterActiveMatch(match);
            reconnectTimers.delete(String(match.id));
            runtimeMatchState.delete(String(match.id));
            await finalizeMatch(match, opponentId);
            io.to(String(match.id)).emit("match:finish", {
              winnerId: opponentId,
              reason: "disconnect"
            });
            clearMatchRuntime(match.id);
          } catch (err) {
            console.error("[reconnect:timeout] failed:", err?.message || err);
          }
        }, 30000);

        reconnectTimers.set(String(match.id), timer);
      }
    });
  });
};
