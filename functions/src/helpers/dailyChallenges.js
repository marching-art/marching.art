/**
 * Daily Challenges Helper
 *
 * Server-authoritative catalog and rotation for the dashboard's daily
 * challenges. The completeDailyChallenge callable validates against this
 * catalog so XP can only be earned for challenges actually offered today.
 *
 * MUST STAY IN SYNC with the client mirror in src/utils/dailyChallenges.js
 * (CHALLENGE_POOL and getChallengesForGameDay) — both sides pin the same
 * fixed-date expectations in their tests to catch drift.
 */

/**
 * The full pool of rotating challenges. CHALLENGES_PER_DAY are offered per
 * game day, drawn only from the ones this director is eligible for. XP values are intentionally small next to dailyLogin (25 XP) so the
 * challenge loop supplements rather than replaces the streak loop.
 *
 * Every challenge is a DECISION with a server-verifiable outcome — the
 * `verify(profileData, gameDay)` predicate is enforced by
 * completeDailyChallenge, so a challenge can only be claimed when the thing
 * was actually done. (The previous pool was six "visit page X" rows that
 * auto-completed on navigation — clicks, not choices; retired per
 * GAMIFICATION.md.)
 */
/**
 * Facts a challenge may need that the profile document alone cannot answer.
 *
 * Podium keeps its competitive state in a server-only subcollection
 * (helpers/podium/store.js), so `profile.corps.podiumClass` carries display
 * copies only — no shows, no concept. A verifier reading the profile therefore
 * cannot see that a Podium director registered for a show or named their show,
 * which is why those facts are passed in instead.
 *
 * @typedef {Object} ChallengeContext
 * @property {boolean} [predictionAvailable] - False when the director has too
 *   few scored results for any prediction question to exist today.
 * @property {{hasShows: boolean, hasConcept: boolean}|null} [podium] - Podium
 *   state for this director, or null when they have no Podium corps.
 * @property {{hasEntered: boolean}|null} [leaguePool] - Whether the director has
 *   entered today's league prediction pool, or null when they have no league.
 */

/**
 * @typedef {Object} Challenge
 * @property {string} id
 * @property {string} label
 * @property {number} xp
 * @property {(profile: any, gameDay?: string, context?: ChallengeContext) => boolean} verify
 * @property {((profile: any) => boolean)} [eligible]
 *   - Whether this challenge belongs in this director's rotation at all — a
 *     STABLE fact of the profile (fields a lineup corps, belongs to a league).
 *     Ineligible challenges never enter the day's draw, so a director is only
 *     ever dealt things they can do (see getChallengesForGameDay).
 * @property {((profile: any, context?: ChallengeContext) => boolean)} [available]
 *   - Whether an eligible challenge can be satisfied TODAY, from facts that
 *     change within a season (no prediction question exists yet for a
 *     brand-new director). An unavailable challenge stays dealt but drops out
 *     of the day's REQUIRED set (see getRequiredChallengeIds) so the weekly arc
 *     stays winnable; it can still be claimed if somehow satisfied.
 */

/**
 * Same-day acts that leave no per-day trace of their own (a reaction doc is
 * overwritten, a like is a boolean), so the callable that performs each one
 * stamps the game day onto the director's profile at
 * `engagement.dailyActs.<act>` (helpers/dailyActs.recordDailyAct). The
 * `engagement` map is server-only in firestore.rules, so the stamp is proof
 * the act went through the callable — a verifier reads one field and needs no
 * cross-document query.
 */
const DAILY_ACTS = Object.freeze({
  REACT_TO_NEWS: "reactToNews",
  APPLAUD_DESIGN: "applaudDesign",
  LEAGUE_CHAT: "leagueChat",
});

/**
 * Whether the director performed a stamped daily act on this game day.
 * @param {any} profile
 * @param {string} act - A DAILY_ACTS value
 * @param {string} [gameDay]
 * @returns {boolean}
 */
