const jwt = require("jsonwebtoken")
const { Server } = require("socket.io")
const registerArenaSocket = require("./arenaSocket")
const registerMatchSocket = require("./matchSocket")
const { cleanupArena } = require("../services/matchService")
const registerChatSocket = require("./chatSocket")

const activeGames = new Map()
const connectedUsers = new Map()
const pendingArenaCleanup = new Map()
const ARENA_DISCONNECT_GRACE_MS = 10_000

function isUserOnline(userId) {
  return connectedUsers.has(String(userId))
}

function getSocketByUserId(io, userId) {
  const socketId = connectedUsers.get(String(userId))
  if (!socketId) return null
  return io.sockets.sockets.get(socketId) || null
}

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
        console.error("[Socket Auth] ERROR: frontend did not send token")
        return next(new Error("UNAUTHORIZED"))
      }

      const decoded = jwt.verify(token, process.env.JWT_SECRET || "dev_secret")
      const userId = decoded.id || decoded.userId || decoded.user_id

      if (!userId) {
        console.error("[Socket Auth] ERROR: token has no user id", decoded)
        return next(new Error("UNAUTHORIZED"))
      }

      socket.data.userId = userId
      console.log(`[Socket Auth] user connected: ${userId}`)
      return next()
    }
    catch (err) {
      console.error("[Socket Auth] token verification failed:", err.message)
      return next(new Error("UNAUTHORIZED"))
    }
  })

  io.on("connection", (socket) => {
    const userId = socket.data?.userId
    if (userId) {
      connectedUsers.set(String(userId), socket.id)
      const cleanupId = pendingArenaCleanup.get(String(userId))
      if (cleanupId) {
        clearTimeout(cleanupId)
        pendingArenaCleanup.delete(String(userId))
      }
    }

    console.log(`[Sockets] connected: ${socket.id}`)
    io.emit("arena:online", io.sockets.sockets.size)

    socket.on("join_game", (gameId) => {
      const normalizedGameId = String(gameId)
      socket.join(normalizedGameId)

      const current = activeGames.get(normalizedGameId)
      if (current && typeof current === "object") {
        activeGames.set(normalizedGameId, {
          ...current,
          updatedAt: Date.now()
        })
      } else {
        console.warn("[join_game] arena not found, room join only", {
          requestedGameId: normalizedGameId,
          userId: socket.data?.userId,
          socketId: socket.id
        })
      }
    })

    socket.on("leave_game", (gameId) => {
      const normalizedGameId = String(gameId || "")
      if (!normalizedGameId) return

      socket.leave(normalizedGameId)
      const currentUserId = socket.data?.userId
      cleanupArena(activeGames, currentUserId, socket.id)
    })

    socket.on("disconnect", () => {
      const uid = socket.data?.userId
      if (uid && connectedUsers.get(String(uid)) === socket.id) {
        connectedUsers.delete(String(uid))
      }

      if (uid) {
        const cleanupId = setTimeout(() => {
          if (!connectedUsers.has(String(uid))) {
            cleanupArena(activeGames, uid, socket.id)
          }
          pendingArenaCleanup.delete(String(uid))
        }, ARENA_DISCONNECT_GRACE_MS)

        pendingArenaCleanup.set(String(uid), cleanupId)
      } else {
        cleanupArena(activeGames, uid, socket.id)
      }

      io.emit("arena:online", io.sockets.sockets.size)
    })

    registerChatSocket(io, socket)
  })

  registerArenaSocket(io, activeGames)
  registerMatchSocket(io)

  return io
}

module.exports = { activeGames, connectedUsers, isUserOnline, getSocketByUserId, initSocket }
