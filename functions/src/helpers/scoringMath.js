// Pure scoring math: cached regression scoring, historical data fetch, and
// the linear/logarithmic regression models used to project caption scores.
// Extracted verbatim from scoring.js.

const { getDb } = require("../config");
const { logger } = require("firebase-functions/v2");

// OPTIMIZATION #1: Cache for regression calculations to avoid recomputing
// the same corps/year/caption/day combination multiple times per scoring run.
// This cache is cleared at the start of each scoring run to prevent stale data.
const regressionCache = new Map();

/**
 * Clear the regression cache. Should be called at the start of each scoring run.
 */
function clearRegressionCache() {
  regressionCache.clear();
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

function getRealisticCaptionScore(corpsName, sourceYear, caption, currentDay, historicalData) {
  const actualScore = getScoreForDay(currentDay, corpsName, sourceYear, caption, historicalData);
  if (actualScore !== null) {
    return actualScore; // Always use the real score if it exists.
  }

  const allDataPoints = [];
  const seenDays = new Set();
  const yearData = historicalData[sourceYear] || [];

  // Pre-index events by offSeasonDay so each day lookup is O(1) instead of O(n),
  // avoiding the O(n²) re-scan that getScoreForDay would cause inside this loop.
  const dayIndex = new Map();
  for (const event of yearData) {
    if (event.offSeasonDay == null) continue;
    const bucket = dayIndex.get(event.offSeasonDay);
    if (bucket) bucket.push(event);
    else dayIndex.set(event.offSeasonDay, [event]);
  }

  for (const event of yearData) {
    if (seenDays.has(event.offSeasonDay)) continue;

    let score = null;
    for (const ev of (dayIndex.get(event.offSeasonDay) || [])) {
      const scoreData = ev.scores?.find((s) => s.corps === corpsName);
      if (scoreData && scoreData.captions[caption] > 0) {
        score = scoreData.captions[caption];
        break;
      }
    }
    if (score !== null) {
      seenDays.add(event.offSeasonDay);
      allDataPoints.push([event.offSeasonDay, score]);
    }
  }

  const maxScore = 20;

  if (allDataPoints.length >= 2) {
    const regression = logarithmicRegression(allDataPoints);
    const predictedScore = regression.predict(currentDay);
    const jitter = (Math.random() - 0.5) * 0.5;
    const finalScore = predictedScore + jitter;
    const roundedScore = parseFloat(finalScore.toFixed(3));
    return Math.max(0, Math.min(maxScore, roundedScore));
  } else if (allDataPoints.length === 1) {
    return allDataPoints[0][1];
  } else {
    // Only warn if we actually fetched data for this year (meaning corps should exist).
    // If the year isn't in historicalData at all, it's likely a stale lineup from a
    // previous season - no need to spam logs for expected missing data.
    if (historicalData[sourceYear] !== undefined) {
      logger.warn(`No historical scores found for ${corpsName} (${sourceYear}), caption ${caption}. Returning 0.`);
    }
    return 0;
  }
}

function getScoreForDay(day, corps, year, caption, historicalData) {
  const events = historicalData[year]?.filter((e) => e.offSeasonDay === day);
  if (!events || events.length === 0) return null;

  for (const event of events) {
    const scoreData = event.scores.find((s) => s.corps === corps);
    if (scoreData && scoreData.captions[caption] > 0) {
      return scoreData.captions[caption]; // Return the first one found
    }
  }
  return null;
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

module.exports = {
  clearRegressionCache,
  getCachedRegressionScore,
  fetchHistoricalData,
  simpleLinearRegression,
  getRealisticCaptionScore,
  getScoreForDay,
  countDataPointsForCorps,
  logarithmicRegression,
};