function didDailyAct(profile, act, gameDay) {
  return Boolean(gameDay) && profile?.engagement?.dailyActs?.[act] === gameDay;
}

/**
 * True when the director belongs to at least one league.
 * @param {any} profile
 * @returns {boolean}
 */
function isLeagueMember(profile) {
  return Array.isArray(profile?.leagueIds) && profile.leagueIds.length > 0;
}

/** Classes that draft a caption lineup (registry capability, not a literal). */
const { FANTASY_CLASSES } = require("./classRegistry");

/**
 * True when the director fields at least one lineup-drafting corps. Podium is
 * a director simulation with no caption lineup at all, so a Podium-only
 * director has none.
 * @param {any} profile
 * @returns {boolean}
 */
function hasLineupBearingCorps(profile) {
  const corps = profile?.corps || {};
  return FANTASY_CLASSES.some((cls) => Boolean(corps[cls] && corps[cls].corpsName));
}

/**
 * @type {Challenge[]}
 *
 * Every challenge here is a GENUINE same-day action — its verifier reads state
 * that is written the day the director does the thing, so a fresh game day
 * starts incomplete and the challenge only claims once the work is actually
 * done today.
 *
 * This is why `register-show` and `set-show-concept` were removed from the
 * daily rotation: both verify persistent, season-scoped state (a show map that
 * stays non-empty all season, a show concept set once), so on every day after
 * the first they auto-claimed off stale state — free XP with no agency, and a
 * phantom "+10 XP" toast whenever the game day rolled over in an open tab.
 * Registering for a show and naming a concept are taught and rewarded once, in
 * their proper place, by the First Season Journey questline (journey.js).
 */
const CHALLENGE_POOL = [
  {
    id: "check-lineup",
    label: "Review your lineup",
    xp: 10,
    // Reviewing a lineup requires having one. The CLIENT claims this on the
    // review action (the row click), NOT by auto-claiming off a lineup merely
    // existing — otherwise it, too, would phantom-complete every day. The
    // server verify only guarantees a lineup is present to review.
    verify: (profile) =>
      Object.values(profile.corps || {}).some(
        (c) => c && c.lineup && Object.keys(c.lineup).length > 0
      ),
    // A Podium-only director has no lineup and never will — Podium's daily
    // verb is allocating rehearsal blocks — so this is never dealt to them.
    eligible: (profile) => hasLineupBearingCorps(profile),
  },
  {
    id: "make-prediction",
    label: "Make today's prediction",
    xp: 10,
    verify: (profile, gameDay) =>
      Object.keys(profile.predictions?.[gameDay ?? ""]?.picks || {}).length > 0,
    // Fewer than two scored results means no question exists to answer.
    available: (_profile, context) => context?.predictionAvailable !== false,
  },
  {
    id: "join-league-pool",
    // Stretch tier (20 XP vs the 10 XP core): higher friction than a glance or
    // a tap — it costs a pool ante and is a deliberate social act — so it pays
    // more. (A small CC reward here is a reasonable further nudge, but that is a
    // new economy faucet and is intentionally left for an owner decision.)
    label: "Enter today's league pool",
    xp: 20,
    // League prediction pools are the game's nightly social heartbeat. Entries
    // live at leagues/{id}/pools/{gameDay}.entrants[uid] — a genuinely per-day
    // fact off the profile, surfaced through context.leaguePool (loaded by
    // loadLeaguePoolChallengeFacts) exactly as the Podium facts were.
    verify: (_profile, _gameDay, context) => Boolean(context?.leaguePool?.hasEntered),
    // Only a director in at least one league can enter a pool; it is never
    // dealt to anyone else.
    eligible: (profile) => isLeagueMember(profile),
  },
  {
    id: "league-chat",
    // Talking shop with the league is the social half of the nightly loop.
    // Stamped by postLeagueMessage, so only a message that actually posted
    // (rate limit and membership passed) counts.
    label: "Talk shop in your league chat",
    xp: 10,
    verify: (profile, gameDay) => didDailyAct(profile, DAILY_ACTS.LEAGUE_CHAT, gameDay),
    eligible: (profile) => isLeagueMember(profile),
  },
  {
    id: "react-to-news",
    // Every director — leagueless, Podium-only, brand-new — can read the
    // day's coverage and weigh in. Stamped by toggleArticleReaction when a
    // reaction is added or changed (never when one is taken back).
    label: "React to a news story",
    xp: 10,
    verify: (profile, gameDay) => didDailyAct(profile, DAILY_ACTS.REACT_TO_NEWS, gameDay),
  },
  {
    id: "applaud-design",
    // A judgment call on another director's uniform. Stamped by
    // likeExchangeDesign only when liking SOMEONE ELSE's design, so a creator
    // can't farm it off their own gallery entry.
    label: "Applaud a design on the Exchange",
    xp: 10,
    verify: (profile, gameDay) => didDailyAct(profile, DAILY_ACTS.APPLAUD_DESIGN, gameDay),
  },
];

