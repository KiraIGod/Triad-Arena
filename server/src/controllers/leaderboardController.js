import { Game } from "../models/Game.js";

export async function getLeaderboard(_req, res) {
  try {
    const games = await Game.findAll({
      limit: 10,
      order: [["createdAt", "DESC"]]
    });

    return res.json({ leaderboard: games });
  } catch (_error) {
    return res.status(500).json({ message: "Failed to fetch leaderboard" });
  }
}
