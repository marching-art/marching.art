// @ts-nocheck -- grandfathered when functions checkJs landed (functions/tsconfig.json); remove when this file is typed or cleaned up
const { logger } = require("firebase-functions/v2");
const { normalizeCorps } = require("./historicalSchedules");

/**
 * The days a specific (corpsName, sourceYear) corps actually competed — the
 * per-pick "index" that powers the two-tier highlight. A director's pick lights
 * up FULL when the show's day is one of these (the pick had a real result that
 * day) and DIM otherwise (the day's score is regression-interpolated).
 *
 * @param {Array<Object>} yearData - historical_scores/{year}.data (events).
 * @param {string} corpsName
 * @returns {number[]} Sorted, de-duped offSeasonDays with a real (>0) result.
 */
function collectResultDays(yearData, corpsName) {
  const target = normalizeCorps(corpsName);
  const days = new Set();
  for (const event of yearData || []) {
    if (event.offSeasonDay == null) continue;
    for (const s of event.scores || []) {
      if (normalizeCorps(s.corps) === target && Number(s.score) > 0) {
        days.add(event.offSeasonDay);
        break;
      }
    }
  }
  return [...days].sort((a, b) => a - b);
}

/**
 * Compute and attach `resultDays` to each pool corps in place, from
 * historical_scores for the corps' source years. Ships with dci-data so the
 * client can resolve highlight tiers without loading full historical data.
 *
 * A pool corps that ends up with zero result days almost always signals a
 * corps-name mismatch between the pool (final_rankings) and historical_scores —
 * i.e. a CORPS_NAME_MAP gap — so those are logged for the coverage audit.
 *
 * @param {FirebaseFirestore.Firestore} db
 * @param {Array<{corpsName:string, sourceYear:(string|number)}>} pool
 * @returns {Promise<{withResults:number, withoutResults:string[]}>}
 */
async function computeResultDaysForPool(db, pool) {
  const years = [...new Set((pool || []).map((c) => String(c.sourceYear)))];
  const byYear = {};
  await Promise.all(years.map(async (y) => {
    const doc = await db.doc(`historical_scores/${y}`).get();
    if (doc.exists) byYear[y] = doc.data().data || [];
  }));

  const withoutResults = [];
  let withResults = 0;
  for (const corps of pool || []) {
    const yearData = byYear[String(corps.sourceYear)] || [];
    corps.resultDays = collectResultDays(yearData, corps.corpsName);
    if (corps.resultDays.length > 0) withResults += 1;
    else withoutResults.push(`${corps.corpsName} (${corps.sourceYear})`);
  }

  if (withoutResults.length > 0) {
    logger.warn(
      `[PickResultDays] ${withoutResults.length} pool corps had no matching results ` +
      `(possible name-map gap): ${withoutResults.join(", ")}`
    );
  }
  logger.info(`[PickResultDays] Computed result days for ${withResults}/${(pool || []).length} pool corps.`);
  return { withResults, withoutResults };
}

module.exports = { collectResultDays, computeResultDaysForPool };
