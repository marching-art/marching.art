/**
 * Score-drop announcements — the nightly "results are in" moment.
 *
 * Two consumers share the same recap aggregation:
 *   1. The Discord stage (dailyProcessors -> nightlyStages.runDiscordStage):
 *      one rich-embed webhook post to the community server's scores channel
 *      right after the 2 AM scoring commit, with tonight's top corps per
 *      ranked class, tonight's SoundSport blue ribbons, and — when one fell —
 *      an all-time record. Championship week adds the cut tonight's results
 *      decided (helpers/championshipCuts.js); finals night adds the season
 *      champions.
 *   2. The morning push job (pushNotifications.scoreDropPushJob): one FCM
 *      push per director who performed last night, at a humane hour.
 *
 * Both read the per-day recap doc (fantasy_recaps/{seasonUid}/days/{day})
 * that commitDailyScoring writes — no extra scoring-time state is needed.
 *
 * SoundSport is ratings-only: its SCORES are never revealed anywhere in the
 * product (see newsSeasonSummary.js). Best in Show is an AWARD, not a rating,
 * so the blue ribbon is announced by name — never with the number behind it.
 *
 * The Discord post is guarded by a scoringRunGuard lease under the
 * `{seasonUid}_discord` key so a scheduler retry of a completed scoring run
 * can never double-post.
 */

const { logger } = require("firebase-functions/v2");
const {
  discordScoresWebhookUrl,
  COLORS,
  MEDALS,
  clampName,
  joinLines,
  place,
  link,
  payloadOf,
  postToDiscordWebhook,
  postOnce,
} = require("./discord");
const { claimScoringRun, markScoringRunCompleted, markScoringRunFailed } = require("./scoringRunGuard");
const { RANKED_CLASSES } = require("./classRegistry");

const CLASS_LABELS = {
  worldClass: "World Class",
  openClass: "Open Class",
  aClass: "A Class",
  soundSport: "SoundSport",
  podiumClass: "Podium",
};

// Attribution params on the announcement deep links. Without these, a director
// arriving from the morning push and one who happened to open the app look
// identical in analytics, so there is no way to tell whether either
// announcement channel actually pulls anyone back — the question the channels
// were built to answer. The client reads `src` on arrival (useScoreDropReturn)
// and reports it with the score_drop_return event. Discord links are tagged by
// helpers/discord.js `link()`; the push tag lives here.
const SRC_PARAM = "src";
const SRC_PUSH = "push";

const SCORES_PATH = "/scores";
const SCORES_URL = link(SCORES_PATH);

// World Championship Finals — the last scored day of a season, and the night
// the champions post goes out.
const FINALS_DAY = 49;

// Record categories as the records book stores them (helpers/gameRecords.js),
// with the copy a "record just fell" announcement uses.
const RECORD_LABELS = {
  highestScore: "Highest score",
  highestGE: "Highest GE",
  highestVisual: "Highest Visual",
  highestMusic: "Highest Music",
  highestSeasonTotal: "Highest season total",
};

/** 1 -> "1st", 2 -> "2nd", 11 -> "11th", 23 -> "23rd". */
function ordinal(n) {
  const rem100 = n % 100;
  if (rem100 >= 11 && rem100 <= 13) return `${n}th`;
  const suffix = { 1: "st", 2: "nd", 3: "rd" }[n % 10] || "th";
  return `${n}${suffix}`;
}

/**
 * Aggregate a day recap into per-class nightly standings.
 *
 * Scores are summed per (uid, corpsClass) across tonight's shows — the same
 * accumulation scoring.js uses for dailyScores — then ranked per class.
 * SoundSport entries are counted but never ranked or exposed with scores.
 *
 * Blue ribbons ride along: each show's top SoundSport corps is that show's
 * Best in Show (the same rule scoringAwards.js awards the trophy by), so the
 * winners can be named without ever exposing a SoundSport score.
 *
 * @param {Object} dailyRecap - fantasy_recaps day doc ({shows: [{eventName, results: []}]})
 * @returns {{
 *   byClass: Map<string, Array<{uid: string, corpsName: string, displayName: string,
 *     score: number, rank: number, of: number}>>,
 *   soundSport: Array<{uid: string, corpsName: string}>,
 *   bestInShow: Array<{uid: string, corpsName: string, displayName: string, eventName: string}>,
 *   showCount: number,
 * }}
 */
