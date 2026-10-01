// Client achievements catalog: parity with the server catalog (the award
// source of truth), the shared tally every surface shows, and the
// season-performance progress mirror.
import { createRequire } from 'node:module';
import { describe, expect, test } from 'vitest';
import {
  ACHIEVEMENTS,
  ACHIEVEMENT_CATEGORIES,
  buildAchievementState,
  seasonPerformance,
  summarizeAchievements,
  uniqueStoredAchievements,
} from './achievementsCatalog';

const require = createRequire(import.meta.url);
const server = require('../../functions/src/helpers/achievements.js');

describe('client catalog mirrors the server catalog', () => {
  test('same ids, rarity and CorpsCoin reward for every achievement', () => {
    const serverById = new Map(server.ACHIEVEMENT_CATALOG.map((a) => [a.id, a]));
    expect(ACHIEVEMENTS.map((a) => a.id).sort()).toEqual([...serverById.keys()].sort());
    for (const a of ACHIEVEMENTS) {
      const s = serverById.get(a.id);
      expect(a.rarity, a.id).toBe(s?.rarity);
      expect(a.ccReward, a.id).toBe(s?.ccReward);
    }
  });

  test('every entry belongs to a listed category', () => {
    const categories = new Set(ACHIEVEMENT_CATEGORIES.map((c) => c.id));
    for (const a of ACHIEVEMENTS) expect(categories.has(a.category), a.id).toBe(true);
  });

  test('season performance derivation matches the server for the same profile', () => {
    const profile = {
      corps: {
        aClass: {
          seasonHistory: [
            { seasonId: 's1', placement: 30, showsAttended: 12 },
            { seasonId: 's2', placement: 11, showsAttended: 26 },
          ],
        },
        soundSport: { seasonHistory: [{ seasonId: 's2', placement: 1, showsAttended: 8 }] },
        openClass: { seasonHistory: [{ seasonId: 's2', placement: 40, showsAttended: 4 }] },
      },
      retiredCorps: [
        { corpsClass: 'worldClass', seasonHistory: [{ seasonId: 's1', placement: 70 }] },
      ],
    };
    expect(seasonPerformance(profile.corps, profile.retiredCorps)).toEqual(
      server.seasonPerformance(profile)
    );
  });
});

describe('summarizeAchievements', () => {
  test('profile and page agree: duplicates collapse and league titles are honors', () => {
    const profile = {
      lifetimeStats: { totalSeasons: 1 },
      achievements: [
        { id: 'seasons_1', title: 'Season One', earnedAt: '2026-08-01' },
        { id: 'seasons_1', title: 'Season One', earnedAt: '2026-08-02' }, // duplicate
        { id: 'league_champion_L1_s1', title: 'League Champion: s1', ccReward: 250 },
        { id: 'first_corps', name: 'First Corps' }, // retired legacy award
      ],
    };
    const summary = summarizeAchievements(profile, {});
    expect(uniqueStoredAchievements(profile)).toHaveLength(3);
    expect(summary.totalCount).toBe(ACHIEVEMENTS.length);
    expect(summary.honors.map((h) => h.id)).toEqual(['league_champion_L1_s1', 'first_corps']);
    expect(summary.earnedCount).toBe(summary.evaluated.filter((a) => a.earned).length);
    // Stored catalog entries + honors account for every unique stored row.
    const storedCatalog = uniqueStoredAchievements(profile).length - summary.honors.length;
    expect(summary.earnedCount).toBeGreaterThanOrEqual(storedCatalog);
  });

  test('Podium achievements are in the catalog, so they count toward X/Y', () => {
    const corps = {
      podiumClass: {
        division: 'worldClass',
        seasonHistory: [{ seasonId: 's1', finalScore: 80, showsAttended: 6 }],
      },
    };
    const earned = summarizeAchievements({}, corps).evaluated.filter((a) => a.earned);
    const ids = earned.map((a) => a.id);
    expect(ids).toEqual(expect.arrayContaining(['podium_debut', 'podium_open', 'podium_world']));
  });
});

describe('season performance progress', () => {
  test('a top-12 finish fills Contender and Finalist but not Medal Stand', () => {
    const corps = { worldClass: { seasonHistory: [{ seasonId: 's1', placement: 9 }] } };
    const byId = Object.fromEntries(
      summarizeAchievements({}, corps).evaluated.map((a) => [a.id, a])
    );
    expect(byId.season_top_25.earned).toBe(true);
    expect(byId.season_top_12.earned).toBe(true);
    expect(byId.season_top_3.earned).toBe(false);
  });

  test('Full Tour shows partial progress from the best single season', () => {
    const state = buildAchievementState(
      {},
      { aClass: { seasonHistory: [{ seasonId: 's1', showsAttended: 15 }] } }
    );
    const fullTour = ACHIEVEMENTS.find((a) => a.id === 'season_full_tour');
    expect(fullTour?.progress(state)).toEqual({ current: 15, goal: 25 });
  });
});
