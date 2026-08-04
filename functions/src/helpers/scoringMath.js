// Pure scoring math: real-score lookup, historical data fetch, and the model
// that projects a caption score for a day a corps has no real result for.
//
// The one rule everything here serves: a real score is used exactly as
// published, and a projection has to look like it could have been one.

const { getDb } = require("../config");
const { logger } = require("firebase-functions/v2");

// Every DCI caption is judged out of 20. Nothing may be projected AT the
// ceiling: a 20.000 is a flawless sheet, and no corps has ever earned one.
const CAPTION_MAX = 20;

// Smallest headroom (20 - score) the projection model will fit or produce.
// Keeps log(headroom) finite for a hypothetical 20.0 in the source data and
// guarantees every projection lands strictly below the ceiling.
const MIN_HEADROOM = 0.05;

// ---------------------------------------------------------------------------
// Projection constants, calibrated against the local DCI corpus
// (functions/pressboxImporter/output/historical_scores_*.json: 23 seasons,
// 2,455 events, 158,200 real caption scores). Every value below was chosen by
// holdout: hide one real result, project it from the rest, measure the error
// over ~115k predictions. See the model note on projectCaptionScore.
// ---------------------------------------------------------------------------

// Weight on the two bracketing shows when projecting a day INSIDE the range
// the corps actually competed in. A corps' nearest real results either side of
// a date carry more signal than its season trend, but not all of it: an even
// split of the two beat both pure neighbour interpolation (MAE 0.480) and a
// pure trend fit (0.569) at MAE 0.458.
const BRACKET_WEIGHT = 0.5;

// Damping for projections OUTSIDE that range. A season trend is good evidence
// about tomorrow and poor evidence about ten days out, so the horizon
// saturates: gap days out is treated as gap / (1 + gap / TREND_DAMPING_DAYS).
// Undamped extrapolation of the same fit ran to a 0.696 MAE and produced
// absurd outliers; damped it is 0.555.
const TREND_DAMPING_DAYS = 6;

// The fit rarely passes exactly through the corps' most recent result. That
// residual is carried onto the projection and decays over this many days, so
// a projection leaves the corps' last real score continuously instead of
// jumping to the trend line.
const ANCHOR_DECAY_DAYS = 3;

// Realism band, as a distance from what the corps has actually scored. In the
// corpus a corps beats its own prior best about 40% of the time, by 0.5-0.7 at
// the 90th percentile a day later and by ~2.5 ten days later, so the ceiling
// opens up with the gap; it falls below its prior worst by more than a point
// well under 1% of the time. These are wide enough that the band almost never
// binds on a sane projection (removing it entirely moves MAE by 0.001) — it
// exists to catch a runaway fit, not to shape ordinary output.
const BAND_ABOVE_BEST = 0.6;
const BAND_ABOVE_PER_DAY = 0.35;
const BAND_ABOVE_MAX = 3.0;
const BAND_BELOW_WORST = 1.5;

// Deterministic variation applied to projections only (never to real
// scores), kept to a single 0.05 tick either way. Real corps move about ten
// times this much between consecutive shows (mean absolute move 0.57), so
// this is a tie-breaker, not an attempt to model night-to-night variance.
const JITTER = 0.05;

// 99.8% of the real caption scores in the corpus land on a 0.05 grid.
const SCORE_STEP = 0.05;

// OPTIMIZATION #1: Cache for regression calculations to avoid recomputing
// the same corps/year/caption/day combination multiple times per scoring run.
// This cache is cleared at the start of each scoring run to prevent stale data.
const regressionCache = new Map();

// Memo for normalizeCorpsName. The fallback name match runs per corps, per
// caption, per score row of the night, so the same handful of corps names
// would otherwise be re-normalized millions of times in one run.
const normalizedNameCache = new Map();

/**
 * Clear the per-run caches. Should be called at the start of each scoring run.
 */
