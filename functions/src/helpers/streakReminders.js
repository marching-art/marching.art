// Evening "your streak ends tonight" nudge.
//
// The game had a post-mortem (streakBrokenEmailJob mails you the morning AFTER
// a streak dies) but no warning. The one moment the 300 CC streak freeze —
// the economy's only recurring consumable — is worth buying is the evening a
// director hasn't claimed yet, and nobody was told. This builds that nudge
// from the same fields claimDailyLogin maintains.
//
// Pure: the scheduled job (scheduled/pushNotifications.js streakAtRiskPushJob)
// queries the candidates and hands their profiles here.
const { getGameDay } = require("./dailyChallenges");

/** Streaks shorter than this aren't worth interrupting an evening for. */
const MIN_STREAK_TO_NUDGE = 3;
const DAY_MS = 24 * 60 * 60 * 1000;

/** Deep link: the dashboard's routed streak panel (hooks/useDashboardModals). */
const STREAK_PANEL_URL = "/dashboard?panel=streak";

/** @param {any} value Firestore Timestamp, Date, ISO string, or null. */
function toDate(value) {
  if (!value) return null;
  if (typeof value.toDate === "function") return value.toDate();
  const d = new Date(value);
  return Number.isFinite(d.getTime()) ? d : null;
}

/**
 * Is this director's streak alive but unclaimed today — i.e. it ends at the
 * game-day boundary unless they claim (or a freeze covers them)?
 *
 * @param {{ engagement?: { loginStreak?: number, lastLogin?: any, streakFreezeUntil?: any } }} profile
 * @param {Date} [now]
 * @returns {boolean}
 */
function isStreakAtRisk(profile, now = new Date()) {
  const engagement = profile?.engagement || {};
  const streak = Number(engagement.loginStreak) || 0;
  if (streak < MIN_STREAK_TO_NUDGE) return false;

  const lastLogin = toDate(engagement.lastLogin);
  if (!lastLogin) return false;

  const today = getGameDay(now);
  const lastLoginDay = getGameDay(lastLogin);
  if (lastLoginDay === today) return false; // already claimed — nothing to lose tonight

  // Only a streak whose last claim was YESTERDAY is still alive; an older
  // gap already broke it (the post-mortem email owns that case).
  const yesterday = new Date(new Date(today).getTime() - DAY_MS).toDateString();
  if (lastLoginDay !== yesterday) return false;

  // A live freeze already protects tonight's miss — don't sell what they own.
  const freezeUntil = toDate(engagement.streakFreezeUntil);
  if (freezeUntil && now <= freezeUntil) return false;

  return true;
}

/**
 * Build the evening pushes (and matching inbox entries) for every at-risk
 * profile. Copy mentions the freeze without quoting its price — the streak
 * panel the link opens shows the price and sells it.
 *
 * @param {Array<{ uid: string, engagement?: Object, username?: string }>} profiles
 * @param {Date} [now]
 * @returns {Array<{ uid: string, streak: number, title: string, body: string, url: string, dedupeKey: string }>}
 */
function buildStreakAtRiskPushes(profiles, now = new Date()) {
  const today = getGameDay(now);
  const dayKey = today.replace(/\s+/g, "_");
  const pushes = [];
  for (const profile of profiles || []) {
    if (!profile?.uid || !isStreakAtRisk(profile, now)) continue;
    const streak = Number(profile.engagement.loginStreak);
    pushes.push({
      uid: profile.uid,
      streak,
      title: `Your ${streak}-day streak ends tonight`,
      body:
        "You haven't claimed today's login yet. Check in before the day rolls over " +
        "to keep it going — or protect it with a Streak Freeze.",
      url: STREAK_PANEL_URL,
      dedupeKey: `streak_at_risk_${dayKey}`,
    });
  }
  return pushes;
}

module.exports = {
  MIN_STREAK_TO_NUDGE,
  STREAK_PANEL_URL,
  isStreakAtRisk,
  buildStreakAtRiskPushes,
};
