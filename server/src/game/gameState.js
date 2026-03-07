const { GAME_CONSTANTS } = require("./constants");

const STARTING_HAND_SIZE = 3;

function createPlayer(id, cards = []) {
  const safeCards = Array.isArray(cards) ? cards.slice() : [];
  const hand = safeCards.slice(0, STARTING_HAND_SIZE);
  const deck = safeCards.slice(STARTING_HAND_SIZE);

  return {
    id,
    hp: GAME_CONSTANTS.MAX_HP,
    shield: 0,
    energy: GAME_CONSTANTS.ENERGY_PER_TURN,
    statuses: [],
    hand,
    deck
  };
}

function createInitialGameState(playerOneId, playerTwoId, options = {}) {
  const playerOneDeck = Array.isArray(options.playerOneDeck) ? options.playerOneDeck : [];
  const playerTwoDeck = Array.isArray(options.playerTwoDeck) ? options.playerTwoDeck : [];

  return {
    turn: 1,
    activePlayer: playerOneId,
    finished: false,
    version: 1,
    player1: createPlayer(playerOneId, playerOneDeck),
    player2: createPlayer(playerTwoId, playerTwoDeck),
    playedCards: [],
    turnActions: []
  };
}

module.exports = { createInitialGameState };
