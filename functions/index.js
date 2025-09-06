const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { logger } = require("firebase-functions/v2");
const { onSchedule } = require("firebase-functions/v2/scheduler");
const { onMessagePublished } = require("firebase-functions/v2/pubsub");
const { PubSub } = require("@google-cloud/pubsub");
const axios = require("axios");
const cheerio = require("cheerio");
const { getDb, appId } = require("./_config"); // UPDATED IMPORT

const pubsubClient = new PubSub();

// ================================================================= //
//                      EXPORTED CLOUD FUNCTIONS                     //
// ================================================================= //

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
    logger.info(`[validateAndSaveLineup] Received corpsName: ${corpsName}`);

    if (!lineup || Object.keys(lineup).length !== 8) {
        throw new HttpsError("invalid-argument", "A complete 8-caption lineup is required.");
    }

    const lineupValues = Object.values(lineup).sort();
    const lineupKey = lineupValues.join("_");
    if (lineupValues.length !== 8 || lineupValues.some((val) => !val)) {
        throw new HttpsError("invalid-argument", "The lineup is incomplete.");
    }
    
    const seasonSettingsRef = getDb().doc("game-settings/season");
    const seasonDoc = await seasonSettingsRef.get();
    if (!seasonDoc.exists || seasonDoc.data().status === "inactive") {
        throw new HttpsError("failed-precondition", "There is no active season.");
    }
    const activeSeasonId = seasonDoc.id;

    try {
        await getDb().runTransaction(async (transaction) => {
            logger.info(`[validateAndSaveLineup] Starting transaction for user: ${uid}`);
            const userProfileRef = getDb().doc(`artifacts/${appId}/users/${uid}/profile/data`);
            const userProfileDoc = await transaction.get(userProfileRef);
            if (!userProfileDoc.exists) {
                throw new HttpsError("not-found", "User profile does not exist.");
            }

            const newActiveLineupRef = getDb().collection("activeLineups").doc(lineupKey);
            const existingLineupDoc = await transaction.get(newActiveLineupRef);

            if (existingLineupDoc.exists && existingLineupDoc.data().uid !== uid) {
                throw new HttpsError("already-exists", "This exact lineup has already been claimed by another user. Please change at least one corps.");
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
            };
            if (corpsName) {
                profileUpdateData.corpsName = corpsName;
            }

            logger.info(`[validateAndSaveLineup] Data to be updated for user ${uid}:`, profileUpdateData);

            transaction.update(userProfileRef, profileUpdateData);
        });

        logger.info(`[validateAndSaveLineup] Transaction completed successfully for user: ${uid}`);
        return { success: true, message: "Lineup saved successfully!" };
    } catch (error) {
        logger.error(`[validateAndSaveLineup] Transaction FAILED for user ${uid}:`, error);
        if (error instanceof HttpsError) {
            throw error;
        }
        throw new HttpsError("internal", "An error occurred while saving your lineup. Please try again.");
    }
});

exports.testScraper = onCall({ cors: true }, async (request) => {
    if (!request.auth || !request.auth.token.admin) {
        throw new HttpsError("permission-denied", "You must be an admin to perform this action.");
    }
    try {
        await scrapeDciScoresLogic();
        return { success: true, message: "Scraper test triggered successfully. Check Cloud Function logs for output." };
    } catch (error) {
        logger.error("Error manually triggering scraper:", error);
        throw new HttpsError("internal", "An error occurred while triggering the scraper test.");
    }
});

