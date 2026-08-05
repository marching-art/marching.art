import { describe, it, expect } from 'vitest';
import { computeDirectorsReport } from './directorsReport';
import { getGameDay, getChallengesForGameDay } from './dailyChallenges';

// Mid-afternoon ET, well clear of the 2 AM game-day boundary.
const NOW = new Date('2026-07-15T18:00:00Z');
const GAME_DAY = getGameDay(NOW);

/** Two scored results are the minimum that produces prediction questions. */
const TWO_RESULTS = [
  { score: 82.5, placement: 4, eventName: 'Show B' },
  { score: 80.1, placement: 6, eventName: 'Show A' },
];

describe('computeDirectorsReport — the day’s set', () => {
  it('counts the login, the challenge rotation, and the questions', () => {
    const state = computeDirectorsReport({
      profile: null,
      recentResults: TWO_RESULTS,
      corpsClass: 'worldClass',
      now: NOW,
    });
    // 1 login + today's challenges + today's questions.
    expect(state.totalCount).toBe(1 + state.challenges.length + state.questions.length);
    expect(state.doneCount).toBe(0);
    expect(state.allDone).toBe(false);
  });

  it('marks the login done when it landed on this game day', () => {
    const state = computeDirectorsReport({
      profile: { engagement: { lastLogin: NOW, loginStreak: 9 } },
      recentResults: TWO_RESULTS,
      corpsClass: 'worldClass',
      now: NOW,
    });
    expect(state.loginDone).toBe(true);
    expect(state.streak).toBe(9);
    expect(state.doneCount).toBe(1);
  });

  it('does not credit a login from a previous game day', () => {
    const state = computeDirectorsReport({
      profile: { engagement: { lastLogin: new Date('2026-07-13T18:00:00Z') } },
      recentResults: TWO_RESULTS,
      corpsClass: 'worldClass',
      now: NOW,
    });
    expect(state.loginDone).toBe(false);
  });

  it('accepts a Firestore Timestamp for lastLogin', () => {
    const state = computeDirectorsReport({
      profile: { engagement: { lastLogin: { toDate: () => NOW } } },
      recentResults: TWO_RESULTS,
      corpsClass: 'worldClass',
      now: NOW,
    });
    expect(state.loginDone).toBe(true);
  });

  it('counts only completed challenges that are in today’s rotation', () => {
    const todays = getChallengesForGameDay(GAME_DAY);
    const state = computeDirectorsReport({
      profile: {
        challenges: {
          [GAME_DAY]: [
            { id: todays[0].id, completed: true },
            { id: todays[1].id, completed: false },
            // A challenge from another day's rotation must not inflate today.
            { id: 'not-in-todays-rotation', completed: true },
          ],
        },
      },
      recentResults: TWO_RESULTS,
      corpsClass: 'worldClass',
      now: NOW,
    });
    expect(state.challengesDone).toBe(1);
  });

  it('counts saved prediction picks', () => {
    const state = computeDirectorsReport({
      profile: { predictions: { [GAME_DAY]: { picks: { 'over-under': 'Over' } } } },
      recentResults: TWO_RESULTS,
      corpsClass: 'worldClass',
      now: NOW,
    });
    expect(state.predictionsDone).toBe(1);
  });

  it('treats a resolved prediction day as fully done', () => {
    const state = computeDirectorsReport({
      profile: { predictions: { [GAME_DAY]: { resolved: true } } },
      recentResults: TWO_RESULTS,
      corpsClass: 'worldClass',
      now: NOW,
    });
    expect(state.predictionsDone).toBe(state.questions.length);
  });

  it('never counts more picks than there are questions', () => {
    const state = computeDirectorsReport({
      profile: {
        predictions: {
          [GAME_DAY]: { picks: { a: 1, b: 2, c: 3, d: 4, e: 5, f: 6, g: 7, h: 8 } },
        },
      },
      recentResults: TWO_RESULTS,
      corpsClass: 'worldClass',
      now: NOW,
    });
    expect(state.predictionsDone).toBe(state.questions.length);
    expect(state.doneCount).toBeLessThanOrEqual(state.totalCount);
  });
});

