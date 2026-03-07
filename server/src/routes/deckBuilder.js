const { Router } = require("express");
const { jwtMiddleware } = require("../middlewares/jwt");
const {
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
} = require("../controllers/deckBuilderController");

const router = Router();

router.get("/cards", jwtMiddleware, fetchCards);
router.get("/collection", jwtMiddleware, fetchCollection);

router.get("/deck", jwtMiddleware, fetchDeck);
router.get("/decks", jwtMiddleware, fetchDecks);
router.post("/decks", jwtMiddleware, createDeck);

router.get("/decks/:deckId", jwtMiddleware, fetchDeckById);
router.put("/decks/:deckId", jwtMiddleware, commitDeck);
router.patch("/decks/:deckId", jwtMiddleware, patchDeck);
router.delete("/decks/:deckId", jwtMiddleware, clearDeck);
router.delete("/decks/:deckId/delete", jwtMiddleware, removeDeck);
router.put("/decks/:deckId/rename", jwtMiddleware, renameDeck);
router.put("/decks/:deckId/activate", jwtMiddleware, activateDeck);

module.exports = router;