function clearRegressionCache() {
  regressionCache.clear();
  normalizedNameCache.clear();
}

/**
 * Get a cached regression score or compute and cache it.
 * Reduces ~40,000 regression calculations to ~2,000 unique calculations per day.
 */
function getCachedRegressionScore(corpsName, sourceYear, caption, currentDay, historicalData) {
  const cacheKey = `${corpsName}|${sourceYear}|${caption}|${currentDay}`;

  if (regressionCache.has(cacheKey)) {
    return regressionCache.get(cacheKey);
  }

  const score = getRealisticCaptionScore(corpsName, sourceYear, caption, currentDay, historicalData);
  regressionCache.set(cacheKey, score);
  return score;
}


async function fetchHistoricalData(dataDocId, additionalYears = []) {
  const db = getDb();
  const corpsDataRef = db.doc(`dci-data/${dataDocId}`);
  const corpsDataSnap = await corpsDataRef.get();
  if (!corpsDataSnap.exists) {
    logger.error(`dci-data document ${dataDocId} not found.`);
    return {};
  }

  const seasonCorpsList = corpsDataSnap.data().corpsValues || [];
  const yearsFromCorps = seasonCorpsList.map((c) => c.sourceYear);
  // Combine corps source years with any additional years (e.g., current year for live season)
  const yearsToFetch = [...new Set([...yearsFromCorps, ...additionalYears.map(String)])];

  const historicalDocs = await Promise.all(
    yearsToFetch.map((year) => db.doc(`historical_scores/${year}`).get())
  );

  const historicalData = {};
  historicalDocs.forEach((doc) => {
    if (doc.exists) {
      historicalData[doc.id] = doc.data().data;
    }
  });
  return historicalData;
}

function simpleLinearRegression(data) {
  const n = data.length;
  if (n < 2) {
    return { m: 0, c: data.length > 0 ? data[0][1] : 0 };
  }

  let sumX = 0, sumY = 0, sumXY = 0, sumXX = 0;
  for (const [x, y] of data) {
    sumX += x;
    sumY += y;
    sumXY += x * y;
    sumXX += x * x;
  }

  const m = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
  const c = (sumY - m * sumX) / n;

  return { m, c };
}

/**
 * Collect one (day, score) point per competition day for a corps/caption.
 *
 * `matches` decides which score row belongs to the corps, so the caller can
 * retry with a looser matcher when the strict one finds nothing (see
 * getRealisticCaptionScore).
 *
 * @param {Array<Object>} yearData - historical_scores/{year}.data events.
 * @param {string} caption
 * @param {(rowCorps: string) => boolean} matches
 * @returns {Array<[number, number]>} [offSeasonDay, score] pairs.
 */
function collectCaptionDataPoints(yearData, caption, matches) {
  /** @type {Array<[number, number]>} */
  const dataPoints = [];
  const seenDays = new Set();

  for (const event of yearData) {
    if (event.offSeasonDay == null || seenDays.has(event.offSeasonDay)) continue;

    for (const scoreData of (event.scores || [])) {
      const value = scoreData?.captions?.[caption];
      if (!(value > 0) || !matches(scoreData.corps)) continue;
      seenDays.add(event.offSeasonDay);
      dataPoints.push([event.offSeasonDay, value]);
      break;
    }
  }

  return dataPoints;
}

