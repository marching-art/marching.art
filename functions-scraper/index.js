/**
 * Isolated Puppeteer Scraper Functions
 *
 * This codebase is separate from the main functions to:
 * - Reduce cold start time for all other functions (~800ms-1.2s savings)
 * - Allow independent memory allocation (2GB for scraper vs 256MB default)
 * - Keep heavy Chromium/Puppeteer dependencies isolated
 */

const admin = require("firebase-admin");
const { onCall, onRequest, HttpsError } = require("firebase-functions/v2/https");
const { logger } = require("firebase-functions/v2");
const { defineSecret } = require("firebase-functions/params");

admin.initializeApp();

// Shared secret used to authenticate server-to-server calls from the main
// functions codebase (e.g. startNewLiveSeason / refreshLiveSeasonSchedule)
// into the HTTP scraper endpoint below. Set via:
//   firebase functions:secrets:set SCRAPER_INVOKE_KEY
const scraperInvokeKey = defineSecret("SCRAPER_INVOKE_KEY");

// Puppeteer and Chromium loaded at module level since this codebase only contains scraper
const puppeteer = require("puppeteer-core");
const chromium = require("@sparticuz/chromium");

/**
 * Scrapes upcoming DCI events from dci.org/events/
 * Uses Puppeteer because the page loads content via AJAX
 * @param {number} year - The year to filter events for
 * @returns {Promise<Array>} Array of event objects with eventName, date, location
 */
