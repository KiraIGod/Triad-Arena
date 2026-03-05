const { DataTypes, Model } = require("sequelize");

function initUserCardModel(sequelize) {
  class UserCard extends Model {}

  UserCard.init(
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
      card_id: {
        type: DataTypes.UUID,
        allowNull: false
      },
      quantity: {
        type: DataTypes.INTEGER,
        allowNull: false,
        validate: {
          min: 0
        }
      }
    },
    {
      sequelize,
      modelName: "UserCard",
      tableName: "user_cards",
      timestamps: false
    }
  );

  return UserCard;
}

module.exports = initUserCardModel;
