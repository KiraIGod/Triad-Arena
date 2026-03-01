import { Sequelize } from "sequelize";

const databaseUrl =
  process.env.DATABASE_URL || "postgres://postgres:postgres@localhost:5432/triad_arena";

export const sequelize = new Sequelize(databaseUrl, {
  dialect: "postgres",
  logging: false
});
