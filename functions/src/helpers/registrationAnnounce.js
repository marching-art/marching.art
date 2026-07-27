/**
 * Registration deadlines → #announcements.
 *
 * Each class closes NEW-corps registration a fixed number of weeks before
 * finals (classRegistry `registrationLockWeeks`: World 6, Open 5, A 4) so a
 * director can't enter a class with too little season left to field a
 * competitive run — helpers/registrationLock.js, enforced in
 * `callable/corps.js`. It is a hard, irreversible deadline: miss it and that
 * class is gone until next season.
 *
 * Until this post, the rule was enforced and never advertised. A director met
 * it as an error message at the moment it was already too late.
 *
 * The announcement is the same shape as the lineup-lock post
 * (helpers/seasonAnnounce.js): fire in the LAST week the class is still open,
 * once, on the channel that reaches the directors who aren't in the app. The
 * lock triggers when `weeksRemaining < lockWeeks`, so `weeksRemaining ===
 * lockWeeks` is exactly that final week.
 *
 * Deliberately NOT a push: this is relevant to directors who have not yet
 * registered in a class, which is precisely the group the per-corps push
 * fan-outs can't target. A channel post is the right instrument.
 */

const { COLORS, link, payloadOf, postOnce } = require("./discord");
const { REGISTRATION_LOCK_WEEKS } = require("./classRegistry");
const { weeksUntilSeasonEnd } = require("./registrationLock");

/** Log tag on every announcement this module posts. */
const TAG = "registration-lock";

const CLASS_LABELS = {
  worldClass: "World Class",
  openClass: "Open Class",
  aClass: "A Class",
  soundSport: "SoundSport",
  podiumClass: "Podium",
};

const DASHBOARD_URL = link("/dashboard");

/**
 * The classes in their FINAL week of open registration, and the weeks left in
 * the season. A class with `registrationLockWeeks: 0` never locks and never
 * appears here.
 *
 * @param {Object} seasonData - game-settings/season doc.
 * @param {Date} [now]
 * @returns {{weeksRemaining: ?number, classes: Array<{corpsClass: string, lockWeeks: number}>}}
 */
function classesClosingThisWeek(seasonData, now = new Date()) {
  const weeksRemaining = weeksUntilSeasonEnd(seasonData, now);
  if (weeksRemaining === null) return { weeksRemaining: null, classes: [] };

  const classes = Object.entries(REGISTRATION_LOCK_WEEKS)
    .filter(([, lockWeeks]) => lockWeeks > 0 && weeksRemaining === lockWeeks)
    // Highest tier first when two classes ever share a lock week.
    .sort((a, b) => b[1] - a[1])
    .map(([corpsClass, lockWeeks]) => ({ corpsClass, lockWeeks }));

  return { weeksRemaining, classes };
}

/** "World Class", "World Class and Open Class", "A, B and C". */
function listLabels(classes) {
  const labels = classes.map((c) => CLASS_LABELS[c.corpsClass] || c.corpsClass);
  if (labels.length <= 1) return labels[0] || "";
  return `${labels.slice(0, -1).join(", ")} and ${labels[labels.length - 1]}`;
}

/**
 * "Last week to start a corps in X" — or null when nothing closes this week.
 *
 * @param {Object} params
 * @param {string} params.seasonName
 * @param {number} params.weeksRemaining
 * @param {Array<{corpsClass: string, lockWeeks: number}>} params.classes
 * @returns {?Object} Webhook payload.
 */
function buildRegistrationDeadlinePayload({ seasonName, weeksRemaining, classes }) {
  if (!classes || classes.length === 0) return null;
  const labels = listLabels(classes);
  const weeks = `${weeksRemaining} week${weeksRemaining === 1 ? "" : "s"}`;

  return payloadOf({
    title: `🚪 Last week to start a ${labels} corps`,
    url: DASHBOARD_URL,
    description:
      `${seasonName} — ${labels} registration closes at the end of this week. Each class ` +
      "locks a set number of weeks before finals so a new corps has enough season left to " +
      `compete, and ${weeks} remain. After that it's closed until next season.`,
    color: COLORS.season,
    fields: classes.map(({ corpsClass, lockWeeks }) => ({
      name: CLASS_LABELS[corpsClass] || corpsClass,
      value: `Locks ${lockWeeks} weeks before finals`,
      inline: true,
    })),
    // The lock blocks STARTING a corps, nothing else. Without this, a director
    // who already has one reads the post as a threat to the corps they're
    // running.
    footer: {
      text: "Only affects starting a new corps — one you already have keeps competing.",
    },
  });
}

/**
 * Announce whichever classes close this week, once per closing week.
 *
 * Safe to call daily: `weeksRemaining` holds the same value for a week, so the
 * lease (keyed by that value) posts on the first day of the window and is
 * quiet for the rest of it.
 *
 * @param {FirebaseFirestore.Firestore} db
 * @param {Object} params
 * @param {string} params.seasonUid
 * @param {string} params.seasonName
 * @param {Object} params.seasonData - game-settings/season doc.
 * @param {string} params.webhookUrl
 * @param {typeof fetch} [params.fetchImpl]
 * @param {Date} [params.now]
 * @returns {Promise<{kind: string, status: string, [k: string]: unknown}>}
 */
async function announceRegistrationDeadline(
  db,
  { seasonUid, seasonName, seasonData, webhookUrl, fetchImpl, now = new Date() }
) {
  const kind = "registration-deadline";
  if (!webhookUrl) return { kind, status: "disabled" };

  const { weeksRemaining, classes } = classesClosingThisWeek(seasonData, now);
  const payload = buildRegistrationDeadlinePayload({ seasonName, weeksRemaining, classes });
  if (!payload) return { kind, status: "nothing-closing", weeksRemaining };

  return postOnce(db, {
    kind,
    tag: TAG,
    leaseKey: `${seasonUid}_discord_reglock`,
    // One lease per closing week: World (6), Open (5) and A (4) each get their
    // own post, and a daily re-run inside a week finds it already taken.
    leaseDay: weeksRemaining,
    payload,
    webhookUrl,
    fetchImpl,
  });
}

module.exports = {
  TAG,
  CLASS_LABELS,
  classesClosingThisWeek,
  listLabels,
  buildRegistrationDeadlinePayload,
  announceRegistrationDeadline,
};
