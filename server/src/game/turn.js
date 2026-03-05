const { GAME_CONSTANTS } = require("./constants");
const { applyStatusEffects, removeExpiredStatuses, tickStatuses } = require("./status");

function getActivePlayerKey(state) {
  if (state?.player1?.id === state?.activePlayer) {
    return "player1";
  }

  if (state?.player2?.id === state?.activePlayer) {
    return "player2";
  }

  return null;
}

function getFinished(state) {
  return (state?.player1?.hp || 0) <= 0 || (state?.player2?.hp || 0) <= 0;
}

function withRefreshedEnergy(player) {
  return {
    ...player,
    energy: GAME_CONSTANTS.ENERGY_PER_TURN
  };
}

function resolveTurn(state) {
  if (!state || state.finished) {
    return state;
  }

  const withEffects = applyStatusEffects(state);
  const currentKey = getActivePlayerKey(withEffects) || "player1";
  const nextKey = currentKey === "player1" ? "player2" : "player1";
  const endedPlayer = removeExpiredStatuses(tickStatuses(withEffects[currentKey]));
  const waitingPlayer = withEffects[nextKey];
  const player1 = currentKey === "player1" ? endedPlayer : waitingPlayer;
  const player2 = currentKey === "player2" ? endedPlayer : waitingPlayer;
  const nextActivePlayer = withRefreshedEnergy(nextKey === "player1" ? player1 : player2);

  return {
    ...withEffects,
    player1: nextKey === "player1" ? nextActivePlayer : player1,
    player2: nextKey === "player2" ? nextActivePlayer : player2,
    activePlayer: nextActivePlayer.id,
    turn: (withEffects.turn || 1) + 1,
    version: (withEffects.version || 0) + 1,
    playedCards: [],
    turnActions: [],
    finished: getFinished({ ...withEffects, player1, player2 })
  };
}

module.exports = { resolveTurn };
