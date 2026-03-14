"use strict";

const { createInitialGameState } = require("../game/gameState");
const { playCard, attack, endTurn } = require("../game/engine");
const { GAME_CONSTANTS, INVALID_ACTION, DUPLICATE_ACTION } = require("../game/constants");

// ─── Simulation limits ────────────────────────────────────────────────────────

const MAX_TURNS_PER_MATCH = 100;
const MAX_ACTIONS_PER_TURN = 15;

// Probability of ending the turn increases with each action taken this turn.
const END_TURN_BASE_PROB = 0.15;
const END_TURN_STEP_PROB = 0.08;

// ─── Action ID counter ────────────────────────────────────────────────────────

let globalActionCounter = 0;

function nextActionId() {
  globalActionCounter += 1;
  return `sim_act_${globalActionCounter}`;
}

// ─── Mock card pool ───────────────────────────────────────────────────────────
//
// 18 distinct templates across all three triad types (assault, precision, arcane)
// and both card types (unit, spell).  Every spell template contains a statuses
// and selfStatuses array so collectStatuses() in the engine can normalise them.

const CARD_TEMPLATES = [
  // ── Assault units ──────────────────────────────────────────────────────────
  { base: "sim_u_a1", name: "Iron Warrior",  type: "unit",  triad_type: "assault",   mana_cost: 2, attack: 3, hp: 4, description: "", statuses: [], selfStatuses: [] },
  { base: "sim_u_a2", name: "Berserker",     type: "unit",  triad_type: "assault",   mana_cost: 3, attack: 5, hp: 2, description: "", statuses: [], selfStatuses: [] },
  { base: "sim_u_a3", name: "Shield Guard",  type: "unit",  triad_type: "assault",   mana_cost: 4, attack: 2, hp: 6, description: "", statuses: [], selfStatuses: [] },

  // ── Precision units ────────────────────────────────────────────────────────
  { base: "sim_u_p1", name: "Shadow Archer", type: "unit",  triad_type: "precision", mana_cost: 2, attack: 4, hp: 2, description: "", statuses: [], selfStatuses: [] },
  { base: "sim_u_p2", name: "Sniper",        type: "unit",  triad_type: "precision", mana_cost: 3, attack: 3, hp: 3, description: "", statuses: [], selfStatuses: [] },
  { base: "sim_u_p3", name: "Tracker",       type: "unit",  triad_type: "precision", mana_cost: 1, attack: 2, hp: 3, description: "", statuses: [], selfStatuses: [] },

  // ── Arcane units ───────────────────────────────────────────────────────────
  { base: "sim_u_r1", name: "Rune Prophet",  type: "unit",  triad_type: "arcane",    mana_cost: 3, attack: 2, hp: 4, description: "", statuses: [], selfStatuses: [] },
  { base: "sim_u_r2", name: "Void Seer",     type: "unit",  triad_type: "arcane",    mana_cost: 4, attack: 3, hp: 5, description: "", statuses: [], selfStatuses: [] },
  { base: "sim_u_r3", name: "Echo Mind",     type: "unit",  triad_type: "arcane",    mana_cost: 2, attack: 2, hp: 3, description: "", statuses: [], selfStatuses: [] },

  // ── Assault spells ─────────────────────────────────────────────────────────
  { base: "sim_s_a1", name: "Brutal Cleave", type: "spell", triad_type: "assault",   mana_cost: 2, attack: 4, hp: 0, description: "", statuses: [], selfStatuses: [] },
  { base: "sim_s_a2", name: "Rage Surge",    type: "spell", triad_type: "assault",   mana_cost: 3, attack: 5, hp: 0, description: "", statuses: [{ type: "weak",   turns: 1 }], selfStatuses: [] },
  { base: "sim_s_a3", name: "Blood Strike",  type: "spell", triad_type: "assault",   mana_cost: 1, attack: 2, hp: 0, description: "", statuses: [], selfStatuses: [{ type: "shield", turns: 2, amount: 3 }] },

  // ── Precision spells ───────────────────────────────────────────────────────
  { base: "sim_s_p1", name: "Piercing Shot", type: "spell", triad_type: "precision", mana_cost: 2, attack: 3, hp: 0, description: "", statuses: [{ type: "burn",  turns: 2 }], selfStatuses: [] },
  { base: "sim_s_p2", name: "Silent Hunter", type: "spell", triad_type: "precision", mana_cost: 3, attack: 4, hp: 0, description: "", statuses: [{ type: "stun",  turns: 1 }], selfStatuses: [] },
  { base: "sim_s_p3", name: "Weak Point",    type: "spell", triad_type: "precision", mana_cost: 1, attack: 2, hp: 0, description: "", statuses: [{ type: "weak",  turns: 2 }], selfStatuses: [] },

  // ── Arcane spells ──────────────────────────────────────────────────────────
  { base: "sim_s_r1", name: "Arcane Burst",  type: "spell", triad_type: "arcane",    mana_cost: 3, attack: 6, hp: 0, description: "", statuses: [], selfStatuses: [] },
  { base: "sim_s_r2", name: "Warp Pulse",    type: "spell", triad_type: "arcane",    mana_cost: 2, attack: 3, hp: 0, description: "", statuses: [], selfStatuses: [{ type: "shield", turns: 2, amount: 5 }] },
  { base: "sim_s_r3", name: "Energy Shift",  type: "spell", triad_type: "arcane",    mana_cost: 1, attack: 0, hp: 0, description: "", statuses: [{ type: "burn",  turns: 3 }], selfStatuses: [{ type: "shield", turns: 1, amount: 2 }] },
];