exports.processDciScores = onMessagePublished("dci-scores-topic", async (message) => {
    logger.info("Received new scores to process.");
    try {
        const payloadBuffer = Buffer.from(message.data.message.data, "base64").toString("utf-8");
        const { eventName, scores } = JSON.parse(payloadBuffer);

        if (!scores || scores.length === 0) {
            logger.info("Payload contained no scores. Exiting function.");
            return;
        }

        // --- NEW LOGIC: Transform and Archive the Raw Scraped Data ---
        try {
            const eventSlug = eventName.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
            const year = new Date().getFullYear();
            const docId = `${year}-${eventSlug}`;

            // This map translates our scraped keys to your database keys
            const captionMap = {
                GE1: "GE1",
                GE2: "GE2",
                VP: "VIS_PROF",
                VA: "VIS_ANALYSIS",
                CG: "CG",
                B: "BRASS", // Assuming 'B' maps to 'BRASS'
                MA: "MUS_ANALYSIS",
                P: "PERCUSSION",
            };

            // Transform the array of scores into an object (map) of corps
            const corpsMap = scores.reduce((acc, corpsScore) => {
                const transformedCaptions = {};
                for (const key in corpsScore.captions) {
                    const newKey = captionMap[key];
                    if (newKey) {
                        transformedCaptions[newKey] = corpsScore.captions[key];
                    }
                }
                acc[corpsScore.corps] = transformedCaptions;
                return acc;
            }, {});

            const archiveData = {
                eventName: eventName,
                eventDate: new Date(),
                seasonYear: year,
                corpses: corpsMap, // Use the 'corpses' key and the transformed map
                createdAt: new Date(),
            };
            
            await getDb().collection('historical_scores').doc(docId).set(archiveData);
            logger.info(`Successfully archived raw scores to historical_scores/${docId} with correct formatting.`);

        } catch (archiveError) {
            logger.error("Failed to archive raw score data:", archiveError);
        }
        // --- END NEW LOGIC ---

        const scoreMap = new Map();
        scores.forEach((s) => scoreMap.set(s.corps, s));
        
        const seasonSettingsRef = getDb().doc("game-settings/season");
        const seasonDoc = await seasonSettingsRef.get();
        if (!seasonDoc.exists) {
            logger.error("Cannot process scores: No active season found.");
            return;
        }
        const activeSeasonId = seasonDoc.id;

        const profileCollection = getDb().collectionGroup("profile").where("activeSeasonId", "==", activeSeasonId);
        const playersSnapshot = await profileCollection.get();

        if (playersSnapshot.empty) {
            logger.info("No active players in this season to score.");
            return;
        }
        
        logger.info(`Found ${playersSnapshot.size} players to score for event: ${eventName}.`);
        
        const promises = [];
        playersSnapshot.forEach((playerDoc) => {
            const playerData = playerDoc.data();
            const playerLineup = playerData.lineup;

            if (!playerLineup) return;

            let fantasyScore = 0;
            
            for (const caption in playerLineup) {
                const selectedCorps = playerLineup[caption];
                const corpsScores = scoreMap.get(selectedCorps);
                
                if (corpsScores && corpsScores.captions[caption]) {
                    fantasyScore += corpsScores.captions[caption];
                }
            }

            const promise = getDb().runTransaction(async (transaction) => {
                const playerProfileRef = playerDoc.ref;
                const freshPlayerDoc = await transaction.get(playerProfileRef);
                const freshPlayerData = freshPlayerDoc.data();

                const seasons = freshPlayerData.seasons || [];
                const seasonIndex = seasons.findIndex((s) => s.name === seasonDoc.data().name);

                const newEvent = {
                    eventName: eventName,
                    score: parseFloat(fantasyScore.toFixed(3)),
                    date: new Date(),
                };
                
                if (seasonIndex > -1) {
                    seasons[seasonIndex].events = [...(seasons[seasonIndex].events || []), newEvent];
                } else {
                    seasons.push({
                        name: seasonDoc.data().name,
                        showTitle: "New Season",
                        repertoire: "TBD",
                        type: seasonDoc.data().status.startsWith("live") ? "Live" : "Off",
                        events: [newEvent],
                    });
                }
                
                const newTotalScore = (freshPlayerData.totalSeasonScore || 0) + newEvent.score;
                
                transaction.update(playerProfileRef, {
                    seasons: seasons,
                    totalSeasonScore: newTotalScore,
                });
            });

            promises.push(promise);
        });

        await Promise.all(promises);
        logger.info("Successfully processed and saved scores for all players.");
    } catch (error) {
        logger.error("Error processing scores:", error);
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

async function scrapeDciScoresLogic() {
    logger.info("Running DCI RECAP scraper...");
    
    const urlsToTry = [
        'https://www.dci.org/scores/recap/2024-dci-world-championships-finals',
        'https://www.dci.org/scores/recap/2023-dci-world-championships-finals'
    ];

    let htmlData;
    let successfulUrl;

    for (const url of urlsToTry) {
        try {
            logger.info(`Attempting to scrape URL: ${url}`);
            const response = await axios.get(url);
            htmlData = response.data;
            successfulUrl = url;
            logger.info(`Successfully fetched data from: ${url}`);
            break; 
        } catch (error) {
            if (error.response && error.response.status === 404) {
                logger.warn(`URL failed with 404: ${url}. Trying next URL...`);
                continue; 
            } else {
                logger.error(`An unexpected error occurred trying to fetch ${url}:`, error);
                throw new Error("Scraping logic failed with a non-404 error.");
            }
        }
    }

    if (!htmlData) {
        logger.error("All scraper URLs failed. Could not retrieve any data.");
        throw new Error("All scraper URLs failed.");
    }
    
    try {
        const $ = cheerio.load(htmlData);
        const scoresData = [];

        $("table#effect-table-0 > tbody > tr").not(".table-top").each((i, row) => {
            const corpsName = $(row).find("td.sticky-td").first().text().trim();
            if (!corpsName) return;

            const geSection = $(row).find("td").eq(1);
            const visualSection = $(row).find("td").eq(2);
            const musicSection = $(row).find("td").eq(3);
            const totalScore = parseFloat($(row).find("td.data-total").last().find("span").first().text().trim());

            // --- NEW, MORE ROBUST HELPER FUNCTIONS ---
            const getJudgeScore = (section, judgeIndex) => {
                const scoreText = section.find('table.data').eq(judgeIndex).find('td').eq(2).find('span').first().text().trim();
                return parseFloat(scoreText) || 0;
            };

            const getAverageScore = (section, judgeIndexes) => {
                const scores = [];
                judgeIndexes.forEach(index => {
                    const score = getJudgeScore(section, index);
                    if (score > 0) { // Only include actual scores, not 0s from non-existent judges
                        scores.push(score);
                    }
                });

                if (scores.length === 0) return 0;
                const sum = scores.reduce((total, current) => total + current, 0);
                return sum / scores.length;
            };

            const getCaptionTotal = (section, captionIndex) => {
                const scoreText = section.find('table.main-sec-table').eq(captionIndex).find('td.data-total span').first().text().trim();
                return parseFloat(scoreText) || 0;
            };
            // --- END NEW HELPER FUNCTIONS ---

            const scores = {
                corps: corpsName,
                totalScore: totalScore,
                captions: {
                    GE1: getAverageScore(geSection, [0, 1]), // Average judges at index 0 and 1
                    GE2: getAverageScore(geSection, [2, 3]), // Average judges at index 2 and 3
                    VP: getCaptionTotal(visualSection, 0),
                    VA: getCaptionTotal(visualSection, 1),
                    CG: getCaptionTotal(visualSection, 2),
                    B: getCaptionTotal(musicSection, 0),
                    MA: getAverageScore(musicSection, [1, 2]), // Average judges at index 1 and 2
                    P: getCaptionTotal(musicSection, 3),
                }
            };
            
            scoresData.push(scores);
        });

        if (scoresData.length === 0) {
            logger.warn(`No scores found on ${successfulUrl}. Selectors may need an update.`);
            return;
        }

        logger.info(`Successfully scraped recap for ${scoresData.length} corps. Publishing to Pub/Sub.`);
        
        const eventName = $("h1.page-title").text().trim() || "DCI Recap Event";
        const dataBuffer = Buffer.from(JSON.stringify({ scores: scoresData, eventName: eventName }));

        await pubsubClient.topic("dci-scores-topic").publishMessage({ data: dataBuffer });

    } catch (error) {
        logger.error("Error during recap parsing or publishing:", error);
        throw new Error("Scraping logic failed during parsing phase.");
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

    const rankingsQuery = getDb().collection("final_rankings").orderBy(getDb().FieldPath.documentId(), "desc").limit(1);
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

    const endDate = new Date(startDate.getTime() + 49 * 24 * 60 * 60 * 1000);
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