function aggregateNightlyStandings(dailyRecap) {
  const shows = (dailyRecap && dailyRecap.shows) || [];
  const totals = new Map(); // `${uid}_${class}` -> entry
  const soundSportByUid = new Map();
  const bestInShow = [];

  for (const show of shows) {
    // Blue ribbon: this show's top SoundSport corps. Scored per show, exactly
    // like the trophy — a corps can win the ribbon at one show on a night
    // another corps wins it elsewhere.
    const showSoundSport = (show.results || [])
      .filter((r) => r && r.uid && r.corpsClass === "soundSport")
      .sort((a, b) => (Number(b.totalScore) || 0) - (Number(a.totalScore) || 0));
    if (showSoundSport.length > 0) {
      const winner = showSoundSport[0];
      bestInShow.push({
        uid: winner.uid,
        corpsName: winner.corpsName || "",
        displayName: winner.displayName || "",
        eventName: show.eventName || "",
      });
    }

    for (const result of show.results || []) {
      if (!result || !result.uid || !result.corpsClass) continue;
      if (result.corpsClass === "soundSport") {
        soundSportByUid.set(result.uid, { uid: result.uid, corpsName: result.corpsName || "" });
        continue;
      }
      if (!RANKED_CLASSES.includes(result.corpsClass)) continue;
      const key = `${result.uid}_${result.corpsClass}`;
      const entry = totals.get(key) || {
        uid: result.uid,
        corpsClass: result.corpsClass,
        corpsName: result.corpsName || "",
        displayName: result.displayName || "",
        score: 0,
      };
      entry.score += Number(result.totalScore) || 0;
      totals.set(key, entry);
    }
  }

  const byClass = new Map();
  for (const corpsClass of RANKED_CLASSES) {
    const entries = [...totals.values()].filter((e) => e.corpsClass === corpsClass);
    if (entries.length === 0) continue;
    entries.sort((a, b) => b.score - a.score);
    entries.forEach((entry, index) => {
      entry.rank = index + 1;
      entry.of = entries.length;
    });
    byClass.set(corpsClass, entries);
  }

  return {
    byClass,
    soundSport: [...soundSportByUid.values()],
    bestInShow,
    showCount: shows.length,
  };
}

/**
 * Build the Discord webhook payload for tonight's score drop, or null when
 * the recap has nothing announceable (dark day / empty recap).
 *
 * @param {Object} params
 * @param {Object} params.dailyRecap
 * @param {string} params.seasonName
 * @param {number} params.scoredDay
 * @returns {Object|null}
 */
function buildScoreDropEmbed({ dailyRecap, seasonName, scoredDay }) {
  const { byClass, soundSport, bestInShow, showCount } = aggregateNightlyStandings(dailyRecap);
  if (byClass.size === 0 && soundSport.length === 0) return null;

  const fields = [];
  for (const [corpsClass, entries] of byClass) {
    const lines = entries.slice(0, 3).map((entry, index) => {
      const director = entry.displayName ? ` · ${clampName(entry.displayName, 30)}` : "";
      return `${MEDALS[index]} **${clampName(entry.corpsName)}** — ${entry.score.toFixed(3)}${director}`;
    });
    const fieldName = `${CLASS_LABELS[corpsClass] || corpsClass} (${entries.length} corps)`;
    fields.push({ name: fieldName, value: lines.join("\n") });
  }

  // Blue ribbons — named, never scored. SoundSport's whole point is that it
  // isn't a competition, but Best in Show is still an honor worth reading out.
  if (bestInShow.length > 0) {
    fields.push({
      name: `🎀 SoundSport Best in Show (${bestInShow.length})`,
      value: joinLines(
        bestInShow.map((winner) => {
          const where = winner.eventName ? ` — ${clampName(winner.eventName, 40)}` : "";
          return `**${clampName(winner.corpsName)}**${where}`;
        })
      ),
    });
  }

  const showWord = showCount === 1 ? "show" : "shows";
  const embed = {
    title: `🎺 Day ${scoredDay} Scores Are In`,
    url: SCORES_URL,
    description: `${seasonName} — ${showCount} ${showWord} scored tonight. Full recaps and standings on marching.art.`,
    color: COLORS.scores,
    fields,
  };
  if (soundSport.length > 0) {
    const perfWord = soundSport.length === 1 ? "performance" : "performances";
    embed.footer = { text: `Plus ${soundSport.length} SoundSport ${perfWord} 🎉` };
  }

  return payloadOf(embed);
}

