/**
 * The only things the rehearsal is allowed to fake.
 *
 * The rule: stub OUTBOUND SIDE EFFECTS, never game logic. Anything that decides
 * a score, a champion, a payout or a rollover runs for real — stubbing any of
 * it would make the exercise worthless. What is stubbed here leaves the process
 * entirely and cannot affect the state the checks read.
 *
 * Each stub records its calls, so the report can still say "the pipeline tried
 * to publish N news requests" without a network.
 */

const calls = { seasonSummary: [] };

/**
 * Replace a module in the require cache before anything loads the real one.
 *
 * @param {string} request - module path, resolved relative to this file.
 * @param {Object} exports - what the stub exports.
 */
function stubModule(request, exports) {
  const resolved = require.resolve(request);
  require.cache[resolved] = {
    id: resolved,
    filename: resolved,
    loaded: true,
    exports,
    children: [],
    paths: [],
  };
}

/**
 * Install the stubs. Must run before the pipeline modules are required.
 *
 * Pub/Sub is the one unavoidable stub: `publishSeasonSummaryRequest` catches
 * its own failures, but the Google auth client it constructs rejects an
 * INTERNAL promise that nothing awaits, and an unhandled rejection takes the
 * whole Node process down. In production the credentials exist and the path is
 * quiet; in the emulator it kills the run on the first dark day (day 15). The
 * publish is a news-generation request — it writes no game state and nothing
 * the checks assert on depends on it.
 */
function installStubs() {
  const real = require("../src/helpers/newsSeasonSummaryTrigger");
  stubModule("../src/helpers/newsSeasonSummaryTrigger", {
    ...real,
    publishSeasonSummaryRequest: async ({ seasonId, dataDocId, scoredDay }) => {
      // Mirror the real day-window gate so the recorded count is meaningful.
      if (!seasonId || !Number.isFinite(scoredDay) || scoredDay < 15 || scoredDay > 49) {
        return false;
      }
      calls.seasonSummary.push({ seasonId, dataDocId, scoredDay });
      return true;
    },
  });
}

module.exports = { installStubs, calls };
