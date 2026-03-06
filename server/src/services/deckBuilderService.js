const db = require("../db/models");

const { Card, Deck, DeckCard, UserCard } = db;
const MAX_DECK_SIZE = 20;
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

async function getOrCreateDeck(userId, transaction) {
  const [deck] = await Deck.findOrCreate({
    where: { user_id: userId, name: DEFAULT_DECK_NAME },
    defaults: { user_id: userId, name: DEFAULT_DECK_NAME },
    transaction
  });
  return deck;
}

async function getUserDeck(userId) {
  const deck = await getOrCreateDeck(userId);
  const deckCards = await DeckCard.findAll({
    where: { deck_id: deck.id },
    include: [{ model: Card }],
    order: [[Card, "name", "ASC"]]
  });

  const cards = deckCards.map((entry) => ({
    cardId: entry.card_id,
    quantity: entry.quantity,
    card: mapCardForResponse(entry.Card)
  }));
  const totalCards = cards.reduce((sum, card) => sum + card.quantity, 0);

  return {
    id: deck.id,
    name: deck.name,
    totalCards,
    maxCards: MAX_DECK_SIZE,
    cards
  };
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

async function persistDeck(userId, deckItemsInput, options = { requireExactSize: false }) {
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

    const deck = await getOrCreateDeck(userId, transaction);
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

  return getUserDeck(userId);
}

async function saveUserDeck(userId, deckItemsInput) {
  return persistDeck(userId, deckItemsInput, { requireExactSize: true });
}

async function updateUserDeckPartial(userId, deckItemsInput) {
  return persistDeck(userId, deckItemsInput, { requireExactSize: false });
}

async function resetUserDeck(userId) {
  await db.sequelize.transaction(async (transaction) => {
    const deck = await getOrCreateDeck(userId, transaction);
    await DeckCard.destroy({
      where: { deck_id: deck.id },
      transaction
    });
  });

  return getUserDeck(userId);
}

module.exports = {
  MAX_DECK_SIZE,
  getAllCards,
  getUserCollection,
  getUserDeck,
  saveUserDeck,
  updateUserDeckPartial,
  resetUserDeck,
  ensureUserCollection
};
