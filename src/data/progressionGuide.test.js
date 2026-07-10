// Mirror-equality tests: the progression guide's numbers must match the
// backend constants that actually pay. These imports reach directly into
// functions/src — the helpers are dependency-free CommonJS, so vitest can
// load them, and any drift between what the guide SAYS and what the game
// PAYS fails the suite.
import { describe, it, expect } from 'vitest';

import {
  XP_PER_LEVEL,
  LEVEL_TITLES,
  CLASS_UNLOCK_PATHS,
  XP_SOURCE_GUIDE,
} from './progressionGuide';
import { XP_SOURCES as CLIENT_XP_SOURCES } from '../utils/captionPricing';

// Backend sources of truth (plain CJS, no firebase imports)
import {
  XP_CONFIG,
  XP_SOURCES as SERVER_XP_SOURCES,
  LEVEL_TITLES as SERVER_LEVEL_TITLES,
} from '../../functions/src/helpers/xpCalculations.js';
import { STREAK_MILESTONES } from '../../functions/src/helpers/engagementRewards.js';
import { CHALLENGE_POOL } from '../../functions/src/helpers/dailyChallenges.js';

describe('progression guide mirrors the backend economy', () => {
  it('level rule matches', () => {
    expect(XP_PER_LEVEL).toBe(XP_CONFIG.xpPerLevel);
  });

  it('title ladder matches, including extended tiers', () => {
    expect(LEVEL_TITLES).toEqual(SERVER_LEVEL_TITLES);
  });

  it('class unlock levels and seasons-completed thresholds match', () => {
    expect(CLASS_UNLOCK_PATHS.aClass.level).toBe(XP_CONFIG.classUnlocks.aClass);
    expect(CLASS_UNLOCK_PATHS.openClass.level).toBe(XP_CONFIG.classUnlocks.open);
    expect(CLASS_UNLOCK_PATHS.worldClass.level).toBe(XP_CONFIG.classUnlocks.world);
    expect(CLASS_UNLOCK_PATHS.aClass.seasons).toBe(XP_CONFIG.classUnlockSeasons.aClass);
    expect(CLASS_UNLOCK_PATHS.openClass.seasons).toBe(XP_CONFIG.classUnlockSeasons.open);
    expect(CLASS_UNLOCK_PATHS.worldClass.seasons).toBe(XP_CONFIG.classUnlockSeasons.world);
  });

  it('client XP_SOURCES mirror matches the server table', () => {
    expect(CLIENT_XP_SOURCES.dailyLogin).toBe(SERVER_XP_SOURCES.dailyLogin);
    expect(CLIENT_XP_SOURCES.showParticipation).toBe(SERVER_XP_SOURCES.showParticipation);
    expect(CLIENT_XP_SOURCES.weeklyParticipation).toBe(SERVER_XP_SOURCES.weeklyParticipation);
    expect(CLIENT_XP_SOURCES.leagueWin).toBe(SERVER_XP_SOURCES.leagueWin);
    expect(CLIENT_XP_SOURCES.seasonCompletion).toEqual(SERVER_XP_SOURCES.seasonCompletion);
  });

  it('guide rows for fixed-amount sources carry the paid amounts', () => {
    const byId = Object.fromEntries(XP_SOURCE_GUIDE.map((row) => [row.id, row]));
    expect(byId.dailyLogin.xp).toBe(SERVER_XP_SOURCES.dailyLogin);
    expect(byId.showParticipation.xp).toBe(SERVER_XP_SOURCES.showParticipation);
    expect(byId.weeklyParticipation.xp).toBe(SERVER_XP_SOURCES.weeklyParticipation);
    expect(byId.leagueWin.xp).toBe(SERVER_XP_SOURCES.leagueWin);
  });

  it('guide ranges cover the real tables (challenges, streaks)', () => {
    const challengeXP = CHALLENGE_POOL.map((c) => c.xp);
    expect(Math.min(...challengeXP)).toBe(10);
    expect(Math.max(...challengeXP)).toBe(10);

    const streakXP = Object.values(STREAK_MILESTONES).map((m) => m.xp);
    expect(Math.min(...streakXP)).toBe(50);
    expect(Math.max(...streakXP)).toBe(1000);
  });
});
