// Pure scoring math: cached regression scoring, historical data fetch, and
// the linear/logarithmic regression models used to project caption scores.
// Extracted verbatim from scoring.js.

const { getDb } = require("../config");
const { logger } = require("firebase-functions/v2");

// Every DCI caption is judged out of 20. Nothing may be projected AT the
// ceiling: a 20.000 is a flawless sheet, and no corps has ever earned one.
const CAPTION_MAX = 20;

// Smallest headroom (20 - score) the projection model will fit or produce.
// Keeps log(headroom) finite for a hypothetical 20.0 in the source data and
// guarantees every projection lands strictly below the ceiling.
const MIN_HEADROOM = 0.05;

// How far a projection may stray from what the corps actually scored: this
// much per day of extrapolation past its most recent real result, capped.
// Late-season corps move by tenths per show, so this is deliberately tight.
const SPREAD_PER_DAY = 0.04;
const MAX_SPREAD = 1.0;

// Deterministic variation applied to projections only (never to real
// scores), kept to a single 0.05 tick either way.
const JITTER = 0.05;

// Real caption scores are reported on a 0.05 grid; projections use it too.
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

function logarithmicRegression(data) {
  const transformedData = data.map(([x, y]) => [x, y > 0 ? Math.log(y) : 0]);

  const { m, c } = simpleLinearRegression(transformedData);

  return {
    predict: (x) => {
      const logPrediction = m * x + c;
      // Use Math.exp() to reverse the Math.log() transformation.
      return Math.exp(logPrediction);
    },
  };
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
 *   2. A PROJECTED score stays inside what the corps has actually done: at
 *      most SPREAD_PER_DAY per day of extrapolation above its season best
 *      (capped at MAX_SPREAD), and never at or above the caption ceiling.
 *   3. The variation applied is minimal (±JITTER) and deterministic.
 *
 * The old model fit the score directly with an exponential (log-linear on the
 * score), which grows without bound. By the last fortnight of a season it
 * projected 20+ for every top corps; the hard `Math.min(20, ...)` in
 * scoring.js then flattened all of them to exactly 20.000, so every lineup
 * carrying a top corps in GE1 and GE2 posted an identical 40.0 General
 * Effect — a perfect sheet no corps has ever earned.
 *
 * @param {Array<[number, number]>} dataPoints - [competitionDay, score] pairs.
 * @param {number} targetDay - The competition day to project.
 * @param {string} [seed] - Stable seed for the jitter; "" disables jitter.
 * @returns {number} A score in [0, CAPTION_MAX).
 */
function projectCaptionScore(dataPoints, targetDay, seed = "") {
  if (!dataPoints || dataPoints.length === 0) return 0;

  const scores = dataPoints.map(([, y]) => y);
  const best = Math.max(...scores);
  const worst = Math.min(...scores);
  const lastDay = Math.max(...dataPoints.map(([x]) => x));

  let predicted;
  if (dataPoints.length === 1) {
    predicted = scores[0];
  } else {
    predicted = headroomRegression(dataPoints).predict(targetDay);
  }
  if (!Number.isFinite(predicted)) predicted = best;

  // Realism band. Above: the corps' season best plus a little for each day
  // projected past its most recent result — a corps improves by tenths late
  // in a season, not points — and always short of the ceiling. Below: it
  // cannot collapse further than MAX_SPREAD under its own worst outing.
  const extrapolatedDays = Math.max(0, targetDay - lastDay);
  const spread = Math.min(MAX_SPREAD, SPREAD_PER_DAY * extrapolatedDays);
  const ceiling = Math.min(CAPTION_MAX - MIN_HEADROOM, best + spread);
  const floor = Math.max(0, Math.min(ceiling, worst - MAX_SPREAD));

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
  logarithmicRegression,
  projectCaptionScore,
  normalizeCorpsName,
  CAPTION_MAX,
};
