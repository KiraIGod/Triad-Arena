const matches = new Map();

export function getOrCreateMatch(matchId) {
  let match = matches.get(matchId)

  if (!match) {
    match = {
      matchId,
      version: 1,
      turn: 1,
      activePlayer: "player1",
      finished: false,

      player1: {
        id: "player1",
        hp: 30,
        energy: 3,
        handCount: 5
      },

      player2: {
        id: "player2",
        hp: 30,
        energy: 3,
        handCount: 5
      }
    }

    matches.set(matchId, match)
  }

  return match
}