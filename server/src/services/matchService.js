const db = require("../db/models");
const { createInitialGameState } = require("../game/gameState");
const { INVALID_ACTION, STATE_OUTDATED } = require("../game/constants");
const matchStateCache = new Map();
const eventLogCache = new Map();
const lastStateCache = new Map();
const STARTING_HAND_SIZE = 3;

function createError(type, message) {
  return { type, message };
}

function toVersion(value) {
  if (!Number.isFinite(value)) {
    return null;
  }

  return Math.trunc(value);
}

function getPlayerFromSocket(socket) {
  const candidates = [
    socket?.userId,
    socket?.data?.userId,
    socket?.data?.user?.id,
    socket?.user?.id,
    socket?.handshake?.auth?.userId,
    socket?.handshake?.auth?.id,
    socket?.handshake?.query?.userId
  ];

  const playerId = candidates.find((value) => typeof value === "string" && value.length > 0);
  return playerId || null;
}

function cloneValue(value) {
  return JSON.parse(JSON.stringify(value));
}

function shuffleArray(items) {
  const shuffled = Array.isArray(items) ? items.slice() : [];

  for (let i = shuffled.length - 1; i > 0; i -= 1) {
    const swapIndex = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[i]];
  }

  return shuffled;
}

function mapCardForMatchState(card) {
  if (!card) {
    return null;
  }

  return {
    id: card.id,
    name: card.name,
    type: card.type,
    triad_type: card.triad_type,
    mana_cost: card.mana_cost,
    attack: card.attack,
    hp: card.hp,
    description: card.description,
    image: card.image,
    // Spell effects — mapped to the field names the engine reads via collectStatuses().
    statuses: Array.isArray(card.statuses) ? card.statuses : [],
    selfStatuses: Array.isArray(card.self_statuses) ? card.self_statuses : [],
    created_at: card.created_at
  };
}

async function loadDeckCards(deckId) {
  if (!deckId) {
    return [];
  }

  const deckCards = await db.DeckCard.findAll({
    where: { deck_id: deckId },
    include: [{ model: db.Card }]
  });

  const expandedCards = [];
  for (const entry of deckCards) {
    const quantity = Math.max(0, Number(entry.quantity) || 0);
    const plainCard = mapCardForMatchState(entry.Card);
    if (!plainCard || quantity === 0) {
      continue;
    }

    for (let i = 0; i < quantity; i += 1) {
      expandedCards.push(cloneValue(plainCard));
    }
  }

  return shuffleArray(expandedCards);
}

async function buildInitialGameState(match) {
  const [playerOneDeck, playerTwoDeck] = await Promise.all([
    loadDeckCards(match.player_one_deck_id),
    loadDeckCards(match.player_two_deck_id)
  ]);

  const gameState = createInitialGameState(match.player_one_id, match.player_two_id, {
    playerOneDeck,
    playerTwoDeck
  });

  if (gameState.player1?.hand?.length > STARTING_HAND_SIZE) {
    gameState.player1.hand = gameState.player1.hand.slice(0, STARTING_HAND_SIZE);
  }
  if (gameState.player2?.hand?.length > STARTING_HAND_SIZE) {
    gameState.player2.hand = gameState.player2.hand.slice(0, STARTING_HAND_SIZE);
  }

  return gameState;
}

async function ensureMatchState(match) {
  const where = { match_id: match.id };
  let matchState = await db.MatchState.findOne({ where });

  if (matchState) {
    return matchState;
  }

  const gameState = await buildInitialGameState(match);
  matchState = await db.MatchState.create({
    match_id: match.id,
    game_state: gameState
  });

  return matchState;
}

