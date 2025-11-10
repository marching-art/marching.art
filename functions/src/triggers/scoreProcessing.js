const { onMessagePublished } = require("firebase-functions/v2/pubsub");
const { logger } = require("firebase-functions/v2");
const { getDb, dataNamespaceParam } = require("../config");
const { queueRecapUrlForScraping } = require("../helpers/scraping");
const puppeteer = require("puppeteer-core");
const chromium = require("@sparticuz/chromium");
const axios = require("axios");
const cheerio = require("cheerio");
const { PubSub } = require("@google-cloud/pubsub");
const { calculateOffSeasonDay } = require("../helpers/season");

let pubsubClient; // Declare globally, initialize lazily

const PAGINATION_TOPIC = "dci-pagination-topic";
const LIVE_SCORES_TOPIC = "live-scores-topic";

exports.processDciScores = onMessagePublished("dci-scores-topic", async (message) => {
  logger.info("Received new historical scores to process.");
  try {
    const payloadBuffer = Buffer.from(message.data.message.data, "base64").toString("utf-8");
    const { eventName, scores, eventLocation, eventDate, year } = JSON.parse(payloadBuffer);

    if (!scores || scores.length === 0 || !year) {
      logger.warn("Payload was missing scores or year. Exiting function.", { eventName, year });
      return;
    }

    const docId = year.toString();
    const yearDocRef = getDb().collection("historical_scores").doc(docId); // This will now work

    const parsedEventDate = new Date(eventDate);
    const offSeasonDay = calculateOffSeasonDay(parsedEventDate, year);

    const newEventData = {
      eventName: eventName,
      date: eventDate,
      location: eventLocation,
      scores: scores,
      headerMap: {},
      offSeasonDay: offSeasonDay,
    };

    await getDb().runTransaction(async (transaction) => { // This will now work
      const yearDoc = await transaction.get(yearDocRef);

      if (!yearDoc.exists) {
        logger.info(`Creating new document for year ${year}.`);
        transaction.set(yearDocRef, { data: [newEventData] });
      } else {
        let existingData = yearDoc.data().data || [];
        const eventIndex = existingData.findIndex((event) =>
          event.eventName === newEventData.eventName &&
          new Date(event.date).getTime() === new Date(newEventData.date).getTime()
        );

        if (eventIndex > -1) {
          logger.info(`Event "${newEventData.eventName}" already exists. Checking for missing scores to merge.`);
          let eventToUpdate = existingData[eventIndex];
          let hasBeenUpdated = false;

          for (const newScore of newEventData.scores) {
            const existingScoreIndex = eventToUpdate.scores.findIndex((s) => s.corps === newScore.corps);

            if (existingScoreIndex === -1) {
              eventToUpdate.scores.push(newScore);
              hasBeenUpdated = true;
              logger.info(`Adding missing corps entry for ${newScore.corps}.`);
            } else {
              let existingScore = eventToUpdate.scores[existingScoreIndex];
              let captionsUpdated = false;
              for (const caption in newScore.captions) {
                if (newScore.captions[caption] > 0 &&
                  (!existingScore.captions[caption] || existingScore.captions[caption] === 0)) {
                  existingScore.captions[caption] = newScore.captions[caption];
                  captionsUpdated = true;
                }
              }
              if (captionsUpdated) {
                hasBeenUpdated = true;
                logger.info(`Updated captions for ${newScore.corps}.`);
              }
            }
          }

          if (hasBeenUpdated) {
            existingData[eventIndex] = eventToUpdate;
            transaction.update(yearDocRef, { data: existingData });
            logger.info(`Successfully merged new scores into event: ${newEventData.eventName}`);
          } else {
            logger.info(`No new scores to merge for event: ${newEventData.eventName}. Skipping.`);
          }
        } else {
          const updatedData = [...existingData, newEventData];
          logger.info(`Appending new event to document for year ${year}. Total events: ${updatedData.length}`);
          transaction.update(yearDocRef, { data: updatedData });
        }
      }
    });

    logger.info(`Successfully processed and archived scores to historical_scores/${docId} with offSeasonDay: ${offSeasonDay}`);
  } catch (error) {
    logger.error("Error processing and archiving historical scores:", error);
  }
});

