// @ts-nocheck -- grandfathered when functions checkJs landed (functions/tsconfig.json); remove when this file is typed or cleaned up
const { onSchedule } = require("firebase-functions/v2/scheduler");
const { logger } = require("firebase-functions/v2");
const { getDb } = require("../config");
// cheerio is required lazily (cold-start weight; only the scrape path parses HTML).
const { scrapeDciScoresLogic, finalScoresToRecapUrl } = require("../helpers/scraping");
const { dciFetch, scraperApiKey } = require("../helpers/dciFetch");
const { competitionDayToDateUTC } = require("../helpers/scheduleGeneration");

const LIVE_SCORES_TOPIC = "live-scores-topic";

const SCORES_LIST_URL = "https://www.dci.org/scores/";

/**
 * Fetch dci.org/scores and parse every listed event into { recapUrl, dateKey }.
 * dci.org renders one ".tbl-row" per event with the date in an "M/D/YYYY" cell
 * and a "final scores" link (the slug carries no date), so we read the date cell
 * directly and derive the recap URL from the final-scores link.
 * @returns {Promise<Array<{recapUrl: string, dateKey: string}>>}
 */
async function fetchScoresListing() {
  const data = await dciFetch(SCORES_LIST_URL);
  const $ = require("cheerio").load(data);

  const listedEvents = [];
  $("a[href*=\"/scores/final-scores/\"]").each((_i, el) => {
    const href = $(el).attr("href");
    if (!href) return;
    const row = $(el).closest(".tbl-row");
    const rowText = row.length ? row.text() : "";
    const dateMatch = rowText.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
    if (!dateMatch) return;
    const [, mm, dd, yyyy] = dateMatch;
    const dateKey = `${yyyy}-${mm.padStart(2, "0")}-${dd.padStart(2, "0")}`;
    const finalScoresUrl = new URL(href, "https://www.dci.org").href;
    listedEvents.push({ recapUrl: finalScoresToRecapUrl(finalScoresUrl), dateKey });
  });

  return listedEvents;
}

/**
 * Scrape + publish every listed event whose dateKey is in `dateKeySet`.
 * Publishing goes to the live-scores topic; processLiveScoreRecap archives it
 * (idempotently) into historical_scores/{year}.
 * @param {Array<{recapUrl: string, dateKey: string}>} listedEvents
 * @param {Set<string>} dateKeySet - YYYY-MM-DD keys to include.
 * @param {object} [opts]
 * @param {boolean} [opts.overwrite=false] - Replace existing scores rather than
 *   only filling blanks (admin backfill/correction).
 * @returns {Promise<{recapUrls: string[], results: object[], totalCount: number}>}
 */
async function scrapeRecapsForDateKeys(listedEvents, dateKeySet, { overwrite = false } = {}) {
  const recapUrls = [
    ...new Set(listedEvents.filter((e) => dateKeySet.has(e.dateKey)).map((e) => e.recapUrl)),
  ];
  const extraPayload = overwrite ? { overwrite: true } : {};

  const results = [];
  let totalCount = 0;
  for (const recapUrl of recapUrls) {
    try {
      const summary = await scrapeDciScoresLogic(recapUrl, LIVE_SCORES_TOPIC, extraPayload);
      const count = summary?.count ?? 0;
      totalCount += count;
      if (count === 0) {
        // A 200 response that parses to zero rows is a Cloudflare interstitial
        // or a markup change, not a published recap — record it as a failure so
        // the night is never treated as successfully scraped on empty data.
        logger.error(`Recap ${recapUrl} returned 0 parsed rows; treating as a failed scrape.`);
        results.push({
          recapUrl,
          eventName: summary?.eventName || null,
          eventDate: summary?.eventDate || null,
          eventLocation: summary?.eventLocation || null,
          error: "0 rows parsed from response",
          count: 0,
        });
        continue;
      }
      results.push({
        recapUrl,
        eventName: summary?.eventName || null,
        eventDate: summary?.eventDate || null,
        eventLocation: summary?.eventLocation || null,
        count,
      });
      logger.info(`Scraped "${summary?.eventName || recapUrl}" (${count} corps).`);
    } catch (error) {
      // One unpublished/broken recap shouldn't abort the rest. processLiveScoreRecap
      // archiving is idempotent, so a later re-run can backfill any event that failed.
      logger.error(`Failed to scrape recap ${recapUrl}: ${error.message}`);
      results.push({ recapUrl, error: error.message, count: 0 });
    }
  }
  return { recapUrls, results, totalCount };
}

