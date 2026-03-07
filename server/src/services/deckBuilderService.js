const db = require("../db/models");

const { Card, Deck, DeckCard, UserCard } = db;
const MAX_DECK_SIZE = 20;
const MAX_DECKS = 3;
const DEFAULT_COLLECTION_QUANTITY = 2;
const DEFAULT_DECK_NAME = "Main Deck";

function normalizeDeckItems(items) {
  if (!Array.isArray(items)) {
    throw new Error("deckItems must be an array");
  }

  const normalized = items.map((item) => ({
    cardId: item?.cardId,
    quantity: Number(item?.quantity)
  }));

  for (const item of normalized) {
    if (!item.cardId || !Number.isInteger(item.quantity) || item.quantity <= 0) {
      throw new Error("Each deck item must include cardId and positive integer quantity");
    }
  }

  return normalized;
}

async function ensureUserCollection(userId, transaction) {
  const cards = await Card.findAll({
    attributes: ["id"],
    transaction
  });

  if (cards.length === 0) {
    return;
  }

  const existing = await UserCard.findAll({
    where: { user_id: userId },
    attributes: ["card_id"],
    transaction
  });
  const existingCardIds = new Set(existing.map((entry) => entry.card_id));

  const missingRows = cards
    .filter((card) => !existingCardIds.has(card.id))
    .map((card) => ({
      user_id: userId,
      card_id: card.id,
      quantity: DEFAULT_COLLECTION_QUANTITY
    }));

  if (missingRows.length > 0) {
    await UserCard.bulkCreate(missingRows, { transaction });
  }
}

function mapCardForResponse(card) {
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
    created_at: card.created_at
  };
}

async function getAllCards() {
  const cards = await Card.findAll({
    order: [
      ["mana_cost", "ASC"],
      ["name", "ASC"]
    ]
  });

  return cards.map(mapCardForResponse);
}

async function getUserCollection(userId) {
  await db.sequelize.transaction(async (transaction) => {
    await ensureUserCollection(userId, transaction);
  });

  const collection = await UserCard.findAll({
    where: { user_id: userId },
    include: [{ model: Card }],
    order: [[Card, "name", "ASC"]]
  });

  return collection.map((entry) => ({
    cardId: entry.card_id,
    quantity: entry.quantity,
    card: mapCardForResponse(entry.Card)
  }));
}

function formatDeckResponse(deck, deckCards) {
  const cards = deckCards.map((entry) => ({
    cardId: entry.card_id,
    quantity: entry.quantity,
    card: mapCardForResponse(entry.Card)
  }));
  const totalCards = cards.reduce((sum, card) => sum + card.quantity, 0);

  return {
    id: deck.id,
    name: deck.name,
    isActive: deck.is_active,
    totalCards,
    maxCards: MAX_DECK_SIZE,
    cards
  };
}

async function getUserDecks(userId) {
  let decks = await Deck.findAll({
    where: { user_id: userId },
    order: [["created_at", "ASC"]]
  });

  if (decks.length === 0) {
    const deck = await Deck.create({
      user_id: userId,
      name: DEFAULT_DECK_NAME,
      is_active: true
    });
    decks = [deck];
  }

  const deckIds = decks.map((d) => d.id);
  const allDeckCards = await DeckCard.findAll({
    where: { deck_id: deckIds },
    include: [{ model: Card }],
    order: [[Card, "name", "ASC"]]
  });

  const cardsByDeckId = new Map();
  for (const dc of allDeckCards) {
    const arr = cardsByDeckId.get(dc.deck_id) || [];
    arr.push(dc);
    cardsByDeckId.set(dc.deck_id, arr);
  }

  return decks.map((deck) =>
    formatDeckResponse(deck, cardsByDeckId.get(deck.id) || [])
  );
}

async function getUserDeckById(userId, deckId) {
  const deck = await Deck.findOne({
    where: { id: deckId, user_id: userId }
  });

  if (!deck) {
    throw new Error("Deck not found");
  }

  const deckCards = await DeckCard.findAll({
    where: { deck_id: deck.id },
    include: [{ model: Card }],
    order: [[Card, "name", "ASC"]]
  });

  return formatDeckResponse(deck, deckCards);
}

async function getUserDeck(userId) {
  const decks = await getUserDecks(userId);
  const active = decks.find((d) => d.isActive);
  return active || decks[0];
}

async function createUserDeck(userId, name) {
  const existingCount = await Deck.count({ where: { user_id: userId } });
  if (existingCount >= MAX_DECKS) {
    throw new Error(`Cannot have more than ${MAX_DECKS} decks`);
  }

  const trimmed = (name || "").trim();
  if (!trimmed || trimmed.length > 30) {
    throw new Error("Deck name must be 1-30 characters");
  }

  const isFirst = existingCount === 0;
  const deck = await Deck.create({
    user_id: userId,
    name: trimmed,
    is_active: isFirst
  });

  return formatDeckResponse(deck, []);
}

async function deleteUserDeck(userId, deckId) {
  const deck = await Deck.findOne({
    where: { id: deckId, user_id: userId }
  });
  if (!deck) {
    throw new Error("Deck not found");
  }

  const totalDecks = await Deck.count({ where: { user_id: userId } });
  if (totalDecks <= 1) {
    throw new Error("Cannot delete the last deck");
  }

  const wasActive = deck.is_active;
  await DeckCard.destroy({ where: { deck_id: deckId } });
  await deck.destroy();

  if (wasActive) {
    const firstRemaining = await Deck.findOne({
      where: { user_id: userId },
      order: [["created_at", "ASC"]]
    });
    if (firstRemaining) {
      firstRemaining.is_active = true;
      await firstRemaining.save();
    }
  }

  return getUserDecks(userId);
}

