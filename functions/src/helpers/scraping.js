const { onCall } = require("firebase-functions/v2/https");
const { logger } = require("firebase-functions/v2");
const { PubSub } = require("@google-cloud/pubsub");
const axios = require("axios");
const cheerio = require("cheerio");
const { assertAdmin } = require("./callableGuards");

// NOTE: Puppeteer/Chromium scraping has been moved to functions-scraper codebase
// to reduce cold start time for all other functions (~800ms-1.2s improvement)
// See: functions-scraper/index.js for scrapeUpcomingDciEvents

// Declare clients in the global scope but do not initialize them.
let pubsubClient;

const DCI_RECAP_TOPIC = "dci-recap-topic";
const DCI_BASE_URL = "https://www.dci.org";
const SITEMAP_INDEX_URL = `${DCI_BASE_URL}/sitemap_index.xml`;
const SCRAPER_USER_AGENT = "Mozilla/5.0 (compatible; MarchingArtBot/1.0)";

/**
 * Derive a recap URL from a "final scores" URL. dci.org serves the per-caption
 * recap at the same slug under /scores/recap/ as the /scores/final-scores/ page.
 * e.g. https://www.dci.org/scores/final-scores/2024-dci-pittsburgh/
 *   ->  https://www.dci.org/scores/recap/2024-dci-pittsburgh/
 * @param {string} finalScoresUrl
 * @returns {string}
 */
function finalScoresToRecapUrl(finalScoresUrl) {
  return finalScoresUrl.replace("/scores/final-scores/", "/scores/recap/");
}

/**
 * Extract all <loc> values from a sitemap XML string.
 * @param {string} xml
 * @returns {string[]}
 */
function extractSitemapLocs(xml) {
  const locs = [];
  for (const match of xml.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/g)) {
    locs.push(match[1]);
  }
  return locs;
}

