import { DataTypes, Model } from "sequelize";

export default function initMatchModel(sequelize) {
  class Match extends Model {}

  Match.init(
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true
      },
      player_one_id: {
        type: DataTypes.UUID,
        allowNull: false
      },
      player_two_id: {
        type: DataTypes.UUID,
        allowNull: true
      },
      player_one_deck_id: {
        type: DataTypes.UUID,
        allowNull: false
      },
      player_two_deck_id: {
        type: DataTypes.UUID,
        allowNull: true
      },
      status: {
        type: DataTypes.ENUM("searching", "active", "finished"),
        allowNull: false
      },
      winner_id: {
        type: DataTypes.UUID,
        allowNull: true
      },
      started_at: {
        type: DataTypes.DATE,
        allowNull: true
      },
      finished_at: {
        type: DataTypes.DATE,
        allowNull: true
      },
      created_at: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW
      }
    },
    {
      sequelize,
      modelName: "Match",
      tableName: "matches",
      timestamps: false
    }
  );

  return Match;
}
