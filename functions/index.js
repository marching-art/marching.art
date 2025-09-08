const { onCall, HttpsError, onRequest } = require("firebase-functions/v2/https");
const { logger } = require("firebase-functions/v2");
const { onSchedule } = require("firebase-functions/v2/scheduler");
const { onMessagePublished } = require("firebase-functions/v2/pubsub");
const { PubSub } = require("@google-cloud/pubsub");
const { CloudTasksClient } = require("@google-cloud/tasks");
const axios = require("axios");
const cheerio = require("cheerio");
const { getDb, appId } = require("./_config"); // UPDATED IMPORT
const puppeteer = require('puppeteer-core');
const chromium = require('@sparticuz/chromium');

const pubsubClient = new PubSub();
const tasksClient = new CloudTasksClient();
const PAGINATION_TOPIC = "dci-pagination-topic";

// ================================================================= //
//                      EXPORTED CLOUD FUNCTIONS                     //
// ================================================================= //

exports.helloWorld = onRequest({ cors: true }, (req, res) => {
    logger.info("Hello Logs!", { structuredData: true });
    res.send("Hello from Firebase! Check your Cloud Function logs.");
});

exports.setUserRole = onCall({ cors: true }, async (request) => {
    if (!request.auth || !request.auth.token.admin) {
        throw new HttpsError("permission-denied", "You must be an admin to perform this action.");
    }
    const { email, makeAdmin } = request.data;
    logger.info(`Admin ${request.auth.uid} attempting to set role for ${email} to admin: ${makeAdmin}`);
    // TODO: Add logic to set custom claims using the Firebase Admin Auth SDK.
    // Example: await getAuth().setCustomUserClaims(user.uid, { admin: makeAdmin });
    return { success: true, message: `Role change for ${email} processed.` };
});

exports.startNewOffSeason = onCall({ cors: true }, async (request) => {
    if (!request.auth || !request.auth.token.admin) {
        throw new HttpsError("permission-denied", "You must be an admin to perform this action.");
    }
    try {
        logger.info(`Manual override triggered by admin: ${request.auth.uid}. Starting new off-season.`);
        await startNewOffSeason();
        return { success: true, message: "A new off-season has been started successfully." };
    } catch (error) {
        logger.error("Error manually starting new off-season:", error);
        throw new HttpsError("internal", "An error occurred while starting the season.");
    }
});

exports.validateAndSaveLineup = onCall({ cors: true }, async (request) => {
    if (!request.auth) {
        throw new HttpsError("unauthenticated", "You must be logged in to save a lineup.");
    }
    const { lineup, corpsName } = request.data;
    const uid = request.auth.uid;
    
    logger.info(`[validateAndSaveLineup] Firing for user: ${uid}`);
    
    if (!lineup || Object.keys(lineup).length !== 8) {
        throw new HttpsError("invalid-argument", "A complete 8-caption lineup is required.");
    }

    const lineupValues = Object.values(lineup).sort();
    const lineupKey = lineupValues.join("_");
    
    const seasonSettingsRef = getDb().doc("game-settings/season");
    const seasonDoc = await seasonSettingsRef.get();
    if (!seasonDoc.exists || seasonDoc.data().status === "inactive") {
        throw new HttpsError("failed-precondition", "There is no active season.");
    }
    const activeSeasonId = seasonDoc.id;

    try {
        await getDb().runTransaction(async (transaction) => {
            const userProfileRef = getDb().doc(`artifacts/${appId}/users/${uid}/profile/data`);
            const userProfileDoc = await transaction.get(userProfileRef);
            if (!userProfileDoc.exists) {
                throw new HttpsError("not-found", "User profile does not exist.");
            }

            const newActiveLineupRef = getDb().collection("activeLineups").doc(lineupKey);
            const existingLineupDoc = await transaction.get(newActiveLineupRef);

            if (existingLineupDoc.exists && existingLineupDoc.data().uid !== uid) {
                throw new HttpsError("already-exists", "This exact lineup has already been claimed by another user.");
            }

            const oldLineupKey = userProfileDoc.data().lineupKey;
            if (oldLineupKey && oldLineupKey !== lineupKey) {
                const oldActiveLineupRef = getDb().collection("activeLineups").doc(oldLineupKey);
                transaction.delete(oldActiveLineupRef);
            }
            
            transaction.set(newActiveLineupRef, { uid: uid, seasonId: activeSeasonId });
            
            const profileUpdateData = {
                lineup: lineup,
                lineupKey: lineupKey,
                activeSeasonId: activeSeasonId,
                corpsName: corpsName,
            };

            transaction.update(userProfileRef, profileUpdateData);
        });
        return { success: true, message: "Lineup saved successfully!" };
    } catch (error) {
        logger.error(`[validateAndSaveLineup] Transaction FAILED for user ${uid}:`, error);
        if (error instanceof HttpsError) throw error;
        throw new HttpsError("internal", "An error occurred while saving your lineup.");
    }
});

