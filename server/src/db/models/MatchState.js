const { DataTypes, Model } = require("sequelize");

function initMatchStateModel(sequelize) {
  class MatchState extends Model {}

  MatchState.init(
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true
      },
      match_id: {
        type: DataTypes.UUID,
        allowNull: false,
        unique: true
      },
      game_state: {
        type: DataTypes.JSONB,
        allowNull: false
      },
      updated_at: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW
      }
    },
    {
      sequelize,
      modelName: "MatchState",
      tableName: "match_states",
      timestamps: false
    }
  );

  return MatchState;
}

module.exports = initMatchStateModel;
