const { GAME_CONSTANTS, STATUS_TYPES } = require("./constants");
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

function hasStatus(player, type) {
  return (player?.statuses || []).some((status) => status?.type === type);
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
  const nextStunned = hasStatus(withEffects[nextKey], STATUS_TYPES.STUN);

  const player1 = removeExpiredStatuses(tickStatuses(withEffects.player1));
  const player2 = removeExpiredStatuses(tickStatuses(withEffects.player2));
  const activeKey = nextStunned ? currentKey : nextKey;
  const nextActivePlayer = withRefreshedEnergy(activeKey === "player1" ? player1 : player2);

  return {
    ...withEffects,
    player1: activeKey === "player1" ? nextActivePlayer : player1,
    player2: activeKey === "player2" ? nextActivePlayer : player2,
    activePlayer: nextActivePlayer.id,
    turn: (withEffects.turn || 1) + 1,
    version: (withEffects.version || 0) + 1,
    playedCards: [],
    turnActions: [],
    finished: getFinished({ ...withEffects, player1, player2 })
  };
}

module.exports = { resolveTurn };