exports.testScraper = onCall({ cors: true }, async (request) => {
    if (!request.auth || !request.auth.token.admin) {
        throw new HttpsError("permission-denied", "You must be an admin to perform this action.");
    }
    try {
        // Define a single, known-good URL for manual testing
        const testUrl = 'https://www.dci.org/scores/recap/2023-dci-world-championships-finals';
        
        // Pass the URL to the logic function
        await scrapeDciScoresLogic(testUrl);

        return { success: true, message: `Scraper test triggered for ${testUrl}. Check logs for output.` };
    } catch (error) {
        logger.error("Error manually triggering scraper:", error);
        throw new HttpsError("internal", "An error occurred while triggering the scraper test.");
    }
});

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
        const yearDocRef = getDb().collection('historical_scores').doc(docId);
        
        // --- NEW: Calculate offSeasonDay using our helper function ---
        const parsedEventDate = new Date(eventDate);
        const offSeasonDay = calculateOffSeasonDay(parsedEventDate, year);

        const newEventData = {
            eventName: eventName,
            date: eventDate,
            location: eventLocation,
            scores: scores,
            headerMap: {},
            offSeasonDay: offSeasonDay // Use the calculated value here
        };

        await getDb().runTransaction(async (transaction) => {
            const yearDoc = await transaction.get(yearDocRef);

            if (!yearDoc.exists) {
                logger.info(`Creating new document for year ${year}.`);
                transaction.set(yearDocRef, { data: [newEventData] });
            } else {
                const existingData = yearDoc.data().data || [];

                const eventExists = existingData.some(event => 
                    event.eventName === newEventData.eventName && new Date(event.date).getTime() === new Date(newEventData.date).getTime()
                );

                if (eventExists) {
                    logger.warn(`Event "${newEventData.eventName}" on ${newEventData.date} already exists for year ${year}. Skipping.`);
                    return;
                }

                const updatedData = [...existingData, newEventData];
                logger.info(`Appending new event to document for year ${year}. Total events: ${updatedData.length}`);
                transaction.update(yearDocRef, { data: updatedData });
            }
        });

        logger.info(`Successfully processed and archived scores to historical_scores/${docId} with offSeasonDay: ${offSeasonDay}`);

    } catch (error) {
        logger.error("Error processing and archiving historical scores:", error);
    }
});

exports.scrapeDciScores = onSchedule({
    schedule: "*/30 19-23 * 7,8 6",
    timeZone: "America/New_York",
}, async (_context) => {
    await scrapeDciScoresLogic();
});

exports.seasonScheduler = onSchedule({
    schedule: "every day 03:00",
    timeZone: "America/New_York",
}, async (_context) => {
    logger.info("Running daily season scheduler...");
    const now = new Date();

    const seasonSettingsRef = getDb().doc("game-settings/season");
    const seasonDoc = await seasonSettingsRef.get();

    if (!seasonDoc.exists) {
        logger.info("No season document found. Starting first off-season.");
        await startNewOffSeason();
        return;
    }

    const seasonData = seasonDoc.data();
    if (!seasonData.schedule || !seasonData.schedule.endDate) {
        logger.warn("Season doc is malformed. Starting new off-season to correct.");
        await startNewOffSeason();
        return;
    }
    
    const seasonEndDate = seasonData.schedule.endDate.toDate();

    if (now < seasonEndDate) {
        logger.info(`Current season (${seasonData.name}) is active. No action taken.`);
        return;
    }

    logger.info(`Season ${seasonData.name} has ended. Starting next season.`);

    const today = new Date();
    const currentYear = today.getFullYear();
    const liveSeasonStartDate = new Date(currentYear, 5, 15);

    if (seasonData.status === "off-season" && today >= liveSeasonStartDate) {
        logger.info("It's time for the live season! Starting now.");
        await startNewLiveSeason();
    } else {
        logger.info("Starting a new off-season.");
        await startNewOffSeason();
    }
});


