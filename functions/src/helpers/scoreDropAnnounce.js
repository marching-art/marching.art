/**
 * Score-drop announcement — the "scores are up" beat of the nightly reveal.
 *
 * Runs at the tail of the OFF-SEASON scoring pipeline only (the 9:00 PM ET
 * prime-time drop). Live season keeps its 2 AM run and sends nothing — nobody
 * wants a 2 AM push, and the summer ritual belongs to the real DCI schedule.
 *
 * Two channels, both isolated so a failure can never mark a scoring run
 * failed after scores have committed:
 *
 *   1. Push — one SCORE_UPDATE notification per opted-in director in the
 *      season (existing pushService plumbing: settings.fcmToken + the
 *      scoreUpdate preference). Deep-links to the dashboard, where the
 *      Nightly Reveal takes over.
 *   2. Discord — an optional webhook post (game-settings/config
 *      .discordScoresWebhookUrl) that seeds the community's nightly
 *      "scores are up" thread. Placements and totals only: full caption
 *      lines stay out of public artifacts (the anti-lineup-harvesting rule —
 *      fantasy recaps are condensed everywhere public).
 */

const { logger } = require("firebase-functions/v2");
const axios = require("axios");
const { sendPushNotification, PUSH_TYPES } = require("./pushService");

/** Max corps rows per class in the Discord embed — a teaser, not the recap. */
const DISCORD_TOP_N = 5;

const CLASS_LABELS = {
  worldClass: "World Class",
  openClass: "Open Class",
  aClass: "A Class",
};

/**
 * Send the "scores are up" push to every director in the season who has a
 * push token and hasn't disabled score updates. ~50 users today; sequential
 * sends with the per-user helper are fine at this scale and reuse its
 * token-cleanup behavior.
 *
 * @param {FirebaseFirestore.Firestore} db
 * @param {Object} seasonData - game-settings/season doc data
 * @param {number} scoredDay - Competition day just scored (1-49)
 * @returns {Promise<number>} notifications attempted
 */
async function sendScoresDropPush(db, seasonData, scoredDay) {
  const profilesSnapshot = await db
    .collectionGroup("profile")
    .where("activeSeasonId", "==", seasonData.seasonUid)
    .select("settings")
    .get();

  let sent = 0;
  for (const doc of profilesSnapshot.docs) {
    if (!doc.data()?.settings?.fcmToken) continue;
    // Profile path: artifacts/{ns}/users/{uid}/profile/data
    const uid = doc.ref.parent.parent?.id;
    if (!uid) continue;
    const ok = await sendPushNotification(
      uid,
      {
        title: "Scores are up 🎺",
        body: `Day ${scoredDay} recaps are in — see how your corps placed tonight.`,
        url: "/dashboard",
      },
      PUSH_TYPES.SCORE_UPDATE,
      { type: "score_drop", day: String(scoredDay) }
    );
    if (ok) sent++;
  }
  return sent;
}

/**
 * Build the Discord embed description from the night's recap: per class, the
 * top placements with totals. Never includes caption-level lines.
 *
 * @param {Object|null} recapData - fantasy_recaps/{seasonUid}/days/{day} data
 * @returns {string}
 */
function buildDiscordSummary(recapData) {
  const shows = recapData?.shows || [];
  const lines = [];

  for (const [classKey, label] of Object.entries(CLASS_LABELS)) {
    // Collect every corps of this class across the night's shows.
    const rows = [];
    for (const show of shows) {
      for (const result of show.results || []) {
        if (result.corpsClass === classKey && typeof result.totalScore === "number") {
          rows.push(result);
        }
      }
    }
    if (rows.length === 0) continue;

    rows.sort((a, b) => b.totalScore - a.totalScore);
    lines.push(`**${label}**`);
    rows.slice(0, DISCORD_TOP_N).forEach((r, i) => {
      lines.push(`${i + 1}. ${r.corpsName} — ${r.totalScore.toFixed(3)}`);
    });
    lines.push("");
  }

  return lines.join("\n").trim();
}

/**
 * Post the night's headline to the community Discord, when a webhook URL is
 * configured. Silent no-op otherwise.
 *
 * @param {FirebaseFirestore.Firestore} db
 * @param {Object} seasonData
 * @param {number} scoredDay
 * @returns {Promise<boolean>} whether a post was made
 */
async function postDiscordScoreDrop(db, seasonData, scoredDay) {
  const configDoc = await db.doc("game-settings/config").get();
  const webhookUrl = configDoc.exists ? configDoc.data().discordScoresWebhookUrl : null;
  if (!webhookUrl || typeof webhookUrl !== "string") return false;

  const recapDoc = await db
    .doc(`fantasy_recaps/${seasonData.seasonUid}/days/${scoredDay}`)
    .get();
  const summary = recapDoc.exists ? buildDiscordSummary(recapDoc.data()) : "";

  await axios.post(
    webhookUrl,
    {
      embeds: [
        {
          title: `🏟️ Scores are up — Day ${scoredDay}`,
          description:
            (summary || "Tonight's recaps are in.") +
            "\n\n[Read the full recap](https://marching.art/scores)",
          color: 0xd4a017,
          footer: { text: `marching.art · ${seasonData.name || "off-season"}` },
        },
      ],
    },
    { timeout: 10000 }
  );
  return true;
}

/**
 * Announce the off-season score drop. Isolated: logs and swallows every
 * failure — announcement problems must never fail a completed scoring run.
 *
 * @param {FirebaseFirestore.Firestore} db
 * @param {Object} seasonData - game-settings/season doc data
 * @param {number} scoredDay - Competition day just scored
 */
async function announceScoreDrop(db, seasonData, scoredDay) {
  try {
    const sent = await sendScoresDropPush(db, seasonData, scoredDay);
    logger.info(`[score-drop] push sent to ${sent} directors for day ${scoredDay}`);
  } catch (error) {
    logger.error(`[score-drop] push failed (scores unaffected): ${error.message}`);
  }

  try {
    const posted = await postDiscordScoreDrop(db, seasonData, scoredDay);
    if (posted) logger.info(`[score-drop] Discord webhook posted for day ${scoredDay}`);
  } catch (error) {
    logger.error(`[score-drop] Discord webhook failed (scores unaffected): ${error.message}`);
  }
}

module.exports = {
  announceScoreDrop,
  sendScoresDropPush,
  postDiscordScoreDrop,
  buildDiscordSummary,
};