function getRealisticCaptionScore(corpsName, sourceYear, caption, currentDay, historicalData) {
  const actualScore = getScoreForDay(currentDay, corpsName, sourceYear, caption, historicalData);
  if (actualScore !== null) {
    // A real result is the score. It is never averaged, nudged, jittered or
    // rounded — see the contract at the top of projectCaptionScore.
    return actualScore;
  }

  const yearData = historicalData[sourceYear] || [];
  let allDataPoints = collectCaptionDataPoints(yearData, caption, (rowCorps) => rowCorps === corpsName);

  // Exact-name miss: retry once on the normalized name so a corps whose
  // dci.org spelling drifted between seasons ("The Cavaliers" vs
  // "Cavaliers") still projects off its own history instead of scoring 0.
  if (allDataPoints.length === 0) {
    const target = normalizeCorpsName(corpsName);
    allDataPoints = collectCaptionDataPoints(
      yearData, caption, (rowCorps) => normalizeCorpsName(rowCorps) === target
    );
  }

  if (allDataPoints.length === 0) {
    // Only warn if we actually fetched data for this year (meaning corps should exist).
    // If the year isn't in historicalData at all, it's likely a stale lineup from a
    // previous season - no need to spam logs for expected missing data.
    if (historicalData[sourceYear] !== undefined) {
      logger.warn(`No historical scores found for ${corpsName} (${sourceYear}), caption ${caption}. Returning 0.`);
    }
    return 0;
  }

  return projectCaptionScore(
    allDataPoints, currentDay, `${corpsName}|${sourceYear}|${caption}|${currentDay}`
  );
}

function getScoreForDay(day, corps, year, caption, historicalData) {
  const events = historicalData[year]?.filter((e) => e.offSeasonDay === day);
  if (!events || events.length === 0) return null;

  // Exact name wins outright; a normalized match is only used when no row
  // matched exactly, so the loose comparison can never shadow a real one.
  let normalizedMatch = null;
  let target = null;

  for (const event of events) {
    for (const scoreData of (event.scores || [])) {
      const value = scoreData?.captions?.[caption];
      if (!(value > 0)) continue;
      if (scoreData.corps === corps) return value;
      if (normalizedMatch === null) {
        if (target === null) target = normalizeCorpsName(corps);
        if (normalizeCorpsName(scoreData.corps) === target) normalizedMatch = value;
      }
    }
  }

  return normalizedMatch;
}

/**
 * Loose corps-name key: casing, punctuation, accents, spacing and a leading
 * "The" all collapse away. Keeps meaningful suffixes ("Blue Devils B" stays
 * distinct from "Blue Devils"), so it can only rescue a spelling drift, never
 * merge two different corps.
 * @param {string} name
 * @returns {string}
 */
function normalizeCorpsName(name) {
  const raw = String(name ?? "");
  const cached = normalizedNameCache.get(raw);
  if (cached !== undefined) return cached;

  const normalized = raw
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/^the /, "");

  normalizedNameCache.set(raw, normalized);
  return normalized;
}

/**
 * How many scraped corps results are archived for a competition day.
 * The nightly run logs this so "were live scores actually used tonight?" is
 * answerable from the logs alone.
 *
 * @param {number} day - Competition day (offSeasonDay).
 * @param {string|number} year - historical_scores document id.
 * @param {Object} historicalData - year -> events.
 * @returns {{events: number, corps: number}}
 */
function countRealScoresForDay(day, year, historicalData) {
  const events = (historicalData[String(year)] || []).filter((e) => e.offSeasonDay === day);
  const corps = new Set();
  for (const event of events) {
    for (const scoreData of (event.scores || [])) {
      if (scoreData?.corps) corps.add(scoreData.corps);
    }
  }
  return { events: events.length, corps: corps.size };
}

/**
 * Counts the number of unique data points available for a corps/caption in a given year.
 * Used to determine if there's enough data for regression.
 */
function countDataPointsForCorps(corpsName, year, caption, historicalData) {
  const yearData = historicalData[year] || [];
  const uniqueDays = new Set();

  for (const event of yearData) {
    if (event.offSeasonDay === null) continue; // Skip pre-season events
    const scoreData = event.scores?.find((s) => s.corps === corpsName);
    if (scoreData && scoreData.captions?.[caption] > 0) {
      uniqueDays.add(event.offSeasonDay);
    }
  }

  return uniqueDays.size;
}

