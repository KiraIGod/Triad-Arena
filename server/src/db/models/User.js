import { DataTypes, Model } from "sequelize";

export default function initUserModel(sequelize) {
  class User extends Model {}

  User.init(
    {
      id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true
      },
      username: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true
      },
      passwordHash: {
        type: DataTypes.STRING,
        allowNull: false
      }
    },
    {
      sequelize,
      modelName: "User",
      tableName: "users",
      timestamps: true
    }
  );

  return User;
}
