const { GAME_CONSTANTS } = require("./constants");
const { applyStatusEffects, removeExpiredStatuses, tickStatuses } = require("./status");
const { refreshBoardForTurn } = require("./board");

function getActivePlayerKey(state) {
  if (state?.player1?.id === state?.activePlayer) return "player1";
  if (state?.player2?.id === state?.activePlayer) return "player2";
  return null;
}

function getFinished(state) {
  return (state?.player1?.hp || 0) <= 0 || (state?.player2?.hp || 0) <= 0;
}

function withRefreshedEnergy(player) {
  return { ...player, energy: GAME_CONSTANTS.ENERGY_PER_TURN };
}

// FIX 9: discard drawn card if hand is at MAX_HAND capacity
function drawCard(player) {
  const deck = Array.isArray(player?.deck) ? [...player.deck] : [];
  const hand = Array.isArray(player?.hand) ? [...player.hand] : [];
  const discard = Array.isArray(player?.discard) ? [...player.discard] : [];

  if (deck.length === 0) {
    return { ...player, hand, deck, discard };
  }

  const [drawnCard, ...remainingDeck] = deck;

  if (hand.length >= GAME_CONSTANTS.MAX_HAND) {
    // Hand is full: drawn card goes to discard (burn)
    return { ...player, hand, deck: remainingDeck, discard: [...discard, drawnCard] };
  }

  return { ...player, hand: [...hand, drawnCard], deck: remainingDeck, discard };
}

function resolveTurn(state) {
  if (!state || state.finished) return state;

  const withEffects = applyStatusEffects(state);
  const currentKey = getActivePlayerKey(withEffects) || "player1";
  // FIX 6: nextKey is the ONLY player whose board gets refreshed
  const nextKey = currentKey === "player1" ? "player2" : "player1";

  const endedPlayer = removeExpiredStatuses(tickStatuses(withEffects[currentKey]));
  const waitingPlayer = withEffects[nextKey];

  const player1 = currentKey === "player1" ? endedPlayer : waitingPlayer;
  const player2 = currentKey === "player2" ? endedPlayer : waitingPlayer;

  const baseNextPlayer = nextKey === "player1" ? player1 : player2;
  const nextActivePlayer = drawCard(withRefreshedEnergy(baseNextPlayer));

  // FIX 6: refreshBoardForTurn applied ONLY to the incoming active player
  const nextActivePlayerWithBoard = {
    ...nextActivePlayer,
    board: refreshBoardForTurn(nextActivePlayer.board)
  };

  return {
    ...withEffects,
    player1: nextKey === "player1" ? nextActivePlayerWithBoard : player1,
    player2: nextKey === "player2" ? nextActivePlayerWithBoard : player2,
    activePlayer: nextActivePlayerWithBoard.id,
    turn: (withEffects.turn || 1) + 1,
    version: (withEffects.version || 0) + 1,
    playedCards: [],
    // FIX 1: single unified action log; no separate attackActions
    turnActions: [],
    finished: getFinished({ ...withEffects, player1, player2 })
  };
}

module.exports = { resolveTurn };