// ─── Deck builder ─────────────────────────────────────────────────────────────
//
// Builds a 20-card shuffled deck.  Each slot gets a position-suffixed id so
// the engine's duplicate-card-id check never blocks playing the same card
// template twice in the same game.
//
// Optionally concentrates 12 of the 20 slots on one triad type so triad combo
// bonuses fire regularly (every 3rd match, roughly).

function buildDeck(concentrateTriad = null) {
  const slots = [];
  const triadTemplates = concentrateTriad
    ? CARD_TEMPLATES.filter((t) => t.triad_type === concentrateTriad)
    : null;

  for (let i = 0; i < 20; i++) {
    const pool = triadTemplates && i < 12 ? triadTemplates : CARD_TEMPLATES;
    const template = pool[Math.floor(Math.random() * pool.length)];
    const { base, ...rest } = template;
    slots.push({ ...rest, id: `${base}_pos${i}` });
  }

  // Fisher-Yates shuffle
  for (let i = slots.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [slots[i], slots[j]] = [slots[j], slots[i]];
  }

  return slots;
}

// ─── State readers ────────────────────────────────────────────────────────────

function getActivePlayerInfo(state) {
  const isP1 = state.player1.id === state.activePlayer;
  return isP1
    ? { player: state.player1, playerKey: "player1", opponent: state.player2, opponentKey: "player2" }
    : { player: state.player2, playerKey: "player2", opponent: state.player1, opponentKey: "player1" };
}

function isStunned(player) {
  return (player.statuses || []).some((s) => s.type === "stun");
}

function getPlayableCards(player, state, playerId) {
  if (isStunned(player)) return [];

  const cardActionsThisTurn = (state.turnActions || []).filter(
    (a) => a.playerId === playerId && a.cardId != null
  ).length;

  if (cardActionsThisTurn >= GAME_CONSTANTS.MAX_CARDS_PER_TURN) return [];

  // Cards the player can afford and that haven't been played this turn.
  const playedCardIds = new Set(
    (state.turnActions || [])
      .filter((a) => a.playerId === playerId && a.cardId != null)
      .map((a) => a.cardId)
  );

  return (player.hand || []).filter(
    (card) => card.mana_cost <= player.energy && !playedCardIds.has(card.id)
  );
}

function getAttackableUnits(player) {
  return (player.board || []).filter((u) => u.canAttack && !u.hasAttacked);
}

// ─── State invariant validator ────────────────────────────────────────────────

