// @ts-nocheck -- grandfathered when functions checkJs landed (functions/tsconfig.json); remove when this file is typed or cleaned up
/**
 * Caption Analytics System
 *
 * Provides trend insights for corps captions without revealing raw scores.
 * Similar to fantasy sports "hot/cold" indicators.
 */

const { getDb } = require('../config');
const { logger } = require('firebase-functions/v2');

/**
 * Per-request read cache. A full-lineup analysis touches the same handful of
 * documents once per caption (8×) without this: the historical_scores docs
 * are shared across captions of the same source year, and the season +
 * dci-stats docs are identical for every caption. Memoizing them turns
 * ~26 document reads per getLineupAnalytics call into ~4-10.
 */
function createAnalyticsContext() {
  return {
    historicalEvents: new Map(), // sourceYear -> events[] | null
    allCorpsStats: undefined, // undefined = not fetched; null = unavailable
  };
}

async function getHistoricalEvents(db, sourceYear, ctx) {
  if (ctx.historicalEvents.has(sourceYear)) {
    return ctx.historicalEvents.get(sourceYear);
  }
  const historicalDoc = await db.doc(`historical_scores/${sourceYear}`).get();
  const events = historicalDoc.exists ? historicalDoc.data().data || [] : null;
  ctx.historicalEvents.set(sourceYear, events);
  return events;
}

/**
 * Analyze caption trends for a specific corps
 * Returns insights without exposing actual scores
 *
 * @param {string} corpsName - Name of the corps
 * @param {string} sourceYear - Source year for the corps
 * @param {string} caption - Caption code (GE1, GE2, VP, VA, CG, B, MA, P)
 * @param {number} currentDay - Current day in the season
 * @param {Object} [ctx] - Shared read cache from createAnalyticsContext().
 * @returns {Object} Trend analysis with indicators
 */
async function analyzeCaptionTrend(corpsName, sourceYear, caption, currentDay, ctx = createAnalyticsContext()) {
  const db = getDb();

  try {
    // Fetch historical scores for this corps (cached across captions)
    const events = await getHistoricalEvents(db, sourceYear, ctx);
    if (events === null) {
      return getDefaultAnalytics();
    }
    const corpsScores = [];

    // Collect all scores for this corps/caption
    events.forEach(event => {
      const scoreData = event.scores.find(s => s.corps === corpsName);
      if (scoreData && scoreData.captions[caption] > 0) {
        corpsScores.push({
          day: event.offSeasonDay,
          score: scoreData.captions[caption]
        });
      }
    });

    if (corpsScores.length < 3) {
      return getDefaultAnalytics();
    }

    // Sort by day
    corpsScores.sort((a, b) => a.day - b.day);

    // Calculate trend (recent vs early season)
    const trend = calculateTrend(corpsScores, currentDay);

    // Calculate momentum (recent performance direction)
    const momentum = calculateMomentum(corpsScores, currentDay);

    // Calculate consistency (score variance)
    const consistency = calculateConsistency(corpsScores);

    // Calculate relative strength (percentile among all corps)
    const strength = await calculateRelativeStrength(corpsName, sourceYear, caption, db, ctx);

    return {
      trend,
      momentum,
      consistency,
      strength,
      dataPoints: corpsScores.length
    };

  } catch (error) {
    logger.error(`Error analyzing caption trend for ${corpsName}/${caption}:`, error);
    return getDefaultAnalytics();
  }
}

/**
 * Calculate season trajectory trend
 * Compares early season to recent performance
 */
function calculateTrend(scores, currentDay) {
  if (scores.length < 4) {
    return { direction: 'stable', label: 'Insufficient data', value: 0 };
  }

  // Get relevant scores up to current day
  const relevantScores = scores.filter(s => s.day <= currentDay);
  if (relevantScores.length < 3) {
    return { direction: 'stable', label: 'Building data', value: 0 };
  }

  // Compare first third to last third of scores
  const thirdLength = Math.floor(relevantScores.length / 3);
  const earlyScores = relevantScores.slice(0, thirdLength);
  const recentScores = relevantScores.slice(-thirdLength);

  const earlyAvg = average(earlyScores.map(s => s.score));
  const recentAvg = average(recentScores.map(s => s.score));

  const percentChange = ((recentAvg - earlyAvg) / earlyAvg) * 100;

  if (percentChange > 3) {
    return { direction: 'up', label: 'Trending up', value: percentChange };
  } else if (percentChange < -3) {
    return { direction: 'down', label: 'Trending down', value: percentChange };
  } else {
    return { direction: 'stable', label: 'Steady', value: percentChange };
  }
}

/**
 * Calculate recent momentum
 * Based on last few performances
 */
