// @ts-nocheck -- grandfathered before checkJs; remove when this file is typed or cleaned up
// Daily Predictions — client mirror of the prediction question catalog.
//
// The prediction game asks a few questions each day whose thresholds are
// derived from the director's recent results. Picks are saved server-side
// (submitPrediction) and resolved authoritatively against fantasy_recaps
// (resolvePredictions) — see functions/src/helpers/dailyPredictions.js, which
// owns the resolution rules and reward table. The question ids here MUST stay
// in sync with PREDICTION_QUESTIONS there.

/** XP shown/awarded per correct prediction (mirrors the server catalog). */
export const PREDICTION_XP = 15;

export const PREDICTION_QUESTION_IDS = ['over-under', 'beat-prev', 'podium', 'ss-improve'];

const ordinal = (n) => {
  const rem10 = n % 10;
  const rem100 = n % 100;
  if (rem10 === 1 && rem100 !== 11) return `${n}st`;
  if (rem10 === 2 && rem100 !== 12) return `${n}nd`;
  if (rem10 === 3 && rem100 !== 13) return `${n}rd`;
  return `${n}th`;
};

/**
 * Build the day's prediction questions from recent results. Thresholds are
 * captured into each question and saved with the pick, so resolution is stable
 * even if later results shift the averages.
 *
 * SoundSport gets placement-based questions only (medal + improvement) — its
 * numeric scores are deliberately hidden behind medal ratings, and the
 * server rejects score-based picks for it.
 *
 * @param {Array<{score: number, placement: number, eventName: string}>} recentResults
 * @param {string} [corpsClass]
 * @returns {Array<{id: string, text: string, options: string[], xp: number, threshold: number}>}
 */
export const buildQuestions = (recentResults, corpsClass) => {
  if (!recentResults || recentResults.length < 2) return [];

  if (corpsClass === 'soundSport') {
    const questions = [
      {
        id: 'podium',
        text: 'Take a medal (top 3) at your next show?',
        options: ['Yes', 'No'],
        xp: PREDICTION_XP,
        threshold: 3,
      },
    ];
    const lastPlacement = recentResults
      .map((r) => r.placement)
      .find((p) => typeof p === 'number' && p > 0);
    // Improvement is only a real question when there's somewhere to climb.
    if (typeof lastPlacement === 'number' && lastPlacement > 1) {
      questions.push({
        id: 'ss-improve',
        text: `Place higher than ${ordinal(lastPlacement)} next time out?`,
        options: ['Yes', 'No'],
        xp: PREDICTION_XP,
        threshold: lastPlacement,
      });
    }
    return questions;
  }

  const scores = recentResults.map((r) => r.score).filter(Boolean);
  if (scores.length < 2) return [];

  const avg = scores.slice(0, 3).reduce((s, v) => s + v, 0) / Math.min(scores.length, 3);
  const line = Math.round(avg * 10) / 10;
  const lastScore = scores[0];

  return [
    {
      id: 'over-under',
      text: `Next score over or under ${line.toFixed(1)}?`,
      options: ['Over', 'Under'],
      xp: PREDICTION_XP,
      threshold: line,
    },
    {
      id: 'beat-prev',
      text: `Beat your last score of ${lastScore.toFixed(1)}?`,
      options: ['Yes', 'No'],
      xp: PREDICTION_XP,
      threshold: lastScore,
    },
    {
      id: 'podium',
      text: 'Top 3 finish next show?',
      options: ['Yes', 'No'],
      xp: PREDICTION_XP,
      threshold: 3,
    },
  ];
};
