/**
 * The Podium Report news article (Phase 7.3 / decision 31): a DAILY,
 * commentative power-rankings column for the director-run Podium Class.
 *
 * It runs every processing night off the daily standings sheet the nightly
 * Podium processor writes to `podium-recaps/{seasonUid}/standings/{day}`
 * (buildDailyStandings), and occupies the Article 3 slot in the news run — so
 * the daily batch stays at five articles, with the Podium Report standing in
 * for the DCI caption deep-dive whenever a standings sheet exists.
 *
 * Deliberately NOT LLM-written: the standings sheet is deterministic,
 * data-true player-facing content, and podiumReportProse composes the magazine
 * voice straight from it — so player corps names, ranks, scores and margins can
 * never be hallucinated. Text-only like every DCI article.
 */

const { analyzeStandings, composeNarrative } = require("./podium/podiumReportProse");

/**
 * The latest published daily Podium standings sheet on or before the given
 * competition day, or null when Podium has no sheet yet. Scans back a short
 * window because a day can pass without a processing run.
 */
async function loadLatestPodiumStandings(db, seasonUid, competitionDay) {
  const day = Math.max(0, Math.floor(competitionDay));
  for (let d = day; d >= Math.max(1, day - 7); d--) {
    const snapshot = await db.doc(`podium-recaps/${seasonUid}/standings/${d}`).get();
    if (snapshot.exists) return snapshot.data();
  }
  return null;
}

/**
 * Compose the article (pure). Returns the standard article shape.
 */
function composePodiumReportArticle(sheet, reportDay) {
  const analysis = analyzeStandings(sheet);
  if (!analysis) return null;

  const day = analysis.day != null ? analysis.day : reportDay;
  const { leader, climber, fieldSize } = analysis;

  const summaryParts = [];
  if (leader) {
    summaryParts.push(
      `${leader.corpsName} tops the Podium Class field` +
        (typeof leader.total === "number" ? ` at ${leader.total.toFixed(3)}` : "")
    );
  }
  if (climber && climber !== leader) {
    summaryParts.push(`${climber.corpsName} is the day's biggest riser`);
  }
  summaryParts.push(`${fieldSize} corps ranked`);

  return {
    type: "podium_report",
    headline: `The Podium Report — Day ${day}`,
    summary: `${summaryParts.join("; ")}.`,
    narrative: composeNarrative(analysis),
    imageUrl: null,
    reportDay,
    podiumDay: day,
  };
}

/**
 * Generate the Podium Report article for the day, or null when no standings
 * sheet exists yet (caller falls back to the DCI recap).
 */
async function generatePodiumReportArticle({ db, seasonUid, competitionDay, reportDay }) {
  if (!seasonUid || competitionDay == null) return null;
  const sheet = await loadLatestPodiumStandings(db, seasonUid, competitionDay);
  if (!sheet || !(sheet.entries || []).length) return null;
  return composePodiumReportArticle(sheet, reportDay);
}

module.exports = {
  generatePodiumReportArticle,
  composePodiumReportArticle,
  loadLatestPodiumStandings,
};
