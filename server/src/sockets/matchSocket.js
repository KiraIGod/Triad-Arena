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
const DEBUG_GAME_STATE = String(process.env.DEBUG_GAME_STATE || "").toLowerCase() === "true";
const RATE_LIMIT_WINDOW_MS = 1000;
const RATE_LIMIT_MAX_ACTIONS = 10;

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

  socket.join(String(matchId));
  socket.emit("match:state", { state: safeState });
  return io;
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
    io.to(String(matchId)).emit("match:update", { state: safeState, events });
    io.to(String(matchId)).emit("match:finish", { winnerId });
    clearMatchRuntime(matchId);
    return;
  }

  const lastTurnAction = persistedState.turnActions[persistedState.turnActions.length - 1];
  if (lastTurnAction && Number.isFinite(lastTurnAction.actionIndex)) {
    console.log(`[ACTION] Turn action #${lastTurnAction.actionIndex}`);
  }
  io.to(String(matchId)).emit("match:update", { state: safeState, events });
}

async function handleEndTurn(io, socket, payload = {}) {
  const { matchId, version } = payload;
  if (!matchId) {
    throw createSocketError(INVALID_ACTION, "matchId is required");
  }
  const incomingVersion = parseIncomingVersion(version);
  enforceActionRateLimit(socket);

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
    io.to(String(matchId)).emit("match:update", { state: safeState, events });
    io.to(String(matchId)).emit("match:finish", { winnerId });
    clearMatchRuntime(matchId);
    return;
  }

  io.to(String(matchId)).emit("match:update", { state: safeState, events });
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
    socket.on("match:join", wrapSocketHandler(socket, (payload) => handleJoin(io, socket, payload)));
    socket.on("match:playCard", wrapSocketHandler(socket, (payload) => handlePlayCard(io, socket, payload)));
    socket.on("match:endTurn", wrapSocketHandler(socket, (payload) => handleEndTurn(io, socket, payload)));
  });
};
