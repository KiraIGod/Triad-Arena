"use strict";

/**
 * Unit tests for the fresh-match state pipeline:
 *   createInitialGameState → serializeGameState → validateGameState
 *
 * These tests do NOT require a running server or DB connection.
 * Run with:  node src/tests/stateValidationTest.js
 */

const { createInitialGameState } = require("../game/gameState");
const { serializeGameState } = require("../game/stateSerializer");
const { validateGameState } = require("../game/stateValidator");
const { GAME_CONSTANTS } = require("../game/constants");

// ─── Helpers ──────────────────────────────────────────────────────────────────

let passed = 0;
let failed = 0;

function test(description, fn) {
  try {
    fn();
    console.log(`  ✓  ${description}`);
    passed++;
  } catch (err) {
    console.error(`  ✗  ${description}`);
    console.error(`     ${err?.message || err}`);
    failed++;
  }
}

function assert(condition, message) {
  if (!condition) throw new Error(message || "Assertion failed");
}

function assertThrows(fn, expectedSubstring) {
  let threw = false;
  try {
    fn();
  } catch (err) {
    threw = true;
    if (expectedSubstring) {
      assert(
        String(err?.message || "").includes(expectedSubstring),
        `Expected error containing "${expectedSubstring}", got: "${err?.message}"`
      );
    }
  }
  assert(threw, "Expected function to throw but it did not");
}

// ─── Mock card pool ───────────────────────────────────────────────────────────

function makeMockCards(count = 20) {
  const templates = [
    { type: "unit",  triad_type: "assault",   mana_cost: 2, attack: 3, hp: 4 },
    { type: "unit",  triad_type: "precision",  mana_cost: 2, attack: 2, hp: 3 },
    { type: "spell", triad_type: "arcane",     mana_cost: 1, attack: 2, hp: 0 }
  ];
  return Array.from({ length: count }, (_, i) => ({
    id: `card_${i}`,
    name: `Card ${i}`,
    type: templates[i % templates.length].type,
    triad_type: templates[i % templates.length].triad_type,
    mana_cost: templates[i % templates.length].mana_cost,
    attack: templates[i % templates.length].attack,
    hp: templates[i % templates.length].hp,
    description: "",
    statuses: [],
    selfStatuses: []
  }));
}

const P1_ID = "player-uuid-001";
const P2_ID = "player-uuid-002";
const MATCH_ID = "match-uuid-001";
const MOCK_CARDS = makeMockCards(20);

// ─── Test suite ───────────────────────────────────────────────────────────────

console.log("\n── State Validation Tests ──────────────────────────────────────\n");

// 1. createInitialGameState returns the correct raw shape
test("createInitialGameState returns correct raw shape", () => {
  const state = createInitialGameState(P1_ID, P2_ID, {
    playerOneDeck: MOCK_CARDS.slice(),
    playerTwoDeck: MOCK_CARDS.slice()
  });

  assert(state.turn === 1, `turn must be 1, got ${state.turn}`);
  assert(state.version === 1, `version must be 1, got ${state.version}`);
  assert(state.activePlayer === P1_ID, "activePlayer must be P1_ID");
  assert(state.finished === false, "finished must be false");
  assert(Array.isArray(state.turnActions), "turnActions must be an array");
  assert(state.turnActions.length === 0, "turnActions must be empty");

  // Raw state keeps players at the top level (NOT nested under .players)
  assert(state.player1 && typeof state.player1 === "object", "player1 must exist at top level");
  assert(state.player2 && typeof state.player2 === "object", "player2 must exist at top level");
  assert(state.player1.id === P1_ID, "player1.id must equal P1_ID");
  assert(state.player2.id === P2_ID, "player2.id must equal P2_ID");
  assert(!state.players, "raw state must NOT have a .players wrapper — serializer adds it");
});

// 2. Fresh player stats are within valid range
test("createInitialGameState player stats are within valid range", () => {
  const state = createInitialGameState(P1_ID, P2_ID, {
    playerOneDeck: MOCK_CARDS.slice(),
    playerTwoDeck: MOCK_CARDS.slice()
  });

  for (const [key, player] of [["player1", state.player1], ["player2", state.player2]]) {
    assert(player.hp === GAME_CONSTANTS.MAX_HP, `${key}.hp must equal MAX_HP`);
    assert(player.shield === 0, `${key}.shield must be 0`);
    assert(player.energy === GAME_CONSTANTS.ENERGY_PER_TURN, `${key}.energy must equal ENERGY_PER_TURN`);
    assert(Array.isArray(player.hand), `${key}.hand must be an array`);
    assert(Array.isArray(player.deck), `${key}.deck must be an array`);
    assert(Array.isArray(player.board), `${key}.board must be an array`);
    assert(player.board.length === 0, `${key}.board must be empty on start`);
  }
});

// 3. serializeGameState produces the correct serialized shape
test("serializeGameState produces nested players structure", () => {
  const raw = createInitialGameState(P1_ID, P2_ID, {
    playerOneDeck: MOCK_CARDS.slice(),
    playerTwoDeck: MOCK_CARDS.slice()
  });

  const serialized = serializeGameState({ ...raw, matchId: MATCH_ID }, {});

  assert(serialized.matchId === MATCH_ID, "serialized matchId must be present");
  assert(serialized.version === 1, "serialized version must be 1");
  assert(serialized.turn === 1, "serialized turn must be 1");
  assert(serialized.activePlayer === P1_ID, "serialized activePlayer must be P1_ID");
  assert(serialized.finished === false, "serialized finished must be false");
  assert(Array.isArray(serialized.turnActions), "serialized turnActions must be array");

  // Serializer must nest players under .players
  assert(serialized.players && typeof serialized.players === "object", "serialized .players must exist");
  assert(serialized.players.player1 && typeof serialized.players.player1 === "object", "players.player1 must exist");
  assert(serialized.players.player2 && typeof serialized.players.player2 === "object", "players.player2 must exist");
});

