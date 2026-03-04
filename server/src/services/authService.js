const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const db = require("../db/models/index");

const { User } = db;

async function registerUser(payload) {
  const { username, password } = payload;

  if (!username || !password) {
    throw new Error("username and password are required");
  }

  const existing = await User.findOne({ where: { nickname: username } });
  if (existing) {
    throw new Error("username already exists");
  }

  const password_hash = await bcrypt.hash(password, 10);
  const user = await User.create({
    nickname: username,
    email: `${username.toLowerCase()}@triad-arena.local`,
    password_hash
  });

  const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET || "dev_secret", {
    expiresIn: "7d"
  });

  return { token, userId: user.id };
}

async function loginUser(payload) {
  const { username, password } = payload;

  if (!username || !password) {
    throw new Error("username and password are required");
  }

  const user = await User.findOne({ where: { nickname: username } });
  if (!user) {
    throw new Error("invalid credentials");
  }

  const isValid = await bcrypt.compare(password, user.password_hash);
  if (!isValid) {
    throw new Error("invalid credentials");
  }

  const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET || "dev_secret", {
    expiresIn: "7d"
  });

  return { token, userId: user.id };
}

module.exports = { registerUser, loginUser };