/**
 * Write the per-night scrape status doc at `scrape_runs/{date}` (date = the
 * Eastern calendar date the run belongs to, same key as lastScrapedDate).
 *
 * Backend-only collection following the `scoring_runs` conventions
 * (helpers/scoringRunGuard.js): no client rules exist for it, status is
 * "completed"/"failed", timestamps are plain Dates. The scoring watchdog reads
 * it at 4:30 AM ET and alerts when a live-season night failed or is absent.
 *
 * Best-effort, never throws — a status write must not break the scrape result
 * path (mirrors markScoringRunFailed).
 *
 * @param {FirebaseFirestore.Firestore} db
 * @param {string} date - Eastern calendar date (YYYY-MM-DD).
 * @param {object} fields - Status fields to merge onto the doc.
 */
async function writeScrapeRunStatus(db, date, fields) {
  try {
    await db.collection("scrape_runs").doc(date).set({ date, ...fields }, { merge: true });
  } catch (error) {
    logger.error(`Failed to write scrape_runs/${date} status doc:`, error);
  }
}

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

  // A single competition night frequently has 2-3 events, so we scrape EVERY
  // event sharing the most-recent date rather than just the latest single link.
  const listedEvents = await fetchScoresListing();

  if (listedEvents.length === 0) {
    logger.info("No dated final-scores rows found on the dci.org scores page.");
    // A listing page with no rows during live season is a scrape failure
    // (blocked or broken markup), not a quiet night — record it so the
    // watchdog can alert instead of the night silently vanishing.
    await writeScrapeRunStatus(db, today, {
      status: "failed",
      failedAt: new Date(),
      attempted: 0,
      succeeded: 0,
      failed: 0,
      lastError: "no dated final-scores rows found on the dci.org scores page",
    });
    return { scraped: false, reason: "no-recap-found" };
  }

  // All events sharing the most-recent date belong to the latest competition
  // night. Compute the max date explicitly rather than trusting listing order.
  const latestDateKey = listedEvents.reduce(
    (max, e) => (e.dateKey > max ? e.dateKey : max),
    listedEvents[0].dateKey
  );

  logger.info(`Latest competition date ${latestDateKey}: scraping events.`);
  const { recapUrls, results, totalCount } =
    await scrapeRecapsForDateKeys(listedEvents, new Set([latestDateKey]));

  const succeeded = results.filter((r) => !r.error && r.count > 0).length;
  const failed = results.length - succeeded;
  const errors = results
    .filter((r) => r.error)
    .map(({ recapUrl, error }) => ({ recapUrl, error }));
  const anySucceeded = succeeded > 0;

  // Record the night's outcome for the watchdog and admin diagnostics.
  await writeScrapeRunStatus(db, today, {
    status: anySucceeded ? "completed" : "failed",
    ...(anySucceeded ? { completedAt: new Date() } : { failedAt: new Date() }),
    latestDateKey,
    attempted: recapUrls.length,
    succeeded,
    failed,
    totalCount,
    ...(errors.length > 0 ? { errors } : {}),
    ...(anySucceeded ? {} : { lastError: errors[0]?.error || "all recaps failed" }),
  });

  // Stamp last scraped date ONLY when at least one recap actually produced
  // rows. A night where every recap failed (Cloudflare block, markup change,
  // unpublished recaps) must NOT be stamped — the stamp is what blocks the
  // same-day guard above, so stamping a zero-score night would silently
  // prevent any retry before the 2 AM scorer runs.
  if (anySucceeded) {
    await db.doc("game-settings/season").update({
      lastScrapedDate: today,
    });
    logger.info(
      `Scraping completed for ${today}: ${succeeded}/${recapUrls.length} event(s) on ` +
      `${latestDateKey}, ${totalCount} total corps scores.`
    );
  } else {
    logger.error(
      `Scraping FAILED for ${today}: 0/${recapUrls.length} event(s) on ${latestDateKey} ` +
      "produced scores. lastScrapedDate NOT stamped so a re-run can retry today."
    );
  }

  return {
    scraped: true,
    latestDate: latestDateKey,
    eventCount: recapUrls.length,
    succeededEvents: succeeded,
    failedEvents: failed,
    stampedLastScrapedDate: anySucceeded,
    count: totalCount,
    events: results,
    scrapedDate: today,
  };
}