// 4. Serialized fresh state has correct player field values
test("serialized player stats have correct values", () => {
  const raw = createInitialGameState(P1_ID, P2_ID, {
    playerOneDeck: MOCK_CARDS.slice(),
    playerTwoDeck: MOCK_CARDS.slice()
  });
  const serialized = serializeGameState({ ...raw, matchId: MATCH_ID }, {});
  const p1 = serialized.players.player1;
  const p2 = serialized.players.player2;

  assert(p1.hp === GAME_CONSTANTS.MAX_HP, `p1.hp must equal MAX_HP (${GAME_CONSTANTS.MAX_HP})`);
  assert(p1.shield === 0, "p1.shield must be 0");
  assert(p1.energy === GAME_CONSTANTS.ENERGY_PER_TURN, "p1.energy must equal ENERGY_PER_TURN");
  assert(Array.isArray(p1.board), "p1.board must be array");
  assert(p1.board.length === 0, "p1.board must be empty");

  assert(p2.hp === GAME_CONSTANTS.MAX_HP, `p2.hp must equal MAX_HP (${GAME_CONSTANTS.MAX_HP})`);
  assert(p2.shield === 0, "p2.shield must be 0");
  assert(p2.energy === GAME_CONSTANTS.ENERGY_PER_TURN, "p2.energy must equal ENERGY_PER_TURN");
  assert(Array.isArray(p2.board), "p2.board must be array");
  assert(p2.board.length === 0, "p2.board must be empty");
});

// 5. validateGameState passes on a freshly serialized state
test("validateGameState passes on fresh serialized state", () => {
  const raw = createInitialGameState(P1_ID, P2_ID, {
    playerOneDeck: MOCK_CARDS.slice(),
    playerTwoDeck: MOCK_CARDS.slice()
  });
  const serialized = serializeGameState({ ...raw, matchId: MATCH_ID }, {});
  const result = validateGameState(serialized);
  assert(result === true, "validateGameState must return true for valid state");
});

// 6. Full pipeline: createInitialGameState → serializeGameState → validateGameState
test("full pipeline: fresh match creates valid serializable state", () => {
  const raw = createInitialGameState(P1_ID, P2_ID, {
    playerOneDeck: MOCK_CARDS.slice(),
    playerTwoDeck: MOCK_CARDS.slice()
  });
  const serialized = serializeGameState({ ...raw, matchId: MATCH_ID }, {});

  // validateGameState must not throw
  let threw = false;
  try {
    validateGameState(serialized);
  } catch (err) {
    threw = true;
    throw new Error(`Unexpected validation error: ${err.message}`);
  }
  assert(!threw, "validateGameState must not throw on fresh state");
});

// 7. serializeGameState throws on missing required fields
test("serializeGameState throws when version is missing", () => {
  const raw = createInitialGameState(P1_ID, P2_ID, {});
  const brokenRaw = { ...raw, version: undefined, matchId: MATCH_ID };
  assertThrows(
    () => serializeGameState(brokenRaw, {}),
    "missing field: version"
  );
});

// 8. validateGameState rejects a state with missing .players
test("validateGameState rejects state missing .players wrapper", () => {
  const raw = createInitialGameState(P1_ID, P2_ID, {
    playerOneDeck: MOCK_CARDS.slice(),
    playerTwoDeck: MOCK_CARDS.slice()
  });
  const partial = {
    matchId: MATCH_ID,
    version: raw.version,
    turn: raw.turn,
    activePlayer: raw.activePlayer,
    finished: raw.finished,
    turnActions: raw.turnActions
    // .players is intentionally omitted
  };
  assertThrows(() => validateGameState(partial), "Invalid state field: players");
});

// 9. validateGameState rejects a state with out-of-range HP
test("validateGameState rejects player with hp > MAX_HP", () => {
  const raw = createInitialGameState(P1_ID, P2_ID, {
    playerOneDeck: MOCK_CARDS.slice(),
    playerTwoDeck: MOCK_CARDS.slice()
  });
  const serialized = serializeGameState({ ...raw, matchId: MATCH_ID }, {});
  serialized.players.player1.hp = GAME_CONSTANTS.MAX_HP + 1;
  assertThrows(() => validateGameState(serialized), "Out of range hp");
});

// 10. Pipeline works with empty decks (match created with no deck cards)
test("full pipeline works with empty decks", () => {
  const raw = createInitialGameState(P1_ID, P2_ID, {
    playerOneDeck: [],
    playerTwoDeck: []
  });
  const serialized = serializeGameState({ ...raw, matchId: MATCH_ID }, {});
  const result = validateGameState(serialized);
  assert(result === true, "validateGameState must pass even with empty decks");
});

// ─── Summary ──────────────────────────────────────────────────────────────────

console.log(`\n── Results ─────────────────────────────────────────────────────`);
console.log(`  Passed : ${passed}`);
console.log(`  Failed : ${failed}`);
console.log(`${"─".repeat(64)}\n`);

if (failed > 0) {
  process.exitCode = 1;
}