// ================================================================= //
//                      INTERNAL HELPER LOGIC                        //
// ================================================================= //

async function scrapeDciScoresLogic(urlToScrape) {
    logger.info(`[scrapeDciScoresLogic] Starting for URL: ${urlToScrape}`);
    if (!urlToScrape) {
        logger.error("[scrapeDciScoresLogic] Critical error: No URL provided.");
        throw new Error("A URL is required to scrape.");
    }
    
    try {
        const { data } = await axios.get(urlToScrape);
        const $ = cheerio.load(data);
        const scoresData = [];

        // --- FINALIZED SELECTORS FOR METADATA ---
        const eventName = $('h1.elementor-heading-title').first().text().trim() || "Unknown DCI Event";
        const dateLocationDiv = $('div.score-date-location').first();
        const dateText = dateLocationDiv.find('p').eq(0).text().trim();
        const locationText = dateLocationDiv.find('p').eq(1).text().trim();

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
        
        logger.info(`PARSED DATA --> Name: '${eventName}', Date: '${eventDate.toISOString()}', Location: '${eventLocation}', Year: '${year}'`);
        
        // --- ★ NEW DYNAMIC CAPTION SCRAPING LOGIC ★ ---
        $("table#effect-table-0 > tbody > tr").not(".table-top").each((i, row) => {
            const corpsName = $(row).find("td.sticky-td").first().text().trim();
            if (!corpsName) return;

            const totalScore = parseFloat($(row).find("td.data-total").last().find("span").first().text().trim());

            // Object to hold all found scores for this corps
            const captions = { GE1: 0, GE2: 0, VP: 0, VA: 0, CG: 0, B: 0, MA: 0, P: 0 };
            
            const tempScores = {
                "General Effect 1": [],
                "General Effect 2": [],
                "Visual Proficiency": [],
                "Visual - Analysis": [],
                "Color Guard": [],
                "Music - Brass": [],
                "Music - Analysis": [],
                "Music - Percussion": [],
            };

            // Find all GE scores
            const geScores = $(row).find('td').eq(1).find('table.data');
            if (geScores.length >= 2) {
                tempScores["General Effect 1"].push(parseFloat(geScores.eq(0).find('td').eq(2).text().trim()));
                tempScores["General Effect 1"].push(parseFloat(geScores.eq(1).find('td').eq(2).text().trim()));
            }
            if (geScores.length >= 4) {
                 tempScores["General Effect 2"].push(parseFloat(geScores.eq(2).find('td').eq(2).text().trim()));
                 tempScores["General Effect 2"].push(parseFloat(geScores.eq(3).find('td').eq(2).text().trim()));
            }

            // Find all Visual scores
            const visualScores = $(row).find('td').eq(2).find('table.data');
            if (visualScores.length >= 1) tempScores["Visual Proficiency"].push(parseFloat(visualScores.eq(0).find('td').eq(2).text().trim()));
            if (visualScores.length >= 2) tempScores["Visual - Analysis"].push(parseFloat(visualScores.eq(1).find('td').eq(2).text().trim()));
            if (visualScores.length >= 3) tempScores["Color Guard"].push(parseFloat(visualScores.eq(2).find('td').eq(2).text().trim()));
           
            // Find all Music scores
            const musicScores = $(row).find('td').eq(3).find('table.data');
            if (musicScores.length >= 1) tempScores["Music - Brass"].push(parseFloat(musicScores.eq(0).find('td').eq(2).text().trim()));
            if (musicScores.length >= 3) { // MA has two judges
                tempScores["Music - Analysis"].push(parseFloat(musicScores.eq(1).find('td').eq(2).text().trim()));
                tempScores["Music - Analysis"].push(parseFloat(musicScores.eq(2).find('td').eq(2).text().trim()));
            }
            if (musicScores.length >= 4) tempScores["Music - Percussion"].push(parseFloat(musicScores.eq(3).find('td').eq(2).text().trim()));
            
            // --- Process and Average the collected scores ---
            const processCaption = (captionName) => {
                const scores = tempScores[captionName].filter(s => !isNaN(s)); // Filter out any NaN values
                if (!scores || scores.length === 0) return 0;
                if (scores.length === 1) return scores[0];
                const sum = scores.reduce((a, b) => a + b, 0);
                return parseFloat((sum / scores.length).toFixed(3));
            };

            captions.GE1 = processCaption("General Effect 1");
            captions.GE2 = processCaption("General Effect 2");
            captions.VP = processCaption("Visual Proficiency");
            captions.VA = processCaption("Visual - Analysis");
            captions.CG = processCaption("Color Guard");
            captions.B = processCaption("Music - Brass");
            captions.MA = processCaption("Music - Analysis");
            captions.P = processCaption("Music - Percussion");

            const scoreObject = { corps: corpsName, score: totalScore, captions: captions };
            scoresData.push(scoreObject);
        });

        if (scoresData.length === 0) {
            logger.warn(`No scores found on ${urlToScrape}.`);
            return;
        }

        const payload = { scores: scoresData, eventName, eventLocation, eventDate: eventDate.toISOString(), year };
        const dataBuffer = Buffer.from(JSON.stringify(payload));
        await pubsubClient.topic("dci-scores-topic").publishMessage({ data: dataBuffer });
        logger.info(`Successfully published ${scoresData.length} corps scores from ${eventName}.`);

    } catch (error) {
        logger.error(`[scrapeDciScoresLogic] CRITICAL ERROR for URL ${urlToScrape}:`, error);
    }
}

