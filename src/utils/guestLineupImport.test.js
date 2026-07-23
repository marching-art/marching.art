// @ts-nocheck -- grandfathered before checkJs; remove when this file is typed or cleaned up
// Tests for the guest-draft import that fulfills the registration gate's
// "your preview progress will be saved" promise.
import { describe, test, expect } from 'vitest';
import { importGuestLineup } from './guestLineupImport';
import { SOUNDSPORT_POINT_LIMIT } from '../pages/onboardingConstants';

const CORPS = [
  { corpsName: 'Blue Devils', sourceYear: 2014, points: 25 },
  { corpsName: 'Carolina Crown', sourceYear: 2013, points: 20 },
  { corpsName: 'Bluecoats', sourceYear: 2019, points: 18 },
  { corpsName: 'Phantom Regiment', sourceYear: 2008, points: 15 },
  { corpsName: 'Madison Scouts', sourceYear: 1995, points: 8 },
];

describe('importGuestLineup', () => {
  test('imports valid picks in onboarding slot format', () => {
    const guest = {
      GE1: 'Blue Devils|2014|25',
      VP: 'Bluecoats|2019|18',
    };
    const { lineup, count } = importGuestLineup(CORPS, guest);
    expect(count).toBe(2);
    expect(lineup.GE1).toBe('Blue Devils|2014|25');
    expect(lineup.VP).toBe('Bluecoats|2019|18');
  });

  test('drops picks that are not in the current season corps list', () => {
    const guest = {
      GE1: 'Blue Devils|2014|25',
      GE2: 'Star of Indiana|1993|30', // rotated out
    };
    const { lineup, count } = importGuestLineup(CORPS, guest);
    expect(count).toBe(1);
    expect(lineup.GE2).toBeUndefined();
  });

  test('uses the current season point cost, not the stored one', () => {
    // Stored cost is stale; the match must re-price from availableCorps
    const guest = { GE1: 'Blue Devils|2014|99' };
    const { lineup } = importGuestLineup(CORPS, guest);
    expect(lineup.GE1).toBe('Blue Devils|2014|25');
  });

  test('enforces the starter budget by dropping unaffordable picks', () => {
    const expensive = Array.from({ length: 8 }, (_, i) => ({
      corpsName: `Corps ${i}`,
      sourceYear: 2000 + i,
      points: 20,
    }));
    const guest = Object.fromEntries(
      ['GE1', 'GE2', 'VP', 'VA', 'CG', 'B', 'MA', 'P'].map((cap, i) => [
        cap,
        `Corps ${i}|${2000 + i}|20`,
      ])
    );
    const { lineup, count } = importGuestLineup(expensive, guest);
    const total = Object.values(lineup).reduce((s, v) => s + parseInt(v.split('|')[2]), 0);
    expect(total).toBeLessThanOrEqual(SOUNDSPORT_POINT_LIMIT);
    expect(count).toBe(Math.floor(SOUNDSPORT_POINT_LIMIT / 20));
  });

  test('drops duplicate corps across captions', () => {
    const guest = {
      GE1: 'Blue Devils|2014|25',
      GE2: 'Blue Devils|2014|25',
    };
    const { lineup, count } = importGuestLineup(CORPS, guest);
    expect(count).toBe(1);
    expect(lineup.GE1).toBeDefined();
    expect(lineup.GE2).toBeUndefined();
  });

  test('handles missing or malformed input safely', () => {
    expect(importGuestLineup(CORPS, null)).toEqual({ lineup: {}, count: 0 });
    expect(importGuestLineup(CORPS, undefined)).toEqual({ lineup: {}, count: 0 });
    expect(importGuestLineup(CORPS, 'garbage')).toEqual({ lineup: {}, count: 0 });
    expect(importGuestLineup(CORPS, { GE1: 42 })).toEqual({ lineup: {}, count: 0 });
    expect(importGuestLineup(undefined, { GE1: 'Blue Devils|2014|25' })).toEqual({
      lineup: {},
      count: 0,
    });
  });
});
