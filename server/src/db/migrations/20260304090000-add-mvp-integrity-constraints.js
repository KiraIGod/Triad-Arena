"use strict";

module.exports = {
  async up(queryInterface) {
    await queryInterface.addConstraint("matches", {
      fields: ["winner_id"],
      type: "foreign key",
      name: "matches_winner_id_fkey",
      references: {
        table: "users",
        field: "id"
      },
      onDelete: "SET NULL",
      onUpdate: "CASCADE"
    });

    await queryInterface.addConstraint("match_states", {
      fields: ["match_id"],
      type: "unique",
      name: "match_states_match_id_unique"
    });

    await queryInterface.addConstraint("match_history", {
      fields: ["match_id"],
      type: "foreign key",
      name: "match_history_match_id_fkey",
      references: {
        table: "matches",
        field: "id"
      },
      onDelete: "CASCADE",
      onUpdate: "CASCADE"
    });

    await queryInterface.addConstraint("match_history", {
      fields: ["player_one_id"],
      type: "foreign key",
      name: "match_history_player_one_id_fkey",
      references: {
        table: "users",
        field: "id"
      },
      onUpdate: "CASCADE"
    });

    await queryInterface.addConstraint("match_history", {
      fields: ["player_two_id"],
      type: "foreign key",
      name: "match_history_player_two_id_fkey",
      references: {
        table: "users",
        field: "id"
      },
      onUpdate: "CASCADE"
    });

    await queryInterface.addConstraint("match_history", {
      fields: ["winner_id"],
      type: "foreign key",
      name: "match_history_winner_id_fkey",
      references: {
        table: "users",
        field: "id"
      },
      onDelete: "SET NULL",
      onUpdate: "CASCADE"
    });
  },

  async down(queryInterface) {
    await queryInterface.removeConstraint("match_history", "match_history_winner_id_fkey");
    await queryInterface.removeConstraint("match_history", "match_history_player_two_id_fkey");
    await queryInterface.removeConstraint("match_history", "match_history_player_one_id_fkey");
    await queryInterface.removeConstraint("match_history", "match_history_match_id_fkey");
    await queryInterface.removeConstraint("match_states", "match_states_match_id_unique");
    await queryInterface.removeConstraint("matches", "matches_winner_id_fkey");
  }
};
