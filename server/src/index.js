const dotenv = require("dotenv");
const express = require("express");
const cors = require("cors");
const http = require("http");
const authRoutes = require("./routes/auth");
const leaderboardRoutes = require("./routes/leaderboard");
const { initSocket } = require("./sockets");

dotenv.config();

const app = express();
const server = http.createServer(app);

app.use(
  cors({
    origin: process.env.CLIENT_URL,
    credentials: true
  })
);
app.use(express.json());

app.use("/api/auth", authRoutes);
app.use("/api/leaderboard", leaderboardRoutes);

initSocket(server);

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
