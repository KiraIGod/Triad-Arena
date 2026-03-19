const dotenv = require("dotenv")
const express = require("express")
const path = require('path')
const cors = require("cors")
const http = require("http")
const authRoutes = require("./routes/auth")
const leaderboardRoutes = require("./routes/leaderboard")
const deckBuilderRoutes = require("./routes/deckBuilder")
const matchesRoutes = require("./routes/matches")
const playersRoutes = require("./routes/players")
const { initSocket } = require("./sockets/index")
const friendsRouter = require('./routes/friendsRouter')
const db = require("./db/models")

dotenv.config()

const app = express()
const server = http.createServer(app)

app.use(
  cors({
    origin: process.env.CLIENT_URL || "http://localhost:5173",
    credentials: true
  })
)
app.use(express.json())

app.use("/api/auth", authRoutes)
app.use("/api/leaderboard", leaderboardRoutes)
app.use("/api/deck-builder", deckBuilderRoutes)
app.use("/api/matches", matchesRoutes)
app.use("/api/players", playersRoutes)
app.use('/static', express.static(path.join(__dirname, 'public')))
app.use('/api/friends', friendsRouter)

const io = initSocket(server)
app.set('io', io)

// В dev-среде бывает, что миграции не применились (или таблица не создалась),
// и чат/счетчики падают из-за отсутствующей таблицы "ChatMessages".
// Создаём/подгоняем схему минимально для ChatMessage при старте сервера.
db.ChatMessage.sync({ alter: true }).catch((err) => {
  console.error("[db] ChatMessage sync failed:", err?.message || err)
})

const PORT = process.env.PORT || 3001
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`)
})