const db = require("../db/models/index");

const { PlayerStats } = db;

async function getMyStats(req, res) {
  try {
    const userId = req.user.userId;

    const allStats = await PlayerStats.findAll({
      order: [["rating", "DESC"]],
      attributes: ["user_id", "rating"]
    });

    const rankIndex = allStats.findIndex((s) => String(s.user_id) === String(userId));
    const rank = rankIndex >= 0 ? rankIndex + 1 : null;

    const stats = await PlayerStats.findOne({ where: { user_id: userId } });

    if (!stats) {
      return res.json({ rating: 1000, wins: 0, losses: 0, games_played: 0, rank });
    }

    return res.json({
      rating: stats.rating,
      wins: stats.wins,
      losses: stats.losses,
      games_played: stats.games_played,
      rank
    });
  } catch (error) {
    console.error("[getMyStats] error:", error?.message || error);
    return res.status(500).json({ message: "Failed to fetch player stats" });
  }
}

module.exports = { getMyStats };