function validateSimState(state) {
  const errors = [];

  for (const [key, player] of [["player1", state.player1], ["player2", state.player2]]) {
    if (player.hp < 0)                                         errors.push(`${key}.hp < 0 (${player.hp})`);
    if (player.hp > GAME_CONSTANTS.MAX_HP)                     errors.push(`${key}.hp > MAX_HP (${player.hp})`);
    if (player.shield < 0)                                     errors.push(`${key}.shield < 0 (${player.shield})`);
    if (player.shield > GAME_CONSTANTS.MAX_SHIELD)             errors.push(`${key}.shield > MAX_SHIELD (${player.shield})`);
    if (player.energy < 0)                                     errors.push(`${key}.energy < 0 (${player.energy})`);
    if ((player.board || []).length > GAME_CONSTANTS.MAX_BOARD) errors.push(`${key}.board.length > MAX_BOARD (${player.board.length})`);
  }

  const cardActionsP1 = (state.turnActions || []).filter(
    (a) => a.playerId === state.player1.id && a.cardId != null
  ).length;
  const cardActionsP2 = (state.turnActions || []).filter(
    (a) => a.playerId === state.player2.id && a.cardId != null
  ).length;

  if (cardActionsP1 > GAME_CONSTANTS.MAX_CARDS_PER_TURN) errors.push(`player1 played ${cardActionsP1} cards this turn`);
  if (cardActionsP2 > GAME_CONSTANTS.MAX_CARDS_PER_TURN) errors.push(`player2 played ${cardActionsP2} cards this turn`);

  return errors;
}

// ─── Target selectors ─────────────────────────────────────────────────────────

function selectRandomTarget(opponentBoard, opponentId) {
  if (opponentBoard.length > 0 && Math.random() < 0.5) {
    const unit = opponentBoard[Math.floor(Math.random() * opponentBoard.length)];
    return { targetType: "unit", targetId: unit.instanceId };
  }
  return { targetType: "hero", targetId: opponentId };
}

// ─── Single-turn simulator ────────────────────────────────────────────────────

function simulateTurn(state, matchStats) {
  let current = state;
  const playerId = current.activePlayer;

  for (let actionsTaken = 0; actionsTaken < MAX_ACTIONS_PER_TURN; actionsTaken++) {
    if (current.finished) return current;

    const { player, opponent, opponentKey } = getActivePlayerInfo(current);

    // A stunned player may only end their turn — no cards, no attacks.
    const stunned = isStunned(player);

    const playableCards   = stunned ? [] : getPlayableCards(player, current, playerId);
    const attackableUnits = stunned ? [] : getAttackableUnits(player);

    const canPlayCard = playableCards.length > 0;
    const canAttack   = attackableUnits.length > 0;

    // Decide whether to end the turn now.
    const endProb = END_TURN_BASE_PROB + actionsTaken * END_TURN_STEP_PROB;
    const mustEnd = !canPlayCard && !canAttack;

    if (mustEnd || Math.random() < endProb) {
      current = endTurn(current, { playerId, expectedVersion: current.version });
      matchStats.turns++;
      return current;
    }

    // Choose action type.
    const choices = [];
    if (canPlayCard) choices.push("playCard");
    if (canAttack)   choices.push("attack");

    const choice = choices[Math.floor(Math.random() * choices.length)];

    if (choice === "playCard") {
      // Prefer to pick cards of the same triad type ~30% of the time to
      // exercise the combo bonus system.
      let card;
      if (Math.random() < 0.3 && playableCards.length > 1) {
        const lastTriad = (current.turnActions || [])
          .filter((a) => a.playerId === playerId && a.triadType)
          .slice(-1)[0]?.triadType;

        const sameTriad = lastTriad
          ? playableCards.filter((c) => c.triad_type === lastTriad)
          : [];
        card = sameTriad.length > 0
          ? sameTriad[Math.floor(Math.random() * sameTriad.length)]
          : playableCards[Math.floor(Math.random() * playableCards.length)];
      } else {
        card = playableCards[Math.floor(Math.random() * playableCards.length)];
      }

      // Unit: can only be played if the board has room.
      if (card.type === "unit" && (player.board || []).length >= GAME_CONSTANTS.MAX_BOARD) {
        // Skip unit play, try to end turn or attack instead.
        if (canAttack) {
          const unit = attackableUnits[Math.floor(Math.random() * attackableUnits.length)];
          const { targetType, targetId } = selectRandomTarget(opponent.board || [], opponent.id);
          current = attack(
            current,
            { playerId, expectedVersion: current.version },
            { unitId: unit.instanceId, targetType, targetId, actionId: nextActionId(), version: current.version }
          );
          matchStats.attacks++;
        } else {
          current = endTurn(current, { playerId, expectedVersion: current.version });
          matchStats.turns++;
          return current;
        }
      } else {
        // Determine spell targeting.
        let targetType = "hero";
        let targetId = opponent.id;
        if (card.type === "spell") {
          const target = selectRandomTarget(opponent.board || [], opponent.id);
          targetType = target.targetType;
          targetId   = target.targetId;
        }

        const cardData = {
          ...card,
          actionId: nextActionId(),
          ...(card.type === "spell" ? { targetType, targetId } : {})
        };

        current = playCard(
          current,
          { playerId, expectedVersion: current.version },
          cardData
        );

        if (card.type === "unit") matchStats.unitsSummoned++;
        else                      matchStats.spellsCast++;
        matchStats.cardsPlayed++;
      }

    } else {
      // Attack action.
      const attackingUnit = attackableUnits[Math.floor(Math.random() * attackableUnits.length)];
      const { targetType, targetId } = selectRandomTarget(
        getActivePlayerInfo(current).opponent.board || [],
        getActivePlayerInfo(current).opponent.id
      );

      current = attack(
        current,
        { playerId, expectedVersion: current.version },
        { unitId: attackingUnit.instanceId, targetType, targetId, actionId: nextActionId(), version: current.version }
      );
      matchStats.attacks++;
    }

    // Validate state invariants after every action.
    const violations = validateSimState(current);
    if (violations.length > 0) {
      throw new Error(`Invariant violation after action: ${violations.join("; ")}`);
    }

    if (current.finished) return current;
  }

  // Safety: ran out of action budget — force end turn.
  current = endTurn(current, { playerId, expectedVersion: current.version });
  matchStats.turns++;
  return current;
}

