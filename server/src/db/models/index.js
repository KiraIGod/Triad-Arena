import { Sequelize } from "sequelize";
import { createRequire } from "module";
import initUserModel from "./User.js";
import initGameModel from "./Game.js";

const require = createRequire(import.meta.url);
const rawConfig = require("../config/config.js");
const env = process.env.NODE_ENV || "development";
const config = rawConfig[env] || rawConfig.development;

const sequelize = new Sequelize(
  config.database,
  config.username,
  config.password,
  {
    host: config.host,
    port: config.port,
    dialect: config.dialect,
    logging: false
  }
);

const db = {};

db.User = initUserModel(sequelize);
db.Game = initGameModel(sequelize);

db.sequelize = sequelize;
db.Sequelize = Sequelize;

export { sequelize, Sequelize, db };
export default db;