/**
 * The all-time marks set on `scoredDay`, read straight off the records book.
 *
 * gameRecords stamps every record it accepts with `{seasonName, day}`, so
 * "what fell tonight" needs no extra state — just the records doc and the
 * night's identity. Podium-class records are stamped with the seasonUid
 * rather than the display name, so both are accepted.
 *
 * @param {Object} records - game-records/records doc data.
 * @param {Object} params
 * @param {string} params.seasonName
 * @param {string} params.seasonUid
 * @param {number} params.scoredDay
 * @returns {Array<{corpsClass: string, category: string, value: number,
 *   corpsName: string, displayName: string}>}
 */
function recordsSetOn(records, { seasonName, seasonUid, scoredDay }) {
  const classes = (records && records.classes) || {};
  const fell = [];
  for (const [corpsClass, categories] of Object.entries(classes)) {
    for (const [category, record] of Object.entries(categories || {})) {
      if (!record || record.day !== scoredDay) continue;
      if (record.seasonName !== seasonName && record.seasonName !== seasonUid) continue;
      fell.push({
        corpsClass,
        category,
        value: Number(record.value) || 0,
        corpsName: record.corpsName || "",
        displayName: record.displayName || "",
      });
    }
  }
  return fell;
}

/**
 * "An all-time record just fell" — the second embed on the nightly drop.
 *
 * Rides the same message as the scores rather than a separate post: same
 * channel, same moment, one notification.
 *
 * @param {Array} fell - From recordsSetOn().
 * @returns {Object|null} Embed, or null on an ordinary night.
 */
function buildRecordsEmbed(fell) {
  if (!fell || fell.length === 0) return null;
  const lines = fell.map((record) => {
    const classLabel = CLASS_LABELS[record.corpsClass] || record.corpsClass;
    const label = RECORD_LABELS[record.category] || record.category;
    const director = record.displayName ? ` · ${clampName(record.displayName, 30)}` : "";
    return `📌 **${clampName(record.corpsName)}** — ${label}, ${classLabel}: ${record.value.toFixed(3)}${director}`;
  });
  const word = fell.length === 1 ? "record" : "records";
  return {
    title: `🔥 All-time ${word} broken`,
    url: link("/records"),
    description:
      fell.length === 1
        ? "A mark that stood since the game started just went down."
        : `${fell.length} all-time marks went down tonight.`,
    color: COLORS.record,
    fields: [{ name: "The Records Book", value: joinLines(lines) }],
  };
}

/**
 * Season champions — finals night, the biggest post of the year.
 *
 * @param {Object} params
 * @param {Object} params.champions - season_champions/{seasonUid} doc data.
 * @param {string} params.seasonName
 * @returns {Object|null} Webhook payload, or null when no class was crowned.
 */
function buildChampionsPayload({ champions, seasonName }) {
  const classes = (champions && champions.classes) || {};
  const fields = [];
  for (const corpsClass of RANKED_CLASSES) {
    const podium = classes[corpsClass];
    if (!Array.isArray(podium) || podium.length === 0) continue;
    fields.push({
      name: CLASS_LABELS[corpsClass] || corpsClass,
      value: joinLines(
        podium.slice(0, 3).map((entry, index) => {
          const director = entry.username ? ` · ${clampName(entry.username, 30)}` : "";
          const score = typeof entry.score === "number" ? ` — ${entry.score.toFixed(3)}` : "";
          return `${place(index)} **${clampName(entry.corpsName)}**${score}${director}`;
        })
      ),
    });
  }
  if (fields.length === 0) return null;

  const champion = (classes.worldClass || [])[0];
  return payloadOf({
    title: `👑 ${seasonName} Champions`,
    url: link("/hall-of-champions"),
    description: champion
      ? `Finals are over. **${clampName(champion.corpsName)}** takes the World Class title, ` +
        `and the season goes into the books.`
      : "Finals are over and the season goes into the books.",
    color: COLORS.champion,
    fields,
  });
}

