import { DataTypes, Model } from "sequelize";

export default function initGameModel(sequelize) {
  class Game extends Model {}

  Game.init(
    {
      id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true
      },
      winnerUserId: {
        type: DataTypes.INTEGER,
        allowNull: true
      },
      status: {
        type: DataTypes.STRING,
        allowNull: false,
        defaultValue: "pending"
      }
    },
    {
      sequelize,
      modelName: "Game",
      tableName: "games",
      timestamps: true
    }
  );

  return Game;
}
