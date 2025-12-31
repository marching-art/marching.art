const { onCall, HttpsError, onRequest } = require("firebase-functions/v2/https");
const { logger } = require("firebase-functions/v2");
const { PubSub } = require("@google-cloud/pubsub");
const { CloudTasksClient } = require("@google-cloud/tasks");
const axios = require("axios");
const cheerio = require("cheerio");
const puppeteer = require("puppeteer-core");
const chromium = require("@sparticuz/chromium");

// Declare clients in the global scope but do not initialize them.
let pubsubClient;
let tasksClient;

const PAGINATION_TOPIC = "dci-pagination-topic";

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
      return;
    }

    const payload = { scores: scoresData, eventName, eventLocation, eventDate: eventDate.toISOString(), year };
    const dataBuffer = Buffer.from(JSON.stringify(payload));
    await pubsubClient.topic(topic).publishMessage({ data: dataBuffer });
    logger.info(`Successfully published ${scoresData.length} corps scores from ${eventName}.`);
  } catch (error) {
    logger.error(`[scrapeDciScoresLogic] CRITICAL ERROR for URL ${urlToScrape}:`, error);
  }
}

async function queueRecapUrlForScraping(url) {
  // Lazy initialize the client
  if (!tasksClient) {
    tasksClient = new CloudTasksClient();
  }

  try {
    const project = process.env.GCLOUD_PROJECT;
    const location = "us-central1";
    const queue = "recap-scraper-queue";
    const workerUrl = `https://us-central1-${project}.cloudfunctions.net/scrapeSingleRecap`;
    const queuePath = tasksClient.queuePath(project, location, queue);

    const task = {
      httpRequest: {
        httpMethod: "POST",
        url: workerUrl,
        body: Buffer.from(JSON.stringify({ url })).toString("base64"),
        headers: { "Content-Type": "application/json" },
      },
    };

    await tasksClient.createTask({ parent: queuePath, task: task });
    logger.info(`[Queuer] Successfully queued task for URL: ${url}`);
  } catch (error) {
    logger.error(`[Queuer] Failed to queue task for URL: ${url}`, error);
  }
}

