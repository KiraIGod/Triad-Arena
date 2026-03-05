const { GAME_CONSTANTS, TRIAD_TYPES } = require("./constants");

const TRIAD_ADVANTAGE = {
  [TRIAD_TYPES.ASSAULT]: TRIAD_TYPES.ARCANE,
  [TRIAD_TYPES.ARCANE]: TRIAD_TYPES.PRECISION,
  [TRIAD_TYPES.PRECISION]: TRIAD_TYPES.ASSAULT
};

function normalizeTriadType(value) {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.toLowerCase();
  return Object.values(TRIAD_TYPES).includes(normalized) ? normalized : null;
}

function applyTriadBonus(attackerType, defenderType, damage) {
  const safeDamage = Number.isFinite(damage) ? Math.max(0, damage) : 0;
  const attacker = normalizeTriadType(attackerType);
  const defender = normalizeTriadType(defenderType);

  if (!attacker || !defender) {
    return safeDamage;
  }

  if (TRIAD_ADVANTAGE[attacker] !== defender) {
    return safeDamage;
  }

  return safeDamage + GAME_CONSTANTS.TRIAD_BONUS;
}

function applyTriadAction(state, action) {
  const baseDamage = action?.damage ?? 0;
  const damage = applyTriadBonus(action?.attackerType, action?.defenderType, baseDamage);
  return { state, action: { ...action, damage } };
}

module.exports = {
  applyTriadBonus,
  applyTriadAction
};
