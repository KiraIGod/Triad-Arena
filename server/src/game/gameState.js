const { GAME_CONSTANTS } = require("./constants");

function createPlayer(id) {
  return {
    id,
    hp: GAME_CONSTANTS.MAX_HP,
    shield: 0,
    energy: GAME_CONSTANTS.ENERGY_PER_TURN,
    statuses: [],
    hand: []
  };
}

function createInitialGameState(playerOneId, playerTwoId) {
  return {
    turn: 1,
    activePlayer: playerOneId,
    finished: false,
    version: 1,
    player1: createPlayer(playerOneId),
    player2: createPlayer(playerTwoId),
    playedCards: [],
    turnActions: []
  };
}

module.exports = { createInitialGameState };