const CHALLENGES_PER_DAY = 2;

/**
 * Weekly arc: complete the full daily challenge set on distinct game days
 * within one ET week (Mon-Sun) to earn milestone rewards. State lives at
 * profile.engagement.weeklyLoop { weekKey, countedDays: [gameDay...],
 * rewardedDays: [milestone.days...] } — countedDays makes the per-day
 * increment idempotent; rewardedDays makes each milestone pay exactly once.
 *
 * The arc is a graduated ladder rather than a single all-or-nothing payout, so
 * consistency is rewarded as it builds (and a perfect week pays the most):
 *   3 days → 40 XP / 40 CC
 *   5 days → 60 XP / 60 CC   (cumulative 100/100 — the old single-bonus total)
 *   7 days → 50 XP / 50 CC   (perfect week; cumulative 150/150)
 * The 5-day total is unchanged, so this adds earlier gratification and a
 * perfect-week ceiling without re-tuning the existing reward downward.
 */
const WEEKLY_LOOP_MILESTONES = [
  { days: 3, xp: 40, coin: 40 },
  { days: 5, xp: 60, coin: 60 },
  { days: 7, xp: 50, coin: 50 },
];
// The top of the ladder — used for progress copy and the legacy migration.
const WEEKLY_LOOP_TARGET_DAYS = WEEKLY_LOOP_MILESTONES[WEEKLY_LOOP_MILESTONES.length - 1].days;

/**
 * Milestone days a loop has already been paid for, tolerant of the legacy
 * `{ rewarded: boolean }` shape: a true legacy flag only ever meant the old
 * single 5-day bonus had paid, which under the ladder covers every milestone
 * up to and including 5 (so those never re-pay) while leaving the new 7-day
 * perfect-week tier still earnable this week.
 * @param {{rewardedDays?: number[], rewarded?: boolean}|undefined} loop
 * @returns {number[]}
 */
function normalizeRewardedDays(loop) {
  if (Array.isArray(loop?.rewardedDays)) return loop.rewardedDays;
  if (loop?.rewarded) return WEEKLY_LOOP_MILESTONES.filter((m) => m.days <= 5).map((m) => m.days);
  return [];
}

/**
 * ET-week identifier (the Monday of the week the game day belongs to, in the
 * same toDateString format as game days). Game-day strings parse cleanly
 * back into local-midnight Dates, and week grouping only needs calendar
 * arithmetic on them.
 *
 * @param {string} gameDay - Value from getGameDay()
 * @returns {string}
 */
function getWeekKey(gameDay) {
  const d = new Date(gameDay);
  const sinceMonday = (d.getDay() + 6) % 7;
  d.setDate(d.getDate() - sinceMonday);
  return d.toDateString();
}

