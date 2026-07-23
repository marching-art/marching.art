/**
 * Score-drop announcements — the nightly "results are in" moment.
 *
 * Two consumers share the same recap aggregation:
 *   1. The Discord stage (dailyProcessors -> nightlyStages.runDiscordStage):
 *      one rich-embed webhook post to the community server right after the
 *      2 AM scoring commit, with tonight's top corps per ranked class.
 *   2. The morning push job (pushNotifications.scoreDropPushJob): one FCM
 *      push per director who performed last night, at a humane hour.
 *
 * Both read the per-day recap doc (fantasy_recaps/{seasonUid}/days/{day})
 * that commitDailyScoring writes — no extra scoring-time state is needed.
 *
 * SoundSport is ratings-only: its scores are never revealed anywhere in the
 * product (see newsSeasonSummary.js), so announcements mention SoundSport
 * participation without scores or placements.
 *
 * The Discord post is guarded by a scoringRunGuard lease under the
 * `{seasonUid}_discord` key so a scheduler retry of a completed scoring run
 * can never double-post.
 */

const { defineSecret } = require("firebase-functions/params");
const { claimScoringRun, markScoringRunCompleted, markScoringRunFailed } = require("./scoringRunGuard");
const { RANKED_CLASSES } = require("./classRegistry");

// Webhook URL for the community server's scores channel. Not stored in
// game-settings (world-readable) — anyone holding the URL can post to the
// channel. Empty/unset disables the stage without erroring.
const discordScoresWebhookUrl = defineSecret("DISCORD_SCORES_WEBHOOK_URL");

const CLASS_LABELS = {
  worldClass: "World Class",
  openClass: "Open Class",
  aClass: "A Class",
  soundSport: "SoundSport",
  podiumClass: "Podium",
};

const SCORES_URL = "https://marching.art/scores";
const MEDALS = ["🥇", "🥈", "🥉"];

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
 * @param {Object} dailyRecap - fantasy_recaps day doc ({shows: [{eventName, results: []}]})
 * @returns {{
 *   byClass: Map<string, Array<{uid: string, corpsName: string, displayName: string,
 *     score: number, rank: number, of: number}>>,
 *   soundSport: Array<{uid: string, corpsName: string}>,
 *   showCount: number,
 * }}
 */
function aggregateNightlyStandings(dailyRecap) {
  const shows = (dailyRecap && dailyRecap.shows) || [];
  const totals = new Map(); // `${uid}_${class}` -> entry
  const soundSportByUid = new Map();

  for (const show of shows) {
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

  return { byClass, soundSport: [...soundSportByUid.values()], showCount: shows.length };
}

/** Keep user-authored names from blowing up embed/push copy. */
function clampName(name, max = 60) {
  const text = String(name || "").trim();
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
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
  const { byClass, soundSport, showCount } = aggregateNightlyStandings(dailyRecap);
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

  const showWord = showCount === 1 ? "show" : "shows";
  const embed = {
    title: `🎺 Day ${scoredDay} Scores Are In`,
    url: SCORES_URL,
    description: `${seasonName} — ${showCount} ${showWord} scored tonight. Full recaps and standings on marching.art.`,
    color: 0xd4af37,
    fields,
  };
  if (soundSport.length > 0) {
    const perfWord = soundSport.length === 1 ? "performance" : "performances";
    embed.footer = { text: `Plus ${soundSport.length} SoundSport ${perfWord} 🎉` };
  }

  return { username: "marching.art", embeds: [embed] };
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
        url: "/scores",
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
      url: "/scores",
      data: { scoredDay: String(scoredDay), corpsClass: "soundSport" },
    });
  }

  return [...pushes.values()];
}

/**
 * POST a payload to a Discord webhook. Throws on any non-2xx response so the
 * caller can mark the lease failed (Discord returns 204 on success).
 *
 * @param {string} webhookUrl
 * @param {Object} payload
 * @param {typeof fetch} [fetchImpl] - Injectable for tests.
 */
async function postToDiscordWebhook(webhookUrl, payload, fetchImpl = fetch) {
  const response = await fetchImpl(webhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(`Discord webhook responded ${response.status}: ${body.slice(0, 200)}`);
  }
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

  const leaseKey = `${seasonUid}_discord`;
  const lease = await claimScoringRun(db, leaseKey, scoredDay);
  if (!lease.claimed) return { status: "skipped", reason: lease.reason, scoredDay };

  try {
    await postToDiscordWebhook(webhookUrl, payload, fetchImpl);
    await markScoringRunCompleted(db, leaseKey, scoredDay, { posted: true });
    return { status: "posted", scoredDay };
  } catch (error) {
    await markScoringRunFailed(db, leaseKey, scoredDay, error);
    throw error;
  }
}

module.exports = {
  discordScoresWebhookUrl,
  CLASS_LABELS,
  ordinal,
  aggregateNightlyStandings,
  buildScoreDropEmbed,
  buildScoreDropPushes,
  postToDiscordWebhook,
  runDiscordScoreDrop,
};
