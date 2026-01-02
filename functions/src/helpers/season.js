const { logger } = require("firebase-functions/v2");
const { getDb, dataNamespaceParam } = require("../config");
const { Timestamp, getDoc } = require("firebase-admin/firestore");
const admin = require("firebase-admin");
const { scrapeUpcomingDciEvents } = require("./scraping");

// =============================================================================
// SCHEDULE SUBCOLLECTION HELPERS
// =============================================================================
// Schedule data is stored in: season-schedules/{seasonId}/days/{dayNumber}
// This allows efficient querying of individual days and avoids document size limits

/**
 * Writes an entire schedule to the subcollection
 * @param {string} seasonId - The season identifier (e.g., "live_2024-25")
 * @param {Array} schedule - Array of day objects with offSeasonDay and shows
 */
async function writeScheduleToSubcollection(seasonId, schedule) {
  const db = getDb();
  const daysCollectionRef = db.collection(`season-schedules/${seasonId}/days`);

  logger.info(`Writing ${schedule.length} days to season-schedules/${seasonId}/days...`);

  // Use batched writes for efficiency (max 500 per batch)
  let batch = db.batch();
  let batchCount = 0;

  for (const day of schedule) {
    const dayDocRef = daysCollectionRef.doc(String(day.offSeasonDay));
    batch.set(dayDocRef, {
      offSeasonDay: day.offSeasonDay,
      shows: day.shows || [],
      updatedAt: new Date().toISOString(),
    });
    batchCount++;

    if (batchCount >= 400) {
      await batch.commit();
      batch = db.batch();
      batchCount = 0;
    }
  }

  if (batchCount > 0) {
    await batch.commit();
  }

  logger.info(`Successfully wrote schedule for season ${seasonId}`);
}

/**
 * Gets a single day's schedule from the subcollection
 * @param {string} seasonId - The season identifier
 * @param {number} dayNumber - The offSeasonDay (1-49)
 * @returns {Object|null} The day data or null if not found
 */
async function getScheduleDay(seasonId, dayNumber) {
  const db = getDb();
  const dayDocRef = db.doc(`season-schedules/${seasonId}/days/${dayNumber}`);
  const dayDoc = await dayDocRef.get();

  if (!dayDoc.exists) {
    return null;
  }

  return dayDoc.data();
}

/**
 * Gets schedule days for a specific range (e.g., a week)
 * @param {string} seasonId - The season identifier
 * @param {number} startDay - First day to fetch (inclusive)
 * @param {number} endDay - Last day to fetch (inclusive)
 * @returns {Array} Array of day objects
 */
async function getScheduleDays(seasonId, startDay, endDay) {
  const db = getDb();
  const daysCollectionRef = db.collection(`season-schedules/${seasonId}/days`);

  const snapshot = await daysCollectionRef
    .where("offSeasonDay", ">=", startDay)
    .where("offSeasonDay", "<=", endDay)
    .orderBy("offSeasonDay")
    .get();

  return snapshot.docs.map((doc) => doc.data());
}

/**
 * Gets all schedule days for a season
 * @param {string} seasonId - The season identifier
 * @returns {Array} Array of all day objects
 */
async function getAllScheduleDays(seasonId) {
  const db = getDb();
  const daysCollectionRef = db.collection(`season-schedules/${seasonId}/days`);

  const snapshot = await daysCollectionRef.orderBy("offSeasonDay").get();

  return snapshot.docs.map((doc) => doc.data());
}

/**
 * Updates a single day's shows in the subcollection
 * @param {string} seasonId - The season identifier
 * @param {number} dayNumber - The offSeasonDay to update
 * @param {Array} shows - The new shows array for this day
 */
async function updateScheduleDay(seasonId, dayNumber, shows) {
  const db = getDb();
  const dayDocRef = db.doc(`season-schedules/${seasonId}/days/${dayNumber}`);

  await dayDocRef.set({
    offSeasonDay: dayNumber,
    shows: shows,
    updatedAt: new Date().toISOString(),
  }, { merge: true });

  logger.info(`Updated day ${dayNumber} for season ${seasonId}`);
}

/**
 * Adds a show to a specific day (without overwriting existing shows)
 * @param {string} seasonId - The season identifier
 * @param {number} dayNumber - The offSeasonDay
 * @param {Object} show - The show object to add
 * @returns {boolean} True if show was added, false if it already exists
 */
async function addShowToDay(seasonId, dayNumber, show) {
  const db = getDb();
  const dayDocRef = db.doc(`season-schedules/${seasonId}/days/${dayNumber}`);

  const dayDoc = await dayDocRef.get();
  const currentShows = dayDoc.exists ? (dayDoc.data().shows || []) : [];

  // Check if show already exists
  const alreadyExists = currentShows.some(
    (s) => s.eventName === show.eventName
  );

  if (alreadyExists) {
    return false;
  }

  currentShows.push(show);

  await dayDocRef.set({
    offSeasonDay: dayNumber,
    shows: currentShows,
    updatedAt: new Date().toISOString(),
  }, { merge: true });

  return true;
}

// =============================================================================
// END SCHEDULE SUBCOLLECTION HELPERS
// =============================================================================

