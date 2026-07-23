/**
 * Lineup-deadline reminders — "caption changes lock tonight."
 *
 * The caption-change rules (helpers/captionWindows.js) create three
 * re-engagement moments worth a push, all landing at the ~8 PM ET day
 * boundary:
 *   - the end of Day 14, when the unlimited-changes period ends;
 *   - the Saturday closes of days 21/28/35/42, when a week's 3 changes
 *     expire (day 7's overnight lock is skipped — changes are still
 *     unlimited when it reopens, so there's nothing to lose);
 *   - each Championship Week day (45-49), when that day's 2 changes close
 *     for the classes still competing.
 *
 * A daily afternoon job (pushNotifications.lineupLockReminderPushJob) calls
 * getLineupLockContext; when a lock lands within the next few hours it
 * builds one push per director who still has changes to lose. Directors
 * with nothing left to spend are never pinged.
 */

const { getCaptionChangeWindow, CHAMPIONSHIP_CLASS_DAYS } = require("./captionWindows");
const { FANTASY_CLASSES } = require("./classRegistry");
const { CLASS_LABELS } = require("./scoreDrop");

// A lock "lands tonight" when it falls within this window of the job run.
// The job runs daily at 4 PM ET and boundaries land at ~7-8 PM ET, so 12h
// catches tonight's boundary and can never also catch tomorrow's (24h apart).
const LOCK_WINDOW_MS = 12 * 60 * 60 * 1000;

/** "8:00 PM ET" for a boundary instant (handles EDT/EST automatically). */
function formatEtTime(date) {
  const label = new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
    timeZone: "America/New_York",
  }).format(date);
  return `${label} ET`;
}

/**
 * Does a caption-change lock land within the reminder window, and under
 * which rules? Pure derivation from the season doc — no Firestore.
 *
 * @param {Object} seasonData - Season doc (schedule.startDate required).
 * @param {Date} [now]
 * @returns {null | {
 *   phase: "unlimited"|"weekly"|"championship",
 *   lockAt: Date, lockTimeLabel: string,
 *   periodKey: number, tradeLimit: number,
 *   competingClasses: string[]|null,
 * }} null when no reminder is due.
 */
function getLineupLockContext(seasonData, now = new Date()) {
  const window = getCaptionChangeWindow(seasonData, now);
  if (!window || window.status !== "open") return null;

  // During the unlimited phase only the END of the phase matters — the
  // day-7 overnight lock costs nothing (changes are unlimited when it
  // reopens), so remind on unlimitedEndsAt, not locksAt.
  const lockAt = window.phase === "unlimited" ? window.unlimitedEndsAt : window.locksAt;
  if (!lockAt) return null;

  const untilLock = lockAt.getTime() - now.getTime();
  if (untilLock <= 0 || untilLock > LOCK_WINDOW_MS) return null;

  return {
    phase: window.phase,
    lockAt,
    lockTimeLabel: formatEtTime(lockAt),
    periodKey: window.periodKey,
    tradeLimit: window.tradeLimit,
    competingClasses:
      window.phase === "championship" ? CHAMPIONSHIP_CLASS_DAYS[window.day] || [] : null,
  };
}

/**
 * The classes in which this director still has changes to lose tonight.
 * @returns {Array<{corpsClass: string, corpsName: string, remaining: number}>}
 */
function classesWithChangesLeft(context, corpsMap, seasonUid) {
  const eligible = [];
  for (const corpsClass of FANTASY_CLASSES) {
    const corps = corpsMap?.[corpsClass];
    if (!corps || !corps.corpsName || !corps.lineup) continue;
    if (context.competingClasses && !context.competingClasses.includes(corpsClass)) continue;

    if (context.phase === "unlimited") {
      eligible.push({ corpsClass, corpsName: corps.corpsName, remaining: Infinity });
      continue;
    }

    const trades = corps.weeklyTrades || null;
    const used =
      trades && trades.seasonUid === seasonUid && trades.week === context.periodKey
        ? trades.used || 0
        : 0;
    const remaining = context.tradeLimit - used;
    if (remaining > 0) {
      eligible.push({ corpsClass, corpsName: corps.corpsName, remaining });
    }
  }
  return eligible;
}

/** Keep user-authored names from blowing up push copy. */
function clampName(name, max = 40) {
  const text = String(name || "").trim();
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

function buildBody(context, eligible) {
  const at = context.lockTimeLabel;

  if (context.phase === "unlimited") {
    const name = clampName(eligible[0].corpsName);
    return `Unlimited caption changes end tonight at ${at} — lock in ${name}'s lineup while you still can.`;
  }

  if (eligible.length === 1) {
    const { corpsName, remaining, corpsClass } = eligible[0];
    const label = CLASS_LABELS[corpsClass] || corpsClass;
    const changeWord = remaining === 1 ? "change" : "changes";
    if (context.phase === "championship") {
      return (
        `Finals week: ${clampName(corpsName)} has ${remaining} caption ${changeWord} ` +
        `left today — ${label} changes close at ${at}.`
      );
    }
    return (
      `${clampName(corpsName)} has ${remaining} caption ${changeWord} left this week — ` +
      `changes lock tonight at ${at}.`
    );
  }

  const scope = context.phase === "championship" ? "today" : "this week";
  return (
    `You have unspent caption changes in ${eligible.length} classes ${scope} — ` +
    `changes lock tonight at ${at}.`
  );
}

/**
 * Build one lineup-lock push per director who still has changes to lose.
 *
 * @param {Object} context - From getLineupLockContext (non-null).
 * @param {Array<{uid: string, corps: Object}>} profiles - In-season directors.
 * @param {string} seasonUid
 * @returns {Array<{uid: string, title: string, body: string, url: string, data: Object}>}
 */
function buildLineupLockPushes(context, profiles, seasonUid) {
  const title =
    context.phase === "unlimited"
      ? "Last night of unlimited changes ⏰"
      : "Caption changes lock tonight ⏰";

  const pushes = [];
  for (const { uid, corps } of profiles) {
    if (!uid) continue;
    const eligible = classesWithChangesLeft(context, corps, seasonUid);
    if (eligible.length === 0) continue;
    pushes.push({
      uid,
      title,
      body: buildBody(context, eligible),
      url: "/dashboard",
      data: { phase: context.phase, lockAt: context.lockAt.toISOString() },
    });
  }
  return pushes;
}

module.exports = {
  LOCK_WINDOW_MS,
  formatEtTime,
  getLineupLockContext,
  buildLineupLockPushes,
};
