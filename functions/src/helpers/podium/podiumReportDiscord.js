/**
 * The Podium Report → #news.
 *
 * At every Podium week boundary the processor publishes a deterministic
 * power-rankings column to `podium-recaps/{seasonUid}/power/{week}`
 * (helpers/podium/powerRankings.js, design 7.3 / decision 31). It is
 * data-composed, never LLM-written, so corps names and ranks cannot be
 * hallucinated — which also makes it safe to syndicate verbatim.
 *
 * Until now it only existed in-app. This posts the week's top of the column
 * and its biggest movers to the news channel, once per week, lease-guarded
 * like every other announcement.
 */

const { COLORS, clampName, place, joinLines, link, payloadOf, postOnce } = require("../discord");

const TAG = "podium-report";
const PODIUM_URL = link("/podium");

/** Signed movement: "▲3", "▼2", "—". */
function movementLabel(delta) {
  const n = Number(delta) || 0;
  if (n > 0) return `▲${n}`;
  if (n < 0) return `▼${Math.abs(n)}`;
  return "—";
}

/**
 * Build the weekly column post.
 *
 * @param {Object} params
 * @param {Object} params.column - podium-recaps/{seasonUid}/power/{week} doc.
 * @param {number} params.week
 * @param {string} params.seasonName
 * @returns {Object|null} Webhook payload, or null when the column is empty.
 */
function buildPodiumReportPayload({ column, week, seasonName }) {
  const entries = ((column && column.entries) || []).filter((e) => e && e.corpsName);
  if (entries.length === 0) return null;

  const fieldSize = Number(column.fieldSize) || entries.length;
  const fields = [
    {
      name: `Top of the column (${fieldSize} corps ranked)`,
      value: joinLines(
        entries.slice(0, 5).map((entry, index) => {
          const move = entry.delta != null ? ` ${movementLabel(entry.delta)}` : "";
          const score = typeof entry.total === "number" ? ` — ${entry.total.toFixed(3)}` : "";
          return `${place(index)} **${clampName(entry.corpsName)}**${score}${move}`;
        })
      ),
    },
  ];

  // Movers: the reason a power-rankings column is worth reading.
  const movers = entries
    .filter((e) => Number(e.delta) > 0)
    .sort((a, b) => Number(b.delta) - Number(a.delta))
    .slice(0, 3);
  if (movers.length > 0) {
    fields.push({
      name: "Biggest climbers",
      value: joinLines(
        movers.map(
          (entry) =>
            `${movementLabel(entry.delta)} **${clampName(entry.corpsName)}**` +
            (entry.rank ? ` — now ${entry.rank}` : "")
        )
      ),
    });
  }

  // The leader's generated note is the column's own lede — deterministic
  // copy, so it can be quoted verbatim.
  const lede = entries[0] && entries[0].note ? `${clampName(entries[0].note, 200)}\n\n` : "";
  return payloadOf({
    title: `📋 The Podium Report — Week ${week}`,
    url: PODIUM_URL,
    description:
      lede +
      `${seasonName} — this week's Podium Class power rankings, composed straight from the ` +
      "week's results.",
    color: COLORS.news,
    fields,
    footer: { text: "Full column and standings on the Podium page" },
  });
}

/**
 * Announce the current week's column if one has been published and not yet
 * posted. Safe to call every night: the lease is keyed by week.
 *
 * @param {FirebaseFirestore.Firestore} db
 * @param {Object} params
 * @param {string} params.seasonUid
 * @param {string} params.seasonName
 * @param {number} params.competitionDay
 * @param {string} params.webhookUrl
 * @param {typeof fetch} [params.fetchImpl]
 * @returns {Promise<{kind: string, status: string, [k: string]: unknown}>}
 */
async function announcePodiumReport(
  db,
  { seasonUid, seasonName, competitionDay, webhookUrl, fetchImpl }
) {
  // Columns publish on week boundaries (day 7, 14, …). Before the first one
  // there is nothing to look for.
  const week = Math.floor(competitionDay / 7);
  if (week < 1) return { kind: "podium-report", status: "no-week" };

  const snapshot = await db.doc(`podium-recaps/${seasonUid}/power/${week}`).get();
  if (!snapshot.exists) return { kind: "podium-report", status: "not-published", week };

  const payload = buildPodiumReportPayload({ column: snapshot.data(), week, seasonName });
  if (!payload) return { kind: "podium-report", status: "empty-column", week };

  return postOnce(db, {
    kind: `podium-report-week-${week}`,
    tag: TAG,
    leaseKey: `${seasonUid}_discord_podreport`,
    leaseDay: week,
    payload,
    webhookUrl,
    fetchImpl,
  });
}

module.exports = { movementLabel, buildPodiumReportPayload, announcePodiumReport };
