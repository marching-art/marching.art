// Streak Freeze semantics (B-H3): a freeze covers the next missed game day
// and is never spent by a login that didn't need it.

const { test, describe } = require("node:test");
const assert = require("node:assert/strict");

const { resolveLoginStreak, freezeHoldUntil, FREEZE_HOLD_DAYS, gameDayMinus } = require("./loginStreak");

const TODAY = new Date(2026, 8, 3).toDateString(); // local-midnight anchored, like getGameDay
const YESTERDAY = gameDayMinus(TODAY, 1);
const TWO_DAYS_AGO = gameDayMinus(TODAY, 2);
const THREE_DAYS_AGO = gameDayMinus(TODAY, 3);
const NOW = new Date(2026, 8, 3, 9);
const HELD = new Date(NOW.getTime() + 10 * 24 * 60 * 60 * 1000);
const LAPSED = new Date(NOW.getTime() - 1000);

describe("resolveLoginStreak", () => {
  test("first ever claim starts at 1", () => {
    const r = resolveLoginStreak({ previousStreak: 0, lastLoginGameDay: null, todayGameDay: TODAY, now: NOW });
    assert.deepEqual(r, { newStreak: 1, streakBroken: false, protectedByFreeze: false, freezeConsumed: false });
  });

  test("consecutive day continues and leaves a held freeze alone", () => {
    const r = resolveLoginStreak({
      previousStreak: 12, lastLoginGameDay: YESTERDAY, todayGameDay: TODAY, streakFreezeUntil: HELD, now: NOW,
    });
    assert.equal(r.newStreak, 13);
    assert.equal(r.freezeConsumed, false);
  });

  test("one missed day with a held freeze is covered (Monday buy, Wednesday login)", () => {
    const r = resolveLoginStreak({
      previousStreak: 12, lastLoginGameDay: TWO_DAYS_AGO, todayGameDay: TODAY, streakFreezeUntil: HELD, now: NOW,
    });
    assert.deepEqual(r, { newStreak: 13, streakBroken: false, protectedByFreeze: true, freezeConsumed: true });
  });

  test("a Firestore Timestamp-shaped freeze works too", () => {
    const r = resolveLoginStreak({
      previousStreak: 3, lastLoginGameDay: TWO_DAYS_AGO, todayGameDay: TODAY,
      streakFreezeUntil: { toDate: () => HELD }, now: NOW,
    });
    assert.equal(r.protectedByFreeze, true);
  });

  test("one missed day with no freeze breaks the streak", () => {
    const r = resolveLoginStreak({ previousStreak: 12, lastLoginGameDay: TWO_DAYS_AGO, todayGameDay: TODAY, now: NOW });
    assert.deepEqual(r, { newStreak: 1, streakBroken: true, protectedByFreeze: false, freezeConsumed: false });
  });

  test("a lapsed freeze protects nothing and is not reported as spent", () => {
    const r = resolveLoginStreak({
      previousStreak: 12, lastLoginGameDay: TWO_DAYS_AGO, todayGameDay: TODAY, streakFreezeUntil: LAPSED, now: NOW,
    });
    assert.equal(r.newStreak, 1);
    assert.equal(r.freezeConsumed, false);
  });

  test("two missed days break the streak and spend the freeze", () => {
    const r = resolveLoginStreak({
      previousStreak: 12, lastLoginGameDay: THREE_DAYS_AGO, todayGameDay: TODAY, streakFreezeUntil: HELD, now: NOW,
    });
    assert.deepEqual(r, { newStreak: 1, streakBroken: true, protectedByFreeze: false, freezeConsumed: true });
  });

  test("a 1-day streak that breaks is not reported as broken", () => {
    const r = resolveLoginStreak({ previousStreak: 1, lastLoginGameDay: THREE_DAYS_AGO, todayGameDay: TODAY, now: NOW });
    assert.equal(r.streakBroken, false);
  });
});

test("freezeHoldUntil is FREEZE_HOLD_DAYS out", () => {
  assert.equal(freezeHoldUntil(NOW).getTime() - NOW.getTime(), FREEZE_HOLD_DAYS * 24 * 60 * 60 * 1000);
});
