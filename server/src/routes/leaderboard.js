const { Router } = require("express");
const { getLeaderboard } = require("../controllers/leaderboardController");
const { jwtMiddleware } = require("../middlewares/jwt");

const router = Router();

router.get("/", jwtMiddleware, getLeaderboard);

module.exports = router;
