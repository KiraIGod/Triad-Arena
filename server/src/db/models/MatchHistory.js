const { DataTypes, Model } = require("sequelize");

function initMatchHistoryModel(sequelize) {
  class MatchHistory extends Model {}

  MatchHistory.init(
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true
      },
      match_id: {
        type: DataTypes.UUID,
        allowNull: false
      },
      player_one_id: {
        type: DataTypes.UUID,
        allowNull: false
      },
      player_two_id: {
        type: DataTypes.UUID,
        allowNull: true
      },
      winner_id: {
        type: DataTypes.UUID,
        allowNull: true
      },
      total_turns: {
        type: DataTypes.INTEGER,
        allowNull: true
      },
      player_one_final_hp: {
        type: DataTypes.INTEGER,
        allowNull: true
      },
      player_two_final_hp: {
        type: DataTypes.INTEGER,
        allowNull: true
      },
      game_mode: {
        type: DataTypes.ENUM("normal", "ranked", "private"),
        allowNull: false,
        defaultValue: "normal"
      },
      finished_at: {
        type: DataTypes.DATE,
        allowNull: true
      }
    },
    {
      sequelize,
      modelName: "MatchHistory",
      tableName: "match_history",
      timestamps: false
    }
  );

  return MatchHistory;
}

module.exports = initMatchHistoryModel;
