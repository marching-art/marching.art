const { onCall } = require("firebase-functions/v2/https");
const { logger } = require("firebase-functions/v2");
const { getDb } = require("../config");
const { assertAdmin } = require("./callableGuards");
const { isAllAgeEvent, isPlaceholderEvent, MIN_FIELD } = require("./learnedSchedules");
const { midnightUtc } = require("./offSeasonHeritage");

/**
 * Is this a scored event we EXPECT to have a running order in the archive?
 * (Not all-age, not a placeholder, enough corps, and inside the competition
 * window so it has an offSeasonDay.)
 */
function isExpectedEvent(event) {
  if (!event || !event.eventName || event.offSeasonDay == null) return false;
  if (isAllAgeEvent(event.eventName) || isPlaceholderEvent(event.eventName)) return false;
  const scored = (event.scores || []).filter((s) => Number(s.score) > 0).length;
  return scored >= MIN_FIELD;
}

const isWorldChampFinals = (name) => /world championship finals/i.test(name || "");

/**
 * Build the schedule-coverage report: for every archived year, how many expected
 * events actually have a running order in historical_schedules (scraped vs
 * learned), what's missing, whether all-age events leaked in, and whether the
 * Finals-Saturday disambiguation held (DCI evening finals present, All-Age one
 * excluded). Plus the current season pool's unmapped corps (empty resultDays).
 *
 * Read-only. Meant for the admin coverage dashboard before the August cutover.
 *
 * @param {FirebaseFirestore.Firestore} db
 * @returns {Promise<Object>}
 */
async function buildScheduleCoverageReport(db) {
  const [scoreRefs, schedRefs] = await Promise.all([
    db.collection("historical_scores").listDocuments(),
    db.collection("historical_schedules").listDocuments(),
  ]);
  const years = [...new Set([...scoreRefs, ...schedRefs].map((r) => r.id))].sort();

  const rows = [];
  const totals = { expected: 0, matched: 0, missing: 0, scraped: 0, learned: 0, allAgeLeak: 0 };

  for (const year of years) {
    const [scoresDoc, schedDoc] = await Promise.all([
      db.doc(`historical_scores/${year}`).get(),
      db.doc(`historical_schedules/${year}`).get(),
    ]);
    const scoreEvents = scoresDoc.exists ? (scoresDoc.data().data || []) : [];
    const schedEvents = schedDoc.exists ? (schedDoc.data().data || []) : [];

    const schedByKey = new Map(schedEvents.map((e) => [`${e.eventName}::${midnightUtc(e.date)}`, e]));

    const row = {
      year, scoresEvents: scoreEvents.length, scheduleEvents: schedEvents.length,
      expected: 0, matched: 0, missing: [], scraped: 0, learned: 0,
      allAgeLeak: 0, finalsOk: true,
    };

    for (const e of scoreEvents) {
      if (!isExpectedEvent(e)) continue;
      row.expected += 1;
      if (schedByKey.has(`${e.eventName}::${midnightUtc(e.date)}`)) row.matched += 1;
      else if (row.missing.length < 25) row.missing.push(`${e.eventName} (${String(e.date).slice(0, 10)})`);
    }
    row.missingCount = row.expected - row.matched;

    for (const s of schedEvents) {
      if (s.source === "learned" || s.source === "learned-championship") row.learned += 1;
      else row.scraped += 1;
      if (isAllAgeEvent(s.eventName)) row.allAgeLeak += 1;
    }

    // Finals disambiguation: if the scores archive has both an all-age and a DCI
    // World Championship Finals, the schedule must carry only the DCI (non-all-age) one.
    const hasAllAgeFinals = scoreEvents.some((e) => isAllAgeEvent(e.eventName) && isWorldChampFinals(e.eventName));
    if (hasAllAgeFinals) {
      row.finalsOk = !schedEvents.some((e) => isAllAgeEvent(e.eventName) && isWorldChampFinals(e.eventName));
    }

    rows.push(row);
    totals.expected += row.expected;
    totals.matched += row.matched;
    totals.missing += row.missingCount;
    totals.scraped += row.scraped;
    totals.learned += row.learned;
    totals.allAgeLeak += row.allAgeLeak;
  }

  // Current season pool: corps whose picks can never light up FULL (no resultDays)
  // — the classic name-map-gap signal.
  const pool = { seasonId: null, size: 0, unmapped: [] };
  const seasonDoc = await db.doc("game-settings/season").get();
  if (seasonDoc.exists && seasonDoc.data().seasonUid) {
    pool.seasonId = seasonDoc.data().seasonUid;
    const dciDoc = await db.doc(`dci-data/${pool.seasonId}`).get();
    const corpsValues = dciDoc.exists ? (dciDoc.data().corpsValues || []) : [];
    pool.size = corpsValues.length;
    pool.unmapped = corpsValues
      .filter((c) => !Array.isArray(c.resultDays) || c.resultDays.length === 0)
      .map((c) => `${c.corpsName} (${c.sourceYear})`);
  }

  return { generatedAt: null, years: rows, totals, pool };
}

/**
 * Admin-only: return the schedule-coverage report for the dashboard.
 */
const getScheduleCoverage = onCall({ cors: true, timeoutSeconds: 120, memory: "512MiB" }, async (request) => {
  assertAdmin(request);
  logger.info(`Admin ${request.auth.uid} requested schedule coverage.`);
  const report = await buildScheduleCoverageReport(getDb());
  return { success: true, ...report };
});

module.exports = { buildScheduleCoverageReport, isExpectedEvent, getScheduleCoverage };
