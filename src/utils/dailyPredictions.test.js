// Client question builder for the daily prediction game, including the
// SoundSport placement-only variant (its numeric scores must never appear in
// prompts). Ids must stay in sync with the server catalog — the equality
// check lives here too.
import { describe, it, expect } from 'vitest';
import { buildQuestions, PREDICTION_QUESTION_IDS } from './dailyPredictions';
import {
  PREDICTION_QUESTION_IDS as SERVER_IDS,
  SCORE_FREE_QUESTION_IDS,
} from '../../functions/src/helpers/dailyPredictions.js';

const results = (entries) =>
  entries.map(([score, placement], i) => ({
    score,
    placement,
    eventName: `Show ${i}`,
  }));

describe('buildQuestions', () => {
  it('question ids mirror the server catalog', () => {
    expect([...PREDICTION_QUESTION_IDS].sort()).toEqual([...SERVER_IDS].sort());
  });

  it('builds score-based questions for competitive classes', () => {
    const qs = buildQuestions(
      results([
        [72.5, 4],
        [70.1, 6],
      ]),
      'worldClass'
    );
    expect(qs.map((q) => q.id)).toEqual(['over-under', 'beat-prev', 'podium']);
  });

  it('builds placement-only questions for SoundSport, with no score in any prompt', () => {
    const qs = buildQuestions(
      results([
        [68.2, 4],
        [66.0, 5],
      ]),
      'soundSport'
    );
    expect(qs.map((q) => q.id)).toEqual(['podium', 'ss-improve']);
    for (const q of qs) {
      expect(SCORE_FREE_QUESTION_IDS).toContain(q.id);
      expect(q.text).not.toMatch(/\d+\.\d/); // no numeric score leaks
    }
    // improvement threshold is the latest placement
    expect(qs[1].threshold).toBe(4);
    expect(qs[1].text).toContain('4th');
  });

  it('skips the improvement question when the corps already placed 1st', () => {
    const qs = buildQuestions(
      results([
        [90, 1],
        [88, 2],
      ]),
      'soundSport'
    );
    expect(qs.map((q) => q.id)).toEqual(['podium']);
  });
});
