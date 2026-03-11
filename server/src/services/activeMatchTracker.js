const activeMatchByUser = new Map();

function registerActiveMatch(match) {
  if (match.player_one_id) {
    activeMatchByUser.set(String(match.player_one_id), match);
  }
  if (match.player_two_id) {
    activeMatchByUser.set(String(match.player_two_id), match);
  }
}

function unregisterActiveMatch(match) {
  if (match.player_one_id) {
    activeMatchByUser.delete(String(match.player_one_id));
  }
  if (match.player_two_id) {
    activeMatchByUser.delete(String(match.player_two_id));
  }
}

function findActiveMatchByUser(userId) {
  return activeMatchByUser.get(String(userId)) || null;
}

module.exports = { registerActiveMatch, unregisterActiveMatch, findActiveMatchByUser };
