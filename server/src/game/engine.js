const {
  GAME_CONSTANTS,
  INVALID_ACTION,
  STATE_OUTDATED,
  DUPLICATE_ACTION,
  STATUS_TYPES
} = require("./constants");
const { applyDamage } = require("./damage");
const { applyTriadBonus, getTriadComboCount, applyTriadComboBonus } = require("./triad");
const { resolveTurn } = require("./turn");
const {
  buildUnitIndex,
  createUnitInstance,
  applyDamageToUnit,
  removeDeadUnits
} = require("./board");

const VALID_STATUS_TYPES = new Set(Object.values(STATUS_TYPES));
const VALID_CARD_TYPES = new Set(["unit", "spell"]);
const VALID_TRIAD_TYPES = new Set(["assault", "precision", "arcane"]);

// ─── Error helpers ────────────────────────────────────────────────────────────

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
    if (
      error?.type === INVALID_ACTION ||
      error?.type === STATE_OUTDATED ||
      error?.type === DUPLICATE_ACTION
    ) {
      throw error;
    }
    throw createError(INVALID_ACTION, "Unexpected engine error");
  }
}

// ─── Player / key helpers ─────────────────────────────────────────────────────

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

// ─── Validators ───────────────────────────────────────────────────────────────

function validateVersion(expectedVersion, currentVersion) {
  if (!Number.isFinite(expectedVersion)) failOutdated();
  if (expectedVersion !== currentVersion) failOutdated();
}

function validatePlayableState(state, playerId, expectedVersion, options = {}) {
  if (!state?.player1 || !state?.player2) failInvalid("Invalid game state");
  if (state.finished) failInvalid("Game already finished");
  validateVersion(expectedVersion, state.version);

  const playerKey = getPlayerKey(state, playerId);
  if (!playerKey) failInvalid("Invalid player");
  if (state.activePlayer !== playerId) failInvalid("Not your turn");

  const allowStunned = Boolean(options.allowStunned);
  const isStunned = (state[playerKey]?.statuses || []).some(
    (status) => status?.type === STATUS_TYPES.STUN
  );
  if (!allowStunned && isStunned) {
    failInvalid("Player is stunned");
  }
  return playerKey;
}

function validateCard(card) {
  if (!card?.id) failInvalid("Card is required");
  if (!VALID_CARD_TYPES.has(card.type)) failInvalid("Invalid card type");
  if (!VALID_TRIAD_TYPES.has(getCardTriadType(card))) failInvalid("Invalid card triad type");
}

function getActionId(source) {
  const actionId = source?.actionId ?? source?.action_id;
  if (typeof actionId !== "string" || actionId.length === 0) {
    failInvalid("actionId is required");
  }
  return actionId;
}

// ─── State sanitizer (FIX 2: no board clamping — board size is enforced in playCard) ──

function clampPlayer(player) {
  const hp = Number.isFinite(player?.hp) ? player.hp : 0;
  const shield = Number.isFinite(player?.shield) ? player.shield : 0;
  const energy = Number.isFinite(player?.energy) ? player.energy : 0;
  const board = Array.isArray(player?.board) ? player.board : [];

  // FIX 10: rebuild unit index after every board mutation
  const unitIndex = buildUnitIndex(board);

  return {
    ...player,
    hp: Math.max(0, Math.min(hp, GAME_CONSTANTS.MAX_HP)),
    shield: Math.max(0, Math.min(shield, GAME_CONSTANTS.MAX_SHIELD)),
    energy: Math.max(0, energy),
    board,
    unitIndex
  };
}

function sanitizeState(state) {
  if (!state?.player1 || !state?.player2) return state;
  return {
    ...state,
    player1: clampPlayer(state.player1),
    player2: clampPlayer(state.player2)
  };
}

// ─── Card helpers ─────────────────────────────────────────────────────────────

