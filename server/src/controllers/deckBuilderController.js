const {
  getAllCards,
  getUserCollection,
  getUserDeck,
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

async function commitDeck(req, res) {
  try {
    const deck = await saveUserDeck(req.user.userId, req.body?.deckItems);
    return res.status(200).json({ deck });
  } catch (error) {
    return res.status(400).json({ message: error.message || "Failed to save deck" });
  }
}

async function patchDeck(req, res) {
  try {
    const deck = await updateUserDeckPartial(req.user.userId, req.body?.deckItems);
    return res.status(200).json({ deck });
  } catch (error) {
    return res.status(400).json({ message: error.message || "Failed to update deck" });
  }
}

async function clearDeck(req, res) {
  try {
    const deck = await resetUserDeck(req.user.userId);
    return res.status(200).json({ deck });
  } catch (_error) {
    return res.status(500).json({ message: "Failed to reset deck" });
  }
}

module.exports = {
  fetchCards,
  fetchCollection,
  fetchDeck,
  commitDeck,
  patchDeck,
  clearDeck
};
