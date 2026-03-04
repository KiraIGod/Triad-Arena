const {
  GAME_CONSTANTS,
  INVALID_ACTION,
  STATE_OUTDATED,
  STATUS_TYPES
} = require("./constants");
const { applyDamage } = require("./damage");
const { applyTriadBonus } = require("./triad");
const { resolveTurn } = require("./turn");

const VALID_STATUS_TYPES = new Set(Object.values(STATUS_TYPES));
const VALID_CARD_TYPES = new Set(["unit", "spell"]);
const VALID_TRIAD_TYPES = new Set(["assault", "precision", "arcane"]);

function createError(type, message) {
  return { type, message };
}

function failInvalid(message) {
  throw createError(INVALID_ACTION, message);
}

function failOutdated() {
  throw createError(STATE_OUTDATED, "Client state outdated");
}

function withSafety(handler) {
  try {
    return handler();
  } catch (error) {
    if (error?.type === INVALID_ACTION || error?.type === STATE_OUTDATED) {
      throw error;
    }
    throw createError(INVALID_ACTION, "Unexpected engine error");
  }
}

function getPlayerKey(state, playerId) {
  if (state?.player1?.id === playerId) return "player1";
  if (state?.player2?.id === playerId) return "player2";
  return null;
}

function getOpponentKey(playerKey) {
  return playerKey === "player1" ? "player2" : "player1";
}

function parseActorInput(input) {
  if (typeof input === "string") return { playerId: input, expectedVersion: undefined };
  if (input && typeof input === "object") {
    return {
      playerId: input.playerId || input.id,
      expectedVersion: input.expectedVersion ?? input.stateVersion ?? input.version
    };
  }
  return { playerId: undefined, expectedVersion: undefined };
}

function validateVersion(expectedVersion, currentVersion) {
  if (!Number.isFinite(expectedVersion)) return;
  if (expectedVersion !== currentVersion) failOutdated();
}

function validatePlayableState(state, playerId, expectedVersion) {
  if (!state?.player1 || !state?.player2) failInvalid("Invalid game state");
  if (state.finished) failInvalid("Game already finished");
  validateVersion(expectedVersion, state.version);

  const playerKey = getPlayerKey(state, playerId);
  if (!playerKey) failInvalid("Invalid player");
  if (state.activePlayer !== playerId) failInvalid("Not your turn");
  if ((state[playerKey]?.statuses || []).some((status) => status?.type === STATUS_TYPES.STUN)) {
    failInvalid("Player is stunned");
  }
  return playerKey;
}

function getCardTriadType(card) {
  return card?.triad_type ?? card?.triadType ?? null;
}

function validateCard(card) {
  if (!card?.id) failInvalid("Card is required");
  if (!VALID_CARD_TYPES.has(card.type)) failInvalid("Invalid card type");
  if (!VALID_TRIAD_TYPES.has(getCardTriadType(card))) failInvalid("Invalid card triad type");
}

function getCardManaCost(card) {
  const manaCost = card?.mana_cost ?? card?.manaCost;
  if (!Number.isFinite(manaCost)) failInvalid("Invalid card mana_cost");
  return Math.max(0, manaCost);
}

function getCardBaseDamage(card) {
  const explicit = card?.damage ?? card?.base_damage;
  if (Number.isFinite(explicit)) return Math.max(0, explicit);
  if (Number.isFinite(card?.attack)) return Math.max(0, card.attack);
  return 0;
}

function getWeakPenalty(player) {
  return (player?.statuses || []).filter((status) => status?.type === STATUS_TYPES.WEAK).length;
}

function getDefenderTriadType(state, opponentId, card) {
  const manual = card?.defenderTriadType ?? card?.defender_triad_type;
  if (manual) return manual;

  for (let i = (state?.playedCards || []).length - 1; i >= 0; i -= 1) {
    const played = state.playedCards[i];
    if (played?.playerId === opponentId) return played?.triadType ?? null;
  }

  return null;
}

function normalizeStatus(entry) {
  if (!entry || typeof entry !== "object" || !VALID_STATUS_TYPES.has(entry.type)) return null;
  const turns = Number.isFinite(entry.turns) ? Math.max(1, entry.turns) : entry.type === STATUS_TYPES.BURN ? 2 : 1;
  const amount = Number.isFinite(entry.amount) ? Math.max(0, entry.amount) : 5;
  return entry.type === STATUS_TYPES.SHIELD ? { type: entry.type, turns, amount } : { type: entry.type, turns };
}

