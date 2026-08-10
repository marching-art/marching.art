// @ts-nocheck -- grandfathered before checkJs; remove when this file is typed or cleaned up
// Daily challenge helpers, shared by the profile store.
// Extracted from the retired userStore so the challenge feature has one home.

/**
 * Get the "game day" string — resets at 2 AM Eastern (after nightly score
 * processing) so challenges roll over together with posted scores rather
 * than at local midnight.
 *
 * Uses Intl with the America/New_York zone (same approach as the backend
 * scoring scheduler) so DST is handled correctly and the result does not
 * depend on the viewer's local timezone. The previous hand-rolled offset
 * math had an inverted sign and rolled the day over ~10 hours late.
 */
export const getGameDay = (date = new Date()) => {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    hour12: false,
  }).formatToParts(date);

  const v = {};
  for (const part of parts) v[part.type] = part.value;

  // Anchor the ET calendar date in UTC for safe day arithmetic
  const et = new Date(
    Date.UTC(
      parseInt(v.year, 10),
      parseInt(v.month, 10) - 1,
      parseInt(v.day, 10),
      parseInt(v.hour === '24' ? '0' : v.hour, 10)
    )
  );

  // Before 2 AM Eastern, the previous game day is still in progress
  if (et.getUTCHours() < 2) {
    et.setUTCDate(et.getUTCDate() - 1);
  }

  // Emit the same Date.toDateString() format the stored challenge buckets
  // have always used (e.g. "Wed Jan 14 2026")
  return new Date(et.getUTCFullYear(), et.getUTCMonth(), et.getUTCDate()).toDateString();
};

/**
 * The full pool of rotating challenges. Three are offered per game day.
 *
 * MUST STAY IN SYNC with the server catalog in
 * functions/src/helpers/dailyChallenges.js — the completeDailyChallenge
 * callable only awards XP for challenges in today's server-side rotation.
 * Both sides pin the same fixed-date expectations in their tests to catch
 * drift.
 */
// Canonical class ids that field a caption lineup. Mirrors the server's
// FANTASY_CLASSES (classRegistry capability), so a Podium-only director — who
// has no lineup — is correctly recognized as unable to satisfy check-lineup.
import { CORPS_CLASS_ORDER } from './corps';

/** True when the director has at least one lineup-drafting corps. */
const hasLineupBearingCorps = (profile) =>
  CORPS_CLASS_ORDER.some((cls) => Boolean(profile?.corps?.[cls]?.corpsName));

/**
 * The challenge pool. Mirrors functions/src/helpers/dailyChallenges.js.
 *
 * `check(profile, gameDay, context)` is the client's optimistic "is this done"
 * predicate (drives auto-claim and the Today count); the server re-verifies.
 * `available(profile, context)` is whether this director could satisfy it at
 * all today — an unavailable challenge drops out of the required set so the
 * count and the weekly arc stay winnable (Podium-only directors have no
 * lineup; a brand-new director has no prediction questions).
 *
 * `context` carries the two facts the profile alone can't answer: Podium keeps
 * its show picks and (as a string) its concept in a server-only subcollection,
 * surfaced here as `context.podium = { hasShows, hasConcept }`.
 */