exports.processLiveScoreRecap = onMessagePublished(LIVE_SCORES_TOPIC, async (message) => {
  logger.info("Received new live score recap to process.");
  const db = getDb(); // This will now work

  try {
    const payloadBuffer = Buffer.from(message.data.message.data, "base64").toString("utf-8");
    const { eventName, scores, eventDate, location } = JSON.parse(payloadBuffer);

    const seasonDoc = await db.doc("game-settings/season").get();
    if (!seasonDoc.exists || seasonDoc.data().status !== "live-season") return;

    const seasonData = seasonDoc.data();
    const activeSeasonId = seasonData.seasonUid;
    const seasonStartDate = seasonData.schedule.startDate.toDate();

    const parsedEventDate = new Date(eventDate);
    const diffInMillis = parsedEventDate.getTime() - seasonStartDate.getTime();
    const eventDay = Math.floor(diffInMillis / (1000 * 60 * 60 * 24)) + 1;

    const batch = db.batch();
    for (const scoreData of scores) {
      const docId = `${scoreData.corps.replace(/ /g, "_")}-${eventDay}`;
      const scoreDocRef = db.doc(`live_scores/${activeSeasonId}/scores/${docId}`);
      batch.set(scoreDocRef, {
        corpsName: scoreData.corps,
        day: eventDay,
        eventName: eventName,
        captions: scoreData.captions,
      });
    }

    // --- USE dataNamespaceParam HERE ---
    const profilesQuery = db.collectionGroup("profile").where("activeSeasonId", "==", activeSeasonId);
    const profilesSnapshot = await profilesQuery.get();
    if (profilesSnapshot.empty) {
      await batch.commit();
      return;
    }

    const showResult = {
      eventName: eventName,
      location: location || "Unknown Location",
      results: [],
    };

    for (const userDoc of profilesSnapshot.docs) {
      const userProfile = userDoc.data();
      const uid = userDoc.ref.parent.parent.id;
      const userCorps = userProfile.corps || {};

      if (userProfile.corpsName && !userCorps.worldClass) {
        userCorps.worldClass = {
          corpsName: userProfile.corpsName,
          lineup: userProfile.lineup,
          selectedShows: userProfile.selectedShows,
          totalSeasonScore: userProfile.totalSeasonScore || 0,
        };
      }

      Object.keys(userCorps).forEach((corpsClass) => {
        const corps = userCorps[corpsClass];
        if (!corps || !corps.corpsName || !corps.lineup) return;

        const userShows = Object.values(corps.selectedShows || {}).flat();
        const attendedShow = userShows.some((s) => s.eventName === eventName);

        if (attendedShow) {
          let geScore = 0, rawVisualScore = 0, rawMusicScore = 0;
          for (const caption in corps.lineup) {
            const [selectedCorps] = corps.lineup[caption].split("|");
            const corpsResult = scores.find((s) => s.corps === selectedCorps);
            if (corpsResult && corpsResult.captions[caption]) {
              const captionScore = corpsResult.captions[caption];
              if (["GE1", "GE2"].includes(caption)) geScore += captionScore;
              else if (["VP", "VA", "CG"].includes(caption)) rawVisualScore += captionScore;
              else if (["B", "MA", "P"].includes(caption)) rawMusicScore += captionScore;
            }
          }

          const visualScore = rawVisualScore / 2;
          const musicScore = rawMusicScore / 2;
          const totalScore = geScore + visualScore + musicScore;

          if (totalScore > 0) {
            batch.update(userDoc.ref, {
              [`corps.${corpsClass}.totalSeasonScore`]: totalScore,
            });
            showResult.results.push({
              uid: uid,
              corpsClass: corpsClass,
              corpsName: corps.corpsName,
              totalScore,
              geScore,
              visualScore,
              musicScore,
            });
          }
        }
      });
    }

    const recapDocRef = db.doc(`fantasy_recaps/${activeSeasonId}`);
    const recapDoc = await recapDocRef.get();
    const dailyRecap = { offSeasonDay: eventDay, date: new Date(), shows: [showResult] };

    if (!recapDoc.exists) {
      batch.set(recapDocRef, { seasonName: seasonData.name, recaps: [dailyRecap] });
    } else {
      const existingRecaps = recapDoc.data().recaps || [];
      const updatedRecaps = existingRecaps.filter((r) => r.offSeasonDay !== eventDay);
      updatedRecaps.push(dailyRecap);
      batch.update(recapDocRef, { recaps: updatedRecaps });
    }

    await batch.commit();
    logger.info(`Processed, scored, and archived recap for live event: ${eventName}.`);
  } catch (error) {
    logger.error("Error processing live score recap:", error);
  }
});

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