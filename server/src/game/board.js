const { v4: uuidv4 } = require("uuid");

/**
 * Builds an O(1) lookup index: { [instanceId]: boardArrayIndex }
 * Rebuilt after every board mutation so it always reflects current positions.
 */
function buildUnitIndex(board) {
  const index = {};
  if (!Array.isArray(board)) return index;
  board.forEach((unit, i) => {
    if (unit?.instanceId) index[unit.instanceId] = i;
  });
  return index;
}

/**
 * Creates a fresh unit instance from a card template.
 * instanceId uses UUID v4 — no Math.random or Date.now.
 * summonedTurn is stored for replay and history.
 */
function createUnitInstance(card, ownerId, currentTurn) {
  return {
    instanceId: uuidv4(),
    cardId: card.id,
    ownerId,
    attack: Math.max(0, Number(card.attack) || 0),
    hp: Math.max(1, Number(card.hp) || 1),
    summonedTurn: Number.isFinite(currentTurn) ? currentTurn : 0,
    canAttack: false,
    hasAttacked: false,
    statuses: []
  };
}

function applyDamageToUnit(unit, damage) {
  const safeDamage = Math.max(0, Number(damage) || 0);
  return { ...unit, hp: Math.max(0, unit.hp - safeDamage) };
}

function removeDeadUnits(board) {
  if (!Array.isArray(board)) return [];
  return board.filter((unit) => unit.hp > 0);
}

/**
 * Refreshes canAttack / hasAttacked for a board when the owning player's
 * turn begins. Only called for the NEXT active player — never for both.
 */
function refreshBoardForTurn(board) {
  if (!Array.isArray(board)) return [];
  return board.map((unit) => ({ ...unit, canAttack: true, hasAttacked: false }));
}

module.exports = {
  buildUnitIndex,
  createUnitInstance,
  applyDamageToUnit,
  removeDeadUnits,
  refreshBoardForTurn
};
