/**
 * The Podium Report news article (Phase 7.3 / decision 31): on Podium week
 * boundaries the weekly power-rankings column (written by the nightly Podium
 * processor to podium-recaps/{seasonUid}/power/{week}) replaces the DCI
 * caption deep-dive (Article 3) in the daily news run.
 *
 * Deliberately NOT LLM-written: the column is deterministic, data-true
 * player-facing content — composing it directly means player corps names
 * and ranks can never be hallucinated. Text-only like every DCI article.
 */

const DIVISION_LABELS = { aClass: "A Class", openClass: "Open Class", worldClass: "World Class" };

/**
 * The latest published Podium power week ≤ the current competition week, or
 * null when Podium has no column yet.
 */
async function loadLatestPodiumReport(db, seasonUid, competitionDay) {
  const currentWeek = Math.floor(Math.max(0, competitionDay) / 7);
  for (let week = Math.min(7, currentWeek); week >= 1; week--) {
    const snapshot = await db.doc(`podium-recaps/${seasonUid}/power/${week}`).get();
    if (snapshot.exists) return snapshot.data();
  }
  return null;
}

/**
 * Compose the article (pure). Returns the standard article shape.
 */
function composePodiumReportArticle(report, reportDay) {
  const entries = report.entries || [];
  const top = entries[0];
  const mover = entries.find((entry) => /biggest move/.test(entry.note || ""));

  const lines = entries.map((entry) => {
    const total = entry.total != null ? entry.total.toFixed(3) : "—";
    const division = entry.division ? ` (${DIVISION_LABELS[entry.division] || entry.division})` : "";
    return `${entry.rank}. ${entry.corpsName || "Unknown corps"}${division} — ${total}. ${entry.note || ""}`.trim();
  });

  const summaryParts = [];
  if (top) {
    summaryParts.push(`${top.corpsName} leads the Podium Class field at ${top.total?.toFixed(3)}`);
  }
  if (mover && mover !== top) {
    summaryParts.push(`${mover.corpsName} makes the week's biggest move`);
  }
  summaryParts.push(`${report.fieldSize} corps ranked`);

  return {
    type: "podium_report",
    headline: `The Podium Report — Week ${report.week} Power Rankings`,
    summary: `${summaryParts.join("; ")}.`,
    narrative:
      `Every week the Podium Report re-seats the director-run field on current scores — ` +
      `who's peaking, who's slipping, and who just arrived.\n\n` +
      `${lines.join("\n")}\n\n` +
      `Power rankings are computed from the nightly recap scores; the full box scores for ` +
      `all eight captions live in the Scores tab under Podium Class.`,
    imageUrl: null,
    reportDay,
    podiumWeek: report.week,
  };
}

/**
 * Generate the Podium Report article for the day, or null when no column
 * exists yet (caller falls back to the DCI recap).
 */
async function generatePodiumReportArticle({ db, seasonUid, competitionDay, reportDay }) {
  if (!seasonUid || competitionDay == null) return null;
  const report = await loadLatestPodiumReport(db, seasonUid, competitionDay);
  if (!report || !(report.entries || []).length) return null;
  return composePodiumReportArticle(report, reportDay);
}

module.exports = { generatePodiumReportArticle, composePodiumReportArticle, loadLatestPodiumReport };
