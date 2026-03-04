const { Sequelize } = require("sequelize");
const rawConfig = require("./config");

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

module.exports = { sequelize, Sequelize };
