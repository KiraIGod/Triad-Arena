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

    socket.on("match:join", (payload) => {
      const { matchId } = payload;
      console.log("MatchId::: ", matchId);
      socket.emit("match:join", { matchId });

      if (!matchId) {
        socket.emit("match:error", {
          type: "BAD_REQUEST",
          message: "matchId required"
        });
        return;
      }

      // const match = getOrCreateMatch(matchId);
      socket.join(matchId);
      console.log(`socket ${socket.id} joined match ${matchId}`);
      socket.emit("match:state", {
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
