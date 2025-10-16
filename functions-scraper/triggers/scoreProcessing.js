const { onMessagePublished } = require("firebase-functions/v2/pubsub");
const { logger } = require("firebase-functions/v2");
const { queueRecapUrlForScraping } = require("../helpers/scraping");
const puppeteer = require("puppeteer-core");
const chromium = require("@sparticuz/chromium");
const axios = require("axios");
const cheerio = require("cheerio");
const { PubSub } = require("@google-cloud/pubsub");

let pubsubClient; // Declare globally, initialize lazily

const PAGINATION_TOPIC = "dci-pagination-topic";

exports.processPaginationPage = onMessagePublished({
  topic: PAGINATION_TOPIC,
  memory: "2GiB",
  timeoutSeconds: 540,
}, async (message) => {
  // Lazy initialize the client
  if (!pubsubClient) {
    pubsubClient = new PubSub();
  }

  const payloadBuffer = Buffer.from(message.data.message.data, "base64").toString("utf-8");
  const { pageno } = JSON.parse(payloadBuffer);
  const baseUrl = "https://www.dci.org";
  const currentUrl = `${baseUrl}/scores?pageno=${pageno}`;
  logger.info(`[Paginator] Processing page: ${currentUrl}`);

  let browser = null;
  try {
    browser = await puppeteer.launch({
      args: chromium.args,
      defaultViewport: chromium.defaultViewport,
      executablePath: await chromium.executablePath(),
      headless: chromium.headless,
      ignoreHTTPSErrors: true,
    });
    const page = await browser.newPage();
    await page.goto(currentUrl, { waitUntil: "domcontentloaded", timeout: 60000 });

    const finalScoresSelector = "a.arrow-btn[href*=\"/scores/final-scores/\"]";
    const linksOnPage = await page.$$eval(finalScoresSelector, (anchors) => anchors.map((a) => a.href));

    if (linksOnPage.length === 0) {
      logger.info(`[Paginator] Found no more 'final-scores' links on pageno=${pageno}. Ending discovery chain.`);
      return;
    }

    logger.info(`[Paginator] Found ${linksOnPage.length} 'final-scores' links. Queueing them for recap search.`);

    for (const finalScoresUrl of linksOnPage) {
      try {
        const { data } = await axios.get(finalScoresUrl, { timeout: 15000 });
        const $ = cheerio.load(data);

        $("a.arrow-btn[href*=\"/scores/recap/\"]").each((_idx, el) => {
          const recapLink = $(el).attr("href");
          if (recapLink) {
            const fullUrl = new URL(recapLink, baseUrl).href;
            queueRecapUrlForScraping(fullUrl);
          }
        });
      } catch (error) {
        logger.warn(`[Paginator] Could not process ${finalScoresUrl}. Skipping. Message: ${error.message}`);
      }
    }
    
    const nextDataBuffer = Buffer.from(JSON.stringify({ pageno: pageno + 1 }));
    await pubsubClient.topic(PAGINATION_TOPIC).publishMessage({ data: nextDataBuffer });
  } catch (error) {
    logger.error(`[Paginator] Failed to process page ${pageno}:`, error);
  } finally {
    if (browser) {
      await browser.close();
    }
  }
});