async function startNewLiveSeason() {
    logger.info("Generating new live season...");
    const today = new Date();
    const year = today.getFullYear();

    const augustFirst = new Date(year, 7, 1);
    const dayOfWeek = augustFirst.getDay();
    const daysToAdd = dayOfWeek === 6 ? 0 : 6 - dayOfWeek;
    const firstSaturday = new Date(augustFirst.getTime() + daysToAdd * 24 * 60 * 60 * 1000);
    const finalsDate = new Date(firstSaturday.getTime() + 7 * 24 * 60 * 60 * 1000);
    const startDate = new Date(finalsDate.getTime() - 70 * 24 * 60 * 60 * 1000);

    const newSeasonData = {
        name: `DCI ${year} Live Season`,
        status: "live-season",
        seasonYear: year,
        currentPointCap: 150,
        schedule: {
            startDate: startDate,
            endDate: finalsDate,
            openTradeEndDate: new Date(`${year}-07-01T23:59:59-04:00`),
            quartersDate: new Date(new Date(finalsDate).setDate(finalsDate.getDate() - 2)),
            semifinalsDate: new Date(new Date(finalsDate).setDate(finalsDate.getDate() - 1)),
            finalsDate: finalsDate,
        },
    };
    
    // TODO: Generate corpsData for the live season from final_rankings.
    await getDb().doc("game-settings/season").set(newSeasonData);
    logger.info(`Successfully started the ${newSeasonData.name}.`);
}