describe('computeDirectorsReport — a brand-new director', () => {
  // Fewer than two scored results means the game cannot pose a prediction
  // question. Leaving make-prediction in the set would pin the count below
  // its total forever, so both the row and the questions drop out.
  it('drops predictions and the make-prediction challenge', () => {
    const state = computeDirectorsReport({
      profile: null,
      recentResults: [],
      corpsClass: 'worldClass',
      now: NOW,
    });
    expect(state.predictionAvailable).toBe(false);
    expect(state.questions).toEqual([]);
    expect(state.challenges.some((c) => c.id === 'make-prediction')).toBe(false);
  });

  it('can still reach a complete day', () => {
    const state = computeDirectorsReport({
      profile: {
        engagement: { lastLogin: NOW },
        challenges: {
          [GAME_DAY]: getChallengesForGameDay(GAME_DAY)
            .filter((c) => c.id !== 'make-prediction')
            .map((c) => ({ id: c.id, completed: true })),
        },
      },
      recentResults: [],
      corpsClass: 'worldClass',
      now: NOW,
    });
    expect(state.doneCount).toBe(state.totalCount);
    expect(state.allDone).toBe(true);
  });
});

describe('computeDirectorsReport — a Podium-only director', () => {
  // No lineup-bearing corps, and their shows/concept live off the profile.
  const podiumProfile = { corps: { podiumClass: { corpsName: 'Riverside' } } };

  it('drops check-lineup from the set — Podium has no lineup', () => {
    const rotation = getChallengesForGameDay(GAME_DAY).map((c) => c.id);
    const state = computeDirectorsReport({
      profile: podiumProfile,
      recentResults: [],
      corpsClass: 'podiumClass',
      now: NOW,
    });
    if (rotation.includes('check-lineup')) {
      expect(state.challenges.some((c) => c.id === 'check-lineup')).toBe(false);
    }
    // The total must not count a challenge they can never do.
    expect(state.totalCount).toBe(1 + state.challenges.length + state.questions.length);
  });

  it('keeps show/concept challenges, which a Podium director can satisfy', () => {
    const rotation = getChallengesForGameDay(GAME_DAY).map((c) => c.id);
    const state = computeDirectorsReport({
      profile: podiumProfile,
      recentResults: [],
      corpsClass: 'podiumClass',
      podium: { hasShows: true, hasConcept: true },
      now: NOW,
    });
    for (const id of ['register-show', 'set-show-concept']) {
      if (rotation.includes(id)) expect(state.challenges.some((c) => c.id === id)).toBe(true);
    }
  });

  it('can reach a complete day with only the challenges it can do', () => {
    // Complete every available challenge; login done; no predictions.
    const available = computeDirectorsReport({
      profile: podiumProfile,
      recentResults: [],
      corpsClass: 'podiumClass',
      podium: { hasShows: true, hasConcept: true },
      now: NOW,
    }).challenges;

    const state = computeDirectorsReport({
      profile: {
        ...podiumProfile,
        engagement: { lastLogin: NOW },
        challenges: { [GAME_DAY]: available.map((c) => ({ id: c.id, completed: true })) },
      },
      recentResults: [],
      corpsClass: 'podiumClass',
      podium: { hasShows: true, hasConcept: true },
      now: NOW,
    });
    expect(state.allDone).toBe(true);
  });
});

describe('computeDirectorsReport — SoundSport', () => {
  it('uses the placement-only question set', () => {
    const state = computeDirectorsReport({
      profile: null,
      recentResults: [
        { placement: 4, eventName: 'Show B' },
        { placement: 6, eventName: 'Show A' },
      ],
      corpsClass: 'soundSport',
      now: NOW,
    });
    // SoundSport hides numeric scores, so no score-threshold questions.
    expect(state.questions.every((q) => q.id === 'podium' || q.id === 'ss-improve')).toBe(true);
    expect(state.questions.length).toBeGreaterThan(0);
  });
});
