/**
 * Materialized "Live Scores" for the landing and news pages.
 *
 * The client used to build this ranking itself: fetch the season's corps pool
 * (dci-data) and then EVERY historical_scores year the pool references —
 * off-season pools span ~25 source years, each an unbounded `events`
 * subcollection — for every anonymous visitor, cached five minutes. That was
 * potentially >1,000 reads and megabytes of JSON for one sidebar box
 * (SITE_REVIEW_2026-09 F-H1).
 *
 * The nightly scoring run now writes ONE doc, landing_scores/{seasonUid},
 * holding each ranked corps' per-day score history. The client filters it to
 * the revealed day and ranks; the doc is a few KB. The client keeps its
 * fan-out as a fallback for seasons the pipeline has not written yet.
 *
 * Off-season: the fantasy pool itself, ranked by each corps' historical
 * scores from its source year. Live season: the scraped current-year corps
 * that are also selectable in the pool (the client applies the same rule).
 */

const { logger } = require("firebase-functions/v2");
const { paths } = require("./paths");
const { loadHistoricalYears } = require("./historicalScores");

/**
 * Total from a captions map — GE in full, Visual and Music halved (the DCI
 * sheet convention; mirrors src/hooks/useLandingScores.js).
 * @param {Record<string, number> | null | undefined} captions
 */
function totalFromCaptions(captions) {
  if (!captions) return 0;
  const ge = (captions.GE1 || 0) + (captions.GE2 || 0);
  const visual = ((captions.VP || 0) + (captions.VA || 0) + (captions.CG || 0)) / 2;
  const music = ((captions.B || 0) + (captions.MA || 0) + (captions.P || 0)) / 2;
  return ge + visual + music;
}

/** @param {number} value */
const round3 = (value) => Math.round(value * 1000) / 1000;

/**
 * Which historical years the ranking needs.
 * @param {{status?: string, seasonYear?: number|string}} seasonData
 * @param {Array<{sourceYear: string|number}>} poolCorps
 * @returns {string[]}
 */
function landingYearsNeeded(seasonData, poolCorps) {
  const isLive = seasonData?.status === "live-season";
  const liveYear = seasonData?.seasonYear != null ? String(seasonData.seasonYear) : null;
  if (isLive && liveYear) return [liveYear];
  return [...new Set((poolCorps || []).map((c) => String(c.sourceYear)))].sort();
}

/**
 * Build the landing_scores document. Pure — exported for tests.
 *
 * @param {Object} params
 * @param {{seasonUid: string, status?: string, seasonYear?: number|string}} params.seasonData
 * @param {Array<{corpsName: string, sourceYear: string|number, points?: number|null}>} params.poolCorps
 * @param {Record<string, Array<{offSeasonDay?: number, eventName?: string, scores?: Array<{corps?: string, captions?: Record<string, number>}>}>>} params.historicalByYear
 * @param {Date} [params.now]
 * @returns {{
 *   seasonUid: string, status: string|null, generatedAt: string, lastDay: number,
 *   corps: Array<{corpsName: string, sourceYear: string, points: number|null,
 *     history: Array<{day: number, totalScore: number, eventName: string|null}>}>
 * }}
 */
function buildLandingScores({ seasonData, poolCorps, historicalByYear, now = new Date() }) {
  const isLive = seasonData?.status === "live-season";
  const liveYear = seasonData?.seasonYear != null ? String(seasonData.seasonYear) : null;

  /** @type {Array<{corpsName: string, sourceYear: string, points: number|null}>} */
  let corpsList;
  if (isLive && liveYear) {
    const selectable = new Set((poolCorps || []).map((c) => c.corpsName));
    const seen = new Map();
    for (const event of historicalByYear[liveYear] || []) {
      for (const row of event.scores || []) {
        if (row.corps && selectable.has(row.corps) && !seen.has(row.corps)) {
          seen.set(row.corps, { corpsName: row.corps, sourceYear: liveYear, points: null });
        }
      }
    }
    corpsList = [...seen.values()];
  } else {
    corpsList = (poolCorps || []).map((c) => ({
      corpsName: c.corpsName,
      sourceYear: String(c.sourceYear),
      points: c.points ?? null,
    }));
  }

  let lastDay = 0;
  const corps = [];
  for (const entry of corpsList) {
    const events = historicalByYear[entry.sourceYear] || [];
    /** @type {Array<{day: number, totalScore: number, eventName: string|null}>} */
    const history = [];
    for (const event of events) {
      const day = Number(event.offSeasonDay);
      if (!Number.isFinite(day) || day < 1) continue;
      const row = event.scores?.find((s) => s.corps === entry.corpsName);
      const total = row && row.captions ? totalFromCaptions(row.captions) : 0;
      if (total <= 0) continue; // a zero is a blank, not a score
      history.push({
        day,
        totalScore: round3(total),
        eventName: typeof event.eventName === "string" ? event.eventName : null,
      });
      if (day > lastDay) lastDay = day;
    }
    if (history.length === 0) continue;
    history.sort((a, b) => a.day - b.day);
    corps.push({ ...entry, history });
  }

  return {
    seasonUid: seasonData.seasonUid,
    status: seasonData.status || null,
    generatedAt: now.toISOString(),
    lastDay,
    corps,
  };
}

/**
 * Load the inputs and write landing_scores/{seasonUid}. Returns the doc, or
 * null when the season has no pool to rank.
 *
 * @param {FirebaseFirestore.Firestore} db
 * @param {{seasonUid?: string, dataDocId?: string, status?: string, seasonYear?: number|string}} seasonData
 */
async function writeLandingScores(db, seasonData) {
  if (!seasonData?.seasonUid || !seasonData.dataDocId) return null;
  const seasonUid = seasonData.seasonUid;
  const poolSnap = await db.doc(paths.dciData(seasonData.dataDocId)).get();
  const poolCorps = poolSnap.exists ? poolSnap.data().corpsValues || [] : [];
  if (poolCorps.length === 0) return null;

  const historicalByYear = await loadHistoricalYears(db, landingYearsNeeded(seasonData, poolCorps));
  const doc = buildLandingScores({ seasonData: { ...seasonData, seasonUid }, poolCorps, historicalByYear });
  await db.doc(paths.landingScores(seasonUid)).set(doc);
  logger.info(
    `Landing scores materialized for ${seasonUid}: ${doc.corps.length} corps through day ${doc.lastDay}.`
  );
  return doc;
}

module.exports = {
  totalFromCaptions,
  landingYearsNeeded,
  buildLandingScores,
  writeLandingScores,
};