async function scrapeDciScoresLogic(urlToScrape, topic = "dci-scores-topic") {
  // Lazy initialize the client if it hasn't been already
  if (!pubsubClient) {
    pubsubClient = new PubSub();
  }

  logger.info(`[scrapeDciScoresLogic] Starting for URL: ${urlToScrape}`);
  if (!urlToScrape) {
    logger.error("[scrapeDciScoresLogic] Critical error: No URL provided.");
    throw new Error("A URL is required to scrape.");
  }

  try {
    const { data } = await axios.get(urlToScrape);
    const $ = cheerio.load(data);
    const scoresData = [];

    const eventNameSelector = "div[data-widget_type=\"theme-post-title.default\"] h1.elementor-heading-title";
    const eventName = $(eventNameSelector).text().trim() || "Unknown DCI Event";
    const dateLocationDiv = $("div[data-widget_type=\"shortcode.default\"] div.score-date-location");
    const dateText = dateLocationDiv.find("p").eq(0).text().trim();
    const locationText = dateLocationDiv.find("p").eq(1).text().trim();

    let eventDate = new Date();
    let eventLocation = locationText || "Unknown Location";
    let year = new Date().getFullYear();

    if (dateText) {
      const parsedDate = new Date(dateText);
      if (!isNaN(parsedDate.getTime())) {
        eventDate = parsedDate;
        year = eventDate.getFullYear();
      }
    }

    const logMsg = `PARSED DATA --> Name: '${eventName}', Date: '${eventDate.toISOString()}', ` +
      `Location: '${eventLocation}', Year: '${year}'`;
    logger.info(logMsg);

    const headerSelector = "table#effect-table-0 > tbody > tr.table-top";
    const headerRow = $(headerSelector);
    const orderedCaptionTitles = [];
    headerRow.find("td.type").each((_i, el) => {
      orderedCaptionTitles.push($(el).text().trim());
    });

    $("table#effect-table-0 > tbody > tr").not(".table-top").each((i, row) => {
      const corpsName = $(row).find("td.sticky-td").first().text().trim();
      if (!corpsName) return;

      const totalScore = parseFloat($(row).find("td.data-total").last().find("span").first().text().trim());

      const tempScores = {
        "General Effect 1": [], "General Effect 2": [],
        "Visual Proficiency": [], "Visual Analysis": [], "Color Guard": [],
        "Music Brass": [], "Music Analysis": [], "Music Percussion": [],
      };

      const mapCaptionTitleToKey = (title) => {
        const normalized = title.replace(/\s-\s/g, " ").trim();
        return Object.prototype.hasOwnProperty.call(tempScores, normalized) ? normalized : null;
      };

      const scoreTables = $(row).find("table.data");

      scoreTables.each((index, table) => {
        const captionTitle = orderedCaptionTitles[index];
        const mappedTitle = mapCaptionTitleToKey(captionTitle);

        if (mappedTitle) {
          const score = parseFloat($(table).find("td").eq(2).text().trim());
          if (!isNaN(score)) {
            tempScores[mappedTitle].push(score);
          }
        }
      });

      const processCaption = (captionName) => {
        const scores = tempScores[captionName];
        if (!scores || scores.length === 0) return 0;
        if (scores.length === 1) return scores[0];
        const sum = scores.reduce((a, b) => a + b, 0);
        return parseFloat((sum / scores.length).toFixed(3));
      };

      const captions = {
        GE1: processCaption("General Effect 1"),
        GE2: processCaption("General Effect 2"),
        VP: processCaption("Visual Proficiency"),
        VA: processCaption("Visual Analysis"),
        CG: processCaption("Color Guard"),
        B: processCaption("Music Brass"),
        MA: processCaption("Music Analysis"),
        P: processCaption("Music Percussion"),
      };

      const scoreObject = { corps: corpsName, score: totalScore, captions: captions };
      scoresData.push(scoreObject);
    });

    if (scoresData.length === 0) {
      logger.warn(`No scores found on ${urlToScrape}.`);
      return { eventName, eventLocation, eventDate: eventDate.toISOString(), year, count: 0 };
    }

    const payload = { scores: scoresData, eventName, eventLocation, eventDate: eventDate.toISOString(), year };
    const dataBuffer = Buffer.from(JSON.stringify(payload));
    await pubsubClient.topic(topic).publishMessage({ data: dataBuffer });
    logger.info(`Successfully published ${scoresData.length} corps scores from ${eventName}.`);
    return { eventName, eventLocation, eventDate: eventDate.toISOString(), year, count: scoresData.length };
  } catch (error) {
    logger.error(`[scrapeDciScoresLogic] CRITICAL ERROR for URL ${urlToScrape}:`, error);
    throw error;
  }
}

const testScraper = onCall({ cors: true }, async (request) => {
  assertAdmin(request);

  logger.info("Running scraper test...");

  // Test URL - using a known DCI recap page
  const testUrl = "https://www.dci.org/scores/recap/2024-07-13-dci-southwestern-championship-san-antonio-tx";
  
  try {
    await scrapeDciScoresLogic(testUrl, "dci-scores-topic");
    return { success: true, message: "Scraper test completed successfully. Check logs for details." };
  } catch (error) {
    logger.error("Scraper test failed:", error);
    return { success: false, message: `Scraper test failed: ${error.message}` };
  }
});

/**
 * Discover every event URL across all years from dci.org's Yoast "competition"
 * sitemaps. Returns the derived recap URLs (deduped).
 *
 * This replaces the old HTML-pagination crawl: dci.org's scores listing now
 * paginates via an authenticated admin-ajax POST, but the sitemaps expose every
 * /scores/final-scores/{year}-{slug}/ URL (2013-present) over plain GET, which
 * is far more robust and complete.
 *
 * @returns {Promise<string[]>} Array of unique recap URLs.
 */
