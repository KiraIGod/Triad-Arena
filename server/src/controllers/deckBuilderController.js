const {
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
  resetUserDeck
} = require("../services/deckBuilderService");

async function fetchCards(_req, res) {
  try {
    const cards = await getAllCards();
    return res.status(200).json({ cards });
  } catch (_error) {
    return res.status(500).json({ message: "Failed to fetch cards" });
  }
}

async function fetchCollection(req, res) {
  try {
    const collection = await getUserCollection(req.user.userId);
    return res.status(200).json({ collection });
  } catch (_error) {
    return res.status(500).json({ message: "Failed to fetch user collection" });
  }
}

async function fetchDeck(req, res) {
  try {
    const deck = await getUserDeck(req.user.userId);
    return res.status(200).json({ deck });
  } catch (_error) {
    return res.status(500).json({ message: "Failed to fetch user deck" });
  }
}

async function fetchDecks(req, res) {
  try {
    const decks = await getUserDecks(req.user.userId);
    return res.status(200).json({ decks });
  } catch (_error) {
    return res.status(500).json({ message: "Failed to fetch user decks" });
  }
}

async function fetchDeckById(req, res) {
  try {
    const deck = await getUserDeckById(req.user.userId, req.params.deckId);
    return res.status(200).json({ deck });
  } catch (error) {
    const status = error.message === "Deck not found" ? 404 : 500;
    return res.status(status).json({ message: error.message || "Failed to fetch deck" });
  }
}

async function createDeck(req, res) {
  try {
    const deck = await createUserDeck(req.user.userId, req.body?.name);
    return res.status(201).json({ deck });
  } catch (error) {
    return res.status(400).json({ message: error.message || "Failed to create deck" });
  }
}

async function removeDeck(req, res) {
  try {
    const decks = await deleteUserDeck(req.user.userId, req.params.deckId);
    return res.status(200).json({ decks });
  } catch (error) {
    const status = error.message === "Deck not found" ? 404 : 400;
    return res.status(status).json({ message: error.message || "Failed to delete deck" });
  }
}

async function renameDeck(req, res) {
  try {
    const deck = await renameUserDeck(req.user.userId, req.params.deckId, req.body?.name);
    return res.status(200).json({ deck });
  } catch (error) {
    const status = error.message === "Deck not found" ? 404 : 400;
    return res.status(status).json({ message: error.message || "Failed to rename deck" });
  }
}

async function activateDeck(req, res) {
  try {
    const decks = await setActiveDeck(req.user.userId, req.params.deckId);
    return res.status(200).json({ decks });
  } catch (error) {
    const status = error.message === "Deck not found" ? 404 : 400;
    return res.status(status).json({ message: error.message || "Failed to activate deck" });
  }
}

async function commitDeck(req, res) {
  try {
    const deck = await saveUserDeck(req.user.userId, req.params.deckId, req.body?.deckItems);
    return res.status(200).json({ deck });
  } catch (error) {
    return res.status(400).json({ message: error.message || "Failed to save deck" });
  }
}

async function patchDeck(req, res) {
  try {
    const deck = await updateUserDeckPartial(req.user.userId, req.params.deckId, req.body?.deckItems);
    return res.status(200).json({ deck });
  } catch (error) {
    return res.status(400).json({ message: error.message || "Failed to update deck" });
  }
}

async function clearDeck(req, res) {
  try {
    const deck = await resetUserDeck(req.user.userId, req.params.deckId);
    return res.status(200).json({ deck });
  } catch (_error) {
    return res.status(500).json({ message: "Failed to reset deck" });
  }
}

module.exports = {
  fetchCards,
  fetchCollection,
  fetchDeck,
  fetchDecks,
  fetchDeckById,
  createDeck,
  removeDeck,
  renameDeck,
  activateDeck,
  commitDeck,
  patchDeck,
  clearDeck
};
