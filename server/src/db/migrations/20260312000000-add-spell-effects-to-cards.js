"use strict";

/**
 * Adds spell effect columns to the cards table and corrects the attack (damage)
 * values for all spell cards whose seeds were left as 0 or null.
 *
 * Column mapping used by the engine:
 *   statuses      → effects applied to the opponent on spell resolution
 *   self_statuses → effects applied to the caster on spell resolution
 *
 * Two-phase patching strategy:
 *   1. Apply known values by card name (matches the canonical seed file).
 *   2. Fallback: any spell card that still has a null attack gets a sensible
 *      default derived from its mana cost (mana_cost × 2), so existing
 *      databases with different card names also receive valid damage values.
 *
 * Note: defaultValue uses Sequelize.literal so PostgreSQL receives the string
 * '[]' and parses it as an empty JSONB array instead of the {} that Sequelize
 * would otherwise emit when serialising a JavaScript [] for a DEFAULT clause.
 * bulkUpdate values are JSON.stringify'd for the same reason.
 */

const NAMED_SPELL_EFFECTS = [
  // ── Assault spells ──────────────────────────────────────────────────────────
  { name: "Blood Strike",  attack: 6, statuses: [],                               selfStatuses: [] },
  { name: "Brutal Cleave", attack: 4, statuses: [{ type: "burn", turns: 2 }],    selfStatuses: [] },
  { name: "Rage Surge",    attack: 0, statuses: [{ type: "weak", turns: 2 }],    selfStatuses: [] },
  { name: "Execution",     attack: 8, statuses: [],                               selfStatuses: [] },

  // ── Precision spells ────────────────────────────────────────────────────────
  { name: "Mark Target",   attack: 3, statuses: [{ type: "weak", turns: 1 }],    selfStatuses: [] },
  { name: "Piercing Shot", attack: 5, statuses: [],                               selfStatuses: [] },
  { name: "Focus",         attack: 2, statuses: [],                               selfStatuses: [] },
  { name: "Weak Point",    attack: 0, statuses: [{ type: "weak", turns: 3 }],    selfStatuses: [] },

  // ── Arcane spells ───────────────────────────────────────────────────────────
  { name: "Arcane Burst",  attack: 4, statuses: [],                               selfStatuses: [] },
  { name: "Echo Mind",     attack: 3, statuses: [{ type: "burn", turns: 1 }],    selfStatuses: [] },
  { name: "Energy Shift",  attack: 0, statuses: [],                               selfStatuses: [{ type: "shield", turns: 2, amount: 5 }] },
  { name: "Warp Pulse",    attack: 3, statuses: [{ type: "burn", turns: 2 }],    selfStatuses: [] },
];

// Fallback: assign damage = mana_cost * 2 for any remaining null-attack spells.
// Covers databases seeded with card names not in the list above.
const MANA_TO_DAMAGE = [
  [1, 2],
  [2, 4],
  [3, 6],
  [4, 8],
  [5, 10],
];

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn("cards", "statuses", {
      type: Sequelize.JSONB,
      allowNull: false,
      defaultValue: Sequelize.literal("'[]'"),
    });

    await queryInterface.addColumn("cards", "self_statuses", {
      type: Sequelize.JSONB,
      allowNull: false,
      defaultValue: Sequelize.literal("'[]'"),
    });

    // Phase 1: patch known card names with precise damage + effect values.
    for (const spell of NAMED_SPELL_EFFECTS) {
      await queryInterface.bulkUpdate(
        "cards",
        {
          attack: spell.attack,
          statuses: JSON.stringify(spell.statuses),
          self_statuses: JSON.stringify(spell.selfStatuses),
        },
        { name: spell.name, type: "spell" }
      );
    }

    // Phase 2: fallback for spell cards with names not in the list above.
    // Sequelize translates { attack: null } → WHERE attack IS NULL.
    for (const [manaCost, damage] of MANA_TO_DAMAGE) {
      await queryInterface.bulkUpdate(
        "cards",
        { attack: damage },
        { type: "spell", attack: null, mana_cost: manaCost }
      );
    }
  },

  async down(queryInterface) {
    await queryInterface.removeColumn("cards", "self_statuses");
    await queryInterface.removeColumn("cards", "statuses");
  },
};
