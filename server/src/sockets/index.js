const { Server } = require("socket.io");
const jwt = require("jsonwebtoken");
const registerMatchSocket = require("./matchSocket");
const registerArenaSocket = require("./arenaSocket");
const { cleanupArena } = require("../services/matchService");

const activeGames = new Map();

function initSocket(httpServer) {
  const io = new Server(httpServer, {
    cors: {
      origin: "*"
    }
  });

  io.use((socket, next) => {
    try {
      const token = socket.handshake?.auth?.token;
      if (!token) {
        return next(new Error("Authentication error"));
      }

      const payload = jwt.verify(token, process.env.JWT_SECRET || "dev_secret");
      const userId = payload?.userId || payload?.id;
      if (typeof userId !== "string" || userId.length === 0) {
        return next(new Error("Authentication error"));
      }

      socket.userId = userId;
      socket.data.userId = userId;
      return next();
    } catch (_error) {
      return next(new Error("Authentication error"));
    }
  });

  io.on("connection", (socket) => {
    socket.on("join_game", (gameId) => {
      const normalizedGameId = String(gameId);
      socket.join(normalizedGameId);
      const current = activeGames.get(normalizedGameId);
      if (current && typeof current === "object") {
        activeGames.set(normalizedGameId, {
          ...current,
          updatedAt: Date.now()
        });
      } else {
        activeGames.set(normalizedGameId, { updatedAt: Date.now() });
      }
    });

    socket.on("disconnect", () => {
      console.log(`[SOCKET] Player disconnected ${socket.userId || "unknown"}`);
      cleanupArena(activeGames, socket.userId, socket.id);
    });
  });

  registerMatchSocket(io);
  registerArenaSocket(io, activeGames);

  return io;
}

module.exports = { activeGames, initSocket };
