const { onSchedule } = require("firebase-functions/v2/scheduler");
const { logger } = require("firebase-functions/v2");
const { getDb } = require("../config");
const cheerio = require("cheerio");
const { scrapeDciScoresLogic, finalScoresToRecapUrl } = require("../helpers/scraping");
const { dciFetch, scraperApiKey } = require("../helpers/dciFetch");

const LIVE_SCORES_TOPIC = "live-scores-topic";

/**
 * Core live-score scrape routine, shared by the nightly scheduler and the
 * admin "Scrape DCI Scores Now" button.
 *
 * Fetches dci.org/scores, takes the most recent event's "final scores" link,
 * derives the matching recap URL, scrapes it, and publishes the parsed scores to
 * the live-scores pubsub topic (which `processLiveScoreRecap` archives into
 * historical_scores/{year}).
 *
 * NOTE: dci.org's scores listing links to /scores/final-scores/{slug}/ pages,
 * not recap pages directly. The detailed per-caption recap lives at the same
 * slug under /scores/recap/{slug}/, so we derive it from the final-scores link.
 *
 * @param {object} [options]
 * @param {boolean} [options.force=false] - When true, bypass the "already
 *   scraped today" guard so an admin can re-run the scrape on demand.
 * @returns {Promise<object>} Result summary for surfacing in the admin UI.
 */
async function scrapeLatestLiveScores({ force = false } = {}) {
  const db = getDb();
  const seasonDoc = await db.doc("game-settings/season").get();

  // Skip if not in live season
  if (!seasonDoc.exists || seasonDoc.data().status !== "live-season") {
    logger.info("Scraper skipped: No active live season.");
    return { scraped: false, reason: "no-live-season" };
  }

  const seasonData = seasonDoc.data();
  logger.info(`Running live score scraper for season: ${seasonData.name} (force=${force})`);

  // Check if we've already scraped today to avoid duplicate processing.
  // A forced (manual) run bypasses this guard.
  //
  // Key the guard on the EASTERN calendar date, not UTC. The scheduled scrape
  // runs at 1:30 AM ET; a UTC date flips at 8 PM ET (EDT) / 7 PM ET (EST), so a
  // manual/forced scrape run during the prior evening would otherwise stamp
  // lastScrapedDate with the NEXT UTC day and silently skip the 1:30 AM run.
  // en-CA formats as YYYY-MM-DD.
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York" }).format(new Date());
  const lastScrapedDate = seasonData.lastScrapedDate;
  if (!force && lastScrapedDate === today) {
    logger.info(`Scraper skipped: Already scraped today (${today}).`);
    return { scraped: false, reason: "already-scraped-today", lastScrapedDate };
  }

  const listUrl = "https://www.dci.org/scores/";
  const data = await dciFetch(listUrl);
  const $ = cheerio.load(data);

  // dci.org renders one ".tbl-row" per event, each containing the event date in
  // an "M/D/YYYY" cell and a "final scores" link. The slug does NOT carry the
  // date (e.g. "2026-corps-encore"), so we read the date cell directly. A single
  // competition night frequently has 2-3 events, so we scrape EVERY event sharing
  // the most-recent date rather than just the latest single link.
  const listedEvents = [];
  $("a[href*=\"/scores/final-scores/\"]").each((_i, el) => {
    const href = $(el).attr("href");
    if (!href) return;
    // Read the date from this anchor's surrounding row. Match "M/D/YYYY" anywhere
    // in the row text so we don't depend on exact column class names.
    const row = $(el).closest(".tbl-row");
    const rowText = row.length ? row.text() : "";
    const dateMatch = rowText.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
    if (!dateMatch) return;
    const [, mm, dd, yyyy] = dateMatch;
    const dateKey = `${yyyy}-${mm.padStart(2, "0")}-${dd.padStart(2, "0")}`;
    const finalScoresUrl = new URL(href, "https://www.dci.org").href;
    listedEvents.push({ recapUrl: finalScoresToRecapUrl(finalScoresUrl), dateKey });
  });

  if (listedEvents.length === 0) {
    logger.info("No dated final-scores rows found on the dci.org scores page.");
    return { scraped: false, reason: "no-recap-found" };
  }

  // All events sharing the most-recent date belong to the latest competition
  // night. Compute the max date explicitly rather than trusting listing order,
  // then de-dupe recap URLs in case a link is repeated.
  const latestDateKey = listedEvents.reduce(
    (max, e) => (e.dateKey > max ? e.dateKey : max),
    listedEvents[0].dateKey
  );
  const recapUrls = [
    ...new Set(listedEvents.filter((e) => e.dateKey === latestDateKey).map((e) => e.recapUrl)),
  ];

  logger.info(`Latest competition date ${latestDateKey}: scraping ${recapUrls.length} event(s).`);

  const results = [];
  let totalCount = 0;
  for (const recapUrl of recapUrls) {
    try {
      const summary = await scrapeDciScoresLogic(recapUrl, LIVE_SCORES_TOPIC);
      totalCount += summary?.count ?? 0;
      results.push({
        recapUrl,
        eventName: summary?.eventName || null,
        eventDate: summary?.eventDate || null,
        eventLocation: summary?.eventLocation || null,
        count: summary?.count ?? 0,
      });
      logger.info(`Scraped "${summary?.eventName || recapUrl}" (${summary?.count ?? 0} corps).`);
    } catch (error) {
      // One unpublished/broken recap shouldn't abort the rest of the night's
      // events. processLiveScoreRecap archiving is idempotent, so a later manual
      // re-run (force) can backfill any event that failed here.
      logger.error(`Failed to scrape recap ${recapUrl}: ${error.message}`);
      results.push({ recapUrl, error: error.message, count: 0 });
    }
  }

  // Stamp last scraped date once the night's events have been attempted.
  await db.doc("game-settings/season").update({
    lastScrapedDate: today,
  });
  logger.info(
    `Scraping completed for ${today}: ${recapUrls.length} event(s) on ` +
    `${latestDateKey}, ${totalCount} total corps scores.`
  );

  return {
    scraped: true,
    latestDate: latestDateKey,
    eventCount: recapUrls.length,
    count: totalCount,
    events: results,
    scrapedDate: today,
  };
}

exports.scrapeLatestLiveScores = scrapeLatestLiveScores;

exports.scrapeDciScores = onSchedule({
  schedule: "every day 01:30",
  timeZone: "America/New_York",
  timeoutSeconds: 300,
  memory: "512MiB",
  secrets: [scraperApiKey],
}, async () => {
  try {
    await scrapeLatestLiveScores({ force: false });
  } catch (error) {
    logger.error("Error during live score scraping:", {
      message: error.message,
      code: error.code,
      status: error.response?.status,
    });
    // Don't throw - let the function complete so it doesn't retry automatically
    // The next scheduled run will try again
  }
});
