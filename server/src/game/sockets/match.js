const { Server } = require("socket.io");

const activeGames = new Map();

function initSocket(httpServer) {
  const io = new Server(httpServer, {
    cors: {
      origin: "*"
    }
  });

  io.on("connection", (socket) => {
    console.log("✅ connected:", socket.id)

      socket.on("arena:create", () => {
        const arenaId = uuidv4(); // You can use any UUID generation library, e.g., 'uuid' npm package
    // 1. Сгенерируй уникальный id (например, uuid)
    // 2. Добавь запись в activeGames: { players: [socket.id] }
    // 3. socket.join(arenaId)
    // 4. socket.emit("arena:created", { arenaId })
  });

    socket.on("arena:join", (payload) => {
      const { arenaId } = payload;
      console.log("ArenaId::: ", arenaId);
      socket.emit("arena:join", { arenaId });

      if (!arenaId) {
        socket.emit("arena:error", {
          type: "BAD_REQUEST",
          message: "arenaId required"
        });
        return;
      }

      // const match = getOrCreateMatch(matchId);
      socket.join(arenaId);
      console.log(`socket ${socket.id} joined arena ${arenaId}`);
      socket.emit("arena:state", {
        // gameState: match
      });
      // io.to(matchId).emit("game:update", { players: getPlayersInGame(matchId) });
    });

    socket.on("disconnect", (reason) => {
      console.log("❌ disconnected:", socket.id, reason);
      // Placeholder for cleanup logic.
    });

  });

  return io;
}

module.exports = { activeGames, initSocket };
