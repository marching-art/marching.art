// Scrape schema-drift canary (scheduled): fetches the live dci.org pages the
// scraper depends on every afternoon and audits their structure
// (helpers/scrapeCanary.js), so a markup redesign surfaces as a 1 PM ET
// email instead of a 2 AM scoring-night incident. Alerting mirrors the
// scoring watchdog: a stably-tagged logger.error ("[scrape-canary]") for
// log-based alerting plus an admin email fan-out. The last result is
// persisted to admin-stats/scrapeCanary for the admin dashboard.

const { onSchedule } = require("firebase-functions/v2/scheduler");
const { logger } = require("firebase-functions/v2");
const { getDb } = require("../config");
const { dciFetch, scraperApiKey } = require("../helpers/dciFetch");
const { discoverAllRecapUrls } = require("../helpers/scraping");
const { auditScoresListing, auditRecapPage } = require("../helpers/scrapeCanary");

const SCORES_LIST_URL = "https://www.dci.org/scores/";

/**
 * Run the three drift checks. Exported for the admin manual trigger/tests.
 *
 * @param {FirebaseFirestore.Firestore} db
 * @returns {Promise<{healthy: boolean, problems: string[], warnings: string[], summary: Object}>}
 */
async function runScrapeCanary(db) {
  const problems = [];
  const warnings = [];
  const summary = {};

  // 1. Scores listing page (what the nightly live scraper reads first).
  try {
    const listingHtml = await dciFetch(SCORES_LIST_URL);
    const listing = auditScoresListing(listingHtml);
    problems.push(...listing.problems);
    warnings.push(...listing.warnings);
    summary.listingEventCount = listing.eventCount;
  } catch (error) {
    problems.push(`could not fetch the scores listing: ${error.message}`);
  }

  // 2. Sitemap discovery (the backfill/importer path) + 3. recap page parse.
  try {
    const recapUrls = await discoverAllRecapUrls();
    summary.sitemapRecapUrls = recapUrls.length;
    if (recapUrls.length === 0) {
      problems.push("sitemap discovery returned zero recap URLs — the Yoast sitemap layout drifted");
    } else {
      // The last URL sorts to the most recent year — a page in the current
      // markup generation, unlike a decade-old archive page.
      const target = recapUrls[recapUrls.length - 1];
      summary.auditedRecapUrl = target;
      const recapHtml = await dciFetch(target);
      const recap = auditRecapPage(recapHtml);
      problems.push(...recap.problems);
      warnings.push(...recap.warnings);
      summary.recapCorpsCount = recap.corpsCount;
      summary.recapEventName = recap.eventName;
    }
  } catch (error) {
    problems.push(`could not audit a recap page: ${error.message}`);
  }

  const healthy = problems.length === 0;
  const result = {
    healthy,
    problems,
    warnings,
    summary,
    checkedAt: new Date().toISOString(),
  };

  // Best-effort persistence for the admin dashboard; never fail the canary on it.
  try {
    await db.doc("admin-stats/scrapeCanary").set(result);
  } catch (error) {
    logger.warn(`[scrape-canary] could not persist result: ${error.message}`);
  }

  if (healthy) {
    logger.info(
      `[scrape-canary] dci.org structure healthy (${summary.recapCorpsCount ?? 0} corps parsed ` +
        `from "${summary.recapEventName ?? "?"}"; ${summary.listingEventCount ?? 0} listed events).`
    );
    if (warnings.length > 0) logger.warn(`[scrape-canary] warnings: ${warnings.join(" | ")}`);
    return result;
  }

  // Alert channel 1: stably-tagged error for log-based alerting.
  logger.error(`[scrape-canary] ${problems.join(" | ")}`, { warnings, summary });

  // Alert channel 2: admin email fan-out (same plumbing as the watchdog).
  try {
    const { fanOutToAdmins, sendAdminGenericAlertEmail } = require("../helpers/emailService");
    await fanOutToAdmins(sendAdminGenericAlertEmail, {
      subject: "⚠️ dci.org markup drift detected — fix before tonight's scrape",
      body:
        "The afternoon scrape canary found structural drift on dci.org. Tonight's " +
        "scoring scrape will likely fail unless the selectors are updated first.\n\n" +
        `Problems:\n- ${problems.join("\n- ")}\n\n` +
        (warnings.length > 0 ? `Warnings:\n- ${warnings.join("\n- ")}\n\n` : "") +
        `Details: ${JSON.stringify(summary, null, 2)}\n\n` +
        "Selectors live in functions/src/helpers/scraping.js and " +
        "scheduled/liveScraper.js; the canary's mirrored contracts in " +
        "helpers/scrapeCanary.js must be updated together with them.",
    });
  } catch (error) {
    logger.error(`[scrape-canary] admin email fan-out failed: ${error.message}`);
  }

  return result;
}

/**
 * Daily 1 PM ET — late enough that dci.org has posted any overnight changes,
 * early enough to leave a working afternoon before the ~2 AM scrape window.
 */
exports.scrapeCanary = onSchedule(
  {
    schedule: "0 13 * * *",
    timeZone: "America/New_York",
    timeoutSeconds: 120,
    secrets: [scraperApiKey],
  },
  async () => {
    await runScrapeCanary(getDb());
  }
);

module.exports = { scrapeCanary: exports.scrapeCanary, runScrapeCanary };