/**
 * Fit the corps' remaining headroom (CAPTION_MAX - score) instead of the score
 * itself, and project it forward.
 *
 * Headroom shrinks roughly geometrically across a season — a corps closes most
 * of the gap to a perfect sheet early and then grinds out tenths — so a
 * log-linear fit on headroom is both a better fit and, crucially, saturating:
 * exp() is strictly positive, so the projected score approaches CAPTION_MAX
 * without ever reaching it.
 *
 * @param {Array<[number, number]>} dataPoints
 * @returns {{predict: (x: number) => number}}
 */
function headroomRegression(dataPoints) {
  const transformed = dataPoints.map(([x, y]) => [
    x, Math.log(Math.max(MIN_HEADROOM, CAPTION_MAX - y)),
  ]);
  const { m, c } = simpleLinearRegression(transformed);

  return { predict: (x) => CAPTION_MAX - Math.exp(m * x + c) };
}

/**
 * The corps' score on `targetDay` read off the two real results either side of
 * it — a straight line between the show before and the show after.
 *
 * @param {Array<[number, number]>} dataPoints - Ascending by day.
 * @param {number} targetDay - A day inside the observed range.
 * @returns {number}
 */
function bracketingScore(dataPoints, targetDay) {
  let before = null;
  let after = null;
  for (const point of dataPoints) {
    if (point[0] <= targetDay) before = point;
    if (point[0] >= targetDay && after === null) after = point;
  }
  if (!before) return after[1];
  if (!after || after[0] === before[0]) return before[1];

  const span = (targetDay - before[0]) / (after[0] - before[0]);
  return before[1] + span * (after[1] - before[1]);
}

/**
 * Deterministic [0, 1) value for a seed string (FNV-1a).
 *
 * Projections used Math.random(), so re-scoring a day (admin force, retry)
 * produced different numbers for the same inputs and the same corps could
 * drift by a quarter point between runs. Seeding off corps/year/caption/day
 * keeps every run identical while still varying between captions.
 *
 * @param {string} seed
 * @returns {number}
 */