async function startNewOffSeason() {
    logger.info("Generating new off-season...");

    const rankingsQuery = getDb().collection("final_rankings").orderBy("__name__", "desc").limit(1);
    
    const rankingsSnapshot = await rankingsQuery.get();
    if (rankingsSnapshot.empty) {
        throw new Error("Cannot start off-season: No final rankings found in the database.");
    }
    const latestRankingsDoc = rankingsSnapshot.docs[0];
    const sourceCorps = latestRankingsDoc.data().data;
    const sourceYear = latestRankingsDoc.id;

    logger.info(`Using final rankings from ${sourceYear} as the source.`);
    const shuffledCorps = shuffleArray(sourceCorps.slice(0, 25));

    const pointValues = [25, 24, 23, 22, 21, 20, 19, 18, 17, 16, 15, 14, 13, 12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1];
    const offSeasonCorpsData = shuffledCorps.map((item, index) => ({
        corpsName: item.corps,
        points: pointValues[index] || 1,
    }));

    const startDate = new Date();
    const seasonName = `Off-Season ${startDate.toLocaleString("default", { month: "long" })} ${startDate.getFullYear()}`;
    const dataDocId = `off-season-${startDate.getFullYear()}-${startDate.getMonth() + 1}`;
    
    await getDb().doc(`dci-data/${dataDocId}`).set({
        corpsValues: offSeasonCorpsData,
        source: `Shuffled from ${sourceYear} rankings`,
        createdAt: startDate,
    });
    logger.info(`Saved new corps data to dci-data/${dataDocId}`);

    const endDate = new Date(startDate.getTime() + 49 * 24 * 60 * 60 * 1000); // 49 days = 7 weeks
    const newSeasonSettings = {
        name: seasonName,
        status: "off-season",
        currentPointCap: 150,
        dataDocId: dataDocId,
        schedule: {
            startDate: startDate,
            endDate: endDate,
        },
    };

    await getDb().doc("game-settings/season").set(newSeasonSettings);
    logger.info(`Successfully started the ${seasonName}.`);
}

function shuffleArray(array) {
    let currentIndex = array.length, randomIndex;
    while (currentIndex !== 0) {
        randomIndex = Math.floor(Math.random() * currentIndex);
        currentIndex--;
        [array[currentIndex], array[randomIndex]] = [array[randomIndex], array[currentIndex]];
    }
    return array;
}

/**
 * Calculates the off-season day (1-49) for a given event date.
 * Day 49 is defined as the second Saturday in August of the event's year.
 * @param {Date} eventDate The date of the drum corps event.
 * @param {number} year The four-digit year of the event.
 * @return {number|null} The off-season day (1-49) or null if outside the season.
 */
function calculateOffSeasonDay(eventDate, year) {
    if (!eventDate || isNaN(eventDate.getTime())) {
        return null; // Cannot calculate without a valid date
    }

    // --- Step 1: Find the second Saturday in August for the given year ---
    const firstOfAugust = new Date(Date.UTC(year, 7, 1)); // Month is 0-indexed, 7 = August
    const dayOfWeek = firstOfAugust.getUTCDay(); // 0=Sunday, 6=Saturday

    // Days to add to the 1st to get to the first Saturday
    const daysUntilFirstSaturday = (6 - dayOfWeek + 7) % 7;
    const firstSaturdayDate = 1 + daysUntilFirstSaturday;
    
    // The second Saturday is 7 days after the first one
    const finalsDateUTC = new Date(Date.UTC(year, 7, firstSaturdayDate + 7));

    // --- Step 2: Determine the 49-day season window ---
    const seasonEndDate = new Date(finalsDateUTC);
    const seasonStartDate = new Date(finalsDateUTC.getTime() - 48 * 24 * 60 * 60 * 1000);

    // --- Step 3: Check if the event is within the window ---
    // Normalize eventDate to UTC start of day for accurate comparison
    const eventDateUTC = new Date(Date.UTC(eventDate.getUTCFullYear(), eventDate.getUTCMonth(), eventDate.getUTCDate()));
    
    if (eventDateUTC < seasonStartDate || eventDateUTC > seasonEndDate) {
        return null; // Event is outside the 49-day off-season window
    }

    // --- Step 4: Calculate the specific off-season day ---
    const diffInMillis = eventDateUTC.getTime() - seasonStartDate.getTime();
    const diffInDays = Math.round(diffInMillis / (1000 * 60 * 60 * 24));
    
    return diffInDays + 1; // Return the day number (1 to 49)
}

// ================================================================= //
//                      NEW CRAWLER & WORKER FUNCTIONS               //
// ================================================================= //

/**
 * The CRAWLER: An onCall function that finds all recap URLs on the main DCI scores
 * page and adds them as tasks to a Cloud Tasks queue.
 */
// In functions/index.js, replace the entire discoverAndQueueUrls function

