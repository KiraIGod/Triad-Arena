"use strict";

const { randomUUID } = require("crypto");

module.exports = {
  async up(queryInterface) {
    const now = new Date();

    await queryInterface.bulkInsert("cards", [
      { id: randomUUID(), name: "Ashfang Duelist", type: "unit", triad_type: "assault", mana_cost: 2, attack: 3, hp: 2, description: "Swift frontline attacker.", image: "uploads/cards/ashfang_duelist.png", created_at: now },
      { id: randomUUID(), name: "Warhorn Juggernaut", type: "unit", triad_type: "assault", mana_cost: 4, attack: 5, hp: 4, description: "Heavy breaker of enemy lines.", image: "uploads/cards/warhorn_juggernaut.png", created_at: now },
      { id: randomUUID(), name: "Bloodfire Slash", type: "spell", triad_type: "assault", mana_cost: 2, attack: null, hp: null, description: "Deal 4 damage to a target.", image: "uploads/cards/bloodfire_slash.png", created_at: now },
      { id: randomUUID(), name: "Rallying Cry", type: "spell", triad_type: "assault", mana_cost: 1, attack: null, hp: null, description: "Give a friendly unit +2 attack this turn.", image: "uploads/cards/rallying_cry.png", created_at: now },
      { id: randomUUID(), name: "Crimson Barrage", type: "spell", triad_type: "assault", mana_cost: 3, attack: null, hp: null, description: "Deal 2 damage to all enemy units.", image: "uploads/cards/crimson_barrage.png", created_at: now },
      { id: randomUUID(), name: "Unbound Rage", type: "spell", triad_type: "assault", mana_cost: 2, attack: null, hp: null, description: "A friendly unit attacks again.", image: "uploads/cards/unbound_rage.png", created_at: now },

      { id: randomUUID(), name: "Duskfeather Ranger", type: "unit", triad_type: "precision", mana_cost: 3, attack: 3, hp: 3, description: "Balanced marksman with steady aim.", image: "uploads/cards/duskfeather_ranger.png", created_at: now },
      { id: randomUUID(), name: "Needlewind Scout", type: "unit", triad_type: "precision", mana_cost: 2, attack: 2, hp: 2, description: "Fast skirmisher that picks weak targets.", image: "uploads/cards/needlewind_scout.png", created_at: now },
      { id: randomUUID(), name: "Pinpoint Arrow", type: "spell", triad_type: "precision", mana_cost: 1, attack: null, hp: null, description: "Deal 3 damage to a target.", image: "uploads/cards/pinpoint_arrow.png", created_at: now },
      { id: randomUUID(), name: "Hunter's Mark", type: "spell", triad_type: "precision", mana_cost: 2, attack: null, hp: null, description: "Marked enemy takes extra damage this turn.", image: "uploads/cards/hunters_mark.png", created_at: now },
      { id: randomUUID(), name: "Tactical Reposition", type: "spell", triad_type: "precision", mana_cost: 1, attack: null, hp: null, description: "Return a friendly unit to your hand.", image: "uploads/cards/tactical_reposition.png", created_at: now },
      { id: randomUUID(), name: "Deadeye Volley", type: "spell", triad_type: "precision", mana_cost: 3, attack: null, hp: null, description: "Deal 2 damage three times randomly.", image: "uploads/cards/deadeye_volley.png", created_at: now },

      { id: randomUUID(), name: "Runesworn Adept", type: "unit", triad_type: "arcane", mana_cost: 2, attack: 2, hp: 3, description: "Young mage channeling raw energy.", image: "uploads/cards/runesworn_adept.png", created_at: now },
      { id: randomUUID(), name: "Astral Sentinel", type: "unit", triad_type: "arcane", mana_cost: 4, attack: 4, hp: 5, description: "Guardian forged of starlight.", image: "uploads/cards/astral_sentinel.png", created_at: now },
      { id: randomUUID(), name: "Arc Spark", type: "spell", triad_type: "arcane", mana_cost: 1, attack: null, hp: null, description: "Deal 2 damage and draw a card.", image: "uploads/cards/arc_spark.png", created_at: now },
      { id: randomUUID(), name: "Mana Surge", type: "spell", triad_type: "arcane", mana_cost: 2, attack: null, hp: null, description: "Gain temporary mana this turn.", image: "uploads/cards/mana_surge.png", created_at: now },
      { id: randomUUID(), name: "Mirror Sigil", type: "spell", triad_type: "arcane", mana_cost: 3, attack: null, hp: null, description: "Copy the last spell cast this turn.", image: "uploads/cards/mirror_sigil.png", created_at: now },
      { id: randomUUID(), name: "Void Rupture", type: "spell", triad_type: "arcane", mana_cost: 5, attack: null, hp: null, description: "Destroy a unit with 5 or less HP.", image: "uploads/cards/void_rupture.png", created_at: now }
    ]);
  },

  async down(queryInterface) {
    await queryInterface.bulkDelete("cards", null, {});
  }
};
