/**
 * Cross-runtime clock/caption-window parity gate.
 *
 * Several pieces of domain logic are hand-mirrored between the Cloud
 * Functions runtime (CommonJS, cannot import outside its deploy root) and the
 * client, each marked with "keep in sync" comments but — before this spec —
 * with no enforcement. This spec loads BOTH sides (the functions modules via
 * createRequire, the client modules as ESM/TS) and compares their outputs
 * across a matrix of instants, so any future edit to one side without the
 * other fails CI:
 *
 *   1. functions/src/helpers/captionWindows.js getCaptionChangeWindow
 *      <-> src/utils/seasonClock.js getCaptionChangeInfo
 *   2. functions/src/helpers/gameDay.js getCompletedGameDayET /
 *      getActiveCalendarDay <-> src/utils/seasonProgress.ts getSeasonProgress
 *      (whose internal getActiveCalendarDay is a verbatim port)
 *   3. The class-unlock triplication: functions xpCalculations XP_CONFIG
 *      <-> functions classRegistry CLASS_UNLOCK_LEVELS <-> client
 *      classUnlocks CLASS_UNLOCK_SEASONS <-> classRegistry.json unlockLevel.
 *      (Backend-only comparisons live in
 *      functions/src/helpers/classUnlockParity.test.js.)
 *
 * INTENTIONAL divergences (not compared here):
 *   - Caption windows: the client adds presentation-only fields (isUnlimited,
 *     resetsAt, nextLimit) the backend does not compute; the backend adds
 *     pendingScoresDay, which needs Firestore access (isDayScoresProcessed)
 *     to act on and is meaningless client-side. Only the shared contract —
 *     day, week, phase, status, tradeLimit, periodKey, unlimitedEndsAt,
 *     locksAt, reopensAt — must agree.
 *   - Game day: the client clamps to [1, 49] / weeks to [1, 7] for display
 *     (day 0 / week 0 with no start date) while the backend returns raw
 *     values its callers validate. Parity is asserted on the clamped value
 *     computed from the backend's raw day.
 *   - gameDay.getCurrentSeasonWeek (raw-ms week used by league jobs) is a
 *     DIFFERENT, coarser algorithm than the 2 AM ET day-based week and is
 *     deliberately not compared.
 */

import { createRequire } from 'node:module';
import { getCaptionChangeInfo } from './seasonClock';
import { getSeasonProgress } from './seasonProgress';
import { CLASS_UNLOCK_SEASONS } from './classUnlocks';
import clientRegistry from '../config/classRegistry.json';

const require = createRequire(import.meta.url);
const backendCaption = require('../../functions/src/helpers/captionWindows.js');
const backendGameDay = require('../../functions/src/helpers/gameDay.js');
const { XP_CONFIG } = require('../../functions/src/helpers/xpCalculations.js');
const backendRegistry = require('../../functions/src/helpers/classRegistry.js');

const DAY_MS = 24 * 60 * 60 * 1000;

// ---------------------------------------------------------------------------
// Instant matrix: synthetic 49-day seasons hitting ordinary days, the 2 AM ET
// processing boundary +/- 1 minute (EDT: 06:00Z, EST: 07:00Z), the 8 PM ET
// day boundaries, blackout (43-44) and championship (45-49) days, plus both
// DST transitions (spring forward 2026-03-08, fall back 2026-11-01) and
// pre-season / post-season overshoot.
// ---------------------------------------------------------------------------
const SEASONS = [
  // [startDate ISO (UTC midnight, as the admin tool writes), springTrainingDays]
  ['2026-06-21T00:00:00Z', 0], // all-summer season (EDT throughout)
  ['2026-02-01T00:00:00Z', 0], // spans the 2026-03-08 spring-forward (day 36)
  ['2026-10-01T00:00:00Z', 0], // spans the 2026-11-01 fall-back (day 32)
  ['2026-05-31T00:00:00Z', 21], // live-season shape with spring training
];

// Offsets within each calendar day of the season (from the UTC-midnight day
// boundary): just after the 8 PM ET boundary, around the 2 AM EDT run
// (06:00Z), the 2 AM EST run (07:00Z), midday, and just before the next
// boundary.
const DAY_OFFSETS_MS = [
  60e3,
  6 * 3600e3 - 60e3,
  6 * 3600e3,
  6 * 3600e3 + 60e3,
  7 * 3600e3,
  12 * 3600e3,
  24 * 3600e3 - 60e3,
];

// Absolute instants around the DST transitions themselves: the spring-forward
// skips 2:00 AM ET (06:59Z -> 07:01Z jumps 1:59 EST -> 3:01 EDT) and the
// fall-back repeats 1-2 AM (2 AM EDT = 06:00Z, 2 AM EST = 07:00Z).
const DST_INSTANTS = [
  '2026-03-08T06:59:00Z',
  '2026-03-08T07:00:00Z',
  '2026-03-08T07:01:00Z',
  '2026-11-01T05:59:00Z',
  '2026-11-01T06:00:00Z',
  '2026-11-01T06:30:00Z',
  '2026-11-01T07:00:00Z',
  '2026-11-01T07:01:00Z',
];

const CORPS_CLASSES = [null, 'worldClass', 'openClass', 'aClass', 'soundSport'];

function seasonDoc(startIso, springTrainingDays) {
  const start = new Date(startIso);
  return {
    status: 'live-season',
    seasonUid: 'parity-season',
    schedule: {
      startDate: { toDate: () => start },
      ...(springTrainingDays ? { springTrainingDays } : {}),
    },
  };
}

