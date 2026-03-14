const { GAME_CONSTANTS } = require("./constants");

function toNonNegativeNumber(value) {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return Math.max(0, value);
}

function applyDamage(defender, damage) {
  const safeDefender = defender || {};
  const incomingDamage = toNonNegativeNumber(damage);
  const initialShield = toNonNegativeNumber(safeDefender.shield);
  const initialHp = toNonNegativeNumber(safeDefender.hp);

  const absorbed = Math.min(initialShield, incomingDamage);
  const shield = Math.max(0, initialShield - absorbed);
  const hpDamage = incomingDamage - absorbed;
  const hp = Math.max(0, initialHp - hpDamage);

  return {
    ...safeDefender,
    shield: Math.min(shield, GAME_CONSTANTS.MAX_SHIELD),
    hp: Math.min(hp, GAME_CONSTANTS.MAX_HP)
  };
}

module.exports = {
  applyDamage
};
