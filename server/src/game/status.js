const { GAME_CONSTANTS, STATUS_TYPES } = require("./constants");
const { applyDamage } = require("./damage");

function getStatuses(player) {
  return Array.isArray(player?.statuses) ? player.statuses : [];
}

function getBurnDamage(player) {
  return getStatuses(player).reduce((sum, status) => {
    return status?.type === STATUS_TYPES.BURN ? sum + GAME_CONSTANTS.BURN_DAMAGE : sum;
  }, 0);
}

function sanitizeTurns(value) {
  return Number.isFinite(value) ? Math.max(0, value) : 0;
}

function sanitizeShieldAmount(value) {
  return Number.isFinite(value) ? Math.max(0, value) : 0;
}

function applyStatusEffects(state) {
  if (!state?.player1 || !state?.player2) {
    return state;
  }

  const player1 = applyDamage(state.player1, getBurnDamage(state.player1));
  const player2 = applyDamage(state.player2, getBurnDamage(state.player2));

  return {
    ...state,
    player1,
    player2
  };
}

function tickStatuses(player) {
  const statuses = getStatuses(player).map((status) => ({
    ...status,
    turns: sanitizeTurns(status?.turns) - 1
  }));

  return {
    ...player,
    statuses
  };
}

function removeExpiredStatuses(player) {
  const currentShield = Number.isFinite(player?.shield) ? Math.max(0, player.shield) : 0;
  let shieldToRemove = 0;

  const statuses = getStatuses(player).filter((status) => {
    const turns = sanitizeTurns(status?.turns);
    const expired = turns <= 0;

    if (expired && status?.type === STATUS_TYPES.SHIELD) {
      shieldToRemove += sanitizeShieldAmount(status?.amount);
    }

    return !expired;
  });

  return {
    ...player,
    shield: Math.max(0, Math.min(GAME_CONSTANTS.MAX_SHIELD, currentShield - shieldToRemove)),
    statuses
  };
}

module.exports = {
  applyStatusEffects,
  tickStatuses,
  removeExpiredStatuses
};