/**
 * Advance the weekly-arc state for a game day. Pure state machine so the
 * transaction in completeDailyChallenge stays thin and this stays testable:
 * a day is counted once (countedDays dedupes), a stale week resets, and each
 * milestone pays exactly once (rewardedDays). When a single counted day crosses
 * more than one milestone at once (only possible for a legacy loop catching up
 * across the migration), their rewards are summed into one payout.
 *
 * @param {{weekKey?: string, countedDays?: string[], rewardedDays?: number[], rewarded?: boolean}|undefined} prevLoop
 *   - profile.engagement.weeklyLoop
 * @param {string} gameDay - Value from getGameDay()
 * @param {boolean} setComplete - Whether today's full challenge set is now done
 * @returns {{weeklyLoop: Object, bonus: {xp:number, coin:number, tiers:number[]}|null}}
 */
function advanceWeeklyLoop(prevLoop, gameDay, setComplete) {
  const weekKey = getWeekKey(gameDay);
  const loop =
    prevLoop?.weekKey === weekKey
      ? {
          weekKey,
          countedDays: prevLoop.countedDays || [],
          rewardedDays: normalizeRewardedDays(prevLoop),
        }
      : { weekKey, countedDays: [], rewardedDays: [] };

  if (!setComplete || loop.countedDays.includes(gameDay)) {
    return { weeklyLoop: loop, bonus: null };
  }

  const countedDays = [...loop.countedDays, gameDay];
  const newlyEarned = WEEKLY_LOOP_MILESTONES.filter(
    (m) => countedDays.length >= m.days && !loop.rewardedDays.includes(m.days)
  );
  const rewardedDays = [...loop.rewardedDays, ...newlyEarned.map((m) => m.days)];
  const bonus = newlyEarned.length
    ? {
        xp: newlyEarned.reduce((sum, m) => sum + m.xp, 0),
        coin: newlyEarned.reduce((sum, m) => sum + m.coin, 0),
        tiers: newlyEarned.map((m) => m.days),
      }
    : null;

  return { weeklyLoop: { weekKey, countedDays, rewardedDays }, bonus };
}

/** Day-buckets of completion history kept on the profile document. */
const MAX_CHALLENGE_DAYS_KEPT = 30;

/**
 * Get the "game day" string — resets at 2 AM Eastern, together with the
 * nightly score processing. Port of the client getGameDay in
 * src/utils/dailyChallenges.js; both emit Date.toDateString() format
 * (e.g. "Wed Jan 14 2026").
 *
 * @param {Date} [now]
 * @returns {string}
 */
function getGameDay(now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    hour12: false,
  }).formatToParts(now);

  /** @type {Record<string, string>} */
  const v = {};
  for (const part of parts) v[part.type] = part.value;

  const et = new Date(
    Date.UTC(
      parseInt(v.year, 10),
      parseInt(v.month, 10) - 1,
      parseInt(v.day, 10),
      parseInt(v.hour === "24" ? "0" : v.hour, 10)
    )
  );

  // Before 2 AM Eastern, the previous game day is still in progress
  if (et.getUTCHours() < 2) {
    et.setUTCDate(et.getUTCDate() - 1);
  }

  return new Date(et.getUTCFullYear(), et.getUTCMonth(), et.getUTCDate()).toDateString();
}

/**
 * 32-bit string hash (djb2-style, same as the client mirror).
 * @param {string} str
 * @returns {number}
 */
function hashString(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = ((h << 5) - h + str.charCodeAt(i)) | 0;
  }
  return h;
}

/**
 * The challenges dealt to a director on a given game day: the pool in an
 * order hashed from the day string, filtered to the ones this director is
 * eligible for, first CHALLENGES_PER_DAY taken. Deterministic from the day and
 * the profile, so client and server always agree without a round trip.
 *
 * Filtering BEFORE the slice (rather than dealing a global pair and dropping
 * the impossible ones) is what keeps a leagueless or Podium-only director from
 * being dealt a one-item or empty day: every director draws a full set from
 * what they can actually do. Eligibility reads only stable profile facts, so
 * the deal only moves mid-day when the director's situation does (they join
 * their first league).
 *
 * @param {string} gameDay - Value from getGameDay()
 * @param {any} profile - The director's profile document data
 * @returns {Challenge[]}
 */
