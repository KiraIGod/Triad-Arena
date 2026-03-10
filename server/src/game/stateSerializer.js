function cloneValue(value) {
  return JSON.parse(JSON.stringify(value));
}

function normalizeUnit(unit) {
  if (!unit || typeof unit !== "object") return null;
  return {
    instanceId: unit.instanceId ?? null,
    cardId: unit.cardId ?? null,
    ownerId: unit.ownerId ?? null,
    attack: Number.isFinite(unit.attack) ? unit.attack : 0,
    hp: Number.isFinite(unit.hp) ? unit.hp : 0,
    summonedTurn: Number.isFinite(unit.summonedTurn) ? unit.summonedTurn : 0,
    canAttack: Boolean(unit.canAttack),
    hasAttacked: Boolean(unit.hasAttacked),
    statuses: Array.isArray(unit.statuses) ? unit.statuses : []
  };
}

function normalizePlayer(player) {
  const source = player || {};
  return {
    id: source.id ?? null,
    hp: source.hp ?? null,
    shield: source.shield ?? null,
    energy: source.energy ?? null,
    statuses: Array.isArray(source.statuses) ? cloneValue(source.statuses) : [],
    hand: Array.isArray(source.hand) ? cloneValue(source.hand) : [],
    deckCount: Array.isArray(source.deck) ? source.deck.length : 0,
    board: Array.isArray(source.board)
      ? source.board.map(normalizeUnit).filter(Boolean)
      : []
  };
}

function normalizeAction(action) {
  const source = action || {};
  return {
    actionIndex: source.actionIndex ?? null,
    actionId: source.actionId ?? null,
    playerId: source.playerId ?? null,
    turnOwnerId: source.turnOwnerId ?? null,
    cardId: source.cardId ?? null,
    timestamp: source.timestamp ?? null
  };
}

function serializeGameState(gameState) {
  const source = gameState || {};
  const serialized = {
    matchId: source.matchId ?? null,
    version: source.version ?? null,
    turn: source.turn ?? null,
    activePlayer: source.activePlayer ?? null,
    players: {
      player1: normalizePlayer(source.player1),
      player2: normalizePlayer(source.player2)
    },
    turnActions: Array.isArray(source.turnActions)
      ? source.turnActions.map(normalizeAction)
      : [],
    finished: source.finished ?? null
  };

  const requiredKeys = ["version", "turn", "activePlayer", "players", "turnActions", "finished"];
  for (const key of requiredKeys) {
    if (serialized[key] === null) {
      const error = new Error(`Serialized game state missing field: ${key}`);
      error.type = "INVALID_STATE";
      throw error;
    }
  }

  return cloneValue(serialized);
}

module.exports = { serializeGameState };
