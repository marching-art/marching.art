/**
 * Championship Week caption-change guide → #announcements.
 *
 * The last week of the season is the one week the caption-change rules stop
 * being "3 a week, everyone, all season" (helpers/captionWindows.js):
 *
 *   Days 43-44   no changes at all, for any class.
 *   Days 45-49   2 changes per class PER DAY — but only for the classes that
 *                still compete that day. A class that isn't on the day's list
 *                is locked out entirely, including a corps that advanced.
 *
 * Every other lock in the season is announced the evening it lands
 * (helpers/seasonAnnounce.js buildLineupLockPayload), which is the right shape
 * for a deadline but the wrong shape for a rule change: by the time the day-45
 * post goes out, two days of "why can't I edit my lineup?" have already
 * happened, and an Open Class director reading "changes close tonight" on day
 * 48 has no way to know the post isn't about them.
 *
 * So this is the one announcement that runs AHEAD of the thing it describes:
 * posted on day 43 — the Sunday championship week opens on — laying out all
 * seven remaining days, both by day and by class, before the first closed day
 * is met as a surprise.
 *
 * Everything in the post is derived from the captionWindows constants that
 * `saveLineup` actually enforces, so the schedule cannot drift from the rules.
 */

const { COLORS, joinLines, link, payloadOf, postOnce } = require("./discord");
const {
  getCaptionChangeWindow,
  BLACKOUT_DAYS,
  CHAMPIONSHIP_CLASS_DAYS,
  CHAMPIONSHIP_TRADE_LIMIT,
  CHAMPIONSHIP_START_DAY,
  SEASON_FINAL_DAY,
} = require("./captionWindows");
const { CLASS_LABELS } = require("./scoreDrop");
const { formatEtTime } = require("./lineupReminders");

/** Log tag on every announcement this module posts. */
const TAG = "championship-week";

/**
 * The day the guide posts: the first blackout day, which is the Sunday that
 * opens championship week (day boundaries land Saturday 8 PM ET, so day 43
 * runs Saturday night through Sunday night). Posting here means the first
 * closed day is announced before it is experienced.
 */
const ANNOUNCE_DAY = BLACKOUT_DAYS[0];

/** Order classes appear in, highest tier first. */
const CLASS_ORDER = ["worldClass", "openClass", "aClass", "soundSport"];

const DASHBOARD_URL = link("/dashboard");

const DAY_LABEL_FORMAT = new Intl.DateTimeFormat("en-US", {
  weekday: "short",
  month: "short",
  day: "numeric",
  timeZone: "UTC",
});

/** Fallback when the season doc has no usable start date to derive from. */
const FALLBACK_CLOSE_LABEL = "8:00 PM ET";

/**
 * The season's start instant, or null when it can't be read. Stored as a
 * Firestore Timestamp in production and a Date/number in tests and fixtures.
 * @param {Object|null|undefined} seasonData
 * @returns {?Date}
 */
function seasonStart(seasonData) {
  const raw = seasonData?.schedule?.startDate;
  if (!raw) return null;
  const asTimestamp = /** @type {{toDate?: () => Date}} */ (raw);
  const start =
    typeof asTimestamp.toDate === "function"
      ? asTimestamp.toDate()
      : new Date(/** @type {string|number|Date} */ (raw));
  return Number.isNaN(start.getTime()) ? null : start;
}

/**
 * Calendar-date labeller for competition days ("Sun, Aug 9"), or null when the
 * season has no start date and the post falls back to day numbers alone.
 *
 * startDate is written at midnight UTC, so a competition day's calendar date is
 * pure UTC arithmetic on it — formatting in ET would name the evening BEFORE
 * (midnight UTC is 8 PM the previous day in EDT) and label finals night Friday.
 *
 * @param {Object|null|undefined} seasonData
 * @returns {?(day: number) => string}
 */