const testScraper = onCall({ cors: true }, async (request) => {
  if (!request.auth || !request.auth.token.admin) {
    throw new HttpsError("permission-denied", "You must be an admin to perform this action.");
  }

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

const discoverAndQueueUrls = onCall({ cors: true }, async (request) => {
  if (!request.auth || !request.auth.token.admin) {
    throw new HttpsError("permission-denied", "You must be an admin to perform this action.");
  }
  // Lazy initialize the client
  if (!pubsubClient) {
    pubsubClient = new PubSub();
  }

  logger.info("Kicking off asynchronous discovery process...");

  const dataBuffer = Buffer.from(JSON.stringify({ pageno: 1 }));
  await pubsubClient.topic(PAGINATION_TOPIC).publishMessage({ data: dataBuffer });

  return { success: true, message: "Asynchronous scraper process initiated. See logs for progress." };
});

const scrapeSingleRecap = onRequest({ cors: true }, async (req, res) => {
  try {
    const { url } = req.body;
    if (!url) {
      logger.error("Worker received a task with no URL.");
      res.status(400).send("Bad Request: Missing URL in payload.");
      return;
    }

    await scrapeDciScoresLogic(url);
    res.status(200).send("Successfully processed recap URL.");
  } catch (error) {
    logger.error(`Worker failed to process URL: ${req.body.url}`, error);
    res.status(500).send("Internal Server Error");
  }
});

/**
 * Scrapes upcoming DCI events from dci.org/events/
 * Uses Puppeteer because the page loads content via AJAX
 * @param {number} year - The year to filter events for (defaults to current year)
 * @returns {Promise<Array>} Array of event objects with eventName, date, location
 */
async function scrapeUpcomingDciEvents(year = new Date().getFullYear()) {
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

    // Set a reasonable timeout
    page.setDefaultTimeout(60000);

    // Navigate to the events page
    const eventsUrl = "https://www.dci.org/events/";
    logger.info(`[EventScraper] Navigating to ${eventsUrl}`);
    await page.goto(eventsUrl, { waitUntil: "networkidle2", timeout: 60000 });

    // Wait for event cards to load (they load via AJAX)
    await page.waitForSelector("a[href*='/events/']", { timeout: 30000 });

    // Give extra time for all events to load
    await new Promise((resolve) => setTimeout(resolve, 2000));

    let currentPage = 1;
    let hasMorePages = true;

    while (hasMorePages) {
      logger.info(`[EventScraper] Processing page ${currentPage}...`);

      // Extract events from the current page
      const eventsOnPage = await page.evaluate((targetYear) => {
        const events = [];

        // Find all event links - they follow pattern /events/YYYY-event-name/
        const eventLinks = document.querySelectorAll("a[href*='/events/']");
        const processedUrls = new Set();

        eventLinks.forEach((link) => {
          const href = link.getAttribute("href");
          if (!href || processedUrls.has(href)) return;

          // Filter for current year events (URL pattern: /events/YYYY-...)
          const yearMatch = href.match(/\/events\/(\d{4})-/);
          if (!yearMatch || parseInt(yearMatch[1]) !== targetYear) return;

          processedUrls.add(href);

          // Try to find event details - look for the event card container
          const card = link.closest("article") || link.closest("div[class*='event']") || link.parentElement;
          if (!card) return;

          // Extract event name from image alt text or link text
          let eventName = "";
          const img = card.querySelector("img[alt*='Image of']");
          if (img) {
            eventName = img.alt.replace("Image of ", "").trim();
          } else {
            // Try to get from heading or link text
            const heading = card.querySelector("h1, h2, h3, h4");
            eventName = heading ? heading.textContent.trim() : link.textContent.trim();
          }

          // Extract date - look for date text (format: "26 Jun" or similar)
          let dateStr = "";
          const dateElements = card.querySelectorAll("span, p, div");
          for (const el of dateElements) {
            const text = el.textContent.trim();
            // Match patterns like "26 Jun", "Jul 4", etc.
            if (/^\d{1,2}\s+[A-Za-z]{3}$/.test(text) || /^[A-Za-z]{3}\s+\d{1,2}$/.test(text)) {
              dateStr = text;
              break;
            }
          }

          // Extract location - look for location text (format: "City, ST")
          let location = "";
          for (const el of dateElements) {
            const text = el.textContent.trim();
            // Match patterns like "Muncie, IN", "San Antonio, TX"
            if (/^[A-Za-z\s]+,\s*[A-Z]{2}$/.test(text)) {
              location = text;
              break;
            }
          }

          if (eventName) {
            events.push({
              eventName,
              dateStr,
              location,
              url: href,
            });
          }
        });

        return events;
      }, year);

      logger.info(`[EventScraper] Found ${eventsOnPage.length} events on page ${currentPage}`);
      allEvents.push(...eventsOnPage);

      // Check for pagination and try to go to next page
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
        // Try to click the next page button
        const nextClicked = await page.evaluate(() => {
          const nextBtn = document.querySelector("a.next, button.next, [aria-label='Next'], .pagination-next");
          if (nextBtn) {
            nextBtn.click();
            return true;
          }
          // Try finding a numbered pagination link
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
          // Wait for new content to load
          await new Promise((resolve) => setTimeout(resolve, 3000));
        } else {
          hasMorePages = false;
        }
      } else {
        hasMorePages = false;
      }

      // Safety limit to prevent infinite loops
      if (currentPage > 20) {
        logger.warn("[EventScraper] Reached page limit (20), stopping pagination.");
        hasMorePages = false;
      }
    }

    // Parse date strings into proper dates
    const parsedEvents = allEvents.map((event) => {
      let eventDate = null;

      if (event.dateStr) {
        // Parse date string like "26 Jun" or "Jul 4"
        const monthNames = {
          "Jan": 0, "Feb": 1, "Mar": 2, "Apr": 3, "May": 4, "Jun": 5,
          "Jul": 6, "Aug": 7, "Sep": 8, "Oct": 9, "Nov": 10, "Dec": 11,
        };

        // Try "26 Jun" format
        let match = event.dateStr.match(/^(\d{1,2})\s+([A-Za-z]{3})$/);
        if (match) {
          const day = parseInt(match[1]);
          const month = monthNames[match[2]];
          if (month !== undefined) {
            eventDate = new Date(year, month, day);
          }
        }

        // Try "Jun 26" format
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

    // Filter out events without valid dates and deduplicate by event name
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

module.exports = {
  scrapeDciScoresLogic,
  queueRecapUrlForScraping,
  testScraper,
  discoverAndQueueUrls,
  scrapeSingleRecap,
  scrapeUpcomingDciEvents,
};
