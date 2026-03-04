import { Sequelize } from "sequelize";
import { createRequire } from "module";

const require = createRequire(import.meta.url);
const rawConfig = require("./config.js");
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
    logging: Boolean(config.logging)
  }
);

export { sequelize, Sequelize };
