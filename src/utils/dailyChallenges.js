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

  /** @type {Record<string, string>} */
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
 * The full pool of rotating challenges. CHALLENGES_PER_DAY are dealt per game
 * day, drawn only from the ones this director is eligible for.
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

/**
 * @typedef {Object} ChallengeContext
 * @property {boolean} [predictionAvailable]
 * @property {any} [leaguePool] - Per-day league-pool facts (LeaguePoolChallengeFacts).
 * @property {any} [podium] - Per-day Podium facts (PodiumChallengeFacts).
 */

/**
 * @typedef {Object} Challenge
 * @property {string} id
 * @property {string} label
 * @property {string|null} [link]
 * @property {string} [action]
 * @property {number} xp
 * @property {(profile: any, gameDay: string, context?: ChallengeContext) => boolean} [check]
 * @property {(profile: any) => boolean} [eligible]
 * @property {(profile: any, context?: ChallengeContext) => boolean} [available]
 */

/**
 * Stamped same-day acts — mirrors DAILY_ACTS on the server. The callable that
 * performs each act writes today's game day to
 * `profile.engagement.dailyActs.<act>` (server-only), which is what the
 * matching challenge's `check` reads.
 */
export const DAILY_ACTS = Object.freeze({
  REACT_TO_NEWS: 'reactToNews',
  APPLAUD_DESIGN: 'applaudDesign',
  LEAGUE_CHAT: 'leagueChat',
});

/**
 * Whether the director performed a stamped daily act on this game day.
 * @param {any} profile
 * @param {string} act - A DAILY_ACTS value
 * @param {string} gameDay
 */
export const didDailyAct = (profile, act, gameDay) =>
  Boolean(gameDay) && profile?.engagement?.dailyActs?.[act] === gameDay;

/**
 * True when the director belongs to at least one league.
 * @param {{ leagueIds?: unknown }|null|undefined} profile
 */
const isLeagueMember = (profile) =>
  Array.isArray(profile?.leagueIds) && profile.leagueIds.length > 0;

/**
 * True when the director has at least one lineup-drafting corps.
 * @param {{ corps?: Record<string, { corpsName?: string }> }|null|undefined} profile
 */
const hasLineupBearingCorps = (profile) =>
  CORPS_CLASS_ORDER.some((cls) => Boolean(profile?.corps?.[cls]?.corpsName));

/**
 * The challenge pool. Mirrors functions/src/helpers/dailyChallenges.js.
 *
 * `check(profile, gameDay, context)` is the client's optimistic "is this done"
 * predicate (drives auto-claim and the Today count); the server re-verifies.
 * `eligible(profile)` is a stable profile fact deciding whether the challenge
 * is ever dealt to this director (Podium-only directors have no lineup;
 * leagueless ones have no pool or chat). `available(profile, context)` is
 * whether a dealt challenge can be satisfied today — an unavailable one drops
 * out of the required set so the count and the weekly arc stay winnable (a
 * brand-new director has no prediction questions).
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
/** @type {Challenge[]} */
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
    // is allocating rehearsal blocks — so this is never dealt to a
    // Podium-only director.
    eligible: (profile) => hasLineupBearingCorps(profile),
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
    // Only a league member can enter a pool; never dealt to anyone else.
    eligible: (profile) => isLeagueMember(profile),
  },
  {
    id: 'league-chat',
    label: 'Talk shop in your league chat',
    link: '/leagues',
    xp: 10,
    // Stamped by postLeagueMessage once a message actually posts.
    check: (profile, gameDay) => didDailyAct(profile, DAILY_ACTS.LEAGUE_CHAT, gameDay),
    eligible: (profile) => isLeagueMember(profile),
  },
  {
    id: 'react-to-news',
    label: 'React to a news story',
    // The news feed lives on the home page; each story's reactions are on
    // the feed card and the article page.
    link: '/',
    xp: 10,
    // Stamped by toggleArticleReaction on a new or changed reaction.
    check: (profile, gameDay) => didDailyAct(profile, DAILY_ACTS.REACT_TO_NEWS, gameDay),
  },
  {
    id: 'applaud-design',
    label: 'Applaud a design on the Exchange',
    link: '/exchange',
    xp: 10,
    // Stamped by likeExchangeDesign when liking someone else's design.
    check: (profile, gameDay) => didDailyAct(profile, DAILY_ACTS.APPLAUD_DESIGN, gameDay),
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
 * The challenges dealt to a director on a given game day: the pool in an
 * order hashed from the day string, filtered to the ones this director is
 * eligible for, first CHALLENGES_PER_DAY taken — deterministic from the day
 * and the profile, so this always matches the server's rotation without a
 * round trip.
 * @param {string} gameDay - Value from getGameDay()
 * @param {any} profile - The director's profile document data
 * @returns {Challenge[]}
 */
export const getChallengesForGameDay = (gameDay, profile) => {
  const seed = hashString(gameDay);
  return CHALLENGE_POOL.filter((challenge) => !challenge.eligible || challenge.eligible(profile))
    .map((challenge) => ({
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
 * @param {ChallengeContext} [context]
 * @returns {Challenge[]}
 */
export const getAvailableChallengesForGameDay = (gameDay, profile, context = {}) =>
  getChallengesForGameDay(gameDay, profile).filter(
    (challenge) => !challenge.available || challenge.available(profile, context)
  );