// ─── Single-match simulator ────────────────────────────────────────────────────

function simulateMatch(matchIndex) {
  const p1Id = `sim_p1_m${matchIndex}`;
  const p2Id = `sim_p2_m${matchIndex}`;

  // Occasionally concentrate one triad type to exercise the combo system.
  const triads = ["assault", "precision", "arcane"];
  const p1Focus = matchIndex % 3 === 0 ? triads[matchIndex % triads.length] : null;
  const p2Focus = matchIndex % 3 === 1 ? triads[(matchIndex + 1) % triads.length] : null;

  let state = createInitialGameState(p1Id, p2Id, {
    playerOneDeck: buildDeck(p1Focus),
    playerTwoDeck: buildDeck(p2Focus)
  });

  const stats = {
    matchIndex,
    winner: null,
    turns: 0,
    cardsPlayed: 0,
    unitsSummoned: 0,
    spellsCast: 0,
    attacks: 0,
    timedOut: false,
    error: null,
    errorSnapshot: null
  };

  try {
    while (!state.finished && state.turn <= MAX_TURNS_PER_MATCH) {
      state = simulateTurn(state, stats);
    }

    if (state.turn > MAX_TURNS_PER_MATCH && !state.finished) {
      stats.timedOut = true;
    }

    const p1Hp = state.player1?.hp ?? 0;
    const p2Hp = state.player2?.hp ?? 0;

    if (p1Hp <= 0 && p2Hp <= 0) stats.winner = "draw";
    else if (p1Hp <= 0)          stats.winner = p2Id;
    else if (p2Hp <= 0)          stats.winner = p1Id;
    else                         stats.winner = null;

  } catch (err) {
    stats.error = err?.message || String(err);
    stats.errorSnapshot = JSON.stringify({
      turn:         state.turn,
      version:      state.version,
      activePlayer: state.activePlayer,
      p1hp:         state.player1?.hp,
      p2hp:         state.player2?.hp,
      p1board:      (state.player1?.board || []).length,
      p2board:      (state.player2?.board || []).length
    });
  }

  return stats;
}

// ─── Statistics helpers ───────────────────────────────────────────────────────

function avg(arr) {
  if (arr.length === 0) return 0;
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}

function pct(num, total) {
  if (total === 0) return "0%";
  return `${((num / total) * 100).toFixed(1)}%`;
}

// ─── Simulation runner ────────────────────────────────────────────────────────

/**
 * Runs `count` full PvP matches using the live game engine.
 *
 * @param {number} count   Number of matches to simulate (default: 100).
 * @param {object} options
 * @param {boolean} options.verbose  Print per-match summary (default: false).
 * @returns {{ matches: object[], summary: object }}
 */
