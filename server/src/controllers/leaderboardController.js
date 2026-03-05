const db = require("../db/models/index");

const { Match } = db;

async function getLeaderboard(_req, res) {
  try {
    const matches = await Match.findAll({
      limit: 10,
      order: [["created_at", "DESC"]]
    });

    return res.json({ leaderboard: matches });
  } catch (_error) {
    return res.status(500).json({ message: "Failed to fetch leaderboard" });
  }
}

module.exports = { getLeaderboard };
