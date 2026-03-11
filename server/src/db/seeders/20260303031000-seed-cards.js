"use strict";

const { randomUUID } = require("crypto");

module.exports = {
  async up(queryInterface) {
    const now = new Date();

    await queryInterface.bulkInsert("cards", [
      // =====================
      // ASSAULT UNITS
      // =====================

      {
        id: randomUUID(),
        name: "Crimson Duelist",
        type: "unit",
        triad_type: "assault",
        mana_cost: 2,
        attack: 3,
        hp: 2,
        description: "Fast aggressive fighter.",
        image: "crimson_duelist.png",
        created_at: now,
      },

      {
        id: randomUUID(),
        name: "Iron Warden",
        type: "unit",
        triad_type: "assault",
        mana_cost: 3,
        attack: 4,
        hp: 5,
        description: "Durable frontline defender.",
        image: "iron_warden.png",
        created_at: now,
      },

      // =====================
      // ASSAULT SPELLS
      // =====================

      {
        id: randomUUID(),
        name: "Blood Strike",
        type: "spell",
        triad_type: "assault",
        mana_cost: 2,
        attack: 0,
        hp: 0,
        description: "Deal 6 damage to enemy hero.",
        image: "blood_strike.png",
        created_at: now,
      },

      {
        id: randomUUID(),
        name: "Brutal Cleave",
        type: "spell",
        triad_type: "assault",
        mana_cost: 3,
        attack: 0,
        hp: 0,
        description: "Deal 4 damage to all enemy units.",
        image: "brutal_cleave.png",
        created_at: now,
      },

      {
        id: randomUUID(),
        name: "Rage Surge",
        type: "spell",
        triad_type: "assault",
        mana_cost: 2,
        attack: 0,
        hp: 0,
        description: "Target unit gains +3 attack this turn.",
        image: "rage_surge.png",
        created_at: now,
      },

      {
        id: randomUUID(),
        name: "Execution",
        type: "spell",
        triad_type: "assault",
        mana_cost: 3,
        attack: 0,
        hp: 0,
        description: "Destroy a unit with 3 HP or less.",
        image: "execution.png",
        created_at: now,
      },

      // =====================
      // PRECISION UNITS
      // =====================

      {
        id: randomUUID(),
        name: "Shadow Archer",
        type: "unit",
        triad_type: "precision",
        mana_cost: 3,
        attack: 3,
        hp: 3,
        description: "Balanced ranged attacker.",
        image: "shadow_archer.png",
        created_at: now,
      },

      {
        id: randomUUID(),
        name: "Silent Hunter",
        type: "unit",
        triad_type: "precision",
        mana_cost: 4,
        attack: 4,
        hp: 4,
        description: "Deadly precision fighter.",
        image: "silent_hunter.png",
        created_at: now,
      },

      // =====================
      // PRECISION SPELLS
      // =====================

      {
        id: randomUUID(),
        name: "Mark Target",
        type: "spell",
        triad_type: "precision",
        mana_cost: 1,
        attack: 0,
        hp: 0,
        description: "Your next attack deals +3 damage.",
        image: "mark_target.png",
        created_at: now,
      },

      {
        id: randomUUID(),
        name: "Piercing Shot",
        type: "spell",
        triad_type: "precision",
        mana_cost: 2,
        attack: 0,
        hp: 0,
        description: "Deal 5 damage ignoring shield.",
        image: "piercing_shot.png",
        created_at: now,
      },

      {
        id: randomUUID(),
        name: "Focus",
        type: "spell",
        triad_type: "precision",
        mana_cost: 1,
        attack: 0,
        hp: 0,
        description: "Draw 1 card.",
        image: "focus.png",
        created_at: now,
      },

      {
        id: randomUUID(),
        name: "Weak Point",
        type: "spell",
        triad_type: "precision",
        mana_cost: 2,
        attack: 0,
        hp: 0,
        description: "Target unit takes +2 damage.",
        image: "weak_point.png",
        created_at: now,
      },

      // =====================
      // ARCANE UNITS
      // =====================

      {
        id: randomUUID(),
        name: "Void Seer",
        type: "unit",
        triad_type: "arcane",
        mana_cost: 3,
        attack: 2,
        hp: 4,
        description: "Mystic controller.",
        image: "void_seer.png",
        created_at: now,
      },

      {
        id: randomUUID(),
        name: "Rune Prophet",
        type: "unit",
        triad_type: "arcane",
        mana_cost: 5,
        attack: 5,
        hp: 5,
        description: "Powerful arcane master.",
        image: "rune_prophet.png",
        created_at: now,
      },

      // =====================
      // ARCANE SPELLS
      // =====================

      {
        id: randomUUID(),
        name: "Arcane Burst",
        type: "spell",
        triad_type: "arcane",
        mana_cost: 2,
        attack: 0,
        hp: 0,
        description: "Deal 4 damage.",
        image: "arcane_burst.png",
        created_at: now,
      },

      {
        id: randomUUID(),
        name: "Echo Mind",
        type: "spell",
        triad_type: "arcane",
        mana_cost: 3,
        attack: 0,
        hp: 0,
        description: "Duplicate your next spell.",
        image: "echo_mind.png",
        created_at: now,
      },

      {
        id: randomUUID(),
        name: "Energy Shift",
        type: "spell",
        triad_type: "arcane",
        mana_cost: 1,
        attack: 0,
        hp: 0,
        description: "Your next card costs 1 less.",
        image: "energy_shift.png",
        created_at: now,
      },

      {
        id: randomUUID(),
        name: "Warp Pulse",
        type: "spell",
        triad_type: "arcane",
        mana_cost: 4,
        attack: 0,
        hp: 0,
        description: "Deal 3 damage to all units.",
        image: "warp_pulse.png",
        created_at: now,
      },
    ]);
  },

  async down(queryInterface) {
    await queryInterface.bulkDelete("cards", null, {});
  },
};
