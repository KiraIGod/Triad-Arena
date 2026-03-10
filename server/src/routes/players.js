const { Router } = require("express");
const { getMyStats } = require("../controllers/playerController");
const { jwtMiddleware } = require("../middlewares/jwt");

const router = Router();

router.get("/me/stats", jwtMiddleware, getMyStats);

module.exports = router;
