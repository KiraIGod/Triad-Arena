"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn("cards", "image", {
      type: Sequelize.STRING,
      allowNull: true
    });

    await queryInterface.sequelize.query(`
      UPDATE cards
      SET image = 'uploads/cards/' || lower(replace(name, ' ', '_')) || '.png'
      WHERE image IS NULL;
    `);

    await queryInterface.changeColumn("cards", "image", {
      type: Sequelize.STRING,
      allowNull: false
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn("cards", "image");
  }
};