/**
 * Build one score-drop push per director who performed last night.
 *
 * A director with corps in several classes gets a single push for their
 * highest class (registry tier order); SoundSport-only directors get a
 * score-free message (ratings are never revealed).
 *
 * @param {Object} params
 * @param {Object} params.dailyRecap
 * @param {number} params.scoredDay
 * @returns {Array<{uid: string, title: string, body: string, url: string, data: Object}>}
 */
function buildScoreDropPushes({ dailyRecap, scoredDay }) {
  const { byClass, soundSport } = aggregateNightlyStandings(dailyRecap);
  const title = `Day ${scoredDay} scores are in 🎺`;
  const pushes = new Map(); // uid -> push (first hit wins: RANKED_CLASSES is tier order)

  for (const corpsClass of RANKED_CLASSES) {
    for (const entry of byClass.get(corpsClass) || []) {
      if (pushes.has(entry.uid)) continue;
      const label = CLASS_LABELS[corpsClass] || corpsClass;
      pushes.set(entry.uid, {
        uid: entry.uid,
        title,
        body:
          `${clampName(entry.corpsName)} scored ${entry.score.toFixed(3)} tonight — ` +
          `${ordinal(entry.rank)} of ${entry.of} in ${label}. Tap for the full recap.`,
        url: `${SCORES_PATH}?${SRC_PARAM}=${SRC_PUSH}`,
        data: { scoredDay: String(scoredDay), corpsClass },
      });
    }
  }

  for (const entry of soundSport) {
    if (pushes.has(entry.uid)) continue;
    pushes.set(entry.uid, {
      uid: entry.uid,
      title,
      body: `${clampName(entry.corpsName)}'s SoundSport performance is in the books. Tap for tonight's recap.`,
      url: `${SCORES_PATH}?${SRC_PARAM}=${SRC_PUSH}`,
      data: { scoredDay: String(scoredDay), corpsClass: "soundSport" },
    });
  }

  return [...pushes.values()];
}

/**
 * Post tonight's score drop to Discord exactly once per (season, day).
 *
 * Reads the day recap, builds the embed, claims the `{seasonUid}_discord`
 * lease, and posts. A retry of an already-posted day is skipped by the
 * lease; a failed post marks the lease failed so the next scheduler retry
 * of the scoring function can re-claim and re-post.
 *
 * @param {FirebaseFirestore.Firestore} db
 * @param {Object} params
 * @param {string} params.seasonUid
 * @param {string} params.seasonName
 * @param {number} params.scoredDay
 * @param {string} params.webhookUrl
 * @param {typeof fetch} [params.fetchImpl]
 * @returns {Promise<{status: string, [key: string]: unknown}>}
 */
