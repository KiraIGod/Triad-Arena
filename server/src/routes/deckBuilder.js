const { Router } = require("express");
const { jwtMiddleware } = require("../middlewares/jwt");
const {
  fetchCards,
  fetchCollection,
  fetchDeck,
  commitDeck,
  patchDeck,
  clearDeck
} = require("../controllers/deckBuilderController");

const router = Router();

router.get("/cards", jwtMiddleware, fetchCards);
router.get("/collection", jwtMiddleware, fetchCollection);
router.get("/deck", jwtMiddleware, fetchDeck);
router.put("/deck", jwtMiddleware, commitDeck);
router.patch("/deck", jwtMiddleware, patchDeck);
router.delete("/deck", jwtMiddleware, clearDeck);

module.exports = router;
