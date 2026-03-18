const { randomUUID, randomBytes } = require("crypto");
const jwt = require("jsonwebtoken");
const { User, Card, DeckCard, Match, Friend } = require("../db/models");
const { Op } = require("sequelize");
const { getActiveDeckId } = require("../services/deckBuilderService");
const { registerActiveMatch } = require("../services/activeMatchTracker");
function lazyGetSocketByUserId(io, userId) {
  const { getSocketByUserId } = require("./index");
  return getSocketByUserId(io, userId);
}

function isUserOnlineByUserId(userId) {
  const { isUserOnline } = require("./index");
  return isUserOnline(userId);
}

function generateRoomCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = randomBytes(6);
  let code = "";
  for (let i = 0; i < 6; i++) {
    code += chars[bytes[i] % chars.length];
  }
  return code;
}

function findArenaByRoomCode(activeGames, roomCode) {
  const upper = String(roomCode).toUpperCase();
  for (const [arenaId, arena] of activeGames.entries()) {
    if (arena?.roomCode === upper && arena?.status === "waiting" && !arena.matchId) {
      return { arenaId, arena };
    }
  }
  return null;
}


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
  if (gameMode === "private") return null;
  for (const [arenaId, arena] of activeGames.entries()) {
    if (
      arena?.status === "waiting" &&
      !arena.matchId &&
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

function findArenaByUserId(activeGames, userId) {
  for (const [arenaId, arena] of activeGames.entries()) {
    if (
      Array.isArray(arena?.players) &&
      arena.players.some((p) => String(p?.userId) === String(userId))
    ) {
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

const PRIVATE_ARENA_TTL_MS = 5 * 60 * 1000;

function cleanupStalePrivateArenas(activeGames) {
  const now = Date.now();
  for (const [arenaId, arena] of activeGames.entries()) {
    if (
      arena?.gameMode === "private" &&
      arena?.status === "waiting" &&
      !arena.matchId &&
      (now - arena.createdAt) > PRIVATE_ARENA_TTL_MS
    ) {
      activeGames.delete(arenaId);
    }
  }
}

module.exports = function registerArenaSocket(io, activeGames) {
  const cleanupInterval = setInterval(() => cleanupStalePrivateArenas(activeGames), 60_000);

  io.on("connection", (socket) => {
    socket.on("arena:create", async (payload, ack) => {
      const callback = typeof payload === "function" ? payload : ack;
      const options = typeof payload === "object" && payload !== null && typeof payload !== "function" ? payload : {};
      const gameMode = ["normal", "ranked", "private"].includes(options.gameMode) ? options.gameMode : "normal";

      const hostNickname = (await getNicknameFromSocket(socket)) || "UNKNOWN";
      try {
        console.log("[arena:create] request", {
          userId: socket.data?.userId,
          socketId: socket.id,
          gameMode,
        });
        if (gameMode === "private") {
          const userId = socket.data?.userId;
          if (findPlayerWaitingArena(activeGames, userId, "private")) {
            if (typeof callback === "function") callback({ error: "You already have an active private room" });
            return;
          }
        }

        const arenaId = randomUUID();
        const roomCode = gameMode === "private" ? generateRoomCode() : null;

        activeGames.set(arenaId, {
          id: arenaId,
          hostSocketId: socket.id,
          status: "waiting",
          gameMode,
          roomCode,
          createdAt: Date.now(),
          updatedAt: Date.now(),
          players: [{ socketId: socket.id, userId: socket.data?.userId || null, nickname: hostNickname }]
        });

        socket.join(arenaId);

        if (typeof callback === "function") {
          console.log("[arena:create] success", {
            userId: socket.data?.userId,
            arenaId,
            roomCode,
            gameMode,
          });
          callback({ arenaId, roomCode });
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
        console.log("[arena:join] request", {
          userId,
          socketId: socket.id,
          gameMode,
        });
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
            console.log("[arena:join] no waiting arena", {
              userId,
              gameMode,
            });
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

        if (arena.status !== "waiting" || arena.matchId || arena.players.length >= 2) {
          if (typeof callback === "function") {
            callback({ error: "Arena is no longer available" });
          }
          return;
        }

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

        if (typeof callback === "function") {
          console.log("[arena:join] success", {
            userId,
            arenaId,
            matchId: arena.matchId || null,
            players: arena.players?.map((p) => ({
              userId: p?.userId,
              nickname: p?.nickname,
            })),
          });
          callback({ arenaId, opponentNickname: hostNickname, matchId: arena.matchId || null });
        }

        console.log("[arena:ready] emit", {
          arenaId,
          matchId: arena.matchId || null,
          players: arena.players?.map((p) => ({
            userId: p?.userId,
            nickname: p?.nickname,
          })),
        });
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

    socket.on("arena:cancel-search", () => {
      const userId = socket.data?.userId;
      if (!userId) return;

      for (const [arenaId, arena] of activeGames.entries()) {
        if (
          arena?.status === "waiting" &&
          !arena.matchId &&
          Array.isArray(arena.players) &&
          arena.players.some(p => String(p?.userId) === String(userId))
        ) {
          const remaining = arena.players.filter(
            p => String(p?.userId) !== String(userId)
          );
          if (remaining.length === 0) {
            activeGames.delete(arenaId);
          } else {
            arena.players = remaining;
            arena.updatedAt = Date.now();
            activeGames.set(arenaId, arena);
          }
          socket.leave(arenaId);
        }
      }
    });

    socket.on("arena:join-by-code", async (payload, ack) => {
      const callback = typeof payload === "function" ? payload : ack;
      const options = typeof payload === "object" && payload !== null && typeof payload !== "function" ? payload : {};
      const roomCode = String(options.roomCode || "").trim().toUpperCase();

      if (!roomCode) {
        if (typeof callback === "function") callback({ error: "Room code is required" });
        return;
      }

      try {
        const found = findArenaByRoomCode(activeGames, roomCode);
        console.log("[arena:join-by-code] request", {
          userId: socket.data?.userId,
          socketId: socket.id,
          roomCode,
          found: Boolean(found),
        });
        if (!found) {
          if (typeof callback === "function") callback({ error: "Room not found" });
          return;
        }

        const { arenaId, arena } = found;
        if (!Array.isArray(arena.players) || arena.players.length >= 2) {
          if (typeof callback === "function") callback({ error: "Room is full" });
          return;
        }

        if (arena.hostSocketId === socket.id) {
          if (typeof callback === "function") callback({ error: "Cannot join your own room" });
          return;
        }

        const userId = socket.data?.userId;
        if (arena.players.some(p => String(p?.userId) === String(userId))) {
          if (typeof callback === "function") callback({ error: "Already in this room" });
          return;
        }

        const joinerNickname = (await getNicknameFromSocket(socket)) || "UNKNOWN";
        const hostNickname = arena.players[0]?.nickname || "UNKNOWN";

        arena.players.push({
          socketId: socket.id,
          userId: userId || null,
          nickname: joinerNickname
        });

        if (arena.players.length === 2 && !arena.matchId) {
          const hostUserId = arena.players[0]?.userId;
          const joinerUserId = arena.players[1]?.userId;

          if (!hostUserId || !joinerUserId) {
            if (typeof callback === "function") callback({ error: "Player identity is missing" });
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
            game_mode: arena.gameMode || "private",
            status: "active",
            started_at: new Date()
          });

          arena.matchId = String(match.id);
          registerActiveMatch(match);
          arena.status = "ready";
        }

        arena.updatedAt = Date.now();
        socket.join(arenaId);

        if (typeof callback === "function") {
          console.log("[arena:join-by-code] success", {
            userId,
            arenaId,
            matchId: arena.matchId || null,
          });
          callback({ arenaId, opponentNickname: hostNickname, matchId: arena.matchId || null });
        }

        console.log("[arena:ready] emit", {
          arenaId,
          matchId: arena.matchId || null,
          players: arena.players?.map((p) => ({
            userId: p?.userId,
            nickname: p?.nickname,
          })),
        });
        io.to(arenaId).emit("arena:ready", {
          arenaId,
          matchId: arena.matchId || null,
          players: arena.players
        });
      } catch (error) {
        console.error("[arena:join-by-code] failed:", error?.message || error);
        if (typeof callback === "function") callback({ error: "Failed to join room" });
      }
    });

    socket.on("arena:invite", async (payload, ack) => {
      const callback = typeof payload === "function" ? payload : ack;
      const options = typeof payload === "object" && payload !== null && typeof payload !== "function" ? payload : {};
      const { arenaId, targetUserId } = options;

      if (!arenaId || !targetUserId) {
        if (typeof callback === "function") callback({ error: "arenaId and targetUserId required" });
        return;
      }

      try {
        const userId = socket.data?.userId;
        const arena = activeGames.get(arenaId);

        if (!arena || arena.gameMode !== "private" || arena.status !== "waiting") {
          if (typeof callback === "function") callback({ error: "Room not available" });
          return;
        }

        if (!arena.players?.some(p => String(p?.userId) === String(userId))) {
          if (typeof callback === "function") callback({ error: "Not your room" });
          return;
        }

        const friendship = await Friend.findOne({
          where: {
            status: "accepted",
            [Op.or]: [
              { userId, friendId: targetUserId },
              { userId: targetUserId, friendId: userId }
            ]
          }
        });

        if (!friendship) {
          if (typeof callback === "function") callback({ error: "Not on your friend list" });
          return;
        }

        // Важно: у пользователя может быть несколько socket-коннектов (например, чат/лобби),
        // поэтому не выбираем "один" socket по connectedUsers, а шлём всем сокетам в room userId.
        // Проверяем наличие активных сокетов именно в room с именем userId.
        // Это корректно работает при множественных socket-коннектах на одного пользователя.
        const room = io.sockets.adapter.rooms.get(String(targetUserId));
        const hasTargetSockets = Boolean(room && room.size > 0);

        if (!hasTargetSockets) {
          if (typeof callback === "function") callback({ error: "Friend is offline" });
          return;
        }

        const hostNickname = arena.players[0]?.nickname || "UNKNOWN";
        io.to(String(targetUserId)).emit("arena:invitation", {
          arenaId,
          roomCode: arena.roomCode || null,
          hostNickname,
          hostUserId: userId
        });

        if (typeof callback === "function") callback({ success: true });
      } catch (error) {
        console.error("[arena:invite] failed:", error?.message || error);
        if (typeof callback === "function") callback({ error: "Failed to send invite" });
      }
    });

    socket.on("arena:get-state", (payload, ack) => {
      try {
        const arenaId = String(payload?.arenaId || "");
        console.log("[arena:get-state] request", {
          requestedArenaId: arenaId,
          userId: socket.data?.userId,
          socketId: socket.id,
        });
        if (!arenaId) {
          if (typeof ack === "function") ack({ error: "arenaId is required" });
          return;
        }

        let resolvedArenaId = arenaId;
        let arena = activeGames.get(arenaId);

        if (!arena) {
          const fallback = findArenaByUserId(activeGames, socket.data?.userId);
          if (fallback) {
            resolvedArenaId = fallback.arenaId;
            arena = fallback.arena;
          }
        }

        if (!arena) {
          console.log("[arena:get-state] not found", {
            requestedArenaId: arenaId,
            userId: socket.data?.userId,
          });
          if (typeof ack === "function") ack({ error: "Arena not found" });
          return;
        }

        if (typeof ack === "function") {
          console.log("[arena:get-state] success", {
            requestedArenaId: arenaId,
            resolvedArenaId,
            userId: socket.data?.userId,
            matchId: arena.matchId || null,
            status: arena.status,
          });
          ack({
            arenaId: resolvedArenaId,
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