// Every challenge is a GENUINE same-day action — its predicate reads state
// written the day the director does the thing. `register-show` and
// `set-show-concept` were retired from the daily pool because they verify
// persistent season state (a show map / concept set once), so they
// auto-claimed off stale state every day — free XP with no agency, and a
// phantom "+10 XP" toast when the game day rolled. Those two are taught and
// paid once by the First Season Journey questline instead.
export const CHALLENGE_POOL = [
  {
    id: 'check-lineup',
    label: 'Review your lineup',
    link: null,
    action: 'lineup',
    xp: 10,
    // No `check`: this challenge is claimed on the review ACTION (the row
    // click, handled in DailyChallenges), not by auto-claiming off a lineup
    // that merely exists — that is what made it phantom-complete every day.
    // Podium is a director simulation with no caption lineup — its daily verb
    // is allocating rehearsal blocks. Requiring this of a Podium-only director
    // once made their full set impossible.
    available: (profile) => hasLineupBearingCorps(profile),
  },
  {
    id: 'make-prediction',
    label: "Make today's prediction",
    link: null,
    action: 'predictions',
    xp: 10,
    check: (profile, gameDay) =>
      Object.keys(profile?.predictions?.[gameDay]?.picks || {}).length > 0,
    available: (_profile, context) => context?.predictionAvailable !== false,
  },
  {
    id: 'join-league-pool',
    label: "Enter today's league pool",
    link: '/leagues',
    // Stretch tier (20 XP vs 10 XP core) — mirrors the server; see the note in
    // functions/src/helpers/dailyChallenges.js.
    xp: 20,
    // Pool entries live at leagues/{id}/pools/{gameDay}, off the profile, so
    // the per-day fact is surfaced through context.leaguePool (computed by
    // useLeaguePoolFacts and threaded down like the Podium facts).
    check: (_profile, _gameDay, context) => Boolean(context?.leaguePool?.hasEntered),
    // Only a league member can enter a pool; dropped otherwise so the count
    // and weekly arc stay winnable.
    available: (profile) => Array.isArray(profile?.leagueIds) && profile.leagueIds.length > 0,
  },
];

export const CHALLENGES_PER_DAY = 2;

/**
 * Weekly arc milestone ladder — mirrors the server (helpers/dailyChallenges.js).
 * Completing the full daily set on N distinct ET-week days pays at each tier:
 *   3 days → 40/40, 5 days → 60/60 (cumulative 100/100), 7 days → 50/50.
 */
export const WEEKLY_LOOP_MILESTONES = [
  { days: 3, xp: 40, coin: 40 },
  { days: 5, xp: 60, coin: 60 },
  { days: 7, xp: 50, coin: 50 },
];
export const WEEKLY_LOOP_TARGET_DAYS =
  WEEKLY_LOOP_MILESTONES[WEEKLY_LOOP_MILESTONES.length - 1].days;

/**
 * ET-week identifier (the Monday of the game day's week), mirroring the
 * server's getWeekKey so the weekly-arc progress reads the right bucket.
 * @param {string} gameDay - Value from getGameDay()
 * @returns {string}
 */
export const getWeekKey = (gameDay) => {
  const d = new Date(gameDay);
  const sinceMonday = (d.getDay() + 6) % 7;
  d.setDate(d.getDate() - sinceMonday);
  return d.toDateString();
};

/**
 * 32-bit string hash (djb2-style, same as the server mirror).
 * @param {string} str
 * @returns {number}
 */
const hashString = (str) => {
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = ((h << 5) - h + str.charCodeAt(i)) | 0;
  }
  return h;
};

/**
 * The three challenges offered on a given game day — deterministic from the
 * day string so this always matches the server's rotation without a round
 * trip.
 * @param {string} gameDay - Value from getGameDay()
 * @returns {Array<{id: string, label: string, link: string|null, action?: string, xp: number}>}
 */
export const getChallengesForGameDay = (gameDay) => {
  const seed = hashString(gameDay);
  return CHALLENGE_POOL.map((challenge) => ({
    challenge,
    order: hashString(`${seed}:${challenge.id}`) & 0x7fffffff,
  }))
    .sort((a, b) => a.order - b.order)
    .slice(0, CHALLENGES_PER_DAY)
    .map((entry) => entry.challenge);
};

/**
 * Today's challenges with the ones this director genuinely can't satisfy
 * removed. Mirrors the server's getRequiredChallengeIds — the same filter that
 * decides the weekly-arc "full set", so the client count and the server payout
 * agree. Returns the challenge objects (the UI needs their labels/links).
 *
 * @param {string} gameDay - Value from getGameDay()
 * @param {any} profile - The user's profile document data
 * @param {{predictionAvailable?: boolean, podium?: {hasShows: boolean, hasConcept: boolean}|null}} [context]
 * @returns {Array<{id: string, label: string, xp: number}>}
 */
export const getAvailableChallengesForGameDay = (gameDay, profile, context = {}) =>
  getChallengesForGameDay(gameDay).filter(
    (challenge) => !challenge.available || challenge.available(profile, context)
  );
