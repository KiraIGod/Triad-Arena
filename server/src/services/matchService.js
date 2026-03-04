const db = require("../db/models");
const { createInitialGameState } = require("../game/gameState");
const { INVALID_ACTION, STATE_OUTDATED } = require("../game/constants");

function createError(type, message) {
  return { type, message };
}

function toVersion(value) {
  if (!Number.isFinite(value)) {
    return null;
  }

  return Math.trunc(value);
}

function getPlayerFromSocket(socket) {
  const candidates = [
    socket?.data?.userId,
    socket?.data?.user?.id,
    socket?.user?.id,
    socket?.handshake?.auth?.userId,
    socket?.handshake?.query?.userId
  ];

  const playerId = candidates.find((value) => typeof value === "string" && value.length > 0);
  return playerId || null;
}

async function ensureMatchState(match) {
  const where = { match_id: match.id };
  let matchState = await db.MatchState.findOne({ where });

  if (matchState) {
    return matchState;
  }

  const gameState = createInitialGameState(match.player_one_id, match.player_two_id);
  matchState = await db.MatchState.create({
    match_id: match.id,
    game_state: gameState
  });

  return matchState;
}

async function loadMatchState(matchId) {
  const match = await db.Match.findByPk(matchId);
  if (!match) {
    throw createError(INVALID_ACTION, "Match not found");
  }

  const matchState = await ensureMatchState(match);
  return {
    match,
    state: matchState.game_state || {},
    matchState
  };
}

async function saveMatchState(matchId, state, expectedVersion) {
  const normalizedExpected = toVersion(expectedVersion);

  return db.sequelize.transaction(async (transaction) => {
    const matchState = await db.MatchState.findOne({
      where: { match_id: matchId },
      transaction,
      lock: transaction.LOCK.UPDATE
    });

    if (!matchState) {
      throw createError(INVALID_ACTION, "Match state not found");
    }

    const currentVersion = toVersion(matchState.game_state?.version) || 0;
    if (normalizedExpected !== null && normalizedExpected !== currentVersion) {
      throw createError(STATE_OUTDATED, "Client state outdated");
    }

    await matchState.update(
      {
        game_state: state,
        updated_at: new Date()
      },
      { transaction }
    );

    return matchState.game_state;
  });
}

module.exports = {
  loadMatchState,
  saveMatchState,
  getPlayerFromSocket
};
