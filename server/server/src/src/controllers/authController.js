import { registerUser, loginUser } from "../services/authService.js";

export async function register(req, res) {
  try {
    const data = await registerUser(req.body);
    return res.status(201).json(data);
  } catch (error) {
    return res.status(400).json({ message: error.message || "Registration failed" });
  }
}

export async function login(req, res) {
  try {
    const data = await loginUser(req.body);
    return res.status(200).json(data);
  } catch (error) {
    return res.status(401).json({ message: error.message || "Login failed" });
  }
}