function collectStatuses(card, key) {
  const source = card?.[key];
  const list = Array.isArray(source) ? source : source ? [source] : [];
  return list.map(normalizeStatus).filter(Boolean);
}

function applyStatuses(player, statuses) {
  return statuses.reduce((current, status) => {
    const nextStatuses = [...(current.statuses || []), status];
    if (status.type !== STATUS_TYPES.SHIELD) return { ...current, statuses: nextStatuses };

    const baseShield = Number.isFinite(current.shield) ? Math.max(0, current.shield) : 0;
    const shield = Math.min(GAME_CONSTANTS.MAX_SHIELD, baseShield + status.amount);
    return { ...current, shield, statuses: nextStatuses };
  }, { ...player, statuses: [...(player?.statuses || [])] });
}

function isDuplicateAction(state, playerId, card) {
  const actionId = card?.actionId ?? card?.action_id;
  const turnActions = state?.turnActions || [];
  const playedCards = state?.playedCards || [];

  if (actionId && turnActions.some((action) => action?.actionId === actionId)) {
    return true;
  }

  const duplicatePlay = playedCards.some((entry) => entry?.playerId === playerId && entry?.cardId === card.id);
  return duplicatePlay || turnActions.some((entry) => entry?.playerId === playerId && entry?.cardId === card.id);
}

function isFinished(state) {
  return (state?.player1?.hp || 0) <= 0 || (state?.player2?.hp || 0) <= 0;
}

function playCard(state, playerInput, card) {
  return withSafety(() => {
    const { playerId, expectedVersion: playerExpected } = parseActorInput(playerInput);
    const actionVersion = card?.expectedVersion ?? card?.stateVersion ?? card?.version ?? playerExpected;
    const playerKey = validatePlayableState(state, playerId, actionVersion);
    const opponentKey = getOpponentKey(playerKey);

    validateCard(card);
    if (isDuplicateAction(state, playerId, card)) failInvalid("Duplicate action");

    const manaCost = getCardManaCost(card);
    const actions = (state.turnActions || []).filter((action) => action?.playerId === playerId).length;
    if (actions >= GAME_CONSTANTS.MAX_CARDS_PER_TURN) failInvalid("Card limit reached for this turn");
    if ((state[playerKey]?.energy || 0) < manaCost) failInvalid("Not enough energy");

    const attacker = state[playerKey];
    const defender = state[opponentKey];
    const baseDamage = getCardBaseDamage(card);
    const weakAdjusted = Math.max(0, baseDamage - getWeakPenalty(attacker));
    const finalDamage = applyTriadBonus(getCardTriadType(card), getDefenderTriadType(state, defender?.id, card), weakAdjusted);

    const defenderAfterDamage = applyDamage(defender, finalDamage);
    const attackerAfterStatuses = applyStatuses(attacker, collectStatuses(card, "selfStatuses"));
    const defenderAfterStatuses = applyStatuses(defenderAfterDamage, collectStatuses(card, "statuses"));
    const energy = Math.max(0, (attackerAfterStatuses.energy || 0) - manaCost);
    const actionId = card?.actionId ?? card?.action_id ?? null;

    const nextState = {
      ...state,
      [playerKey]: { ...attackerAfterStatuses, energy },
      [opponentKey]: defenderAfterStatuses,
      playedCards: [...(state.playedCards || []), { playerId, cardId: card.id, triadType: getCardTriadType(card), actionId }],
      turnActions: [...(state.turnActions || []), { playerId, cardId: card.id, actionId }],
      version: (state.version || 0) + 1
    };

    return { ...nextState, finished: isFinished(nextState) };
  });
}

function endTurn(state, playerInput) {
  return withSafety(() => {
    const { playerId, expectedVersion } = parseActorInput(playerInput);
    validatePlayableState(state, playerId, expectedVersion);
    const nextState = resolveTurn(state);
    return { ...nextState, finished: isFinished(nextState) };
  });
}

function runEngineTick(gameState) {
  return withSafety(() => resolveTurn(gameState));
}

module.exports = {
  playCard,
  endTurn,
  runEngineTick
};