function getCardTriadType(card) {
  return card?.triad_type ?? card?.triadType ?? null;
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
  const turns =
    Number.isFinite(entry.turns)
      ? Math.max(1, entry.turns)
      : entry.type === STATUS_TYPES.BURN
        ? 2
        : 1;
  const amount = Number.isFinite(entry.amount) ? Math.max(0, entry.amount) : 5;
  return entry.type === STATUS_TYPES.SHIELD
    ? { type: entry.type, turns, amount }
    : { type: entry.type, turns };
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

// ─── Duplicate action protection (FIX 1: unified via turnActions) ─────────────

function isDuplicatePlayAction(state, playerId, card) {
  const actionId = card?.actionId ?? card?.action_id;
  const turnActions = state?.turnActions || [];
  const playedCards = state?.playedCards || [];

  if (actionId && turnActions.some((a) => a?.actionId === actionId)) return true;

  const duplicatePlay = playedCards.some(
    (entry) => entry?.playerId === playerId && entry?.cardId === card.id
  );
  return duplicatePlay || turnActions.some(
    (entry) => entry?.playerId === playerId && entry?.cardId === card.id
  );
}

function isDuplicateAction(state, actionId) {
  if (!actionId) return false;
  return (state?.turnActions || []).some((a) => a?.actionId === actionId);
}

// ─── Match finish check ───────────────────────────────────────────────────────

function isFinished(state) {
  return (state?.player1?.hp || 0) <= 0 || (state?.player2?.hp || 0) <= 0;
}

// ─── Hand management ─────────────────────────────────────────────────────────

function consumeCardFromHand(player, cardId) {
  const hand = Array.isArray(player?.hand) ? [...player.hand] : [];
  const discard = Array.isArray(player?.discard) ? [...player.discard] : [];
  const cardIndex = hand.findIndex((entry) => entry?.id === cardId);

  if (cardIndex < 0) return null;

  const [consumedCard] = hand.splice(cardIndex, 1);
  return { ...player, hand, discard: [...discard, consumedCard] };
}

// ─── SPELL RESOLUTION ────────────────────────────────────────────────────────

/**
 * Resolves a spell card effect:
 *   1. Computes final damage (base → weak penalty → triad advantage → triad combo).
 *   2. Applies damage to opponent hero via shield absorption.
 *   3. Applies `card.statuses` to opponent.
 *   4. Applies `card.selfStatuses` to caster.
 *
 * Damage pipeline:
 *   base → minus weak penalty → plus type-advantage bonus → plus same-type combo bonus
 *
 * Pipeline order: validate → applySpellEffect → update state → discard card.
 * The card is moved to discard in the caller (playCard) after this function returns.
 *
 * @param {object} state        - Current (immutable) game state.
 * @param {string} playerKey    - "player1" | "player2" (caster).
 * @param {string} opponentKey
 * @param {object} attackerState - Caster's player state after card consumption + energy deduction.
 * @param {object} card         - Full card data (including statuses / selfStatuses arrays).
 * @returns {{ nextPlayerState: object, nextOpponentState: object }}
 */
function applySpellEffect(state, playerKey, opponentKey, attackerState, card) {
  const defender = state[opponentKey];
  const triadType = getCardTriadType(card);

  const baseDamage = getCardBaseDamage(card);
  const weakAdjusted = Math.max(0, baseDamage - getWeakPenalty(state[playerKey]));

  // Type-advantage bonus (attacker type beats defender's last played type)
  const triadBoosted = applyTriadBonus(
    triadType,
    getDefenderTriadType(state, defender?.id, card),
    weakAdjusted
  );

  // Same-type combo bonus: count how many cards of this triad_type
  // this player has already played this turn (state.playedCards is pre-play snapshot)
  const comboCount = getTriadComboCount(state.playedCards, attackerState.id, triadType);
  const finalDamage = applyTriadComboBonus(triadBoosted, comboCount);

  console.log(`[TRIAD CHECK] cardId=${card.id} triad_type=${triadType} comboCount=${comboCount} baseDamage=${baseDamage} weakAdjusted=${weakAdjusted} triadBoosted=${triadBoosted} finalDamage=${finalDamage}`);
  console.log(`[Spell resolved] card=${card.id} name="${card.name}" damage=${finalDamage} target=${card?.targetType || "hero"}:${card?.targetId || "n/a"}`);

  const targetType = card?.targetType ?? "hero";
  const targetId = card?.targetId ?? null;

  let nextOpponentState;

  if (targetType === "unit" && targetId) {
    // Route spell damage to a specific unit on the opponent's board.
    const opponentBoard = defender?.board || [];
    const opponentUnitIndex = defender?.unitIndex || buildUnitIndex(opponentBoard);
    const unitIdx = opponentUnitIndex[targetId] ?? -1;
    if (unitIdx < 0) failInvalid("Target unit not found on opponent board");

    const newBoard = [...opponentBoard];
    if (finalDamage > 0) {
      newBoard[unitIdx] = applyDamageToUnit(newBoard[unitIdx], finalDamage);
    }

    // Status effects (weak, burn, etc.) always apply to the opponent hero, not the unit.
    nextOpponentState = applyStatuses(
      { ...defender, board: removeDeadUnits(newBoard) },
      collectStatuses(card, "statuses")
    );
  } else {
    // Default: damage and statuses both go to the opponent hero.
    const defenderAfterDamage = applyDamage(defender, finalDamage);
    nextOpponentState = applyStatuses(
      defenderAfterDamage,
      collectStatuses(card, "statuses")
    );
  }

  const nextPlayerState = applyStatuses(
    attackerState,
    collectStatuses(card, "selfStatuses")
  );

  return { nextPlayerState, nextOpponentState };
}

// ─── PLAY CARD ────────────────────────────────────────────────────────────────

function playCard(state, playerInput, card) {
  return withSafety(() => {
    const { playerId, expectedVersion: playerExpected } = parseActorInput(playerInput);
    const actionVersion = card?.expectedVersion ?? card?.stateVersion ?? card?.version ?? playerExpected;
    const playerKey = validatePlayableState(state, playerId, actionVersion, { allowStunned: false });
    const opponentKey = getOpponentKey(playerKey);

    validateCard(card);
    const actionId = getActionId(card);

    if (isDuplicatePlayAction(state, playerId, card)) {
      throw createError(DUPLICATE_ACTION, "Duplicate action");
    }

    const manaCost = getCardManaCost(card);
    const actions = (state.turnActions || []).filter((a) => a?.playerId === playerId).length;
    if (actions >= GAME_CONSTANTS.MAX_CARDS_PER_TURN) failInvalid("Card limit reached for this turn");
    if ((state[playerKey]?.energy || 0) < manaCost) failInvalid("Not enough energy");

    const attackerAfterConsume = consumeCardFromHand(state[playerKey], card.id);
    if (!attackerAfterConsume) failInvalid("Card is not in hand");

    const actionIndex = (state.turnActions || []).length + 1;
    const turnOwnerId = state.activePlayer;
    const energy = Math.max(0, (attackerAfterConsume.energy || 0) - manaCost);

    let nextPlayerState;
    let nextOpponentState;

    if (card.type === "unit") {
      // FIX 2: reject here, never silently trim board in sanitizeState
      const currentBoard = attackerAfterConsume.board || [];
      if (currentBoard.length >= GAME_CONSTANTS.MAX_BOARD) {
        failInvalid("Board is full");
      }

      // FIX 5 & 8: UUID instanceId, summonedTurn from state.turn
      const unit = createUnitInstance(card, playerId, state.turn);
      const playerWithStatuses = applyStatuses(
        { ...attackerAfterConsume, energy, board: [...currentBoard, unit] },
        collectStatuses(card, "selfStatuses")
      );

      nextPlayerState = playerWithStatuses;
      nextOpponentState = state[opponentKey];
    } else {
      // Spell: resolve effect instantly then go to discard.
      const spellResult = applySpellEffect(
        state,
        playerKey,
        opponentKey,
        { ...attackerAfterConsume, energy },
        card
      );
      nextPlayerState = spellResult.nextPlayerState;
      nextOpponentState = spellResult.nextOpponentState;
    }

    const nextState = {
      ...state,
      [playerKey]: nextPlayerState,
      [opponentKey]: nextOpponentState,
      playedCards: [
        ...(state.playedCards || []),
        { playerId, cardId: card.id, triadType: getCardTriadType(card), actionId, actionIndex, turnOwnerId }
      ],
      turnActions: [
        ...(state.turnActions || []),
        { actionId, actionIndex, playerId, turnOwnerId, cardId: card.id, triadType: getCardTriadType(card), timestamp: Date.now() }
      ],
      version: (state.version || 0) + 1
    };

    const safeState = sanitizeState(nextState);
    return { ...safeState, finished: isFinished(safeState) };
  });
}

// ─── ATTACK ───────────────────────────────────────────────────────────────────

function attack(state, playerInput, attackPayload) {
  return withSafety(() => {
    const { playerId, expectedVersion: playerExpected } = parseActorInput(playerInput);
    const actionVersion =
      attackPayload?.version ?? attackPayload?.expectedVersion ?? playerExpected;

    validatePlayableState(state, playerId, actionVersion, { allowStunned: false });

    const actionId = getActionId(attackPayload);

    // FIX 1: duplicate check via unified turnActions
    if (isDuplicateAction(state, actionId)) {
      throw createError(DUPLICATE_ACTION, "Duplicate attack action");
    }

    const { unitId, targetType, targetId } = attackPayload || {};

    if (!unitId) failInvalid("unitId is required");
    if (targetType !== "unit" && targetType !== "hero") failInvalid("Invalid targetType");
    if (!targetId) failInvalid("targetId is required");

    const playerKey = getPlayerKey(state, playerId);
    const opponentKey = getOpponentKey(playerKey);

    // FIX 10: O(1) lookup via unitIndex (rebuilt by sanitizeState after each action)
    const playerUnitIndex = state[playerKey].unitIndex || buildUnitIndex(state[playerKey].board);
    const attackerIdx = playerUnitIndex[unitId] ?? -1;
    if (attackerIdx < 0) failInvalid("Attacking unit not found on your board");

    const attackerBoard = [...(state[playerKey].board || [])];
    const attackerUnit = attackerBoard[attackerIdx];

    // FIX 4: strict ownership + exhaustion checks
    if (!attackerUnit) failInvalid("Attacking unit not found on your board");
    if (attackerUnit.ownerId !== playerId) failInvalid("You do not own this unit");
    if (!attackerUnit.canAttack) failInvalid("Unit cannot attack this turn");
    if (attackerUnit.hasAttacked) failInvalid("Unit has already attacked this turn");

    // Mark unit as spent
    const spentUnit = { ...attackerUnit, canAttack: false, hasAttacked: true };
    attackerBoard[attackerIdx] = spentUnit;

    let updatedPlayerState = { ...state[playerKey], board: attackerBoard };
    let updatedOpponentState = { ...state[opponentKey] };

    if (targetType === "unit") {
      // FIX 10: O(1) lookup for defender
      const opponentUnitIndex =
        state[opponentKey].unitIndex || buildUnitIndex(state[opponentKey].board);
      const defenderIdx = opponentUnitIndex[targetId] ?? -1;
      if (defenderIdx < 0) failInvalid("Target unit not found on opponent board");

      const defenderBoard = [...(state[opponentKey].board || [])];
      const defenderUnit = defenderBoard[defenderIdx];
      if (!defenderUnit) failInvalid("Target unit not found on opponent board");

      // FIX 3: combat → applyDamage → removeDeadUnits immediately
      defenderBoard[defenderIdx] = applyDamageToUnit(defenderUnit, spentUnit.attack);
      attackerBoard[attackerIdx] = applyDamageToUnit(spentUnit, defenderUnit.attack);

      updatedPlayerState = {
        ...state[playerKey],
        board: removeDeadUnits(attackerBoard)
      };
      updatedOpponentState = {
        ...state[opponentKey],
        board: removeDeadUnits(defenderBoard)
      };
    } else {
      // Unit vs Hero: hero takes damage, attacker board updated with spent unit
      const heroDamage = spentUnit.attack;
      updatedOpponentState = {
        ...state[opponentKey],
        hp: Math.max(0, (state[opponentKey].hp || 0) - heroDamage)
      };
      updatedPlayerState = { ...state[playerKey], board: attackerBoard };
    }

    // FIX 1: store attack in turnActions (unified action log)
    const actionIndex = (state.turnActions || []).length + 1;
    const nextState = {
      ...state,
      [playerKey]: updatedPlayerState,
      [opponentKey]: updatedOpponentState,
      turnActions: [
        ...(state.turnActions || []),
        {
          actionId,
          actionIndex,
          playerId,
          turnOwnerId: state.activePlayer,
          cardId: null,
          unitId,
          targetType,
          targetId,
          timestamp: Date.now()
        }
      ],
      version: (state.version || 0) + 1
    };

    const safeState = sanitizeState(nextState);
    return { ...safeState, finished: isFinished(safeState) };
  });
}

// ─── END TURN ─────────────────────────────────────────────────────────────────

function endTurn(state, playerInput) {
  return withSafety(() => {
    const { playerId, expectedVersion } = parseActorInput(playerInput);
    validatePlayableState(state, playerId, expectedVersion, { allowStunned: true });
    const nextState = sanitizeState(resolveTurn(state));
    return { ...nextState, finished: isFinished(nextState) };
  });
}

// ─── ENGINE TICK (timer-forced turn end) ─────────────────────────────────────

function runEngineTick(gameState) {
  return withSafety(() => sanitizeState(resolveTurn(gameState)));
}

module.exports = {
  playCard,
  attack,
  endTurn,
  runEngineTick
};
