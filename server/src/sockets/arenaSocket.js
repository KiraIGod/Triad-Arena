const { randomUUID } = require("crypto");
const jwt = require("jsonwebtoken");
const { User, Card, DeckCard, Match } = require("../db/models");
const { getActiveDeckId } = require("../services/deckBuilderService");


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

async function ensurePlayerDeckId(userId) {
  const deckId = await getActiveDeckId(userId);
  if (!deckId) {
    throw new Error("Active deck not found");
  }

  const rawDeckCards = await DeckCard.findAll({ where: { deck_id: deckId } });
  const rawTotalCards = rawDeckCards.reduce((sum, dc) => sum + (Number(dc.quantity) || 0), 0);

  const validDeckCards = await DeckCard.findAll({
    where: { deck_id: deckId },
    include: [{ model: Card, required: true }]
  });
  const validTotalCards = validDeckCards.reduce((sum, dc) => sum + (Number(dc.quantity) || 0), 0);

  if (rawTotalCards !== 20 || validTotalCards !== 20) {
    throw new Error("Deck must contain 20 cards");
  }

  return deckId;
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
          players: [{ socketId: socket.id, userId: socket.data?.userId || null, nickname: hostNickname }]
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
            userId: socket.data?.userId || null,
            nickname: joinerNickname
          });
        }

        if (arena.players.length === 2) {
          if (!arena.matchId) {
            const hostUserId = arena.players[0]?.userId;
            const joinerUserId = arena.players[1]?.userId;

            if (!hostUserId || !joinerUserId) {
              if (typeof ack === "function") {
                ack({ error: "Player identity is missing" });
              }
              return;
            }

            const [playerOneDeckId, playerTwoDeckId] = await Promise.all([
              ensurePlayerDeckId(hostUserId),
              ensurePlayerDeckId(joinerUserId)
            ]);

            const match = await Match.create({
              player_one_id: hostUserId,
              player_two_id: joinerUserId,
              player_one_deck_id: playerOneDeckId,
              player_two_deck_id: playerTwoDeckId,
              status: "active",
              started_at: new Date()
            });

            arena.matchId = String(match.id);
          }

          arena.status = "ready";
        }
        arena.updatedAt = Date.now();

        socket.join(arenaId);

        console.log(`[arena:join] success arenaId=${arenaId} socket=${socket.id}`);

        if (typeof ack === "function") {
          ack({ arenaId, opponentNickname: hostNickname, matchId: arena.matchId || null });
        }

        io.to(arenaId).emit("arena:ready", {
          arenaId,
          matchId: arena.matchId || null,
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
            matchId: arena.matchId || null,
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
