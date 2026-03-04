import { Server } from "socket.io";

export const activeGames = new Map();

export function initSocket(httpServer) {
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
