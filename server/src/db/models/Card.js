const { DataTypes, Model } = require("sequelize");

module.exports = function initCardModel(sequelize) {
  class Card extends Model {}

  Card.init(
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true
      },
      name: {
        type: DataTypes.STRING,
        allowNull: false
      },
      type: {
        type: DataTypes.ENUM("unit", "spell"),
        allowNull: false
      },
      triad_type: {
        type: DataTypes.ENUM("assault", "precision", "arcane"),
        allowNull: false
      },
      mana_cost: {
        type: DataTypes.INTEGER,
        allowNull: false
      },
      attack: {
        type: DataTypes.INTEGER,
        allowNull: true
      },
      hp: {
        type: DataTypes.INTEGER,
        allowNull: true
      },
      description: {
        type: DataTypes.TEXT,
        allowNull: false
      },
      image: {
        type: DataTypes.STRING,
        allowNull: false
      },
      created_at: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW
      }
    },
    {
      sequelize,
      modelName: "Card",
      tableName: "cards",
      timestamps: false
    }
  );

  return Card;
};
