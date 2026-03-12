const GAME_CONSTANTS = {
  MAX_PLAYERS: 2,
  MAX_HP: 30,
  MAX_SHIELD: 30,
  ENERGY_PER_TURN: 10,
  MAX_CARDS_PER_TURN: 3,
  MAX_BOARD: 5,
  MAX_HAND: 10,
  BURN_DAMAGE: 2,
  // Type-advantage bonus (attacker type beats defender type)
  TRIAD_BONUS: 2,
  // Same-type combo bonus: playing N cards of the same triad_type in one turn
  TRIAD_COMBO_BONUS_2: 2,  // 2 same-type cards → +2 damage
  TRIAD_COMBO_BONUS_3: 4   // 3 same-type cards → +4 damage
};

const STATUS_TYPES = {
  BURN: "burn",
  WEAK: "weak",
  STUN: "stun",
  SHIELD: "shield"
};

const TRIAD_TYPES = {
  ASSAULT: "assault",
  PRECISION: "precision",
  ARCANE: "arcane"
};

const INVALID_ACTION = "INVALID_ACTION";
const STATE_OUTDATED = "STATE_OUTDATED";
const DUPLICATE_ACTION = "DUPLICATE_ACTION";

module.exports = {
  GAME_CONSTANTS,
  STATUS_TYPES,
  TRIAD_TYPES,
  INVALID_ACTION,
  STATE_OUTDATED,
  DUPLICATE_ACTION
};
