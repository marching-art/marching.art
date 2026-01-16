/**
 * Isolated Puppeteer Scraper Functions
 *
 * This codebase is separate from the main functions to:
 * - Reduce cold start time for all other functions (~800ms-1.2s savings)
 * - Allow independent memory allocation (1GB for scraper vs 256MB default)
 * - Keep heavy Chromium/Puppeteer dependencies isolated
 */

const admin = require("firebase-admin");
const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { logger } = require("firebase-functions/v2");

admin.initializeApp();

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

    await page.waitForSelector("a[href*='/events/']", { timeout: 30000 });
    await new Promise((resolve) => setTimeout(resolve, 2000));

    let currentPage = 1;
    let hasMorePages = true;

    while (hasMorePages) {
      logger.info(`[EventScraper] Processing page ${currentPage}...`);

      const eventsOnPage = await page.evaluate((targetYear) => {
        const events = [];
        const eventLinks = document.querySelectorAll("a[href*='/events/']");
        const processedUrls = new Set();

        eventLinks.forEach((link) => {
          const href = link.getAttribute("href");
          if (!href || processedUrls.has(href)) return;

          const yearMatch = href.match(/\/events\/(\d{4})-/);
          if (!yearMatch || parseInt(yearMatch[1]) !== targetYear) return;

          processedUrls.add(href);

          const card = link.closest("article") || link.closest("div[class*='event']") || link.parentElement;
          if (!card) return;

          let eventName = "";
          const img = card.querySelector("img[alt*='Image of']");
          if (img) {
            eventName = img.alt.replace("Image of ", "").trim();
          } else {
            const heading = card.querySelector("h1, h2, h3, h4");
            eventName = heading ? heading.textContent.trim() : link.textContent.trim();
          }

          let dateStr = "";
          const dateElements = card.querySelectorAll("span, p, div");
          for (const el of dateElements) {
            const text = el.textContent.trim();
            if (/^\d{1,2}\s+[A-Za-z]{3}$/.test(text) || /^[A-Za-z]{3}\s+\d{1,2}$/.test(text)) {
              dateStr = text;
              break;
            }
          }

          let location = "";
          for (const el of dateElements) {
            const text = el.textContent.trim();
            if (/^[A-Za-z\s]+,\s*[A-Z]{2}$/.test(text)) {
              location = text;
              break;
            }
          }

          if (eventName) {
            events.push({ eventName, dateStr, location, url: href });
          }
        });

        return events;
      }, year);

      logger.info(`[EventScraper] Found ${eventsOnPage.length} events on page ${currentPage}`);
      allEvents.push(...eventsOnPage);

      const hasNextButton = await page.evaluate(() => {
        const paginationText = document.body.innerText;
        const match = paginationText.match(/(\d+)\s+from\s+(\d+)/);
        if (match) {
          const current = parseInt(match[1]);
          const total = parseInt(match[2]);
          return current < total;
        }
        return false;
      });

      if (hasNextButton) {
        const nextClicked = await page.evaluate(() => {
          const nextBtn = document.querySelector("a.next, button.next, [aria-label='Next'], .pagination-next");
          if (nextBtn) {
            nextBtn.click();
            return true;
          }
          const paginationLinks = document.querySelectorAll(".pagination a, nav[aria-label*='pagination'] a");
          for (const link of paginationLinks) {
            if (link.textContent.trim() === String(parseInt(document.querySelector(".current, .active")?.textContent || "1") + 1)) {
              link.click();
              return true;
            }
          }
          return false;
        });

        if (nextClicked) {
          currentPage++;
          await new Promise((resolve) => setTimeout(resolve, 3000));
        } else {
          hasMorePages = false;
        }
      } else {
        hasMorePages = false;
      }

      if (currentPage > 20) {
        logger.warn("[EventScraper] Reached page limit (20), stopping pagination.");
        hasMorePages = false;
      }
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
 * Memory: 1GB (required for Chromium)
 * Timeout: 300s (scraping can take time)
 */
const scrapeUpcomingDciEvents = onCall({
  cors: true,
  memory: "1GiB",
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

module.exports = {
  scrapeUpcomingDciEvents,
};