async function scrapeUpcomingDciEventsLogic(year) {
  logger.info(`[EventScraper] Starting to scrape upcoming DCI events for ${year}...`);

  let browser = null;
  const allEvents = [];

  try {
    browser = await puppeteer.launch({
      args: chromium.args,
      defaultViewport: chromium.defaultViewport,
      executablePath: await chromium.executablePath(),
      headless: chromium.headless,
      ignoreHTTPSErrors: true,
    });

    const page = await browser.newPage();
    page.setDefaultTimeout(60000);

    const eventsUrl = "https://www.dci.org/events/";
    logger.info(`[EventScraper] Navigating to ${eventsUrl}`);
    await page.goto(eventsUrl, { waitUntil: "networkidle2", timeout: 60000 });

    // The events list (#event_results) is server-rendered for page 1; subsequent
    // pages load via AJAX when a pagination link is clicked.
    await page.waitForSelector(".upcoming-events-box", { timeout: 30000 });
    await new Promise((resolve) => setTimeout(resolve, 2000));

    // Extracts every event card currently rendered in the list. Each card lives in
    // a `.upcoming-events-box`; the detail link (with the year-prefixed slug) holds
    // the name, and the `.upcoming-events-contact` list holds the date and location.
    const extractCurrentPage = (targetYear) => page.evaluate((yr) => {
      const events = [];
      document.querySelectorAll(".upcoming-events-box").forEach((box) => {
        const nameLink = box.querySelector(".upcoming-events-info-holder p.h4 a") ||
          box.querySelector(".upcoming-events-info a[href*='/events/']");

        let url = nameLink ? (nameLink.getAttribute("href") || "") : "";
        let eventName = nameLink ? nameLink.textContent.trim() : "";

        if (!eventName) {
          const img = box.querySelector("img[alt^='Image of']");
          if (img) eventName = img.alt.replace(/^Image of /, "").trim();
        }

        // Only keep events for the target year (slug looks like /events/2026-...).
        const yearMatch = url.match(/\/events\/(\d{4})-/);
        if (!yearMatch || parseInt(yearMatch[1], 10) !== yr) return;

        let dateStr = "";
        let location = "";
        box.querySelectorAll(".upcoming-events-contact li span").forEach((span) => {
          const text = span.textContent.trim();
          if (!dateStr && (/^\d{1,2}\s+[A-Za-z]{3}$/.test(text) || /^[A-Za-z]{3}\s+\d{1,2}$/.test(text))) {
            dateStr = text;
          } else if (!location && /^[A-Za-z.\s]+,\s*[A-Z]{2}$/.test(text)) {
            location = text;
          }
        });

        if (eventName && url) {
          events.push({ eventName, dateStr, location, url });
        }
      });
      return events;
    }, targetYear);

    // Read total page count from the "<current> from <total>" pagination indicator.
    const totalPages = await page.evaluate(() => {
      const total = document.querySelector("#pagination .total, .pagination .total");
      return total ? (parseInt(total.textContent.trim(), 10) || 1) : 1;
    });
    logger.info(`[EventScraper] Pagination reports ${totalPages} page(s).`);

    const PAGE_LIMIT = 30;
    let currentPage = 1;
    allEvents.push(...await extractCurrentPage(year));
    logger.info(`[EventScraper] Found ${allEvents.length} events on page 1`);

    while (currentPage < totalPages && currentPage < PAGE_LIMIT) {
      const nextPage = currentPage + 1;

      const clicked = await page.evaluate((np) => {
        const link = document.querySelector(`.pagination-link[data-page="${np}"]`);
        if (link) {
          link.click();
          return true;
        }
        return false;
      }, nextPage);

      if (!clicked) {
        logger.warn(`[EventScraper] Could not find pagination link for page ${nextPage}. Stopping.`);
        break;
      }

      // Wait for the AJAX swap to complete: the ".current" indicator updates to the
      // new page number once #event_results has been re-rendered.
      try {
        await page.waitForFunction((np) => {
          const cur = document.querySelector("#pagination .current, .pagination .current");
          return cur && parseInt(cur.textContent.trim(), 10) === np;
        }, { timeout: 30000 }, nextPage);
      } catch {
        logger.warn(`[EventScraper] Timed out waiting for page ${nextPage} to load; falling back to fixed delay.`);
        await new Promise((resolve) => setTimeout(resolve, 3000));
      }

      currentPage = nextPage;
      const eventsOnPage = await extractCurrentPage(year);
      logger.info(`[EventScraper] Found ${eventsOnPage.length} events on page ${currentPage}`);
      allEvents.push(...eventsOnPage);
    }

    // Parse date strings into proper dates
    const monthNames = {
      "Jan": 0, "Feb": 1, "Mar": 2, "Apr": 3, "May": 4, "Jun": 5,
      "Jul": 6, "Aug": 7, "Sep": 8, "Oct": 9, "Nov": 10, "Dec": 11,
    };

    const parsedEvents = allEvents.map((event) => {
      let eventDate = null;

      if (event.dateStr) {
        let match = event.dateStr.match(/^(\d{1,2})\s+([A-Za-z]{3})$/);
        if (match) {
          const day = parseInt(match[1]);
          const month = monthNames[match[2]];
          if (month !== undefined) {
            eventDate = new Date(year, month, day);
          }
        }

        if (!eventDate) {
          match = event.dateStr.match(/^([A-Za-z]{3})\s+(\d{1,2})$/);
          if (match) {
            const month = monthNames[match[1]];
            const day = parseInt(match[2]);
            if (month !== undefined) {
              eventDate = new Date(year, month, day);
            }
          }
        }
      }

      return {
        eventName: event.eventName,
        date: eventDate ? eventDate.toISOString() : null,
        location: event.location || "Unknown Location",
        url: event.url,
      };
    });

    const seenNames = new Set();
    const validEvents = parsedEvents.filter((event) => {
      if (!event.date || seenNames.has(event.eventName)) return false;
      seenNames.add(event.eventName);
      return true;
    });

    logger.info(`[EventScraper] Successfully scraped ${validEvents.length} unique events for ${year}`);
    return validEvents;

  } catch (error) {
    logger.error("[EventScraper] Error scraping DCI events:", error);
    throw error;
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

/**
 * Callable function to scrape upcoming DCI events
 * Requires admin authentication
 * Memory: 2GB (required for Chromium paging through all event pages)
 * Timeout: 300s (scraping can take time)
 */
const scrapeUpcomingDciEvents = onCall({
  cors: true,
  memory: "2GiB",
  timeoutSeconds: 300,
  region: "us-central1",
}, async (request) => {
  // Require admin authentication
  if (!request.auth || !request.auth.token.admin) {
    throw new HttpsError("permission-denied", "Only admins can trigger event scraping.");
  }

  const year = request.data?.year || new Date().getFullYear();

  try {
    const events = await scrapeUpcomingDciEventsLogic(year);
    return { success: true, events, count: events.length };
  } catch (error) {
    logger.error("scrapeUpcomingDciEvents failed:", error);
    throw new HttpsError("internal", `Scraping failed: ${error.message}`);
  }
});

/**
 * HTTP variant of the scraper for server-to-server invocation from the main
 * functions codebase. Authenticated via the SCRAPER_INVOKE_KEY shared secret.
 * onCall above remains in place for direct admin invocation from the web UI.
 */
const scrapeUpcomingDciEventsHttp = onRequest({
  cors: false,
  memory: "2GiB",
  timeoutSeconds: 300,
  region: "us-central1",
  secrets: [scraperInvokeKey],
}, async (req, res) => {
  if (req.method !== "POST") {
    res.status(405).json({ success: false, error: "Method not allowed" });
    return;
  }

  const providedKey = req.get("x-invoke-key") || "";
  const expectedKey = scraperInvokeKey.value();
  if (!expectedKey) {
    logger.error("SCRAPER_INVOKE_KEY is not configured. Run: firebase functions:secrets:set SCRAPER_INVOKE_KEY");
    res.status(500).json({ success: false, error: "Scraper invoke key not configured" });
    return;
  }
  if (providedKey !== expectedKey) {
    logger.warn("scrapeUpcomingDciEventsHttp called with invalid invoke key");
    res.status(401).json({ success: false, error: "Unauthorized" });
    return;
  }

  const year = Number(req.body?.year) || new Date().getFullYear();
  try {
    const events = await scrapeUpcomingDciEventsLogic(year);
    res.status(200).json({ success: true, events, count: events.length });
  } catch (error) {
    logger.error("scrapeUpcomingDciEventsHttp failed:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = {
  scrapeUpcomingDciEvents,
  scrapeUpcomingDciEventsHttp,
};