function runSimulation(count = 100, options = {}) {
  const verbose = Boolean(options.verbose);
  const results = [];

  console.log(`\n${"─".repeat(60)}`);
  console.log(` MATCH SIMULATOR — running ${count} matches`);
  console.log(`${"─".repeat(60)}`);

  const startTime = Date.now();

  for (let i = 0; i < count; i++) {
    const stats = simulateMatch(i + 1);
    results.push(stats);

    if (verbose) {
      const outcome = stats.error
        ? `ERROR: ${stats.error}`
        : stats.timedOut
          ? `TIMEOUT after ${stats.turns} turns`
          : `WINNER: ${stats.winner ?? "draw"} in ${stats.turns} turns`;

      console.log(
        `  [${String(i + 1).padStart(4)}] ${outcome}` +
        ` | cards=${stats.cardsPlayed} units=${stats.unitsSummoned}` +
        ` spells=${stats.spellsCast} attacks=${stats.attacks}`
      );
    } else if ((i + 1) % 10 === 0) {
      process.stdout.write(`  Simulated ${i + 1}/${count} matches...\n`);
    }
  }

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);

  // ── Aggregate statistics ──────────────────────────────────────────────────

  const errors   = results.filter((r) => r.error);
  const timeouts = results.filter((r) => r.timedOut);
  const winners  = results.filter((r) => !r.error && !r.timedOut && r.winner && r.winner !== "draw");
  const draws    = results.filter((r) => !r.error && r.winner === "draw");

  const allTurns        = results.filter((r) => !r.error).map((r) => r.turns);
  const allCards        = results.filter((r) => !r.error).map((r) => r.cardsPlayed);
  const allUnits        = results.filter((r) => !r.error).map((r) => r.unitsSummoned);
  const allSpells       = results.filter((r) => !r.error).map((r) => r.spellsCast);
  const allAttacks      = results.filter((r) => !r.error).map((r) => r.attacks);

  const summary = {
    total:          count,
    completed:      winners.length + draws.length,
    timedOut:       timeouts.length,
    errors:         errors.length,
    draws:          draws.length,
    avgTurns:       avg(allTurns).toFixed(1),
    avgCardsPlayed: avg(allCards).toFixed(1),
    avgUnitsSummoned: avg(allUnits).toFixed(1),
    avgSpellsCast:  avg(allSpells).toFixed(1),
    avgAttacks:     avg(allAttacks).toFixed(1),
    elapsedSec:     elapsed
  };

  // ── Final report ──────────────────────────────────────────────────────────

  console.log(`\n${"═".repeat(60)}`);
  console.log(" SIMULATION RESULTS");
  console.log(`${"═".repeat(60)}`);
  console.log(` Matches simulated : ${count}`);
  console.log(` Completed         : ${summary.completed}  (${pct(summary.completed, count)})`);
  console.log(` Timed out         : ${summary.timedOut}   (${pct(summary.timedOut, count)})`);
  console.log(` Draws             : ${summary.draws}   (${pct(summary.draws, count)})`);
  console.log(` Errors            : ${summary.errors}   (${pct(summary.errors, count)})`);
  console.log(`${"─".repeat(60)}`);
  console.log(` Avg turns / match : ${summary.avgTurns}`);
  console.log(` Avg cards played  : ${summary.avgCardsPlayed}`);
  console.log(` Avg units summoned: ${summary.avgUnitsSummoned}`);
  console.log(` Avg spells cast   : ${summary.avgSpellsCast}`);
  console.log(` Avg attacks       : ${summary.avgAttacks}`);
  console.log(`${"─".repeat(60)}`);
  console.log(` Total time        : ${elapsed}s`);
  console.log(`${"═".repeat(60)}`);

  if (errors.length > 0) {
    console.log(`\n⚠  ERRORS DETECTED (${errors.length}):`);
    errors.forEach((r, idx) => {
      console.log(`\n  [Error ${idx + 1}] match #${r.matchIndex}`);
      console.log(`    message : ${r.error}`);
      console.log(`    snapshot: ${r.errorSnapshot}`);
    });
    console.log("");
  }

  return { matches: results, summary };
}

// ─── Entry point ─────────────────────────────────────────────────────────────

if (require.main === module) {
  const countArg = parseInt(process.argv[2], 10);
  const count    = Number.isFinite(countArg) && countArg > 0 ? countArg : 100;
  const verbose  = process.argv.includes("--verbose") || process.argv.includes("-v");

  const { summary } = runSimulation(count, { verbose });

  process.exitCode = summary.errors > 0 ? 1 : 0;
}

module.exports = { runSimulation, simulateMatch, buildDeck };
