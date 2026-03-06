const { randomUUID } = require("crypto");
const jwt = require("jsonwebtoken");
const { User } = require("../db/models");


async function getNicknameFromSocket(socket) {
  const token = socket.handshake?.auth?.token;
  if (!token) return null;

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || "dev_secret");
    const user = await User.findByPk(decoded.userId, { attributes: ["id", "nickname"] });
    return user?.nickname || null;
  } catch {
    return null;
  }
}

function pickWaitingArena(activeGames) {
  for (const [arenaId, arena] of activeGames.entries()) {
    if (arena?.status === "waiting" && Array.isArray(arena.players) && arena.players.length === 1) {
      return { arenaId, arena };
    }
  }
  return null;
}

module.exports = function registerArenaSocket(io, activeGames) {
  io.on("connection", (socket) => {
    socket.on("arena:create", async (ack) => {
      const hostNickname = (await getNicknameFromSocket(socket)) || "UNKNOWN";
      try {
        const arenaId = randomUUID();

        activeGames.set(arenaId, {
          id: arenaId,
          hostSocketId: socket.id,
          status: "waiting",
          createdAt: Date.now(),
          updatedAt: Date.now(),
          players: [{ socketId: socket.id, userId: socket.userId || null, nickname: hostNickname }]
        });

        socket.join(arenaId);
        console.log(`[arena:create] success arenaId=${arenaId} socket=${socket.id}`);

        if (typeof ack === "function") {
          ack({ arenaId });
        }
      } catch (error) {
        console.error("[arena:create] failed:", error?.message || error);
        if (typeof ack === "function") {
          ack({ error: "Failed to create arena" });
        }
      }
    });

    const handleJoinRandom = async (ack) => {
      try {
        const picked = pickWaitingArena(activeGames);

        if (!picked) {
          if (typeof ack === "function") {
            ack({ error: "No available arena found" });
          }
          return;
        }

        const { arenaId, arena } = picked;
        if (!Array.isArray(arena?.players)) {
          if (typeof ack === "function") {
            ack({ error: "Arena is unavailable" });
          }
          return;
        }

        const joinerNickname = (await getNicknameFromSocket(socket)) || "UNKNOWN";
        const hostNickname = arena.players?.[0]?.nickname || "UNKNOWN";


        if (arena.hostSocketId === socket.id) {
          if (typeof ack === "function") {
            ack({ error: "Cannot join your own arena" });
          }
          return;
        }

        const isAlreadyInArena = arena.players.some((p) => p?.socketId === socket.id);
        if (!isAlreadyInArena && arena.players.length >= 2) {
          if (typeof ack === "function") {
            ack({ error: "Arena is full" });
          }
          return;
        }

        if (!isAlreadyInArena) {
          arena.players.push({
            socketId: socket.id,
            userId: socket.userId || null,
            nickname: joinerNickname
          });
        }

        if (arena.players.length === 2) {
          arena.status = "ready";
        }
        arena.updatedAt = Date.now();

        socket.join(arenaId);

        console.log(`[arena:join] success arenaId=${arenaId} socket=${socket.id}`);

        if (typeof ack === "function") {
          ack({ arenaId, opponentNickname: hostNickname });
        }

        io.to(arenaId).emit("arena:ready", {
          arenaId,
          players: arena.players
        });
      } catch (error) {
        console.error("[arena:join] failed:", error?.message || error);
        if (typeof ack === "function") {
          ack({ error: "Failed to join arena" });
        }
      }
    };


    socket.on("arena:join", handleJoinRandom);

    socket.on("arena:get-state", (payload, ack) => {
      try {
        const arenaId = String(payload?.arenaId || "");
        if (!arenaId) {
          if (typeof ack === "function") ack({ error: "arenaId is required" });
          return;
        }

        const arena = activeGames.get(arenaId);
        if (!arena) {
          if (typeof ack === "function") ack({ error: "Arena not found" });
          return;
        }

        if (typeof ack === "function") {
          ack({
            arenaId,
            status: arena.status,
            players: Array.isArray(arena.players) ? arena.players : []
          });
        }
      } catch (error) {
        if (typeof ack === "function") {
          ack({ error: "Failed to get arena state" });
        }
      }
    });


  });
};
