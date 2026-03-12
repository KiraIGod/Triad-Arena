const { Op } = require("sequelize");
const db = require("../db/models/index");

const { MatchHistory, User } = db;

async function getMatchHistory(req, res) {
  try {
    const userId = req.user.userId;

    const history = await MatchHistory.findAll({
      where: {
        [Op.or]: [{ player_one_id: userId }, { player_two_id: userId }]
      },
      include: [
        { model: User, as: "history_player_one", attributes: ["id", "nickname"] },
        { model: User, as: "history_player_two", attributes: ["id", "nickname"] }
      ],
      order: [["finished_at", "DESC"]],
      limit: 20
    });

    const matches = history.map((m) => {
      const isPlayerOne = String(m.player_one_id) === String(userId);
      const opponent = isPlayerOne
        ? (m.history_player_two?.nickname ?? "UNKNOWN")
        : (m.history_player_one?.nickname ?? "UNKNOWN");

      let result = "Draw";
      if (m.winner_id) {
        result = String(m.winner_id) === String(userId) ? "Victory" : "Defeat";
      }

      const hpLeft = isPlayerOne
        ? (m.player_one_final_hp ?? 0)
        : (m.player_two_final_hp ?? 0);

      return {
        matchId: m.match_id,
        opponent,
        result,
        turns: m.total_turns ?? 0,
        hpLeft,
        date: m.finished_at,
        gameMode: m.game_mode || "normal"
      };
    });

    return res.json({ matches });
  } catch (error) {
    console.error("[getMatchHistory] error:", error?.message || error);
    return res.status(500).json({ message: "Failed to fetch match history" });
  }
}

module.exports = { getMatchHistory };