function dayLabeller(seasonData) {
  const start = seasonStart(seasonData);
  if (!start) return null;
  const springTrainingDays = seasonData?.schedule?.springTrainingDays || 0;
  return (day) =>
    DAY_LABEL_FORMAT.format(
      new Date(
        Date.UTC(
          start.getUTCFullYear(),
          start.getUTCMonth(),
          start.getUTCDate() + springTrainingDays + day - 1
        )
      )
    );
}

/**
 * "8:00 PM ET" — the wall-clock time each championship day closes, derived
 * from the season's own day boundary rather than assumed, so a season whose
 * startDate isn't midnight UTC is described accurately.
 *
 * @param {Object|null|undefined} seasonData
 * @returns {string}
 */
function closeTimeLabel(seasonData) {
  const start = seasonStart(seasonData);
  if (!start) return FALLBACK_CLOSE_LABEL;
  const springTrainingDays = seasonData?.schedule?.springTrainingDays || 0;
  // The end of day 45 is the start of day 46 — every day boundary in the
  // season shares this wall-clock time.
  const boundary = new Date(
    start.getTime() + (springTrainingDays + CHAMPIONSHIP_START_DAY) * 24 * 60 * 60 * 1000
  );
  return formatEtTime(boundary);
}

/**
 * Every remaining day of the season, in order, with the classes allowed to
 * change captions on it. Read straight off CHAMPIONSHIP_CLASS_DAYS, so a
 * change to the bracket changes the post.
 *
 * @param {Object|null|undefined} seasonData
 * @returns {Array<{day: number, dateLabel: ?string, classes: string[]}>}
 */
function championshipWeekSchedule(seasonData) {
  const labelFor = dayLabeller(seasonData);
  const rows = [];
  for (let day = ANNOUNCE_DAY; day <= SEASON_FINAL_DAY; day++) {
    const classes = day >= CHAMPIONSHIP_START_DAY ? CHAMPIONSHIP_CLASS_DAYS[day] || [] : [];
    rows.push({
      day,
      dateLabel: labelFor ? labelFor(day) : null,
      // Keep the display order stable regardless of how the bracket lists them.
      classes: CLASS_ORDER.filter((c) => classes.includes(c)),
    });
  }
  return rows;
}

/**
 * The same schedule inverted: the days each class may change captions on.
 * This is the view a director actually holds in their head — "when can *I*
 * make a change?" — and reading it off the day-by-day list is exactly the
 * mistake the post exists to prevent.
 *
 * @returns {Array<{corpsClass: string, days: number[]}>}
 */
function daysByClass() {
  const byClass = new Map();
  for (let day = CHAMPIONSHIP_START_DAY; day <= SEASON_FINAL_DAY; day++) {
    for (const corpsClass of CHAMPIONSHIP_CLASS_DAYS[day] || []) {
      if (!byClass.has(corpsClass)) byClass.set(corpsClass, []);
      byClass.get(corpsClass).push(day);
    }
  }
  return CLASS_ORDER.filter((c) => byClass.has(c)).map((corpsClass) => ({
    corpsClass,
    days: byClass.get(corpsClass),
  }));
}

/** "`Day 45 · Tue, Aug 11` — ✅ Open Class, A Class · 2 changes each" */
function scheduleLines(rows) {
  return rows.map(({ day, dateLabel, classes }) => {
    const head = `\`Day ${day}${dateLabel ? ` · ${dateLabel}` : ""}\``;
    if (classes.length === 0) return `${head} — 🔒 **Closed to every class**`;
    const names = classes.map((c) => CLASS_LABELS[c] || c).join(", ");
    return `${head} — ✅ ${names} · ${CHAMPIONSHIP_TRADE_LIMIT} changes each`;
  });
}

/** "**World Class** — Days 47, 48, 49 (6 changes total)" */
function classLines(entries) {
  return entries.map(({ corpsClass, days }) => {
    const total = days.length * CHAMPIONSHIP_TRADE_LIMIT;
    return (
      `**${CLASS_LABELS[corpsClass] || corpsClass}** — Days ${days.join(", ")} ` +
      `(${total} changes total)`
    );
  });
}

