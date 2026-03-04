import { Router } from "express";
import { getLeaderboard } from "../controllers/leaderboardController.js";
import { jwtMiddleware } from "../middlewares/jwt.js";

const router = Router();

router.get("/", jwtMiddleware, getLeaderboard);

export default router;