exports.scrapeLatestLiveScores = scrapeLatestLiveScores;

/**
 * Admin backfill: scrape dci.org scores for a specific competition-day range
 * (e.g. days 22-24) instead of just the latest night. Maps each day to its
 * calendar date via the season's finals anchor, then scrapes every listed event
 * on those dates. Unlike the nightly run it does NOT stamp lastScrapedDate, so
 * it never interferes with the daily cadence.
 *
 * @param {object} params
 * @param {number} params.startDay - First competition day (1-49).
 * @param {number} params.endDay - Last competition day (>= startDay, <= 49).
 * @param {boolean} [params.overwrite=false] - Replace existing scores/captions
 *   rather than only filling blanks. Use to correct bad data, not for routine
 *   backfill of missing days.
 * @returns {Promise<object>} Result summary for the admin UI.
 */
async function scrapeLiveScoresForDayRange({ startDay, endDay, overwrite = false } = {}) {
  const db = getDb();
  const seasonDoc = await db.doc("game-settings/season").get();

  if (!seasonDoc.exists || seasonDoc.data().status !== "live-season") {
    logger.info("Day-range backfill skipped: no active live season.");
    return { scraped: false, reason: "no-live-season" };
  }
  const seasonData = seasonDoc.data();

  // Finals year drives the day -> date mapping; seasonYear is the finals year.
  const finalsYear = seasonData.seasonYear || new Date().getUTCFullYear();

  // Map each requested competition day to its calendar date (YYYY-MM-DD).
  const dateKeySet = new Set();
  const requestedDates = [];
  for (let day = startDay; day <= endDay; day++) {
    const date = competitionDayToDateUTC(day, finalsYear);
    if (!date) continue;
    const dateKey = date.toISOString().slice(0, 10);
    dateKeySet.add(dateKey);
    requestedDates.push({ day, date: dateKey });
  }

  if (dateKeySet.size === 0) {
    return { scraped: false, reason: "invalid-day-range", startDay, endDay };
  }

  logger.info(
    `Day-range backfill: days ${startDay}-${endDay} -> ` +
    `${requestedDates.map((d) => d.date).join(", ")} (overwrite=${overwrite}).`
  );

  const listedEvents = await fetchScoresListing();
  if (listedEvents.length === 0) {
    logger.info("Day-range backfill: no final-scores rows on the dci.org scores page.");
    return { scraped: false, reason: "no-recap-found", requestedDates };
  }

  const { recapUrls, results, totalCount } =
    await scrapeRecapsForDateKeys(listedEvents, dateKeySet, { overwrite });

  if (recapUrls.length === 0) {
    logger.info(
      `Day-range backfill: no listed events fell on ${[...dateKeySet].join(", ")}. ` +
      "They may not be posted on dci.org's current listing."
    );
    return { scraped: false, reason: "no-events-in-range", startDay, endDay, requestedDates };
  }

  logger.info(
    `Day-range backfill complete: days ${startDay}-${endDay}, ` +
    `${recapUrls.length} event(s), ${totalCount} total corps scores (overwrite=${overwrite}).`
  );

  return {
    scraped: true,
    startDay,
    endDay,
    overwrite,
    requestedDates,
    eventCount: recapUrls.length,
    count: totalCount,
    events: results,
  };
}

exports.scrapeLiveScoresForDayRange = scrapeLiveScoresForDayRange;

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
