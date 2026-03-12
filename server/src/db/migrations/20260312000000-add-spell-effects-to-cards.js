"use strict";

/**
 * Adds spell effect columns to the cards table and corrects the attack (damage)
 * values for all spell cards whose seeds were left as 0.
 *
 * Column mapping used by the engine:
 *   statuses      → effects applied to the opponent on spell resolution
 *   self_statuses → effects applied to the caster on spell resolution
 */

const SPELL_EFFECTS = [
  // ── Assault spells ──────────────────────────────────────────────────────────
  { name: "Blood Strike",  attack: 6, statuses: [],                                   selfStatuses: [] },
  { name: "Brutal Cleave", attack: 4, statuses: [{ type: "burn",  turns: 2 }],        selfStatuses: [] },
  { name: "Rage Surge",    attack: 0, statuses: [{ type: "weak",  turns: 2 }],        selfStatuses: [] },
  { name: "Execution",     attack: 8, statuses: [],                                   selfStatuses: [] },

  // ── Precision spells ────────────────────────────────────────────────────────
  { name: "Mark Target",   attack: 3, statuses: [{ type: "weak",  turns: 1 }],        selfStatuses: [] },
  { name: "Piercing Shot", attack: 5, statuses: [],                                   selfStatuses: [] },
  { name: "Focus",         attack: 2, statuses: [],                                   selfStatuses: [] },
  { name: "Weak Point",    attack: 0, statuses: [{ type: "weak",  turns: 3 }],        selfStatuses: [] },

  // ── Arcane spells ───────────────────────────────────────────────────────────
  { name: "Arcane Burst",  attack: 4, statuses: [],                                   selfStatuses: [] },
  { name: "Echo Mind",     attack: 3, statuses: [{ type: "burn",  turns: 1 }],        selfStatuses: [] },
  { name: "Energy Shift",  attack: 0, statuses: [],                                   selfStatuses: [{ type: "shield", turns: 2, amount: 5 }] },
  { name: "Warp Pulse",    attack: 3, statuses: [{ type: "burn",  turns: 2 }],        selfStatuses: [] },
];

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn("cards", "statuses", {
      type: Sequelize.JSONB,
      allowNull: false,
      defaultValue: [],
    });

    await queryInterface.addColumn("cards", "self_statuses", {
      type: Sequelize.JSONB,
      allowNull: false,
      defaultValue: [],
    });

    for (const spell of SPELL_EFFECTS) {
      await queryInterface.bulkUpdate(
        "cards",
        {
          attack: spell.attack,
          statuses: spell.statuses,
          self_statuses: spell.selfStatuses,
        },
        { name: spell.name, type: "spell" }
      );
    }
  },

  async down(queryInterface) {
    await queryInterface.removeColumn("cards", "self_statuses");
    await queryInterface.removeColumn("cards", "statuses");
  },
};