async function loadMatchState(matchId) {
  const match = await db.Match.findByPk(matchId);
  if (!match) {
    throw createError(INVALID_ACTION, "Match not found");
  }

  const cachedState = matchStateCache.get(String(matchId));
  if (cachedState) {
    lastStateCache.set(String(matchId), cachedState);
    return {
      match,
      state: cachedState,
      matchState: null
    };
  }

  const matchState = await ensureMatchState(match);
  const state = matchState.game_state || {};
  const cacheKey = String(matchId);
  matchStateCache.set(cacheKey, state);
  lastStateCache.set(cacheKey, state);
  return {
    match,
    state,
    matchState
  };
}

async function saveMatchState(matchId, state, expectedVersion) {
  const normalizedExpected = toVersion(expectedVersion);

  return db.sequelize.transaction(async (transaction) => {
    const matchState = await db.MatchState.findOne({
      where: { match_id: matchId },
      transaction,
      lock: transaction.LOCK.UPDATE
    });

    if (!matchState) {
      throw createError(INVALID_ACTION, "Match state not found");
    }

    const currentVersion = toVersion(matchState.game_state?.version) || 0;
    if (normalizedExpected !== null && normalizedExpected !== currentVersion) {
      throw createError(STATE_OUTDATED, "Client state outdated");
    }

    await matchState.update(
      {
        game_state: state,
        updated_at: new Date()
      },
      { transaction }
    );

    const persistedState = matchState.game_state || state;
    const cacheKey = String(matchId);
    matchStateCache.set(cacheKey, persistedState);
    lastStateCache.set(cacheKey, persistedState);

    return persistedState;
  });
}

function appendMatchEvents(matchId, entries) {
  const cacheKey = String(matchId);
  const current = eventLogCache.get(cacheKey) || [];
  const inputList = Array.isArray(entries) ? entries : [entries];
  const nextEvents = inputList
    .filter((entry) => entry && entry.type)
    .map((entry, index) => ({
      eventId: current.length + index + 1,
      turn: Number.isFinite(entry.turn) ? entry.turn : null,
      type: entry.type,
      timestamp: Number.isFinite(entry.timestamp) ? entry.timestamp : Date.now(),
      payload: entry.payload && typeof entry.payload === "object" ? cloneValue(entry.payload) : {}
    }));

  if (nextEvents.length === 0) {
    return [];
  }

  const merged = current.concat(nextEvents);
  eventLogCache.set(cacheKey, merged);
  return nextEvents;
}

function getMatchEventLog(matchId) {
  return cloneValue(eventLogCache.get(String(matchId)) || []);
}

function getLastState(matchId) {
  const state = lastStateCache.get(String(matchId));
  return state ? cloneValue(state) : null;
}

function clearMatchRuntime(matchId) {
  const cacheKey = String(matchId);
  matchStateCache.delete(cacheKey);
  eventLogCache.delete(cacheKey);
  lastStateCache.delete(cacheKey);
}

function cleanupArena(activeGames, userId, socketId) {
  try {
    if (!(activeGames instanceof Map)) {
      return;
    }

    for (const [arenaId, arena] of activeGames.entries()) {
      if (!arena || !Array.isArray(arena.players)) {
        continue;
      }

      const nextPlayers = arena.players.filter((player) => {
        const sameSocket = socketId && player?.socketId === socketId;
        const sameUser = userId && player?.userId === userId;
        return !sameSocket && !sameUser;
      });

      if (nextPlayers.length === arena.players.length) {
        continue;
      }

      if (nextPlayers.length === 0) {
        activeGames.delete(arenaId);
        continue;
      }

      arena.players = nextPlayers;
      arena.updatedAt = Date.now();
      if (arena.status === "ready" && nextPlayers.length < 2) {
        arena.status = "waiting";
      }
      activeGames.set(arenaId, arena);
    }
  } catch (error) {
    console.error("[arena:cleanup] failed:", error?.message || error);
  }
}

module.exports = {
  loadMatchState,
  saveMatchState,
  getPlayerFromSocket,
  appendMatchEvents,
  getMatchEventLog,
  getLastState,
  clearMatchRuntime,
  cleanupArena,
  matchStateCache,
  eventLogCache,
  lastStateCache
};