function* instants(startIso, springTrainingDays) {
  const startMs = new Date(startIso).getTime();
  // Calendar days 0..(spring + 51): pre-season through post-season overshoot.
  for (let d = 0; d <= springTrainingDays + 51; d++) {
    for (const off of DAY_OFFSETS_MS) yield new Date(startMs + d * DAY_MS + off);
  }
  for (const iso of DST_INSTANTS) yield new Date(iso);
}

const ms = (date) => (date instanceof Date ? date.getTime() : date === null ? null : NaN);

describe('caption-change window parity (functions captionWindows <-> client seasonClock)', () => {
  const SHARED_SCALARS = ['day', 'week', 'phase', 'status', 'tradeLimit', 'periodKey'];
  const SHARED_INSTANTS = ['unlimitedEndsAt', 'locksAt', 'reopensAt'];

  it.each(SEASONS)('agrees across the full matrix (start %s, spring %i)', (startIso, spring) => {
    const season = seasonDoc(startIso, spring);
    let compared = 0;
    for (const now of instants(startIso, spring)) {
      for (const corpsClass of CORPS_CLASSES) {
        const backend = backendCaption.getCaptionChangeWindow(season, now, corpsClass);
        const client = getCaptionChangeInfo(season, now, corpsClass);
        const context = `${startIso} spring=${spring} now=${now.toISOString()} class=${corpsClass}`;
        for (const key of SHARED_SCALARS) {
          expect(client[key], `${key} @ ${context}`).toBe(backend[key]);
        }
        for (const key of SHARED_INSTANTS) {
          expect(ms(client[key]), `${key} @ ${context}`).toBe(ms(backend[key]));
        }
        compared++;
      }
    }
    expect(compared).toBeGreaterThan(1000);
  });

  it('both sides return null without a start date', () => {
    expect(backendCaption.getCaptionChangeWindow({}, new Date())).toBeNull();
    expect(getCaptionChangeInfo({}, new Date())).toBeNull();
  });
});

describe('game-day parity (functions gameDay <-> client seasonProgress)', () => {
  it.each(SEASONS)('agrees across the full matrix (start %s, spring %i)', (startIso, spring) => {
    const season = seasonDoc(startIso, spring);
    const start = new Date(startIso);
    let compared = 0;
    for (const now of instants(startIso, spring)) {
      // Backend truth: active calendar day from the 2 AM ET game-day clock,
      // minus spring training, clamped exactly the way the client displays it.
      const activeCalendarDay = backendGameDay.getActiveCalendarDay(start, now);
      const expectedDay = Math.max(1, Math.min(activeCalendarDay - spring, 49));
      const expectedWeek = Math.max(1, Math.min(Math.ceil(expectedDay / 7), 7));

      const progress = getSeasonProgress(season, now);
      const context = `${startIso} spring=${spring} now=${now.toISOString()}`;
      expect(progress.currentDay, `currentDay @ ${context}`).toBe(expectedDay);
      expect(progress.currentWeek, `currentWeek @ ${context}`).toBe(expectedWeek);
      compared++;
    }
    expect(compared).toBeGreaterThan(300);
  });

  it('active day is completed day + 1 on the backend (shared 2 AM ET boundary)', () => {
    const now = new Date('2026-06-25T12:00:00Z');
    expect(backendGameDay.getActiveCalendarDay(new Date('2026-06-21T00:00:00Z'), now)).toBe(
      backendGameDay.getCompletedCalendarDay(new Date('2026-06-21T00:00:00Z'), now) + 1
    );
  });
});

describe('class-unlock triplication consistency', () => {
  it('client CLASS_UNLOCK_SEASONS mirrors backend XP_CONFIG.classUnlockSeasons', () => {
    // Backend keys are the short aliases; the client also accepts canonical
    // keys, which must carry the same values.
    expect(CLASS_UNLOCK_SEASONS.aClass).toBe(XP_CONFIG.classUnlockSeasons.aClass);
    expect(CLASS_UNLOCK_SEASONS.open).toBe(XP_CONFIG.classUnlockSeasons.open);
    expect(CLASS_UNLOCK_SEASONS.world).toBe(XP_CONFIG.classUnlockSeasons.world);
    expect(CLASS_UNLOCK_SEASONS.openClass).toBe(XP_CONFIG.classUnlockSeasons.open);
    expect(CLASS_UNLOCK_SEASONS.worldClass).toBe(XP_CONFIG.classUnlockSeasons.world);
  });

  it('backend XP_CONFIG.classUnlocks mirrors registry CLASS_UNLOCK_LEVELS', () => {
    expect(backendRegistry.CLASS_UNLOCK_LEVELS).toEqual({
      aClass: XP_CONFIG.classUnlocks.aClass,
      openClass: XP_CONFIG.classUnlocks.open,
      worldClass: XP_CONFIG.classUnlocks.world,
    });
  });

  it('client classRegistry.json unlockLevel fields match the backend registry', () => {
    // scripts/checkClassRegistrySync.js keeps the two JSON copies
    // byte-identical; this asserts the derived unlock gates line up with the
    // client copy this bundle actually imports.
    for (const [id, entry] of Object.entries(clientRegistry.classes)) {
      const expected = backendRegistry.CLASS_UNLOCK_LEVELS[id] ?? 0;
      expect(entry.unlockLevel, `unlockLevel for ${id}`).toBe(expected);
    }
  });

  it('pins the current unlock gate values (Level 3/5/10, seasons 1/2/3)', () => {
    expect(XP_CONFIG.classUnlocks).toEqual({ aClass: 3, open: 5, world: 10 });
    expect(XP_CONFIG.classUnlockSeasons).toEqual({ aClass: 1, open: 2, world: 3 });
  });
});
