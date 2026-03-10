const matchQueues = new Map();

/**
 * Enqueues an async action for a specific match.
 * Actions for the same match execute sequentially, preventing race conditions.
 * If a previous action fails, the queue continues processing subsequent actions.
 *
 * @param {string|number} matchId
 * @param {() => Promise<any>} fn
 * @returns {Promise<any>} Resolves/rejects with the result of fn
 */
async function enqueueMatchAction(matchId, fn) {
  const key = String(matchId);
  const previous = matchQueues.get(key) ?? Promise.resolve();

  let resolve, reject;
  const actionPromise = new Promise((res, rej) => {
    resolve = res;
    reject = rej;
  });

  const next = previous.then(
    () => fn().then(resolve, reject),
    () => fn().then(resolve, reject)
  );

  matchQueues.set(key, next.then(() => {}, () => {}));

  return actionPromise;
}

function clearMatchQueue(matchId) {
  matchQueues.delete(String(matchId));
}

module.exports = { enqueueMatchAction, clearMatchQueue };
