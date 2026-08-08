/**
 * The Podium Report → #news.
 *
 * Every processing night the Podium processor publishes a deterministic
 * standings sheet to `podium-recaps/{seasonUid}/standings/{day}`
 * (helpers/podium/powerRankings.js buildDailyStandings). It is data-composed,
 * never LLM-written, so corps names and ranks cannot be hallucinated — which
 * also makes it safe to syndicate verbatim.
 *
 * This posts the night's top of the board, its biggest movers, and a
 * commentative lede to the news channel, once per day, lease-guarded like every
 * other announcement.
 */

const { COLORS, clampName, place, joinLines, link, payloadOf, postOnce } = require("../discord");
const { analyzeStandings, leadSentence } = require("./podiumReportProse");

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
 * Build the daily column post.
 *
 * @param {Object} params
 * @param {Object} params.sheet - podium-recaps/{seasonUid}/standings/{day} doc.
 * @param {number} params.day
 * @param {string} params.seasonName
 * @returns {Object|null} Webhook payload, or null when the sheet is empty.
 */
function buildPodiumReportPayload({ sheet, day, seasonName }) {
  const analysis = analyzeStandings(sheet);
  if (!analysis) return null;

  const fields = [
    {
      name: `Top of the board (${analysis.fieldSize} corps ranked)`,
      value: joinLines(
        analysis.ranked.slice(0, 5).map((entry, index) => {
          const move = entry.delta != null ? ` ${movementLabel(entry.delta)}` : "";
          const score = typeof entry.total === "number" ? ` — ${entry.total.toFixed(3)}` : "";
          return `${place(index)} **${clampName(entry.corpsName)}**${score}${move}`;
        })
      ),
    },
  ];

  // Movers: the reason a power-rankings column is worth reading — the night's
  // biggest climb and, when there is one, its steepest slide.
  const moverLines = [];
  if (analysis.climber) {
    moverLines.push(
      `${movementLabel(analysis.climber.delta)} **${clampName(analysis.climber.corpsName)}**` +
        (analysis.climber.rank ? ` — now ${analysis.climber.rank}` : "")
    );
  }
  if (analysis.faller) {
    moverLines.push(
      `${movementLabel(analysis.faller.delta)} **${clampName(analysis.faller.corpsName)}**` +
        (analysis.faller.rank ? ` — now ${analysis.faller.rank}` : "")
    );
  }
  if (moverLines.length > 0) {
    fields.push({ name: "Movers", value: joinLines(moverLines) });
  }

  return payloadOf({
    title: `📋 The Podium Report — Day ${day}`,
    url: PODIUM_URL,
    description:
      `${leadSentence(analysis)}\n\n` +
      `${seasonName} — the Podium Class re-seated on tonight's results.`,
    color: COLORS.news,
    fields,
    footer: { text: "Full board and box scores on the Podium page" },
  });
}

/**
 * The latest published daily standings sheet on or before the given competition
 * day, or null. Scans back a short window because a day can pass with no run.
 */
async function loadLatestStandings(db, seasonUid, competitionDay) {
  const day = Math.max(0, Math.floor(competitionDay));
  for (let d = day; d >= Math.max(1, day - 7); d--) {
    const snapshot = await db.doc(`podium-recaps/${seasonUid}/standings/${d}`).get();
    if (snapshot.exists) return { sheet: snapshot.data(), day: d };
  }
  return null;
}

/**
 * Announce the latest daily standings sheet if one has been published and not
 * yet posted. Safe to call every night: the lease is keyed by the sheet's day.
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
  // Before the first scored day there is nothing to look for.
  if (!(competitionDay >= 1)) return { kind: "podium-report", status: "no-day" };

  const found = await loadLatestStandings(db, seasonUid, competitionDay);
  if (!found) return { kind: "podium-report", status: "not-published" };

  const { sheet, day } = found;
  const payload = buildPodiumReportPayload({ sheet, day, seasonName });
  if (!payload) return { kind: "podium-report", status: "empty-board", day };

  return postOnce(db, {
    kind: `podium-report-day-${day}`,
    tag: TAG,
    leaseKey: `${seasonUid}_discord_podreport`,
    leaseDay: day,
    payload,
    webhookUrl,
    fetchImpl,
  });
}

module.exports = { movementLabel, buildPodiumReportPayload, announcePodiumReport };
