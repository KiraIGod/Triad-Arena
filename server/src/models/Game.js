import { DataTypes, Model } from "sequelize";
import { sequelize } from "../config/database.js";

export class Game extends Model {}

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