/**
 * The championship-week guide embed.
 *
 * @param {Object} params
 * @param {string} params.seasonName
 * @param {Object} [params.seasonData] - game-settings/season doc, for dates.
 * @returns {Object} Webhook payload.
 */
function buildChampionshipWeekPayload({ seasonName, seasonData = null }) {
  const rows = championshipWeekSchedule(seasonData);
  const closedDays = rows.filter((row) => row.classes.length === 0).map((row) => row.day);
  const closeLabel = closeTimeLabel(seasonData);
  const byClass = daysByClass();
  // Claimed only when it is actually true: if the bracket ever stops giving
  // every class the same number of change days, the footer drops rather than
  // asserting a fairness the schedule above visibly contradicts.
  const dayCounts = new Set(byClass.map((c) => c.days.length));
  const perClassDays = dayCounts.size === 1 ? byClass[0].days.length : null;

  return payloadOf({
    title: "🗓️ Championship Week — when you can change captions",
    url: DASHBOARD_URL,
    description:
      `${seasonName} — the last week of the season starts today, and the weekly caption-change ` +
      `rules are over. Changes are **closed to every class** for ${closedDays.length} days ` +
      `(Days ${closedDays.join(" and ")}) starting now, then it's ` +
      `**${CHAMPIONSHIP_TRADE_LIMIT} changes per day** for each class still competing that day. ` +
      "Every remaining day is below, so nobody has to guess.",
    color: COLORS.season,
    fields: [
      {
        name: "Day by day",
        value: joinLines(scheduleLines(rows)),
      },
      {
        name: "By class — the days you can change",
        value: joinLines(classLines(byClass)),
      },
      {
        name: "How each championship day works",
        value: joinLines([
          `• ${CHAMPIONSHIP_TRADE_LIMIT} changes per corps, per day — a fresh allotment every ` +
            "competition day.",
          `• Changes close at ${closeLabel}, then reopen once that night's scores post ` +
            "(around 2:00 AM ET).",
          "• Unused changes never carry over to the next day.",
          "• On a day your class isn't competing, changes are closed — even if your corps " +
            "advanced and is still marching later in the week.",
        ]),
      },
    ],
    // The symmetry is the answer to "why does World Class get the last two
    // days?" — asked every year, and the reason the schedule is fair.
    ...(perClassDays
      ? {
          footer: {
            text:
              `Every class gets the same ${perClassDays} change days and the same ` +
              `${perClassDays * CHAMPIONSHIP_TRADE_LIMIT} total changes.`,
          },
        }
      : {}),
  });
}

/**
 * Post the championship-week guide, once, on day 43.
 *
 * Safe to call daily: on every other day of the season the day check returns
 * before any Firestore write, and the day-43 lease makes a same-day retry a
 * no-op.
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
async function announceChampionshipWeek(
  db,
  { seasonUid, seasonName, seasonData, webhookUrl, fetchImpl, now = new Date() }
) {
  const kind = "championship-week-windows";
  if (!webhookUrl) return { kind, status: "disabled" };

  const window = getCaptionChangeWindow(seasonData, now);
  if (!window) return { kind, status: "no-season" };
  if (window.day !== ANNOUNCE_DAY) return { kind, status: "not-today", day: window.day };

  return postOnce(db, {
    kind,
    tag: TAG,
    leaseKey: `${seasonUid}_discord_champweek`,
    leaseDay: ANNOUNCE_DAY,
    payload: buildChampionshipWeekPayload({ seasonName, seasonData }),
    webhookUrl,
    fetchImpl,
  });
}

module.exports = {
  TAG,
  ANNOUNCE_DAY,
  CLASS_ORDER,
  championshipWeekSchedule,
  daysByClass,
  buildChampionshipWeekPayload,
  announceChampionshipWeek,
};
