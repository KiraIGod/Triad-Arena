"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn("matches", "game_mode", {
      type: Sequelize.ENUM("normal", "ranked", "private"),
      allowNull: false,
      defaultValue: "normal"
    });

    await queryInterface.addColumn("match_history", "game_mode", {
      type: Sequelize.ENUM("normal", "ranked", "private"),
      allowNull: false,
      defaultValue: "normal"
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn("matches", "game_mode");
    await queryInterface.removeColumn("match_history", "game_mode");
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_matches_game_mode";');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_match_history_game_mode";');
  }
};
