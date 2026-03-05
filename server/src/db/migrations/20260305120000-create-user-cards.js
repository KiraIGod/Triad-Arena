"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable("user_cards", {
      id: {
        type: Sequelize.UUID,
        allowNull: false,
        primaryKey: true,
        defaultValue: Sequelize.UUIDV4
      },
      user_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: "users",
          key: "id"
        },
        onDelete: "CASCADE",
        onUpdate: "CASCADE"
      },
      card_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: "cards",
          key: "id"
        },
        onDelete: "CASCADE",
        onUpdate: "CASCADE"
      },
      quantity: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 2
      }
    });

    await queryInterface.addConstraint("user_cards", {
      fields: ["user_id", "card_id"],
      type: "unique",
      name: "user_cards_user_id_card_id_unique"
    });

    await queryInterface.sequelize.query(
      "ALTER TABLE user_cards ADD CONSTRAINT user_cards_quantity_non_negative CHECK (quantity >= 0);"
    );
  },

  async down(queryInterface) {
    await queryInterface.dropTable("user_cards");
  }
};
