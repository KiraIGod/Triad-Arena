const { DataTypes, Model } = require("sequelize");

function initDeckModel(sequelize) {
  class Deck extends Model {}

  Deck.init(
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true
      },
      user_id: {
        type: DataTypes.UUID,
        allowNull: false
      },
      name: {
        type: DataTypes.STRING,
        allowNull: false
      }
    },
    {
      sequelize,
      modelName: "Deck",
      tableName: "decks",
      createdAt: "created_at",
      updatedAt: "updated_at"
    }
  );

  return Deck;
}

module.exports = initDeckModel;
