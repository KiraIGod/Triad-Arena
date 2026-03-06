const { Server } = require("socket.io");
const registerMatchSocket = require("./matchSocket");
const registerArenaSocket = require("./arenaSocket");

const activeGames = new Map();

function initSocket(httpServer) {
  const io = new Server(httpServer, {
    cors: {
      origin: "*"
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
      // Placeholder for cleanup logic.
    });
  });

  registerMatchSocket(io);
  registerArenaSocket(io, activeGames);

  return io;
}

module.exports = { activeGames, initSocket };
