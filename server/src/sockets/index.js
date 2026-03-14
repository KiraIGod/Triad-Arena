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
        console.error("[Socket Auth] ОШИБКА: Фронтенд не передал токен!")
        return next(new Error("UNAUTHORIZED"))
      }

      const decoded = jwt.verify(token, process.env.JWT_SECRET || "dev_secret")

      const userId = decoded.id || decoded.userId || decoded.user_id

      if (!userId) {
        console.error("[Socket Auth] ОШИБКА: В токене нет ID юзера. Расшифровка:", decoded)
        return next(new Error("UNAUTHORIZED"))
      }

      socket.data.userId = userId;
      console.log(`[Socket Auth] Успешное подключение юзера ID: ${userId}`)
      return next()
    }
    catch (err) {
      console.error("[Socket Auth] ОШИБКА проверки токена:", err.message)
      return next(new Error("UNAUTHORIZED"))
    }
  })

  io.on("connection", (socket) => {
    console.log(`🔥 [Sockets] Главный коннект! ID: ${socket.id}`)
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
      }
      else {
        activeGames.set(normalizedGameId, { updatedAt: Date.now() })
      }
    })

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

    registerChatSocket(io, socket)

  })

  registerArenaSocket(io, activeGames)
  registerMatchSocket(io)

  return io
}

module.exports = { activeGames, initSocket }
