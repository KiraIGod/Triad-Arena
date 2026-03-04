const db = require("../db/models");
const { playCard, endTurn } = require("../game/engine");
const { INVALID_ACTION, STATE_OUTDATED } = require("../game/constants");
const {
  loadMatchState,
  saveMatchState,
  getPlayerFromSocket
} = require("../services/matchService");

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
    throw createSocketError(INVALID_ACTION, "Game already finished");
  }

  if (state?.activePlayer !== playerId) {
    throw createSocketError(INVALID_ACTION, "Not your turn");
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

  socket.join(String(matchId));
  socket.emit("match:state", { gameState: state });
  return io;
}

async function handlePlayCard(io, socket, payload = {}) {
  const { matchId, cardId, version, actionId } = payload;
  if (!matchId || !cardId) {
    throw createSocketError(INVALID_ACTION, "matchId and cardId are required");
  }
  const incomingVersion = parseIncomingVersion(version);

  const { match, state } = await loadMatchState(matchId);
  const playerId = getPlayerFromSocket(socket);
  validateMatchAccess(match, playerId);

  if (incomingVersion !== state.version) {
    throw createSocketError(STATE_OUTDATED, "Client state outdated");
  }

  const card = await db.Card.findByPk(cardId);
  if (!card) {
    throw createSocketError(INVALID_ACTION, "Card not found");
  }

  const cardData = card.get({ plain: true });
  validateCardPlayPreconditions(state, playerId, cardData);

  const nextState = playCard(
    state,
    { playerId, expectedVersion: incomingVersion },
    { ...cardData, actionId }
  );
  const persistedState = await saveMatchState(matchId, nextState, incomingVersion);

  io.to(String(matchId)).emit("match:update", { gameState: persistedState });
  if (persistedState.finished) {
    io.to(String(matchId)).emit("match:finish", { winnerId: getWinnerId(match, persistedState) });
  }
}

async function handleEndTurn(io, socket, payload = {}) {
  const { matchId, version } = payload;
  if (!matchId) {
    throw createSocketError(INVALID_ACTION, "matchId is required");
  }
  const incomingVersion = parseIncomingVersion(version);

  const { match, state } = await loadMatchState(matchId);
  const playerId = getPlayerFromSocket(socket);
  validateMatchAccess(match, playerId);

  if (incomingVersion !== state.version) {
    throw createSocketError(STATE_OUTDATED, "Client state outdated");
  }

  const nextState = endTurn(state, { playerId, expectedVersion: incomingVersion });
  const persistedState = await saveMatchState(matchId, nextState, incomingVersion);

  io.to(String(matchId)).emit("match:update", { gameState: persistedState });
  if (persistedState.finished) {
    io.to(String(matchId)).emit("match:finish", { winnerId: getWinnerId(match, persistedState) });
  }
}

module.exports = function registerMatchSocket(io) {
  io.on("connection", (socket) => {
    socket.on("match:join", async (payload) => {
      try {
        await handleJoin(io, socket, payload);
      } catch (error) {
        emitSocketError(socket, error);
      }
    });

    socket.on("match:playCard", async (payload) => {
      try {
        await handlePlayCard(io, socket, payload);
      } catch (error) {
        emitSocketError(socket, error);
      }
    });

    socket.on("match:endTurn", async (payload) => {
      try {
        await handleEndTurn(io, socket, payload);
      } catch (error) {
        emitSocketError(socket, error);
      }
    });
  });
};
