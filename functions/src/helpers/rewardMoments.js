/**
 * Bell notifications for the reward moments a daily-login claim settles —
 * achievements, level-ups, and class unlocks. Pure: turns the claim result
 * into the notification payloads (callable/dailyOps.js writes them post-commit
 * via createUserNotification, best-effort).
 *
 * Why the inbox: the dashboard used to interrupt with a modal for every
 * achievement and class unlock, on top of the season recap, the setup wizard,
 * the onboarding tour and the install nudge — a returning director could face
 * five dialogs before the page (site review U-H4). Celebrations now land here,
 * where they wait for the director instead of standing in front of them; the
 * dashboard shows a passing toast at most.
 *
 * The achievement sweep also BACKFILLS old directors on their first login
 * after it shipped, which can return many at once; that is not "you just
 * earned these", so a large batch collapses to one summary rather than
 * spamming the bell with historical unlocks. A normal earn is one or two.
 */

/** Above this many achievements in one claim, collapse to a summary row. */
const ACHIEVEMENT_BATCH_SUMMARY_THRESHOLD = 3;

/** Class display names for the unlock notification. */
const CLASS_NAMES = {
  aClass: "A Class",
  openClass: "Open Class",
  worldClass: "World Class",
};

/**
 * @param {string} uid
 * @param {{
 *   newAchievements?: Array<{id: string, title: string, description?: string, rarity?: string, ccReward?: number}>,
 *   levelsGained?: number,
 *   newLevel?: number,
 *   classUnlocked?: string | null,
 *   unlockPath?: string | null,
 * }} result - the claim's transaction result
 * @returns {Array<Object>} createUserNotification payloads, in send order
 */
function buildRewardMomentNotifications(uid, result) {
  const out = [];
  const earned = (result && result.newAchievements) || [];

  if (earned.length > ACHIEVEMENT_BATCH_SUMMARY_THRESHOLD) {
    out.push({
      type: "achievement_unlocked",
      title: "Achievements Unlocked",
      message: `You've unlocked ${earned.length} achievements! Check your profile to see them.`,
      link: "/achievements",
      metadata: { count: earned.length },
      dedupeKey: `achievements_backfill_${uid}`,
    });
  } else {
    for (const achievement of earned) {
      out.push({
        type: "achievement_unlocked",
        title: "Achievement Unlocked",
        message: `${achievement.title} — ${achievement.description}`,
        link: "/achievements",
        metadata: {
          achievementId: achievement.id,
          rarity: achievement.rarity,
          ccReward: achievement.ccReward,
        },
        dedupeKey: `achievement_${uid}_${achievement.id}`,
      });
    }
  }

  if ((result.levelsGained || 0) > 0) {
    out.push({
      type: "level_up",
      title: "Level Up!",
      message: `You reached Level ${result.newLevel}.`,
      link: "/profile",
      metadata: { level: result.newLevel, levelsGained: result.levelsGained },
      // One entry per level reached, so a multi-level jump (or a re-run)
      // converges instead of duplicating.
      dedupeKey: `level_up_${uid}_${result.newLevel}`,
    });
  }

  // A class unlocked by XP or by seasons completed is a graduation worth a
  // row; the account-age backstop is granted silently (a ceremony for a grant
  // you didn't earn reads as hollow — helpers/xpCalculations.js).
  const classKey = classKeyFor(result.classUnlocked);
  if (classKey && result.unlockPath !== "backstop") {
    out.push({
      type: "class_unlocked",
      title: `${CLASS_NAMES[classKey]} Unlocked`,
      message: `You can now register a ${CLASS_NAMES[classKey]} corps. Set it up from the dashboard whenever you're ready.`,
      link: "/dashboard?panel=register",
      metadata: { corpsClass: classKey, unlockPath: result.unlockPath || null },
      dedupeKey: `class_unlocked_${uid}_${classKey}`,
    });
  }

  return out;
}

/**
 * calculateXPUpdates reports the unlock as a display label ("A Class",
 * "Open Class", "World Class"); map it back to the canonical key.
 * @param {string | null | undefined} label
 */
function classKeyFor(label) {
  if (!label) return null;
  for (const [key, name] of Object.entries(CLASS_NAMES)) {
    if (label === key || label === name) return key;
  }
  return null;
}

module.exports = {
  ACHIEVEMENT_BATCH_SUMMARY_THRESHOLD,
  buildRewardMomentNotifications,
  classKeyFor,
};
