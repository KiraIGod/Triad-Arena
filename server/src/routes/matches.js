const { Router } = require("express");
const { getMatchHistory } = require("../controllers/matchHistoryController");
const { jwtMiddleware } = require("../middlewares/jwt");

const router = Router();

router.get("/history", jwtMiddleware, getMatchHistory);

module.exports = router;