async function runDiscordScoreDrop(db, { seasonUid, seasonName, scoredDay, webhookUrl, fetchImpl }) {
  if (!webhookUrl) return { status: "disabled" };

  const recapSnap = await db.doc(`fantasy_recaps/${seasonUid}/days/${scoredDay}`).get();
  if (!recapSnap.exists) return { status: "no-recap", scoredDay };

  const payload = buildScoreDropEmbed({ dailyRecap: recapSnap.data(), seasonName, scoredDay });
  if (!payload) return { status: "empty-recap", scoredDay };

  // Records that fell tonight ride the same message — same channel, same
  // moment, one notification. Never fails the drop: an unreadable records
  // doc just means the night posts without the extra embed.
  let recordsBroken = 0;
  try {
    const recordsSnap = await db.doc("game-records/records").get();
    const embed = buildRecordsEmbed(
      recordsSetOn(recordsSnap.exists ? recordsSnap.data() : null, {
        seasonName,
        seasonUid,
        scoredDay,
      })
    );
    if (embed) {
      payload.embeds.push(embed);
      recordsBroken = embed.fields[0].value.split("\n").length;
    }
  } catch (error) {
    logger.warn(`[discord-stage] records check skipped: ${error.message}`);
  }

  // Championship week: the cut tonight's results just decided — who marches
  // tomorrow (helpers/championshipCuts.js). Rides the same message for the
  // same reason the records embed does: it IS tonight's headline, and it is
  // news at the moment the scores land, not the next morning. Isolated the
  // same way — a failure here just means the drop posts without it.
  let cutAnnounced = null;
  try {
    const { cutForDrop, buildCutsEmbed } = require("./championshipCuts");
    const cut = cutForDrop(recapSnap.data(), scoredDay);
    const embed = buildCutsEmbed(cut, { seasonName });
    if (embed) {
      payload.embeds.push(embed);
      cutAnnounced = { event: cut.eventName, advancing: cut.advancing.length, missed: cut.missed };
    }
  } catch (error) {
    logger.warn(`[discord-stage] championship cut skipped: ${error.message}`);
  }

  const leaseKey = `${seasonUid}_discord`;
  // kind "announce": a failed Discord post is a warning at the watchdog, not
  // a critical scoring incident.
  const lease = await claimScoringRun(db, leaseKey, scoredDay, { kind: "announce" });
  if (!lease.claimed) return { status: "skipped", reason: lease.reason, scoredDay };

  const result = { status: "posted", scoredDay, recordsBroken };
  if (cutAnnounced) result.cut = cutAnnounced;
  try {
    await postToDiscordWebhook(webhookUrl, payload, fetchImpl);
    await markScoringRunCompleted(db, leaseKey, scoredDay, { posted: true });
  } catch (error) {
    await markScoringRunFailed(db, leaseKey, scoredDay, error);
    throw error;
  }

  // Finals night: the champions post follows the last score drop of the year,
  // under its own lease so a champions failure can't un-post the drop.
  if (scoredDay === FINALS_DAY) {
    try {
      result.champions = await runChampionsPost(db, {
        seasonUid,
        seasonName,
        webhookUrl,
        fetchImpl,
      });
    } catch (error) {
      logger.error(`[discord-stage] champions post failed: ${error.message}`);
    }
  }
  return result;
}

/**
 * Post the season champions to the scores channel, once per season.
 *
 * Separate message and separate lease from the nightly drop: the drop is a
 * daily habit, the champions post is the year's headline.
 *
 * @param {FirebaseFirestore.Firestore} db
 * @param {Object} params
 * @param {string} params.seasonUid
 * @param {string} params.seasonName
 * @param {string} params.webhookUrl
 * @param {typeof fetch} [params.fetchImpl]
 * @returns {Promise<{kind: string, status: string, [k: string]: unknown}>}
 */
async function runChampionsPost(db, { seasonUid, seasonName, webhookUrl, fetchImpl }) {
  const snapshot = await db.doc(`season_champions/${seasonUid}`).get();
  if (!snapshot.exists) return { kind: "champions", status: "no-champions" };

  const payload = buildChampionsPayload({ champions: snapshot.data(), seasonName });
  if (!payload) return { kind: "champions", status: "no-champions" };

  return postOnce(db, {
    kind: "champions",
    tag: "discord-stage",
    leaseKey: `${seasonUid}_discord_champions`,
    leaseDay: FINALS_DAY,
    payload,
    webhookUrl,
    fetchImpl,
  });
}

module.exports = {
  discordScoresWebhookUrl,
  CLASS_LABELS,
  RECORD_LABELS,
  FINALS_DAY,
  ordinal,
  aggregateNightlyStandings,
  buildScoreDropEmbed,
  buildScoreDropPushes,
  recordsSetOn,
  buildRecordsEmbed,
  buildChampionsPayload,
  postToDiscordWebhook,
  runDiscordScoreDrop,
  runChampionsPost,
};
