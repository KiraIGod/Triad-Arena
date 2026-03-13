const { DataTypes, Model } = require("sequelize");

function initFriendModel(sequelize) {
  class Friend extends Model {}

  Friend.init(
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true
      },
      userId: {
        type: DataTypes.UUID,
        allowNull: false
      },
      friendId: {
        type: DataTypes.UUID,
        allowNull: false
      },
      status: {
        type: DataTypes.STRING,
        allowNull: false,
        defaultValue: 'pending'
      }
    },
    {
      sequelize,
      modelName: "Friend",
      tableName: "friends",
      createdAt: "created_at",
      updatedAt: "updated_at"
    }
  )

  return Friend
}

module.exports = initFriendModel