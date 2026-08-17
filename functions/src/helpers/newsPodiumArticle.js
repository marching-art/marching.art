/**
 * The Podium Report news article (Phase 7.3 / decision 31): a DAILY,
 * commentative power-rankings feature for the director-run Podium Class.
 *
 * It runs every processing night off the daily standings sheet the nightly
 * Podium processor writes to `podium-recaps/{seasonUid}/standings/{day}`
 * (buildDailyStandings), and occupies the Article 3 slot in the news run — so
 * the daily batch stays at five articles, with the Podium Report standing in
 * for the DCI caption deep-dive whenever a standings sheet exists.
 *
 * It reads the last few nights' sheets alongside tonight's so the story can lead
 * on the real drama — a coup at the top, a lead that is opening or closing, a
 * multi-night reign — instead of re-describing a static ranking every day.
 *
 * Deliberately NOT LLM-written: the standings sheets are deterministic,
 * data-true player-facing content, and podiumReportProse composes the feature
 * voice straight from them — so player corps names, ranks, scores and margins
 * can never be hallucinated. Text-only like every DCI article.
 */

const {
  analyzeStandings,
  composeHeadline,
  composeDek,
  composeNarrative,
} = require("./podium/podiumReportProse");

/**
 * The latest published daily Podium standings sheet on or before the given
 * competition day, or null when Podium has no sheet yet. Scans back a short
 * window because a day can pass without a processing run.
 */
async function loadLatestPodiumStandings(db, seasonUid, competitionDay) {
  const day = Math.max(0, Math.floor(competitionDay));
  for (let d = day; d >= Math.max(1, day - 7); d--) {
    const snapshot = await db.doc(`podium-recaps/${seasonUid}/standings/${d}`).get();
    if (snapshot.exists) return { ...snapshot.data(), day: snapshot.data().day ?? d };
  }
  return null;
}

/**
 * The published standings sheets strictly BEFORE `beforeDay`, most-recent first,
 * up to `limit` of them. Feeds the prose composer the night-over-night context
 * it needs for streaks and margin trends. Scans a wider window than `limit`
 * because processing days can be skipped, but never returns more than `limit`.
 */
async function loadPreviousPodiumStandings(db, seasonUid, beforeDay, limit = 6) {
  const start = Math.floor(beforeDay) - 1;
  const sheets = [];
  for (let d = start; d >= Math.max(1, start - 14) && sheets.length < limit; d--) {
    const snapshot = await db.doc(`podium-recaps/${seasonUid}/standings/${d}`).get();
    if (snapshot.exists) sheets.push({ ...snapshot.data(), day: snapshot.data().day ?? d });
  }
  return sheets;
}

/**
 * Compose the article (pure). Takes tonight's sheet and the prior nights'
 * sheets (most-recent first) and returns the standard article shape.
 */
function composePodiumReportArticle(sheet, reportDay, previousSheets = []) {
  const analysis = analyzeStandings(sheet, previousSheets);
  if (!analysis) return null;

  const day = analysis.day != null ? analysis.day : reportDay;

  return {
    type: "podium_report",
    headline: composeHeadline(analysis),
    summary: composeDek(analysis),
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
  const previousSheets = await loadPreviousPodiumStandings(
    db,
    seasonUid,
    sheet.day != null ? sheet.day : competitionDay
  );
  return composePodiumReportArticle(sheet, reportDay, previousSheets);
}

module.exports = {
  generatePodiumReportArticle,
  composePodiumReportArticle,
  loadLatestPodiumStandings,
  loadPreviousPodiumStandings,
};
