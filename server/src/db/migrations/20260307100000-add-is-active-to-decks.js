"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn("decks", "is_active", {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: false
    });

    const [decks] = await queryInterface.sequelize.query(
      `SELECT DISTINCT ON (user_id) id FROM decks ORDER BY user_id, created_at ASC`
    );

    for (const deck of decks) {
      await queryInterface.sequelize.query(
        `UPDATE decks SET is_active = true WHERE id = :id`,
        { replacements: { id: deck.id } }
      );
    }
  },

  async down(queryInterface) {
    await queryInterface.removeColumn("decks", "is_active");
  }
};
