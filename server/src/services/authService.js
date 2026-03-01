import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import db from "../db/models/index.js";

const { User } = db;

export async function registerUser(payload) {
  const { username, password } = payload;

  if (!username || !password) {
    throw new Error("username and password are required");
  }

  const existing = await User.findOne({ where: { username } });
  if (existing) {
    throw new Error("username already exists");
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const user = await User.create({ username, passwordHash });

  const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET || "dev_secret", {
    expiresIn: "7d"
  });

  return { token, userId: user.id };
}

export async function loginUser(payload) {
  const { username, password } = payload;

  if (!username || !password) {
    throw new Error("username and password are required");
  }

  const user = await User.findOne({ where: { username } });
  if (!user) {
    throw new Error("invalid credentials");
  }

  const isValid = await bcrypt.compare(password, user.passwordHash);
  if (!isValid) {
    throw new Error("invalid credentials");
  }

  const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET || "dev_secret", {
    expiresIn: "7d"
  });

  return { token, userId: user.id };
}