function calculateMomentum(scores, currentDay) {
  const relevantScores = scores.filter(s => s.day <= currentDay);
  if (relevantScores.length < 3) {
    return { status: 'neutral', label: 'Building momentum' };
  }

  // Look at last 3-5 scores
  const recentCount = Math.min(5, relevantScores.length);
  const recentScores = relevantScores.slice(-recentCount);

  // Calculate if scores are increasing or decreasing
  let increases = 0;
  let decreases = 0;

  for (let i = 1; i < recentScores.length; i++) {
    if (recentScores[i].score > recentScores[i-1].score) {
      increases++;
    } else if (recentScores[i].score < recentScores[i-1].score) {
      decreases++;
    }
  }

  const total = increases + decreases;
  if (total === 0) {
    return { status: 'neutral', label: 'Steady hand' };
  }

  const increaseRatio = increases / total;

  if (increaseRatio >= 0.7) {
    return { status: 'hot', label: 'Hot streak' };
  } else if (increaseRatio <= 0.3) {
    return { status: 'cold', label: 'Cooling off' };
  } else {
    return { status: 'neutral', label: 'Mixed results' };
  }
}

/**
 * Calculate consistency rating
 * Based on score variance
 */
function calculateConsistency(scores) {
  if (scores.length < 3) {
    return { rating: 'unknown', label: 'Needs more data', value: 0 };
  }

  const scoreValues = scores.map(s => s.score);
  const avg = average(scoreValues);

  // Calculate coefficient of variation (CV)
  const variance = scoreValues.reduce((sum, val) => sum + Math.pow(val - avg, 2), 0) / scoreValues.length;
  const stdDev = Math.sqrt(variance);
  const cv = (stdDev / avg) * 100;

  if (cv < 3) {
    return { rating: 'reliable', label: 'Very consistent', value: cv };
  } else if (cv < 6) {
    return { rating: 'steady', label: 'Consistent', value: cv };
  } else if (cv < 10) {
    return { rating: 'variable', label: 'Some variance', value: cv };
  } else {
    return { rating: 'volatile', label: 'Unpredictable', value: cv };
  }
}

/**
 * Calculate relative strength compared to other corps
 * Returns a percentile ranking
 */
async function calculateRelativeStrength(corpsName, sourceYear, caption, db, ctx = createAnalyticsContext()) {
  try {
    // Get the dci-stats document which has averages for all corps. The
    // season + stats docs are identical for every caption in a lineup, so
    // they are fetched once per context and reused.
    if (ctx.allCorpsStats === undefined) {
      const seasonDoc = await db.doc('game-settings/season').get();
      if (!seasonDoc.exists) {
        ctx.allCorpsStats = null;
      } else {
        const seasonId = seasonDoc.data().seasonUid;
        const statsDoc = await db.doc(`dci-stats/${seasonId}`).get();
        ctx.allCorpsStats = statsDoc.exists ? statsDoc.data().data || [] : null;
      }
    }

    if (ctx.allCorpsStats === null) {
      return { percentile: 50, label: 'Average' };
    }

    const allCorpsStats = ctx.allCorpsStats;

    // Get all averages for this caption
    const captionAverages = allCorpsStats
      .map(corps => corps.stats?.[caption]?.avg || 0)
      .filter(avg => avg > 0);

    if (captionAverages.length === 0) {
      return { percentile: 50, label: 'Average' };
    }

    // Find this corps' average
    const thisCorps = allCorpsStats.find(c =>
      c.corpsName === corpsName && c.sourceYear === sourceYear
    );
    const thisAvg = thisCorps?.stats?.[caption]?.avg || 0;

    if (thisAvg === 0) {
      return { percentile: 50, label: 'Average' };
    }

    // Calculate percentile
    const belowCount = captionAverages.filter(avg => avg < thisAvg).length;
    const percentile = Math.round((belowCount / captionAverages.length) * 100);

    // Generate label
    let label;
    if (percentile >= 90) {
      label = 'Elite';
    } else if (percentile >= 75) {
      label = 'Strong';
    } else if (percentile >= 50) {
      label = 'Above average';
    } else if (percentile >= 25) {
      label = 'Below average';
    } else {
      label = 'Needs work';
    }

    return { percentile, label };

  } catch (error) {
    logger.warn(`Error calculating relative strength: ${error.message}`);
    return { percentile: 50, label: 'Average' };
  }
}

/**
 * Get analytics for all captions in a lineup
 */
async function analyzeLineupTrends(lineup, currentDay) {
  const analytics = {};
  // One shared read cache for the whole lineup — the 8 captions reuse the
  // same historical/season/stats documents instead of re-reading them.
  const ctx = createAnalyticsContext();

  for (const [caption, corpsValue] of Object.entries(lineup || {})) {
    if (!corpsValue) continue;

    const [corpsName, sourceYear] = corpsValue.split('|');
    analytics[caption] = await analyzeCaptionTrend(corpsName, sourceYear, caption, currentDay, ctx);
  }

  return analytics;
}

/**
 * Default analytics when data is unavailable
 */
function getDefaultAnalytics() {
  return {
    trend: { direction: 'stable', label: 'No data', value: 0 },
    momentum: { status: 'neutral', label: 'Unknown' },
    consistency: { rating: 'unknown', label: 'No data', value: 0 },
    strength: { percentile: 50, label: 'Unknown' },
    dataPoints: 0
  };
}

/**
 * Helper: Calculate average
 */
function average(arr) {
  if (arr.length === 0) return 0;
  return arr.reduce((sum, val) => sum + val, 0) / arr.length;
}

module.exports = {
  analyzeCaptionTrend,
  analyzeLineupTrends,
  getDefaultAnalytics
};
