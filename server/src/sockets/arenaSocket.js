const { randomUUID } = require("crypto");
const jwt = require("jsonwebtoken");
const { User, Card, DeckCard, Match } = require("../db/models");
const { getActiveDeckId } = require("../services/deckBuilderService");
const { registerActiveMatch } = require("../services/activeMatchTracker");


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

function pickWaitingArena(activeGames, gameMode = "normal", excludeUserId = null) {
  for (const [arenaId, arena] of activeGames.entries()) {
    if (
      arena?.status === "waiting" &&
      Array.isArray(arena.players) &&
      arena.players.length === 1 &&
      (arena.gameMode || "normal") === gameMode
    ) {
      if (excludeUserId && arena.players.some(p => String(p?.userId) === String(excludeUserId))) {
        continue;
      }
      return { arenaId, arena };
    }
  }
  return null;
}

function findPlayerWaitingArena(activeGames, userId, gameMode) {
  for (const [, arena] of activeGames.entries()) {
    if (
      arena?.status === "waiting" &&
      (arena.gameMode || "normal") === gameMode &&
      Array.isArray(arena.players) &&
      arena.players.some(p => String(p?.userId) === String(userId))
    ) {
      return true;
    }
  }
  return false;
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
    socket.on("arena:create", async (payload, ack) => {
      const callback = typeof payload === "function" ? payload : ack;
      const options = typeof payload === "object" && payload !== null && typeof payload !== "function" ? payload : {};
      const gameMode = ["normal", "ranked", "private"].includes(options.gameMode) ? options.gameMode : "normal";

      const hostNickname = (await getNicknameFromSocket(socket)) || "UNKNOWN";
      try {
        const arenaId = randomUUID();

        activeGames.set(arenaId, {
          id: arenaId,
          hostSocketId: socket.id,
          status: "waiting",
          gameMode,
          createdAt: Date.now(),
          updatedAt: Date.now(),
          players: [{ socketId: socket.id, userId: socket.data?.userId || null, nickname: hostNickname }]
        });

        socket.join(arenaId);
        console.log(`[arena:create] success arenaId=${arenaId} gameMode=${gameMode} socket=${socket.id}`);

        if (typeof callback === "function") {
          callback({ arenaId });
        }
      } catch (error) {
        console.error("[arena:create] failed:", error?.message || error);
        if (typeof callback === "function") {
          callback({ error: "Failed to create arena" });
        }
      }
    });

    const handleJoinRandom = async (payload, ack) => {
      const callback = typeof payload === "function" ? payload : ack;
      const options = typeof payload === "object" && payload !== null && typeof payload !== "function" ? payload : {};
      const gameMode = ["normal", "ranked", "private"].includes(options.gameMode) ? options.gameMode : "normal";

      try {
        const userId = socket.data?.userId;
        const picked = pickWaitingArena(activeGames, gameMode, userId);

        if (!picked) {
          if (!findPlayerWaitingArena(activeGames, userId, gameMode) && userId) {
            const autoNickname = (await getNicknameFromSocket(socket)) || "UNKNOWN";
            const arenaId = randomUUID();
            activeGames.set(arenaId, {
              id: arenaId,
              hostSocketId: socket.id,
              status: "waiting",
              gameMode,
              createdAt: Date.now(),
              updatedAt: Date.now(),
              players: [{ socketId: socket.id, userId, nickname: autoNickname }]
            });
            socket.join(arenaId);
            console.log(`[arena:join] auto-created arena ${arenaId} (${gameMode}) for ${userId}`);
          }

          if (typeof callback === "function") {
            callback({ error: "No available arena found" });
          }
          return;
        }

        const { arenaId, arena } = picked;
        if (!Array.isArray(arena?.players)) {
          if (typeof callback === "function") {
            callback({ error: "Arena is unavailable" });
          }
          return;
        }

        const joinerNickname = (await getNicknameFromSocket(socket)) || "UNKNOWN";
        const hostNickname = arena.players?.[0]?.nickname || "UNKNOWN";


        if (arena.hostSocketId === socket.id) {
          if (typeof callback === "function") {
            callback({ error: "Cannot join your own arena" });
          }
          return;
        }

        const isAlreadyInArena = arena.players.some((p) => p?.socketId === socket.id);
        if (!isAlreadyInArena && arena.players.length >= 2) {
          if (typeof callback === "function") {
            callback({ error: "Arena is full" });
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
              if (typeof callback === "function") {
                callback({ error: "Player identity is missing" });
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
              game_mode: arena.gameMode || "normal",
              status: "active",
              started_at: new Date()
            });

            arena.matchId = String(match.id);
            registerActiveMatch(match);
          }

          arena.status = "ready";
        }
        arena.updatedAt = Date.now();

        socket.join(arenaId);

        console.log(`[arena:join] success arenaId=${arenaId} socket=${socket.id}`);

        if (typeof callback === "function") {
          callback({ arenaId, opponentNickname: hostNickname, matchId: arena.matchId || null });
        }

        io.to(arenaId).emit("arena:ready", {
          arenaId,
          matchId: arena.matchId || null,
          players: arena.players
        });
      } catch (error) {
        console.error("[arena:join] failed:", error?.message || error);
        if (typeof callback === "function") {
          callback({ error: "Failed to join arena" });
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