function getChallengesForGameDay(gameDay, profile) {
  const seed = hashString(gameDay);
  return CHALLENGE_POOL.filter((challenge) => !challenge.eligible || challenge.eligible(profile))
    .map((challenge) => ({
      challenge,
      order: hashString(`${seed}:${challenge.id}`) & 0x7fffffff,
    }))
    .sort((a, b) => a.order - b.order)
    .slice(0, CHALLENGES_PER_DAY)
    .map((entry) => entry.challenge);
}

/**
 * The challenge ids that count toward "the full set" today for this director.
 *
 * A challenge the director genuinely cannot satisfy is excluded rather than
 * left to sit incomplete forever: the weekly arc pays for completing the full
 * set on five days, so an impossible member would lock the payout for the
 * whole population it applies to. Claims are unaffected — an excluded
 * challenge can still be claimed if it somehow verifies.
 *
 * @param {string} gameDay - Value from getGameDay()
 * @param {any} profile - The user's profile document data
 * @param {ChallengeContext} [context]
 * @returns {string[]}
 */
function getRequiredChallengeIds(gameDay, profile, context = {}) {
  return getChallengesForGameDay(gameDay, profile)
    .filter((challenge) => !challenge.available || challenge.available(profile, context))
    .map((challenge) => challenge.id);
}

/**
 * Whether today's rotation contains anything whose verification depends on
 * Podium state, so the caller only pays for that read when it can matter.
 *
 * The two challenges that ever needed it (register-show / set-show-concept)
 * were retired from the daily pool, so this is currently always false — kept
 * as the single gate the callable checks, so re-introducing a Podium-verified
 * challenge only touches this function and the pool.
 * @param {string} gameDay - Value from getGameDay()
 * @param {any} profile - The director's profile document data
 * @returns {boolean}
 */
function rotationNeedsPodiumContext(gameDay, profile) {
  const ids = getChallengesForGameDay(gameDay, profile).map((c) => c.id);
  return ids.includes("register-show") || ids.includes("set-show-concept");
}

/**
 * Whether today's rotation contains the join-league-pool challenge, so the
 * callable only reads the director's league pool docs when it can matter.
 * @param {string} gameDay - Value from getGameDay()
 * @param {any} profile - The director's profile document data
 * @returns {boolean}
 */
function rotationNeedsLeaguePoolContext(gameDay, profile) {
  return getChallengesForGameDay(gameDay, profile).some((c) => c.id === "join-league-pool");
}

/**
 * Prune old day-buckets so the profile document doesn't grow unbounded.
 * Keeps the most recent MAX_CHALLENGE_DAYS_KEPT buckets.
 * @param {Object} challenges - Map keyed by game-day string
 * @returns {Object}
 */
function pruneOldChallenges(challenges) {
  if (!challenges || typeof challenges !== "object") return challenges;

  const entries = Object.entries(challenges);
  if (entries.length <= MAX_CHALLENGE_DAYS_KEPT) return challenges;

  const sorted = entries.sort(
    ([dateA], [dateB]) => new Date(dateA).getTime() - new Date(dateB).getTime()
  );
  return Object.fromEntries(sorted.slice(-MAX_CHALLENGE_DAYS_KEPT));
}

module.exports = {
  CHALLENGE_POOL,
  CHALLENGES_PER_DAY,
  DAILY_ACTS,
  MAX_CHALLENGE_DAYS_KEPT,
  WEEKLY_LOOP_TARGET_DAYS,
  WEEKLY_LOOP_MILESTONES,
  getGameDay,
  getWeekKey,
  advanceWeeklyLoop,
  getChallengesForGameDay,
  getRequiredChallengeIds,
  rotationNeedsPodiumContext,
  rotationNeedsLeaguePoolContext,
  hasLineupBearingCorps,
  isLeagueMember,
  didDailyAct,
  pruneOldChallenges,
};
