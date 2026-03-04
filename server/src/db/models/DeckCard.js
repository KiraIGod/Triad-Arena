const { DataTypes, Model } = require("sequelize");

module.exports = function initDeckCardModel(sequelize) {
  class DeckCard extends Model {}

  DeckCard.init(
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true
      },
      deck_id: {
        type: DataTypes.UUID,
        allowNull: false
      },
      card_id: {
        type: DataTypes.UUID,
        allowNull: false
      },
      quantity: {
        type: DataTypes.INTEGER,
        allowNull: false,
        validate: {
          max: 2
        }
      }
    },
    {
      sequelize,
      modelName: "DeckCard",
      tableName: "deck_cards",
      timestamps: false
    }
  );

  return DeckCard;
};