exports.discoverAndQueueUrls = onCall({ cors: true }, async (request) => {
    if (!request.auth || !request.auth.token.admin) {
        throw new HttpsError("permission-denied", "You must be an admin to perform this action.");
    }

    logger.info("Kicking off asynchronous discovery process...");
    
    // Publish the first page number to the pagination topic to start the chain.
    const dataBuffer = Buffer.from(JSON.stringify({ pageno: 1 }));
    await pubsubClient.topic(PAGINATION_TOPIC).publishMessage({ data: dataBuffer });

    return { success: true, message: "Asynchronous scraper process initiated. See logs for progress." };
});

/**
 * The WORKER: An HTTP-triggered function that receives a URL from the Cloud Tasks
 * queue, scrapes it, and publishes the results to Pub/Sub.
 */
exports.scrapeSingleRecap = onRequest({ cors: true }, async (req, res) => {
    // The v2 onRequest wrapper handles body parsing, so req.body is already an object.
    try {
        const { url } = req.body;
        if (!url) {
            logger.error("Worker received a task with no URL.");
            res.status(400).send("Bad Request: Missing URL in payload.");
            return;
        }

        // We reuse our existing scraping logic!
        await scrapeDciScoresLogic(url);

        // Acknowledge the task was successful
        res.status(200).send("Successfully processed recap URL.");
    } catch (error) {
        logger.error(`Worker failed to process URL: ${req.body.url}`, error);
        // Tell Cloud Tasks the task failed so it can be retried
        res.status(500).send("Internal Server Error");
    }
});

exports.processPaginationPage = onMessagePublished({
    topic: PAGINATION_TOPIC,
    memory: '2GiB',
    timeoutSeconds: 540,
}, async (message) => {
    // --- FIX STARTS HERE ---
    // Manually decode the Base64 payload and parse it as JSON.
    const payloadBuffer = Buffer.from(message.data.message.data, 'base64').toString('utf-8');
    const { pageno } = JSON.parse(payloadBuffer);
    // --- FIX ENDS HERE ---

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
        await page.goto(currentUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });
        
        const linksOnPage = await page.$$eval('a.arrow-btn[href*="/scores/final-scores/"]', anchors => anchors.map(a => a.href));
        
        if (linksOnPage.length === 0) {
            logger.info(`[Paginator] Found no more 'final-scores' links on pageno=${pageno}. Ending discovery chain.`);
            return;
        }

        logger.info(`[Paginator] Found ${linksOnPage.length} 'final-scores' links. Queueing them for recap search.`);
        
        // Use Axios to quickly find recap links on each final-scores page
        for (const finalScoresUrl of linksOnPage) {
            try {
                const { data } = await axios.get(finalScoresUrl, { timeout: 15000 });
                const $ = cheerio.load(data);
                
                $('a.arrow-btn[href*="/scores/recap/"]').each((_idx, el) => {
                    const recapLink = $(el).attr('href');
                    if (recapLink) {
                        const fullUrl = new URL(recapLink, baseUrl).href;
                        // Instead of adding to a set, directly queue it in Cloud Tasks
                        queueRecapUrlForScraping(fullUrl);
                    }
                });
            } catch (error) {
                 logger.warn(`[Paginator] Could not process ${finalScoresUrl}. Skipping. Message: ${error.message}`);
            }
        }
        
        // Trigger the next page processing
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


async function queueRecapUrlForScraping(url) {
    try {
        // The CloudTasksClient is now initialized globally, no need to require it here
        const project = 'marching-art';
        const location = 'us-central1';
        const queue = 'recap-scraper-queue';
        const workerUrl = `https://us-central1-${project}.cloudfunctions.net/scrapeSingleRecap`;
        const queuePath = tasksClient.queuePath(project, location, queue);

        const task = {
            httpRequest: {
                httpMethod: 'POST',
                url: workerUrl,
                body: Buffer.from(JSON.stringify({ url })).toString('base64'),
                headers: { 'Content-Type': 'application/json' },
            },
        };

        await tasksClient.createTask({ parent: queuePath, task: task });
        logger.info(`[Queuer] Successfully queued task for URL: ${url}`);
    } catch (error) {
        logger.error(`[Queuer] Failed to queue task for URL: ${url}`, error);
    }
}