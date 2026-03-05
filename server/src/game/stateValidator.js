const { GAME_CONSTANTS } = require("./constants");

function createError(message) {
  const error = new Error(message);
  error.type = "INVALID_STATE";
  return error;
}

function assertNumber(value, field) {
  if (!Number.isFinite(value)) {
    throw createError(`Invalid state field: ${field}`);
  }
}

function validatePlayer(player, key) {
  if (!player || typeof player !== "object") {
    throw createError(`Missing player state: ${key}`);
  }

  assertNumber(player.hp, `${key}.hp`);
  assertNumber(player.shield, `${key}.shield`);
  assertNumber(player.energy, `${key}.energy`);

  if (player.hp < 0 || player.hp > GAME_CONSTANTS.MAX_HP) {
    throw createError(`Out of range hp: ${key}.hp`);
  }

  if (player.shield < 0 || player.shield > GAME_CONSTANTS.MAX_SHIELD) {
    throw createError(`Out of range shield: ${key}.shield`);
  }

  if (player.energy < 0) {
    throw createError(`Out of range energy: ${key}.energy`);
  }
}

function validateGameState(state) {
  if (!state || typeof state !== "object") {
    throw createError("State is required");
  }

  assertNumber(state.version, "version");
  assertNumber(state.turn, "turn");
  if (typeof state.activePlayer !== "string" || state.activePlayer.length === 0) {
    throw createError("Invalid state field: activePlayer");
  }

  const players = state.players;
  if (!players || typeof players !== "object") {
    throw createError("Invalid state field: players");
  }

  validatePlayer(players.player1, "players.player1");
  validatePlayer(players.player2, "players.player2");

  if (!Array.isArray(state.turnActions)) {
    throw createError("Invalid state field: turnActions");
  }

  if (typeof state.finished !== "boolean") {
    throw createError("Invalid state field: finished");
  }

  return true;
}

module.exports = {
  validateGameState
};
