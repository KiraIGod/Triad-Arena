const jwt = require("jsonwebtoken");
const { Server } = require("socket.io");
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
        return next(new Error("UNAUTHORIZED"));
      }
      const decoded = jwt.verify(token, process.env.JWT_SECRET || "dev_secret");
      socket.data.userId = decoded.userId;
      return next();
    } catch (err) {
      return next(new Error("UNAUTHORIZED"));
    }
  });

  io.on("connection", (socket) => {
    io.emit("arena:online", io.sockets.sockets.size);

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

    socket.on("leave_game", (gameId) => {
      const normalizedGameId = String(gameId || "");
      if (!normalizedGameId) return;

      socket.leave(normalizedGameId);
      const userId = socket.data?.userId;
      cleanupArena(activeGames, userId, socket.id);
    });

    socket.on("disconnect", () => {
      const userId = socket.data?.userId;
      cleanupArena(activeGames, userId, socket.id);
      io.emit("arena:online", io.sockets.sockets.size);
    });
  });

  registerMatchSocket(io);
  registerArenaSocket(io, activeGames);

  return io;
}

module.exports = { activeGames, initSocket };
