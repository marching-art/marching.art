/**
 * Season-clock announcements → #announcements.
 *
 * Two moments where the game asks something of every director at once, and
 * where the cost of missing it is real:
 *
 *   SEASON START — a new season is live. The audience that most needs this
 *     is the one that isn't opening the app: lapsed directors who are still
 *     sitting in the Discord server. This is the re-activation post.
 *   LINEUP LOCK — caption changes close tonight (helpers/captionWindows.js).
 *     The FCM push (pushNotifications.lineupLockReminderPushJob) already
 *     reaches directors who still have changes to spend; the channel post
 *     reaches everyone else, including the people who never enabled push.
 *
 * Both are lease-guarded like every other announcement, so the jobs that
 * emit them can run daily without repeating themselves.
 */

const { COLORS, clampName, link, payloadOf } = require("./discord");

const PHASE_COPY = {
  unlimited: {
    title: "🔓 Free caption changes end tonight",
    body:
      "Tonight is the last night of unlimited caption changes. From tomorrow you get a " +
      "fixed number per week — so make the swaps you've been putting off.",
  },
  weekly: {
    title: "🔒 This week's caption changes lock tonight",
    body: "Unused changes don't roll over. If you're sitting on a swap, tonight is the night.",
  },
  championship: {
    title: "🔒 Championship-week lineup lock",
    body: "Today's caption changes close tonight for the classes still competing.",
  },
};

/**
 * "A new season is live."
 *
 * @param {Object} params
 * @param {string} params.seasonName
 * @param {"off-season"|"live-season"} params.seasonType
 * @param {Date} [params.endDate]
 * @returns {Object} Webhook payload.
 */
function buildSeasonStartPayload({ seasonName, seasonType, endDate }) {
  const live = seasonType === "live-season";
  const ends = endDate instanceof Date && !isNaN(endDate.getTime())
    ? new Intl.DateTimeFormat("en-US", {
        month: "long",
        day: "numeric",
        timeZone: "America/New_York",
      }).format(endDate)
    : null;

  return payloadOf({
    title: `🎬 ${clampName(seasonName, 100)} starts now`,
    url: link("/dashboard"),
    description: live
      ? "The live season is open. Build your lineup from this year's real DCI corps, pick your " +
        "shows, and score against the actual scores as they come in."
      : "A new off-season is open. Draft your lineup from decades of DCI history, pick your " +
        "shows, and see how your corps stacks up night after night.",
    color: COLORS.season,
    fields: [
      { name: "Season", value: live ? "Live season" : "Off-season", inline: true },
      ...(ends ? [{ name: "Runs through", value: ends, inline: true }] : []),
    ],
    footer: { text: "New directors welcome — the first lineup takes about five minutes." },
  });
}

/**
 * "Caption changes lock tonight."
 *
 * @param {Object} params
 * @param {Object} params.context - From lineupReminders.getLineupLockContext.
 * @param {string} params.seasonName
 * @returns {Object} Webhook payload.
 */
function buildLineupLockPayload({ context, seasonName }) {
  const copy = PHASE_COPY[context.phase] || PHASE_COPY.weekly;
  return payloadOf({
    title: copy.title,
    url: link("/dashboard"),
    description: `${seasonName} — ${copy.body}`,
    color: COLORS.season,
    fields: [
      { name: "Locks at", value: context.lockTimeLabel, inline: true },
      ...(context.competingClasses && context.competingClasses.length > 0
        ? [{ name: "Competing tonight", value: context.competingClasses.join(", "), inline: true }]
        : []),
    ],
  });
}

module.exports = { PHASE_COPY, buildSeasonStartPayload, buildLineupLockPayload };
