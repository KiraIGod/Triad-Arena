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

// ─── Type-advantage bonus ─────────────────────────────────────────────────────

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

// ─── Same-type turn combo ─────────────────────────────────────────────────────

/**
 * Counts how many cards of the same triad type the given player has already
 * played this turn (from state.playedCards), then adds 1 for the card being
 * played now. Returns the total combo count (1 = just this card, no bonus yet).
 *
 * @param {Array}  playedCards  - state.playedCards at the moment of resolution
 * @param {string} playerId
 * @param {string} triadType    - triad_type of the card currently being played
 * @returns {number}
 */
function getTriadComboCount(playedCards, playerId, triadType) {
  const normalized = normalizeTriadType(triadType);
  if (!normalized) return 1;

  const previousSameType = (playedCards || []).filter(
    (p) => p.playerId === playerId && normalizeTriadType(p.triadType) === normalized
  ).length;

  return previousSameType + 1;
}

/**
 * Applies the same-type combo bonus to base damage.
 *   comboCount=1  → no bonus
 *   comboCount=2  → +TRIAD_COMBO_BONUS_2
 *   comboCount>=3 → +TRIAD_COMBO_BONUS_3
 *
 * @param {number} baseDamage
 * @param {number} comboCount
 * @returns {number}
 */
function applyTriadComboBonus(baseDamage, comboCount) {
  const safe = Number.isFinite(baseDamage) ? Math.max(0, baseDamage) : 0;

  if (comboCount >= 3) return safe + GAME_CONSTANTS.TRIAD_COMBO_BONUS_3;
  if (comboCount >= 2) return safe + GAME_CONSTANTS.TRIAD_COMBO_BONUS_2;
  return safe;
}

module.exports = {
  applyTriadBonus,
  getTriadComboCount,
  applyTriadComboBonus
};