async function renameUserDeck(userId, deckId, name) {
  const trimmed = (name || "").trim();
  if (!trimmed || trimmed.length > 30) {
    throw new Error("Deck name must be 1-30 characters");
  }

  const deck = await Deck.findOne({
    where: { id: deckId, user_id: userId }
  });
  if (!deck) {
    throw new Error("Deck not found");
  }

  deck.name = trimmed;
  await deck.save();

  return getUserDeckById(userId, deckId);
}

async function setActiveDeck(userId, deckId) {
  const deck = await Deck.findOne({
    where: { id: deckId, user_id: userId }
  });
  if (!deck) {
    throw new Error("Deck not found");
  }

  await db.sequelize.transaction(async (transaction) => {
    await Deck.update(
      { is_active: false },
      { where: { user_id: userId }, transaction }
    );
    deck.is_active = true;
    await deck.save({ transaction });
  });

  return getUserDecks(userId);
}

async function validateDeckItems(userId, compactItems, transaction) {
  const cardIds = compactItems.map((item) => item.cardId);
  const [collectionRows, existingCards] = await Promise.all([
    UserCard.findAll({
      where: { user_id: userId },
      transaction
    }),
    Card.findAll({
      where: { id: cardIds },
      attributes: ["id"],
      transaction
    })
  ]);

  const existingCardIds = new Set(existingCards.map((card) => card.id));
  const collectionByCardId = new Map(collectionRows.map((row) => [row.card_id, row.quantity]));

  for (const item of compactItems) {
    if (!existingCardIds.has(item.cardId)) {
      throw new Error(`Card ${item.cardId} does not exist`);
    }
    const owned = collectionByCardId.get(item.cardId) || 0;
    if (item.quantity > owned) {
      throw new Error("Cannot add more copies than owned");
    }
  }
}

async function persistDeck(userId, deckId, deckItemsInput, options = { requireExactSize: false }) {
  const deckItems = normalizeDeckItems(deckItemsInput);

  const deduped = new Map();
  for (const item of deckItems) {
    const previous = deduped.get(item.cardId) || 0;
    deduped.set(item.cardId, previous + item.quantity);
  }

  const compactItems = Array.from(deduped.entries()).map(([cardId, quantity]) => ({ cardId, quantity }));
  const totalDeckCards = compactItems.reduce((sum, item) => sum + item.quantity, 0);
  if (options.requireExactSize && totalDeckCards !== MAX_DECK_SIZE) {
    throw new Error(`Deck must contain exactly ${MAX_DECK_SIZE} cards`);
  }
  if (totalDeckCards > MAX_DECK_SIZE) {
    throw new Error(`Deck cannot contain more than ${MAX_DECK_SIZE} cards`);
  }

  await db.sequelize.transaction(async (transaction) => {
    await ensureUserCollection(userId, transaction);
    await validateDeckItems(userId, compactItems, transaction);

    const deck = await Deck.findOne({
      where: { id: deckId, user_id: userId },
      transaction
    });
    if (!deck) {
      throw new Error("Deck not found");
    }

    await DeckCard.destroy({
      where: { deck_id: deck.id },
      transaction
    });
    await DeckCard.bulkCreate(
      compactItems.map((item) => ({
        deck_id: deck.id,
        card_id: item.cardId,
        quantity: item.quantity
      })),
      { transaction }
    );
  });

  return getUserDeckById(userId, deckId);
}

async function saveUserDeck(userId, deckId, deckItemsInput) {
  return persistDeck(userId, deckId, deckItemsInput, { requireExactSize: true });
}

async function updateUserDeckPartial(userId, deckId, deckItemsInput) {
  return persistDeck(userId, deckId, deckItemsInput, { requireExactSize: false });
}

async function resetUserDeck(userId, deckId) {
  await db.sequelize.transaction(async (transaction) => {
    const deck = await Deck.findOne({
      where: { id: deckId, user_id: userId },
      transaction
    });
    if (!deck) {
      throw new Error("Deck not found");
    }
    await DeckCard.destroy({
      where: { deck_id: deck.id },
      transaction
    });
  });

  return getUserDeckById(userId, deckId);
}

async function getActiveDeckId(userId) {
  const deck = await Deck.findOne({
    where: { user_id: userId, is_active: true }
  });

  if (deck) {
    return deck.id;
  }

  const firstDeck = await Deck.findOne({
    where: { user_id: userId },
    order: [["created_at", "ASC"]]
  });

  if (firstDeck) {
    firstDeck.is_active = true;
    await firstDeck.save();
    return firstDeck.id;
  }

  const created = await Deck.create({
    user_id: userId,
    name: DEFAULT_DECK_NAME,
    is_active: true
  });
  return created.id;
}

module.exports = {
  MAX_DECK_SIZE,
  MAX_DECKS,
  getAllCards,
  getUserCollection,
  getUserDeck,
  getUserDecks,
  getUserDeckById,
  createUserDeck,
  deleteUserDeck,
  renameUserDeck,
  setActiveDeck,
  saveUserDeck,
  updateUserDeckPartial,
  resetUserDeck,
  getActiveDeckId,
  ensureUserCollection
};
