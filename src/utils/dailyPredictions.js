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

export const PREDICTION_QUESTION_IDS = ['over-under', 'beat-prev', 'podium'];

/**
 * Build the day's prediction questions from recent results. Thresholds are
 * captured into each question and saved with the pick, so resolution is stable
 * even if later results shift the averages.
 *
 * @param {Array<{score: number, placement: number, eventName: string}>} recentResults
 * @returns {Array<{id: string, text: string, options: string[], xp: number, threshold: number}>}
 */
export const buildQuestions = (recentResults) => {
  if (!recentResults || recentResults.length < 2) return [];

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
