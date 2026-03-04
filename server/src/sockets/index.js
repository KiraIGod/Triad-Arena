const { Server } = require("socket.io");

const activeGames = new Map();

function initSocket(httpServer) {
  const io = new Server(httpServer, {
    cors: {
      origin: "*"
    }
  });

  io.on("connection", (socket) => {
    socket.on("join_game", (gameId) => {
      socket.join(String(gameId));
      activeGames.set(String(gameId), { updatedAt: Date.now() });
    });

    socket.on("disconnect", () => {
      // Placeholder for cleanup logic.
    });
  });

  return io;
}

module.exports = { activeGames, initSocket };