function shuffleArray(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

async function generateLiveSeasonSchedule(seasonLength, startDay, finalsYear, startDate, finalsDate) {
  logger.info(`Generating live season schedule for ${seasonLength} days, starting on day ${startDay}.`);

  // Create schedule structure matching off-season format
  const schedule = Array.from({ length: seasonLength }, (_, i) => ({ offSeasonDay: startDay + i, shows: [] }));

  // Scrape upcoming DCI events and populate days 1-44
  try {
    logger.info(`Scraping upcoming DCI events for ${finalsYear}...`);
    const upcomingEvents = await scrapeUpcomingDciEvents(finalsYear);
    logger.info(`Found ${upcomingEvents.length} upcoming events to map to schedule.`);

    // Map each event to its corresponding offSeasonDay
    const millisInDay = 24 * 60 * 60 * 1000;

    for (const event of upcomingEvents) {
      if (!event.date) continue;

      const eventDate = new Date(event.date);

      // Calculate which offSeasonDay this event falls on
      // offSeasonDay 1 = startDate, offSeasonDay 49 = finalsDate
      const diffFromStart = eventDate.getTime() - startDate.getTime();
      const dayNumber = Math.floor(diffFromStart / millisInDay) + 1;

      // Only include events within days 1-44 (non-championship days)
      if (dayNumber >= 1 && dayNumber <= 44) {
        const dayEntry = schedule.find((d) => d.offSeasonDay === dayNumber);
        if (dayEntry) {
          // Check if this event already exists on this day
          const alreadyExists = dayEntry.shows.some(
            (s) => s.eventName === event.eventName
          );
          if (!alreadyExists) {
            dayEntry.shows.push({
              eventName: event.eventName,
              location: event.location,
              date: event.date,
              isChampionship: false,
            });
            logger.info(`Mapped "${event.eventName}" to day ${dayNumber}`);
          }
        }
      }
    }

    // Log summary of populated days
    const populatedDays = schedule.filter((d) => d.shows.length > 0 && d.offSeasonDay <= 44);
    logger.info(`Successfully populated ${populatedDays.length} days with ${upcomingEvents.length} scraped events.`);

  } catch (error) {
    logger.error("Failed to scrape upcoming events. Schedule will be created with empty days 1-44:", error);
    // Continue with empty schedule - the season can still function, just without pre-populated shows
  }

  // Championship Week Shows (Days 45-49) - Same structure as off-season
  const day45 = schedule.find((d) => d.offSeasonDay === 45);
  if (day45) {
    day45.shows = [{
      eventName: "Open and A Class Prelims",
      location: "Marion, IN",
      date: null,
      isChampionship: true,
      eligibleClasses: ["openClass", "aClass"],
      mandatory: true,
    }];
  }

  const day46 = schedule.find((d) => d.offSeasonDay === 46);
  if (day46) {
    day46.shows = [{
      eventName: "Open and A Class Finals",
      location: "Marion, IN",
      date: null,
      isChampionship: true,
      eligibleClasses: ["openClass", "aClass"],
      advancementRules: { openClass: 8, aClass: 4 },
      mandatory: true,
    }];
  }

  const day47 = schedule.find((d) => d.offSeasonDay === 47);
  if (day47) {
    day47.shows = [{
      eventName: "marching.art World Championship Prelims",
      location: "Indianapolis, IN",
      date: null,
      isChampionship: true,
      eligibleClasses: ["worldClass", "openClass", "aClass"],
      mandatory: true,
    }];
  }

  const day48 = schedule.find((d) => d.offSeasonDay === 48);
  if (day48) {
    day48.shows = [{
      eventName: "marching.art World Championship Semifinals",
      location: "Indianapolis, IN",
      date: null,
      isChampionship: true,
      eligibleClasses: ["worldClass", "openClass", "aClass"],
      advancementRules: { all: 25 },
      mandatory: true,
    }];
  }

  const day49 = schedule.find((d) => d.offSeasonDay === 49);
  if (day49) {
    day49.shows = [
      {
        eventName: "marching.art World Championship Finals",
        location: "Indianapolis, IN",
        date: null,
        isChampionship: true,
        eligibleClasses: ["worldClass", "openClass", "aClass"],
        advancementRules: { all: 12 },
        mandatory: true,
      },
      {
        eventName: "SoundSport International Music & Food Festival",
        location: "Indianapolis, IN",
        date: null,
        isChampionship: true,
        eligibleClasses: ["soundSport"],
        mandatory: true,
      },
    ];
  }

  logger.info("Live season schedule generated successfully with championship week structure.");
  return schedule;
}

async function startNewLiveSeason() {
  logger.info("Generating new live season...");
  const db = getDb();
  const today = new Date();
  const year = today.getFullYear();
  const previousYear = (year - 1).toString();

  let oldSeasonUid = null;
  const oldSeasonDoc = await db.doc("game-settings/season").get();
  if (oldSeasonDoc.exists) {
    oldSeasonUid = oldSeasonDoc.data().seasonUid;
  }

  const rankingsDocRef = db.doc(`final_rankings/${previousYear}`);
  const rankingsDoc = await rankingsDocRef.get();
  if (!rankingsDoc.exists) {
    throw new Error(`Cannot start live season: Final rankings for ${previousYear} not found.`);
  }
  const corpsValues = rankingsDoc.data().data.map((c) => ({
    corpsName: c.corps,
    sourceYear: previousYear,
    points: c.points,
  }));

  // Calculate finals date (2nd Saturday of August)
  const augustFirst = new Date(year, 7, 1);
  const dayOfWeek = augustFirst.getDay();
  const daysToAdd = dayOfWeek === 6 ? 0 : 6 - dayOfWeek;
  const millisInDay = 24 * 60 * 60 * 1000;
  const firstSaturday = new Date(augustFirst.getTime() + daysToAdd * millisInDay);
  const finalsDate = new Date(firstSaturday.getTime() + 7 * millisInDay);

  // Season is 70 days total: 21 days spring training + 49 days competition
  // Start date is 69 days before finals (day 70 = finals)
  const startDate = new Date(finalsDate.getTime() - 69 * millisInDay);

  // Season naming
  const startYear = startDate.getFullYear();
  const endYear = finalsDate.getFullYear();
  const seasonYearSuffix = `${startYear}-${endYear.toString().slice(-2)}`;
  const seasonName = `live_${seasonYearSuffix}`;

  const dataDocId = seasonName;
  await db.doc(`dci-data/${dataDocId}`).set({ corpsValues: corpsValues });

  // Generate schedule with offSeasonDay structure (1-49 competition days)
  // Pass startDate and finalsDate so we can map scraped events to the correct days
  const schedule = await generateLiveSeasonSchedule(49, 1, year, startDate, finalsDate);

  // Write schedule to subcollection for scalability
  // Data stored at: season-schedules/{seasonId}/days/{dayNumber}
  await writeScheduleToSubcollection(dataDocId, schedule);

  const newSeasonData = {
    name: seasonName,
    status: "live-season",
    seasonUid: dataDocId,
    seasonYear: year,
    currentPointCap: 150,
    dataDocId: dataDocId,
    schedule: {
      startDate: Timestamp.fromDate(startDate),
      endDate: Timestamp.fromDate(finalsDate),
      springTrainingDays: 21, // First 21 calendar days are spring training
    },
    // Note: events are now stored in season-schedules/{seasonId}/days subcollection
  };

  await db.doc("game-settings/season").set(newSeasonData);
  logger.info(`Successfully started the ${newSeasonData.name}.`);

  if (oldSeasonUid) {
    // Reset user profiles from old season
    const profilesQuery = db.collectionGroup("profile").where("activeSeasonId", "==", oldSeasonUid);
    const profilesSnapshot = await profilesQuery.get();

    if (!profilesSnapshot.empty) {
      logger.info(`Resetting ${profilesSnapshot.size} user profiles from season ${oldSeasonUid}...`);

      let batch = db.batch();
      let batchCount = 0;

      for (const doc of profilesSnapshot.docs) {
        const profileData = doc.data();
        const corpsData = profileData.corps || {};
        const lifetimeStats = profileData.lifetimeStats || {
          totalSeasons: 0,
          totalShows: 0,
          totalPoints: 0,
          bestSeasonScore: 0,
          bestWeeklyScore: 0,
          leagueChampionships: 0
        };

        // Archive current season data and reset corps
        const resetCorps = {};
        let seasonShowCount = 0;
        let seasonPointsTotal = 0;

        Object.keys(corpsData).forEach(corpsClass => {
          const corps = corpsData[corpsClass];
          const seasonHistory = corps.seasonHistory || [];

          // Only archive if this corps was active this season
          if (corps.lineup || corps.totalSeasonScore > 0) {
            const showsAttended = Object.keys(corps.selectedShows || {}).length;
            const highestWeeklyScore = Math.max(...Object.values(corps.weeklyScores || {}), 0);

            // Archive this season's performance
            seasonHistory.push({
              seasonId: oldSeasonUid,
              seasonName: oldSeasonUid,
              corpsClass,
              corpsName: corps.corpsName || null,
              location: corps.location || null,
              lineup: corps.lineup || null,
              selectedShows: corps.selectedShows || {},
              weeklyScores: corps.weeklyScores || {},
              totalSeasonScore: corps.totalSeasonScore || 0,
              showsAttended,
              highestWeeklyScore,
              archivedAt: new Date()
            });

            seasonShowCount += showsAttended;
            seasonPointsTotal += (corps.totalSeasonScore || 0);

            // Update lifetime stats
            lifetimeStats.bestSeasonScore = Math.max(lifetimeStats.bestSeasonScore, corps.totalSeasonScore || 0);
            lifetimeStats.bestWeeklyScore = Math.max(lifetimeStats.bestWeeklyScore, highestWeeklyScore);
          }

          resetCorps[corpsClass] = {
            // PRESERVE: Historical data
            corpsName: corps.corpsName || null,
            location: corps.location || null,
            seasonHistory,
            // RESET: Season-specific data (including weeklyTrades so users can set up corps)
            weeklyTrades: null,
            lineup: null,
            lineupKey: null,
            selectedShows: {},
            weeklyScores: {},
            totalSeasonScore: 0,
          };
        });

        // Update lifetime stats
        if (seasonShowCount > 0 || seasonPointsTotal > 0) {
          lifetimeStats.totalSeasons = (lifetimeStats.totalSeasons || 0) + 1;
          lifetimeStats.totalShows = (lifetimeStats.totalShows || 0) + seasonShowCount;
          lifetimeStats.totalPoints = (lifetimeStats.totalPoints || 0) + seasonPointsTotal;
        }

        batch.update(doc.ref, {
          activeSeasonId: null,
          corps: resetCorps,
          lifetimeStats,
          retiredCorps: profileData.retiredCorps || [] // Preserve retired corps list
        });

        batchCount++;

        if (batchCount >= 400) {
          logger.info(`Committing batch of ${batchCount} profile resets...`);
          await batch.commit();
          batch = db.batch();
          batchCount = 0;
        }
      }

      if (batchCount > 0) {
        await batch.commit();
      }

      logger.info(`Successfully reset all user profiles from previous season: ${oldSeasonUid}`);
    }

    // Clear all active lineups from previous season
    logger.info(`Clearing active lineups from season ${oldSeasonUid}...`);
    const activeLineupsQuery = db.collection("activeLineups").where("seasonId", "==", oldSeasonUid);
    const lineupSnapshot = await activeLineupsQuery.get();

    if (!lineupSnapshot.empty) {
      logger.info(`Found ${lineupSnapshot.size} active lineups to clear...`);

      let batch = db.batch();
      let batchCount = 0;

      for (const doc of lineupSnapshot.docs) {
        batch.delete(doc.ref);
        batchCount++;

        if (batchCount >= 400) {
          logger.info(`Committing batch of ${batchCount} lineup deletions...`);
          await batch.commit();
          batch = db.batch();
          batchCount = 0;
        }
      }

      if (batchCount > 0) {
        await batch.commit();
      }

      logger.info(`Successfully cleared ${lineupSnapshot.size} active lineups from previous season`);
    } else {
      logger.info("No active lineups found to clear");
    }
  }
}

async function startNewOffSeason() {
  logger.info("Generating new themed off-season...");
  const db = getDb();
  const seasonSettingsRef = db.doc("game-settings/season");

  let oldSeasonUid = null;
  const oldSeasonDoc = await seasonSettingsRef.get();
  if (oldSeasonDoc.exists) {
    oldSeasonUid = oldSeasonDoc.data().seasonUid;
  }

  const { startDate, endDate, seasonType, finalsYear } = getNextOffSeasonWindow();
  const seasonLength = 49;
  const rankingsSnapshot = await db.collection("final_rankings").get();
  if (rankingsSnapshot.empty) {
    throw new Error("Cannot start off-season: No final rankings found.");
  }
  const pointsMap = new Map();
  const allCorpsList = [];
  rankingsSnapshot.forEach((doc) => {
    const year = doc.id;
    const corpsData = doc.data().data || [];
    corpsData.forEach((corps) => {
      const pointValue = corps.points;
      if (pointValue) {
        const entry = { corpsName: corps.corps, sourceYear: year, points: pointValue };
        if (!pointsMap.has(pointValue)) pointsMap.set(pointValue, []);
        pointsMap.get(pointValue).push(entry);
        allCorpsList.push(entry);
      }
    });
  });
  const offSeasonCorpsData = [];
  const usedCorpsNames = new Set();
  const shuffledAllCorps = shuffleArray(allCorpsList);
  for (let points = 25; points >= 1; points--) {
    let candidates = pointsMap.get(points) || [];
    let chosenCorps = null;
    if (candidates.length > 0) {
      const shuffledCandidates = shuffleArray([...candidates]);
      chosenCorps = shuffledCandidates.find((c) => !usedCorpsNames.has(c.corpsName));
      if (!chosenCorps) chosenCorps = shuffledCandidates[0];
    }
    if (!chosenCorps) {
      const fallback = shuffledAllCorps.find((c) => !usedCorpsNames.has(c.corpsName));
      if (fallback) chosenCorps = { ...fallback, points: points };
    }
    if (chosenCorps) {
      const { corpsName, sourceYear, points: chosenPoints } = chosenCorps;
      offSeasonCorpsData.push({ corpsName, sourceYear, points: chosenPoints });
      usedCorpsNames.add(chosenCorps.corpsName);
    }
  }
  const schedule = await generateOffSeasonSchedule(seasonLength, 1);
  const seasonName = getThematicOffSeasonName(seasonType, finalsYear);
  const dataDocId = seasonName;

  await db.doc(`dci-data/${dataDocId}`).set({ corpsValues: offSeasonCorpsData });

  // Write schedule to subcollection for scalability
  // Data stored at: season-schedules/{seasonId}/days/{dayNumber}
  await writeScheduleToSubcollection(dataDocId, schedule);

  const newSeasonSettings = {
    name: seasonName,
    status: "off-season",
    seasonUid: dataDocId,
    currentPointCap: 150,
    dataDocId: dataDocId,
    schedule: { startDate: Timestamp.fromDate(startDate), endDate: Timestamp.fromDate(endDate) },
    // Note: events are now stored in season-schedules/{seasonId}/days subcollection
  };

  await seasonSettingsRef.set(newSeasonSettings);
  logger.info(`Successfully started ${seasonName}.`);

  if (oldSeasonUid) {
    // Reset user profiles from old season
    const profilesQuery = db.collectionGroup("profile").where("activeSeasonId", "==", oldSeasonUid);
    const profilesSnapshot = await profilesQuery.get();

    if (!profilesSnapshot.empty) {
      logger.info(`Resetting ${profilesSnapshot.size} user profiles from season ${oldSeasonUid}...`);

      let batch = db.batch();
      let batchCount = 0;

      for (const doc of profilesSnapshot.docs) {
        const profileData = doc.data();
        const corpsData = profileData.corps || {};
        const lifetimeStats = profileData.lifetimeStats || {
          totalSeasons: 0,
          totalShows: 0,
          totalPoints: 0,
          bestSeasonScore: 0,
          bestWeeklyScore: 0,
          leagueChampionships: 0
        };

        // Archive current season data and reset corps
        const resetCorps = {};
        let seasonShowCount = 0;
        let seasonPointsTotal = 0;

        Object.keys(corpsData).forEach(corpsClass => {
          const corps = corpsData[corpsClass];
          const seasonHistory = corps.seasonHistory || [];

          // Only archive if this corps was active this season
          if (corps.lineup || corps.totalSeasonScore > 0) {
            const showsAttended = Object.keys(corps.selectedShows || {}).length;
            const highestWeeklyScore = Math.max(...Object.values(corps.weeklyScores || {}), 0);

            // Archive this season's performance
            seasonHistory.push({
              seasonId: oldSeasonUid,
              seasonName: oldSeasonUid,
              corpsClass,
              corpsName: corps.corpsName || null,
              location: corps.location || null,
              lineup: corps.lineup || null,
              selectedShows: corps.selectedShows || {},
              weeklyScores: corps.weeklyScores || {},
              totalSeasonScore: corps.totalSeasonScore || 0,
              showsAttended,
              highestWeeklyScore,
              archivedAt: new Date()
            });

            seasonShowCount += showsAttended;
            seasonPointsTotal += (corps.totalSeasonScore || 0);

            // Update lifetime stats
            lifetimeStats.bestSeasonScore = Math.max(lifetimeStats.bestSeasonScore, corps.totalSeasonScore || 0);
            lifetimeStats.bestWeeklyScore = Math.max(lifetimeStats.bestWeeklyScore, highestWeeklyScore);
          }

          resetCorps[corpsClass] = {
            // PRESERVE: Historical data
            corpsName: corps.corpsName || null,
            location: corps.location || null,
            seasonHistory,
            // RESET: Season-specific data (including weeklyTrades so users can set up corps)
            weeklyTrades: null,
            lineup: null,
            lineupKey: null,
            selectedShows: {},
            weeklyScores: {},
            totalSeasonScore: 0,
          };
        });

        // Update lifetime stats
        if (seasonShowCount > 0 || seasonPointsTotal > 0) {
          lifetimeStats.totalSeasons = (lifetimeStats.totalSeasons || 0) + 1;
          lifetimeStats.totalShows = (lifetimeStats.totalShows || 0) + seasonShowCount;
          lifetimeStats.totalPoints = (lifetimeStats.totalPoints || 0) + seasonPointsTotal;
        }

        batch.update(doc.ref, {
          activeSeasonId: null,
          corps: resetCorps,
          lifetimeStats,
          retiredCorps: profileData.retiredCorps || [] // Preserve retired corps list
        });

        batchCount++;

        if (batchCount >= 400) {
          logger.info(`Committing batch of ${batchCount} profile resets...`);
          await batch.commit();
          batch = db.batch();
          batchCount = 0;
        }
      }

      if (batchCount > 0) {
        await batch.commit();
      }

      logger.info(`Successfully reset all user profiles from previous season: ${oldSeasonUid}`);
    }

    // Clear all active lineups from previous season
    logger.info(`Clearing active lineups from season ${oldSeasonUid}...`);
    const activeLineupsQuery = db.collection("activeLineups").where("seasonId", "==", oldSeasonUid);
    const lineupSnapshot = await activeLineupsQuery.get();

    if (!lineupSnapshot.empty) {
      logger.info(`Found ${lineupSnapshot.size} active lineups to clear...`);

      let batch = db.batch();
      let batchCount = 0;

      for (const doc of lineupSnapshot.docs) {
        batch.delete(doc.ref);
        batchCount++;

        if (batchCount >= 400) {
          logger.info(`Committing batch of ${batchCount} lineup deletions...`);
          await batch.commit();
          batch = db.batch();
          batchCount = 0;
        }
      }

      if (batchCount > 0) {
        await batch.commit();
      }

      logger.info(`Successfully cleared ${lineupSnapshot.size} active lineups from previous season`);
    } else {
      logger.info("No active lineups found to clear");
    }
  }
}

async function generateOffSeasonSchedule(seasonLength, startDay) {
  logger.info(`Generating schedule for a ${seasonLength}-day season, starting on day ${startDay}.`);
  const db = getDb();
  const scoresSnapshot = await db.collection("historical_scores").get();

  const showsByDay = new Map();
  scoresSnapshot.forEach((yearDoc) => {
    const yearData = yearDoc.data().data || [];
    yearData.forEach((event) => {
      if (event.eventName && event.offSeasonDay && !event.eventName.toLowerCase().includes("open class")) {
        const showData = {
          eventName: event.eventName,
          date: event.date,
          location: event.location,
          scores: event.scores,
          offSeasonDay: event.offSeasonDay,
        };
        if (!showsByDay.has(event.offSeasonDay)) showsByDay.set(event.offSeasonDay, []);
        showsByDay.get(event.offSeasonDay).push(showData);
      }
    });
  });

  const schedule = Array.from({ length: seasonLength }, (_, i) => ({ offSeasonDay: startDay + i, shows: [] }));
  const usedEventNames = new Set();
  const usedLocations = new Set();

  const placeExclusiveShow = (day, showNamePattern, mandatory) => {
    const dayObject = schedule.find((d) => d.offSeasonDay === day);
    if (!dayObject) return;

    const showsForThisDay = showsByDay.get(day) || [];
    const candidates = showsForThisDay.filter((s) => {
      const nameMatches = s.eventName.toLowerCase().includes(showNamePattern.toLowerCase());
      const isUnused = !usedEventNames.has(s.eventName);
      return nameMatches && isUnused;
    });

    const showToPlace = shuffleArray(candidates)[0];

    if (showToPlace) {
      dayObject.shows = [{ ...showToPlace, mandatory }];
      usedEventNames.add(showToPlace.eventName);
      usedLocations.add(showToPlace.location);
    } else {
      logger.warn(`Could not find an unused show for Day ${day} matching "${showNamePattern}". Day will be empty.`);
      dayObject.shows = [];
    }
  };

  placeExclusiveShow(49, "marching.art World Championship Finals", true);
  placeExclusiveShow(48, "marching.art World Championship Semifinals", true);
  placeExclusiveShow(47, "marching.art World Championship Prelims", true);
  placeExclusiveShow(28, "DCI Southwestern Championship", true);
  placeExclusiveShow(35, "championship", false);

  const showsForDay41 = showsByDay.get(41) || [];
  const showsForDay42 = showsByDay.get(42) || [];

  const ecCandidates = [...showsForDay41, ...showsForDay42];
  const easternClassicCandidates = ecCandidates.filter((s) => {
    const nameMatches = s.eventName.includes("DCI Eastern Classic");
    const isUnused = !usedEventNames.has(s.eventName);
    return nameMatches && isUnused;
  });

  const dciEastShow = shuffleArray(easternClassicCandidates)[0];

  if (dciEastShow) {
    const day41 = schedule.find((d) => d.offSeasonDay === 41);
    const day42 = schedule.find((d) => d.offSeasonDay === 42);

    if (day41) day41.shows = [{ ...dciEastShow, mandatory: false }];
    if (day42) day42.shows = [{ ...dciEastShow, mandatory: false }];

    if (day41 || day42) {
      usedEventNames.add(dciEastShow.eventName);
      usedLocations.add(dciEastShow.location);
    }
  } else {
    const warnMsg = "Could not find \"DCI Eastern Classic\" on days 41 or 42. " +
      "These days will be filled randomly if available.";
    logger.warn(warnMsg);
  }

  const remainingDays = schedule.filter((d) => d.shows.length === 0);
  const twoShowDayCount = Math.floor(remainingDays.length * 0.2);
  const dayCounts = shuffleArray(
    [...Array(twoShowDayCount).fill(2), ...Array(remainingDays.length - twoShowDayCount).fill(3)]
  );

  for (const day of remainingDays) {
    const numShowsToPick = dayCounts.pop() || 3;
    const potentialShows = shuffleArray(showsByDay.get(day.offSeasonDay) || []);
    const pickedShows = [];

    for (const show of potentialShows) {
      if (pickedShows.length >= numShowsToPick) break;
      if (!usedEventNames.has(show.eventName) && !usedLocations.has(show.location)) {
        pickedShows.push(show);
        usedEventNames.add(show.eventName);
        usedLocations.add(show.location);
      }
    }
    day.shows = pickedShows;
  }

  // Championship Week Shows (Days 45-49)
  // These are auto-enrollment events - users don't select them manually
  const day45 = schedule.find((d) => d.offSeasonDay === 45);
  if (day45) {
    day45.shows = [{
      eventName: "Open and A Class Prelims",
      location: "Marion, IN",
      date: null, // Will be set based on season schedule
      isChampionship: true,
      eligibleClasses: ["openClass", "aClass"],
      mandatory: true,
    }];
  }

  const day46 = schedule.find((d) => d.offSeasonDay === 46);
  if (day46) {
    day46.shows = [{
      eventName: "Open and A Class Finals",
      location: "Marion, IN",
      date: null,
      isChampionship: true,
      eligibleClasses: ["openClass", "aClass"],
      advancementRules: { openClass: 8, aClass: 4 }, // Top 8 Open, Top 4 A Class from Day 45
      mandatory: true,
    }];
  }

  // Update Day 47-49 to include championship metadata
  const day47 = schedule.find((d) => d.offSeasonDay === 47);
  if (day47 && day47.shows.length > 0) {
    day47.shows[0].isChampionship = true;
    day47.shows[0].eligibleClasses = ["worldClass", "openClass", "aClass"];
  }

  const day48 = schedule.find((d) => d.offSeasonDay === 48);
  if (day48 && day48.shows.length > 0) {
    day48.shows[0].isChampionship = true;
    day48.shows[0].eligibleClasses = ["worldClass", "openClass", "aClass"];
    day48.shows[0].advancementRules = { all: 25 }; // Top 25 from Day 47
  }

  const day49 = schedule.find((d) => d.offSeasonDay === 49);
  if (day49) {
    // Day 49 has two shows: World Finals and SoundSport Festival
    const worldFinalsShow = day49.shows[0] || {
      eventName: "World Championships Finals",
      location: "Indianapolis, IN",
      date: null,
    };
    worldFinalsShow.isChampionship = true;
    worldFinalsShow.eligibleClasses = ["worldClass", "openClass", "aClass"];
    worldFinalsShow.advancementRules = { all: 12 }; // Top 12 from Day 48

    const soundSportShow = {
      eventName: "SoundSport International Music & Food Festival",
      location: "Indianapolis, IN",
      date: null,
      isChampionship: true,
      eligibleClasses: ["soundSport"],
      mandatory: true,
    };

    day49.shows = [worldFinalsShow, soundSportShow];
  }

  // Swap DCI to marching.art in show names for off-season branding
  // Skip championship shows that already have proper names
  schedule.forEach((day) => {
    day.shows.forEach((show) => {
      if (!show.isChampionship) {
        show.eventName = show.eventName.replace(/DCI/g, "marching.art");
      }
    });
  });

  logger.info("Advanced schedule generated successfully.");
  return schedule;
}

function calculateOffSeasonDay(eventDate, year) {
  if (!eventDate || isNaN(eventDate.getTime())) return null;

  const firstOfAugust = new Date(Date.UTC(year, 7, 1));
  const dayOfWeek = firstOfAugust.getUTCDay();
  const daysUntilFirstSaturday = (6 - dayOfWeek + 7) % 7;
  const firstSaturdayDate = 1 + daysUntilFirstSaturday;
  const finalsDay = firstSaturdayDate + 7;
  const finalsDateUTC = new Date(Date.UTC(year, 7, finalsDay));

  const seasonEndDate = new Date(finalsDateUTC);
  const millisIn48Days = 48 * 24 * 60 * 60 * 1000;
  const seasonStartDate = new Date(finalsDateUTC.getTime() - millisIn48Days);
  const eventDateUTC = new Date(Date.UTC(eventDate.getUTCFullYear(), eventDate.getUTCMonth(), eventDate.getUTCDate()));

  if (eventDateUTC < seasonStartDate || eventDateUTC > seasonEndDate) return null;

  const diffInMillis = eventDateUTC.getTime() - seasonStartDate.getTime();
  const millisInDay = 1000 * 60 * 60 * 24;
  const diffInDays = Math.round(diffInMillis / millisInDay);

  return diffInDays + 1;
}

function getThematicOffSeasonName(seasonType, finalsYear) {
  const startYear = finalsYear - 1;
  return `${seasonType.toLowerCase()}_${startYear}-${finalsYear.toString().slice(-2)}`;
}

function getNextOffSeasonWindow() {
  const now = new Date();
  const currentYear = now.getFullYear();

  const findSecondSaturday = (year) => {
    const firstOfAugust = new Date(Date.UTC(year, 7, 1));
    const dayOfWeek = firstOfAugust.getUTCDay();
    const daysToAdd = (6 - dayOfWeek + 7) % 7;
    const firstSaturday = 1 + daysToAdd;
    return new Date(Date.UTC(year, 7, firstSaturday + 7));
  };

  let nextFinalsDate = findSecondSaturday(currentYear);
  if (now >= nextFinalsDate) {
    nextFinalsDate = findSecondSaturday(currentYear + 1);
  }

  const millisInDay = 24 * 60 * 60 * 1000;
  const liveSeasonStartDate = new Date(nextFinalsDate.getTime() - 69 * millisInDay);
  const seasonTypes = ["Finale", "Crescendo", "Scherzo", "Adagio", "Allegro", "Overture"];
  const seasonWindows = [];

  for (let i = 0; i < seasonTypes.length; i++) {
    const seasonEndDate = new Date(liveSeasonStartDate.getTime() - (i * 49 * millisInDay) - (1 * millisInDay));
    const seasonStartDate = new Date(seasonEndDate.getTime() - 48 * millisInDay);
    seasonWindows.push({
      startDate: seasonStartDate,
      endDate: seasonEndDate,
      seasonType: seasonTypes[i],
    });
  }

  seasonWindows.reverse();
  const nextWindow = seasonWindows.find((window) => now < window.endDate);

  if (nextWindow) {
    return { ...nextWindow, finalsYear: nextFinalsDate.getFullYear() };
  }

  const overtureStartDate = new Date(nextFinalsDate.getTime() + 1 * millisInDay);
  const overtureEndDate = new Date(overtureStartDate.getTime() + 48 * millisInDay);

  return {
    startDate: overtureStartDate,
    endDate: overtureEndDate,
    seasonType: "Overture",
    finalsYear: nextFinalsDate.getFullYear(),
  };
}

async function archiveSeasonResultsLogic() {
  logger.info("Starting end-of-season archival process...");
  const db = getDb();

  const seasonSettingsRef = db.doc("game-settings/season");
  const seasonDoc = await seasonSettingsRef.get();
  if (!seasonDoc.exists) {
    logger.error("No season document found. Cannot archive results.");
    throw new Error("No active season document found.");
  }
  const seasonData = seasonDoc.data();
  const seasonId = seasonData.seasonUid;
  const seasonName = seasonData.name;

  const leaguesSnapshot = await db.collection("leagues").get();
  if (leaguesSnapshot.empty) {
    logger.info("No leagues found to archive.");
    return;
  }

  const batch = db.batch();

  for (const leagueDoc of leaguesSnapshot.docs) {
    const league = leagueDoc.data();
    const leagueId = leagueDoc.id;
    const members = league.members || [];

    if (members.length === 0) continue;

    let leagueWinner = { userId: null, username: "Unknown", finalScore: -1, corpsName: "Unknown" };

    const profilePromises = members.map((uid) => db.doc(`artifacts/${dataNamespaceParam.value()}/users/${uid}/profile/data`).get());
    const profileDocs = await Promise.all(profilePromises);

    profileDocs.forEach((profileDoc) => {
      if (profileDoc.exists) {
        const profileData = profileDoc.data();
        if (profileData.activeSeasonId === seasonId) {
          const userCorps = profileData.corps || {};
          if (profileData.corpsName && !userCorps.worldClass) {
            userCorps.worldClass = { totalSeasonScore: profileData.totalSeasonScore || 0 };
          }
          const totalScore = Object.values(userCorps)
            .reduce((sum, corps) => sum + (corps.totalSeasonScore || 0), 0);

          if (totalScore > leagueWinner.finalScore) {
            leagueWinner = {
              userId: profileDoc.ref.parent.parent.id,
              username: profileData.username,
              finalScore: totalScore,
              corpsName: userCorps.worldClass?.corpsName || profileData.corpsName || "Unnamed Corps",
            };
          }
        }
      }
    });

    if (leagueWinner.userId) {
      const leagueRef = db.doc(`leagues/${leagueId}`);
      const championEntry = {
        seasonName: seasonName,
        winnerId: leagueWinner.userId,
        winnerUsername: leagueWinner.username,
        winnerCorpsName: leagueWinner.corpsName,
        score: leagueWinner.finalScore,
        archivedAt: new Date(),
      };
      batch.update(leagueRef, {
        champions: admin.firestore.FieldValue.arrayUnion(championEntry),
      });
      logger.info(`Archived winner for league '${league.name}': ${leagueWinner.username}`);

      // --- ACHIEVEMENT LOGIC ---
      const winnerProfileRef = db.doc(`artifacts/${dataNamespaceParam.value()}/users/${leagueWinner.userId}/profile/data`);
      const championAchievement = {
        id: `league_champion_${seasonId}`, // Unique ID for this achievement
        name: `League Champion: ${seasonName}`,
        description: `Finished 1st in the ${league.name} league during the ${seasonName}.`,
        earnedAt: new Date(),
        icon: "trophy", // An identifier for the frontend to use
      };
      batch.update(winnerProfileRef, {
        achievements: admin.firestore.FieldValue.arrayUnion(championAchievement),
      });
      logger.info(`Granted 'League Champion' achievement to ${leagueWinner.username}.`);

      // --- NEW NOTIFICATION LOGIC ---
      const notificationMessage = `🏆 ${leagueWinner.username} has won the ${seasonName} ` +
        `championship in your league, ${league.name}!`;
      members.forEach((memberUid) => {
        const notificationRef = db.collection(`artifacts/${dataNamespaceParam.value()}/users/${memberUid}/notifications`).doc();
        batch.set(notificationRef, {
          type: "new_champion",
          message: notificationMessage,
          link: `/leagues/${leagueId}`, // This will be used for client-side routing
          timestamp: admin.firestore.FieldValue.serverTimestamp(),
          isRead: false,
        });
      });
      logger.info(`Created notifications for all ${members.length} members of league '${league.name}'.`);
    }
  }

  await batch.commit();
  logger.info("End-of-season archival process complete.");
}

/**
 * Refreshes the live season schedule with newly scraped DCI events
 * Only updates days 1-44 (non-championship days), preserving championship week
 * Can be called mid-season to add new events that were announced after season start
 */
async function refreshLiveSeasonSchedule() {
  logger.info("Refreshing live season schedule with scraped events...");
  const db = getDb();

  const seasonDoc = await db.doc("game-settings/season").get();
  if (!seasonDoc.exists) {
    throw new Error("No active season found.");
  }

  const seasonData = seasonDoc.data();
  if (seasonData.status !== "live-season") {
    throw new Error("Can only refresh schedule during a live season.");
  }

  const seasonId = seasonData.seasonUid;
  const startDate = seasonData.schedule.startDate.toDate();
  const finalsDate = seasonData.schedule.endDate.toDate();
  const year = finalsDate.getFullYear();

  try {
    logger.info(`Scraping upcoming DCI events for ${year}...`);
    const upcomingEvents = await scrapeUpcomingDciEvents(year);
    logger.info(`Found ${upcomingEvents.length} events to process.`);

    const millisInDay = 24 * 60 * 60 * 1000;
    let addedCount = 0;

    for (const event of upcomingEvents) {
      if (!event.date) continue;

      const eventDate = new Date(event.date);
      const diffFromStart = eventDate.getTime() - startDate.getTime();
      const dayNumber = Math.floor(diffFromStart / millisInDay) + 1;

      // Only include events within days 1-44 (non-championship days)
      if (dayNumber >= 1 && dayNumber <= 44) {
        const show = {
          eventName: event.eventName,
          location: event.location,
          date: event.date,
          isChampionship: false,
        };

        // Use helper function to add show to day (handles deduplication)
        const wasAdded = await addShowToDay(seasonId, dayNumber, show);
        if (wasAdded) {
          addedCount++;
          logger.info(`Added "${event.eventName}" to day ${dayNumber}`);
        }
      }
    }

    // Update the season document with refresh timestamp
    await db.doc("game-settings/season").update({
      lastScheduleRefresh: new Date().toISOString(),
    });

    logger.info(`Schedule refresh complete. Added ${addedCount} new events.`);
    return { addedCount, totalEvents: upcomingEvents.length };

  } catch (error) {
    logger.error("Failed to refresh schedule:", error);
    throw error;
  }
}

module.exports = {
  // Core season functions
  shuffleArray,
  startNewLiveSeason,
  startNewOffSeason,
  generateLiveSeasonSchedule,
  generateOffSeasonSchedule,
  calculateOffSeasonDay,
  getThematicOffSeasonName,
  getNextOffSeasonWindow,
  archiveSeasonResultsLogic,
  refreshLiveSeasonSchedule,
  // Schedule subcollection helpers
  writeScheduleToSubcollection,
  getScheduleDay,
  getScheduleDays,
  getAllScheduleDays,
  updateScheduleDay,
  addShowToDay,
};