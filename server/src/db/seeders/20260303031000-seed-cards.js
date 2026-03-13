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
        statuses: JSON.stringify([]),
        self_statuses: JSON.stringify([]),
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
        statuses: JSON.stringify([]),
        self_statuses: JSON.stringify([]),
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
        attack: 6,
        hp: 0,
        description: "Deal 6 damage to enemy hero.",
        statuses: JSON.stringify([]),
        self_statuses: JSON.stringify([]),
        image: "blood_strike.png",
        created_at: now,
      },

      {
        id: randomUUID(),
        name: "Brutal Cleave",
        type: "spell",
        triad_type: "assault",
        mana_cost: 3,
        attack: 4,
        hp: 0,
        description: "Deal 4 damage and apply Burn for 2 turns.",
        statuses: JSON.stringify([{ type: "burn", turns: 2 }]),
        self_statuses: JSON.stringify([]),
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
        description: "Apply Weak to enemy for 2 turns.",
        statuses: JSON.stringify([{ type: "weak", turns: 2 }]),
        self_statuses: JSON.stringify([]),
        image: "rage_surge.png",
        created_at: now,
      },

      {
        id: randomUUID(),
        name: "Execution",
        type: "spell",
        triad_type: "assault",
        mana_cost: 3,
        attack: 8,
        hp: 0,
        description: "Deal 8 damage to enemy hero.",
        statuses: JSON.stringify([]),
        self_statuses: JSON.stringify([]),
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
        statuses: JSON.stringify([]),
        self_statuses: JSON.stringify([]),
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
        statuses: JSON.stringify([]),
        self_statuses: JSON.stringify([]),
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
        attack: 3,
        hp: 0,
        description: "Deal 3 damage and apply Weak for 1 turn.",
        statuses: JSON.stringify([{ type: "weak", turns: 1 }]),
        self_statuses: JSON.stringify([]),
        image: "mark_target.png",
        created_at: now,
      },

      {
        id: randomUUID(),
        name: "Piercing Shot",
        type: "spell",
        triad_type: "precision",
        mana_cost: 2,
        attack: 5,
        hp: 0,
        description: "Deal 5 damage to enemy hero.",
        statuses: JSON.stringify([]),
        self_statuses: JSON.stringify([]),
        image: "piercing_shot.png",
        created_at: now,
      },

      {
        id: randomUUID(),
        name: "Focus",
        type: "spell",
        triad_type: "precision",
        mana_cost: 1,
        attack: 2,
        hp: 0,
        description: "Deal 2 damage to enemy hero.",
        statuses: JSON.stringify([]),
        self_statuses: JSON.stringify([]),
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
        description: "Apply Weak to enemy for 3 turns.",
        statuses: JSON.stringify([{ type: "weak", turns: 3 }]),
        self_statuses: JSON.stringify([]),
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
        statuses: JSON.stringify([]),
        self_statuses: JSON.stringify([]),
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
        statuses: JSON.stringify([]),
        self_statuses: JSON.stringify([]),
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
        attack: 4,
        hp: 0,
        description: "Deal 4 damage to enemy hero.",
        statuses: JSON.stringify([]),
        self_statuses: JSON.stringify([]),
        image: "arcane_burst.png",
        created_at: now,
      },

      {
        id: randomUUID(),
        name: "Echo Mind",
        type: "spell",
        triad_type: "arcane",
        mana_cost: 3,
        attack: 3,
        hp: 0,
        description: "Deal 3 damage and apply Burn for 1 turn.",
        statuses: JSON.stringify([{ type: "burn", turns: 1 }]),
        self_statuses: JSON.stringify([]),
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
        description: "Grant yourself Shield +5 for 2 turns.",
        statuses: JSON.stringify([]),
        self_statuses: JSON.stringify([{ type: "shield", turns: 2, amount: 5 }]),
        image: "energy_shift.png",
        created_at: now,
      },

      {
        id: randomUUID(),
        name: "Warp Pulse",
        type: "spell",
        triad_type: "arcane",
        mana_cost: 4,
        attack: 3,
        hp: 0,
        description: "Deal 3 damage and apply Burn for 2 turns.",
        statuses: JSON.stringify([{ type: "burn", turns: 2 }]),
        self_statuses: JSON.stringify([]),
        image: "warp_pulse.png",
        created_at: now,
      },
    ]);
  },

  async down(queryInterface) {
    await queryInterface.bulkDelete("cards", null, {});
  },
};
