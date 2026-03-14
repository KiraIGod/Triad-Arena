const jwt = require("jsonwebtoken")
const { Server } = require("socket.io")
const registerArenaSocket = require("./arenaSocket")
const registerMatchSocket = require("./matchSocket")
const { cleanupArena } = require("../services/matchService")
const registerChatSocket = require("./chatSocket")

const activeGames = new Map()

function initSocket(httpServer) {
  const io = new Server(httpServer, {
    cors: {
      origin: "*"
    }
  })

  io.use((socket, next) => {
    try {
      const token = socket.handshake?.auth?.token
      if (!token) {
        return next(new Error("UNAUTHORIZED"))
      }
      const decoded = jwt.verify(token, process.env.JWT_SECRET || "dev_secret")
      socket.data.userId = decoded.userId
      return next()
    }
    catch (err) {
      return next(new Error("UNAUTHORIZED"))
    }
  })

  io.on("connection", (socket) => {
    io.emit("arena:online", io.sockets.sockets.size)

    socket.on("join_game", (gameId) => {
<<<<<<< HEAD
      const normalizedGameId = String(gameId)
      socket.join(normalizedGameId)
      const current = activeGames.get(normalizedGameId)
      if (current && typeof current === "object") {
        activeGames.set(normalizedGameId, {
          ...current,
          updatedAt: Date.now()
        })
      }
      else {
        activeGames.set(normalizedGameId, { updatedAt: Date.now() })
      }
    })
=======
      const normalizedGameId = String(gameId || "");
      if (!normalizedGameId) return;

      const userId = socket.data?.userId;
      const arena = activeGames.get(normalizedGameId);

      // Only allow joining arena rooms that exist and include this user.
      // This prevents authenticated-but-unauthorized users from joining
      // match rooms or foreign arena rooms to spectate hand/state data.
      if (!arena || !Array.isArray(arena.players)) return;
      const isParticipant = arena.players.some(
        (p) => p?.userId != null && String(p.userId) === String(userId)
      );
      if (!isParticipant) return;

      socket.join(normalizedGameId);
      activeGames.set(normalizedGameId, { ...arena, updatedAt: Date.now() });
    });
>>>>>>> 2f934aa126921099925c0196ee5a19ca4cc9ebb1

    socket.on("leave_game", (gameId) => {
      const normalizedGameId = String(gameId || "")
      if (!normalizedGameId) return

      socket.leave(normalizedGameId)
      const userId = socket.data?.userId
      cleanupArena(activeGames, userId, socket.id)
    })

    socket.on("disconnect", () => {
      const userId = socket.data?.userId
      cleanupArena(activeGames, userId, socket.id)
      io.emit("arena:online", io.sockets.sockets.size)
    })
  })

  registerArenaSocket(io, activeGames)
  registerMatchSocket(io)
  registerChatSocket(io)

  return io
}

module.exports = { activeGames, initSocket }
