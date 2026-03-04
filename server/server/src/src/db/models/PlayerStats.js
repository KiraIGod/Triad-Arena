import { DataTypes, Model } from "sequelize";

export default function initPlayerStatsModel(sequelize) {
  class PlayerStats extends Model {}

  PlayerStats.init(
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true
      },
      user_id: {
        type: DataTypes.UUID,
        allowNull: false,
        unique: true
      },
      rating: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 1000
      },
      wins: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0
      },
      losses: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0
      },
      games_played: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0
      }
    },
    {
      sequelize,
      modelName: "PlayerStats",
      tableName: "player_stats",
      createdAt: "created_at",
      updatedAt: "updated_at"
    }
  );

  return PlayerStats;
}