async function discoverAllRecapUrls() {
  const headers = { "User-Agent": SCRAPER_USER_AGENT };

  const { data: indexXml } = await axios.get(SITEMAP_INDEX_URL, { timeout: 30000, headers });
  const competitionSitemaps = extractSitemapLocs(indexXml)
    .filter((u) => /competition-sitemap\d*\.xml/.test(u));

  if (competitionSitemaps.length === 0) {
    logger.warn("[DeepScrape] No competition sitemaps found in sitemap index.");
    return [];
  }
  logger.info(`[DeepScrape] Found ${competitionSitemaps.length} competition sitemap(s).`);

  const recapUrls = new Set();
  for (const sitemapUrl of competitionSitemaps) {
    try {
      const { data: xml } = await axios.get(sitemapUrl, { timeout: 30000, headers });
      for (const loc of extractSitemapLocs(xml)) {
        if (loc.includes("/scores/final-scores/")) {
          recapUrls.add(finalScoresToRecapUrl(loc));
        }
      }
    } catch (error) {
      logger.warn(`[DeepScrape] Failed to read sitemap ${sitemapUrl}: ${error.message}`);
    }
  }

  return [...recapUrls];
}

/**
 * Admin-only "deep scrape": discover every event across all years on dci.org and
 * archive each recap into historical_scores/{year}.
 *
 * Pipeline:
 *   discoverAndQueueUrls (this) -- reads the competition sitemaps, derives every
 *     recap URL, and fans them out to dci-recap-topic
 *   -> processDciRecap (throttled) -> scrapeDciScoresLogic
 *   -> dci-scores-topic (processDciScores) -> merge into historical_scores/{year}
 *
 * processDciScores merges by event (name+date), appending missing corps and
 * filling only blank/zero captions, so re-running is safe and idempotent: it
 * backfills missing scores without overwriting existing values.
 */
const discoverAndQueueUrls = onCall({
  cors: true,
  timeoutSeconds: 300,
  memory: "512MiB",
}, async (request) => {
  assertAdmin(request);
  // Lazy initialize the client
  if (!pubsubClient) {
    pubsubClient = new PubSub();
  }

  logger.info(`Admin ${request.auth.uid} kicked off a full DCI history deep scrape.`);

  const recapUrls = await discoverAllRecapUrls();
  if (recapUrls.length === 0) {
    return {
      success: false,
      message: "Deep scrape found no event URLs in the dci.org sitemaps. Nothing was queued.",
      discovered: 0,
      published: 0,
    };
  }

  // Fan out to the recap topic in parallel chunks (keeps publish latency low
  // while bounding concurrency). processDciRecap throttles the actual scraping.
  const topic = pubsubClient.topic(DCI_RECAP_TOPIC);
  const CHUNK_SIZE = 50;
  let published = 0;
  for (let i = 0; i < recapUrls.length; i += CHUNK_SIZE) {
    const chunk = recapUrls.slice(i, i + CHUNK_SIZE);
    const results = await Promise.allSettled(
      chunk.map((url) =>
        topic.publishMessage({ data: Buffer.from(JSON.stringify({ url })) })
      )
    );
    for (const r of results) {
      if (r.status === "fulfilled") published++;
      else logger.error(`[DeepScrape] Failed to publish a recap URL: ${r.reason?.message}`);
    }
  }

  logger.info(`[DeepScrape] Queued ${published}/${recapUrls.length} recap URLs for archiving.`);

  return {
    success: true,
    message: `Deep scrape started: queued ${published} event recaps spanning all years on ` +
      "dci.org for archiving in the background. Missing corps/caption scores will be filled in; " +
      "existing values are never overwritten. This runs over the next several minutes — watch the " +
      "function logs and refresh the Live Scores view to see data populate.",
    discovered: recapUrls.length,
    published,
  };
});

module.exports = {
  scrapeDciScoresLogic,
  finalScoresToRecapUrl,
  discoverAllRecapUrls,
  testScraper,
  discoverAndQueueUrls,
};
