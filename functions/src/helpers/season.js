const { logger } = require("firebase-functions/v2");
const { getDb, dataNamespaceParam } = require("../config");
const { Timestamp, getDoc } = require("firebase-admin/firestore");
const admin = require("firebase-admin");

function shuffleArray(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
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

  // Calculate finals year for naming (season spans two calendar years)
  const augustFirst = new Date(year, 7, 1);
  const dayOfWeek = augustFirst.getDay();
  const daysToAdd = dayOfWeek === 6 ? 0 : 6 - dayOfWeek;
  const millisInDay = 24 * 60 * 60 * 1000;
  const firstSaturday = new Date(augustFirst.getTime() + daysToAdd * millisInDay);
  const finalsDate = new Date(firstSaturday.getTime() + 7 * millisInDay);
  const startDate = new Date(finalsDate.getTime() - 69 * millisInDay);

  // Season starts in previous year and ends in current year
  const startYear = startDate.getFullYear();
  const endYear = finalsDate.getFullYear();
  const seasonYearSuffix = `${startYear}-${endYear.toString().slice(-2)}`;
  const seasonName = `live_${seasonYearSuffix}`;

  const dataDocId = seasonName;
  await db.doc(`dci-data/${dataDocId}`).set({ corpsValues: corpsValues });

  const scheduleTemplateRef = db.doc("schedules/live_season_template");
  const scheduleTemplateDoc = await scheduleTemplateRef.get();
  const events = scheduleTemplateDoc.exists ? scheduleTemplateDoc.data().events : [];

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
    },
    events: events,
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

        // Preserve historical data while resetting season-specific fields
        const resetCorps = {};
        Object.keys(corpsData).forEach(corpsClass => {
          const corps = corpsData[corpsClass];
          resetCorps[corpsClass] = {
            // PRESERVE: Historical data
            corpsName: corps.corpsName || null,
            location: corps.location || null,
            seasonHistory: corps.seasonHistory || [],
            // RESET: Season-specific data
            lineup: null,
            lineupKey: null,
            selectedShows: {},
            weeklyTrades: null,
            weeklyScores: {},
            totalSeasonScore: 0,
          };
        });

        batch.update(doc.ref, {
          activeSeasonId: null,
          corps: resetCorps,
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

  const newSeasonSettings = {
    name: seasonName,
    status: "off-season",
    seasonUid: dataDocId,
    currentPointCap: 150,
    dataDocId: dataDocId,
    schedule: { startDate: Timestamp.fromDate(startDate), endDate: Timestamp.fromDate(endDate) },
    events: schedule,
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

        // Preserve historical data while resetting season-specific fields
        const resetCorps = {};
        Object.keys(corpsData).forEach(corpsClass => {
          const corps = corpsData[corpsClass];
          resetCorps[corpsClass] = {
            // PRESERVE: Historical data
            corpsName: corps.corpsName || null,
            location: corps.location || null,
            seasonHistory: corps.seasonHistory || [],
            // RESET: Season-specific data
            lineup: null,
            lineupKey: null,
            selectedShows: {},
            weeklyTrades: null,
            weeklyScores: {},
            totalSeasonScore: 0,
          };
        });

        batch.update(doc.ref, {
          activeSeasonId: null,
          corps: resetCorps,
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

  placeExclusiveShow(49, "DCI World Championship Finals", true);
  placeExclusiveShow(48, "DCI World Championship Semifinals", true);
  placeExclusiveShow(47, "DCI World Championship Prelims", true);
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

  const day45 = schedule.find((d) => d.offSeasonDay === 45);
  if (day45) day45.shows = [];
  const day46 = schedule.find((d) => d.offSeasonDay === 46);
  if (day46) day46.shows = [];

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

module.exports = {
  shuffleArray,
  startNewLiveSeason,
  startNewOffSeason,
  generateOffSeasonSchedule,
  calculateOffSeasonDay,
  getThematicOffSeasonName,
  getNextOffSeasonWindow,
  archiveSeasonResultsLogic,
};