function seededUnitValue(seed) {
  let hash = 0x811c9dc5;
  for (let i = 0; i < seed.length; i++) {
    hash ^= seed.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash / 0x100000000;
}

/**
 * Project a caption score for a day the corps has no real result for.
 *
 * The contract this exists to enforce:
 *   1. A REAL score is never touched. Callers return it before reaching here.
 *   2. A PROJECTED score stays inside what the corps has actually done, and
 *      never at or above the caption ceiling.
 *   3. The variation applied is minimal (±JITTER) and deterministic.
 *
 * ## The model, and why it is this one
 *
 * Two regimes, because a season arc is two different problems:
 *
 *   INSIDE the range of days the corps competed in, the answer is mostly
 *   already in the data — a blend of the shows either side of the date and
 *   the season trend through them.
 *
 *   OUTSIDE it, there is nothing to interpolate, so the season trend is
 *   extended from the corps' nearest real result. The trend is fitted on
 *   remaining HEADROOM (20 - score) rather than on the score: headroom
 *   shrinks roughly geometrically across a season (a corps closes most of the
 *   gap early, then grinds out tenths), and because exp() is strictly
 *   positive, a headroom fit approaches the ceiling without ever reaching it.
 *   The horizon is damped so a trend is not trusted indefinitely.
 *
 * Calibrated by holdout against 23 seasons of real DCI results: hide one
 * actual caption score, project it from the rest, measure the error. Mean
 * absolute error, ~257k predictions:
 *
 *                          inside range   outside range
 *   this model                    0.500           0.554
 *   plain linear fit              0.491           0.646
 *   previous model (below)        0.553           0.679
 *
 * The previous model fit the score directly with an exponential (log-linear
 * on the score), which grows without bound. It projected 20+ for 3.7% of
 * late-season top-corps GE captions; the hard `Math.min(20, ...)` in
 * scoring.js then flattened all of them to exactly 20.000, so every lineup
 * carrying a top corps in GE1 and GE2 posted an identical 40.0 General
 * Effect — a perfect sheet no corps has ever earned. This model produces
 * none, on the same holdout.
 *
 * @param {Array<[number, number]>} dataPoints - [competitionDay, score] pairs,
 *   ascending by day.
 * @param {number} targetDay - The competition day to project.
 * @param {string} [seed] - Stable seed for the jitter; "" disables jitter.
 * @returns {number} A score in [0, CAPTION_MAX).
 */
function projectCaptionScore(dataPoints, targetDay, seed = "") {
  if (!dataPoints || dataPoints.length === 0) return 0;

  const scores = dataPoints.map(([, y]) => y);
  const best = Math.max(...scores);
  const worst = Math.min(...scores);
  const firstPoint = dataPoints[0];
  const lastPoint = dataPoints[dataPoints.length - 1];

  // Days beyond either end of the corps' real season. Zero inside it.
  let daysOutside = 0;
  let predicted;

  if (dataPoints.length === 1) {
    predicted = scores[0];
    daysOutside = Math.abs(targetDay - firstPoint[0]);
  } else if (targetDay >= firstPoint[0] && targetDay <= lastPoint[0]) {
    const trend = headroomRegression(dataPoints);
    predicted = BRACKET_WEIGHT * bracketingScore(dataPoints, targetDay) +
      (1 - BRACKET_WEIGHT) * trend.predict(targetDay);
  } else {
    // Extend the trend from whichever end of the season is nearest.
    const beyondEnd = targetDay > lastPoint[0];
    const [anchorDay, anchorScore] = beyondEnd ? lastPoint : firstPoint;
    daysOutside = Math.abs(targetDay - anchorDay);

    // Saturating horizon: the first days past the corps' last show carry the
    // trend nearly in full, the tenth barely moves it further.
    const dampedDays = daysOutside / (1 + daysOutside / TREND_DAMPING_DAYS);
    const effectiveDay = anchorDay + (beyondEnd ? dampedDays : -dampedDays);

    const trend = headroomRegression(dataPoints);
    const anchorResidual = anchorScore - trend.predict(anchorDay);
    predicted = trend.predict(effectiveDay) +
      anchorResidual * Math.exp(-daysOutside / ANCHOR_DECAY_DAYS);
  }
  if (!Number.isFinite(predicted)) predicted = best;

  // Realism band, widening with the distance projected outside the corps'
  // real season. Wide by design: it is a guard against a runaway fit, not the
  // thing shaping ordinary output (see the constants).
  const allowance = Math.min(BAND_ABOVE_MAX, BAND_ABOVE_BEST + BAND_ABOVE_PER_DAY * daysOutside);
  const ceiling = Math.min(CAPTION_MAX - MIN_HEADROOM, best + allowance);
  const floor = Math.max(0, Math.min(ceiling, worst - BAND_BELOW_WORST));

  const jitter = seed ? (seededUnitValue(seed) - 0.5) * 2 * JITTER : 0;
  const bounded = Math.min(ceiling, Math.max(floor, predicted + jitter));

  // Land on the 0.05 grid real DCI caption scores use, then re-bound: a
  // projected score should be indistinguishable in shape from a scraped one.
  let stepped = Math.round(bounded / SCORE_STEP) * SCORE_STEP;
  if (stepped > ceiling) stepped -= SCORE_STEP;
  if (stepped < floor) stepped += SCORE_STEP;

  return parseFloat(Math.min(ceiling, Math.max(floor, stepped)).toFixed(3));
}

module.exports = {
  clearRegressionCache,
  getCachedRegressionScore,
  fetchHistoricalData,
  simpleLinearRegression,
  getRealisticCaptionScore,
  getScoreForDay,
  countDataPointsForCorps,
  countRealScoresForDay,
  projectCaptionScore,
  normalizeCorpsName,
  CAPTION_MAX,
};
