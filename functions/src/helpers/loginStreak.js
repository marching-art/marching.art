/**
 * Login-streak resolution and Streak Freeze semantics — pure, so the claim
 * transaction in callable/dailyOps.js stays thin and the rules are testable.
 *
 * A Streak Freeze (300 CC, or the free one at a streak milestone) covers the
 * NEXT game day the director misses. It is held, unused, until then — for up
 * to FREEZE_HOLD_DAYS — and is spent only by a missed day. The previous
 * implementation expired it 24 hours after purchase and cleared it on every
 * claim, so a freeze bought Monday morning was gone by Tuesday morning
 * and a Tuesday login wiped it unused: it almost never protected anything.
 *
 * Game days are Date.toDateString() strings (the ET game day anchored to a
 * local-midnight Date), the same shape dailyChallenges.getGameDay returns.
 * The server clock is UTC, which has no DST, so day arithmetic on them is exact.
 */

const DAY_MS = 24 * 60 * 60 * 1000;

/** How long an unused freeze stays held before it lapses. */
const FREEZE_HOLD_DAYS = 30;

/**
 * When a freeze bought/awarded `now` lapses if never needed.
 * @param {Date} now
 * @returns {Date}
 */
function freezeHoldUntil(now = new Date()) {
  return new Date(now.getTime() + FREEZE_HOLD_DAYS * DAY_MS);
}

/**
 * Normalize the stored freeze field (Timestamp, Date, ISO string, or null).
 * @param {any} value
 * @returns {Date | null}
 */
function toFreezeDate(value) {
  if (!value) return null;
  const date = typeof value.toDate === "function" ? value.toDate() : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

/**
 * Step a game-day string back by whole days.
 * @param {string} gameDay Date.toDateString() output
 * @param {number} days
 * @returns {string}
 */
function gameDayMinus(gameDay, days) {
  return new Date(new Date(gameDay).getTime() - days * DAY_MS).toDateString();
}

/**
 * Resolve the streak a claim continues (or restarts).
 *
 * - Claimed yesterday → streak + 1; a held freeze stays held.
 * - Missed exactly one game day with a freeze held → the freeze covers it:
 *   streak + 1, freeze spent.
 * - Anything else → the streak restarts at 1. A held freeze is spent too:
 *   it covered the first missed day; the later misses broke the streak.
 *
 * @param {{
 *   previousStreak: number,
 *   lastLoginGameDay: string | null,
 *   todayGameDay: string,
 *   streakFreezeUntil?: any,
 *   now?: Date,
 * }} input
 * @returns {{ newStreak: number, streakBroken: boolean, protectedByFreeze: boolean, freezeConsumed: boolean }}
 */
function resolveLoginStreak({ previousStreak, lastLoginGameDay, todayGameDay, streakFreezeUntil, now = new Date() }) {
  const prior = Number(previousStreak) || 0;
  if (!lastLoginGameDay) {
    return { newStreak: 1, streakBroken: false, protectedByFreeze: false, freezeConsumed: false };
  }

  const yesterday = gameDayMinus(todayGameDay, 1);
  if (lastLoginGameDay === yesterday) {
    return { newStreak: prior + 1, streakBroken: false, protectedByFreeze: false, freezeConsumed: false };
  }

  const freezeUntil = toFreezeDate(streakFreezeUntil);
  const freezeHeld = Boolean(freezeUntil && now <= freezeUntil);
  const missedExactlyOne = lastLoginGameDay === gameDayMinus(todayGameDay, 2);

  if (freezeHeld && missedExactlyOne) {
    return { newStreak: prior + 1, streakBroken: false, protectedByFreeze: true, freezeConsumed: true };
  }

  return {
    newStreak: 1,
    streakBroken: prior > 1,
    protectedByFreeze: false,
    freezeConsumed: freezeHeld,
  };
}

module.exports = {
  DAY_MS,
  FREEZE_HOLD_DAYS,
  freezeHoldUntil,
  toFreezeDate,
  gameDayMinus,
  resolveLoginStreak,
};
