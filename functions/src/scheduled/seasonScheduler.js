/**
 * marching.art Season Scheduler - COMPLETE VERIFIED VERSION
 * Cross-checked with all game requirements and existing files
 * Optimized for 10,000+ users with minimal Firebase costs
 */

const functions = require('firebase-functions');
const admin = require('firebase-admin');

// === CONFIGURATION ===
const SEASON_CONFIG = {
  LIVE_SEASON_DAYS: 70,      // 10 weeks
  OFF_SEASON_DAYS: 49,        // 7 weeks
  SEASON_START_HOUR: 3,       // 3:00 AM ET
  SEASON_THEMES: ['Overture', 'Allegro', 'Adagio', 'Scherzo', 'Crescendo', 'Finale'],
};

// === HELPER FUNCTIONS ===
function shuffleArray(array) {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

function getSecondSaturdayOfAugust(year) {
  const august = new Date(Date.UTC(year, 7, 1));
  const dayOfWeek = august.getUTCDay();
  const daysToAdd = (6 - dayOfWeek + 7) % 7;
  const firstSaturday = 1 + daysToAdd;
  return new Date(Date.UTC(year, 7, firstSaturday + 7, SEASON_CONFIG.SEASON_START_HOUR));
}

function determineCurrentSeason(currentDate) {
  const currentYear = currentDate.getFullYear();
  const currentYearFinalsDate = getSecondSaturdayOfAugust(currentYear);
  const liveSeasonStart = new Date(currentYearFinalsDate);
  liveSeasonStart.setDate(liveSeasonStart.getDate() - (SEASON_CONFIG.LIVE_SEASON_DAYS - 1));

  // Check if we're in live season
  if (currentDate >= liveSeasonStart && currentDate <= currentYearFinalsDate) {
    return {
      seasonType: 'live',
      seasonName: `DCI ${currentYear} Live Season`,
      finalsYear: currentYear,
      startDate: liveSeasonStart,
      endDate: currentYearFinalsDate,
      totalWeeks: 10,
      totalDays: SEASON_CONFIG.LIVE_SEASON_DAYS
    };
  }

  // Determine which off-season we're in
  const previousYearFinalsDate = currentDate > currentYearFinalsDate ? 
    currentYearFinalsDate : getSecondSaturdayOfAugust(currentYear - 1);
  
  const cycleStartDate = new Date(previousYearFinalsDate);
  cycleStartDate.setDate(cycleStartDate.getDate() + 1);
  
  const daysSinceCycleStart = Math.floor((currentDate - cycleStartDate) / (1000 * 60 * 60 * 24));
  const offSeasonNumber = Math.min(Math.floor(daysSinceCycleStart / SEASON_CONFIG.OFF_SEASON_DAYS) + 1, 6);
  
  const seasonStartDate = new Date(cycleStartDate);
  seasonStartDate.setDate(seasonStartDate.getDate() + ((offSeasonNumber - 1) * SEASON_CONFIG.OFF_SEASON_DAYS));
  
  const seasonEndDate = new Date(seasonStartDate);
  seasonEndDate.setDate(seasonEndDate.getDate() + (SEASON_CONFIG.OFF_SEASON_DAYS - 1));
  seasonEndDate.setUTCHours(23, 59, 59, 999);
  
  const seasonTheme = SEASON_CONFIG.SEASON_THEMES[offSeasonNumber - 1];
  const baseYear = currentDate > currentYearFinalsDate ? currentYear : currentYear - 1;
  
  return {
    seasonType: seasonTheme.toLowerCase(),
    seasonName: `${seasonTheme} Season ${baseYear}-${(baseYear + 1).toString().slice(-2)}`,
    finalsYear: baseYear + 1,
    startDate: seasonStartDate,
    endDate: seasonEndDate,
    totalWeeks: 7,
    totalDays: SEASON_CONFIG.OFF_SEASON_DAYS
  };
}

async function getNextSeasonNumber(db) {
  const seasonsSnapshot = await db.collection('season-archives')
    .orderBy('seasonNumber', 'desc')
    .limit(1)
    .get();
  return seasonsSnapshot.empty ? 1 : (seasonsSnapshot.docs[0].data().seasonNumber || 0) + 1;
}

// === CORPS SELECTION - FIXED FOR EXISTING DATA STRUCTURE ===
async function assignCorpsForLiveSeason(db, seasonYear) {
  functions.logger.info(`Assigning corps for LIVE season ${seasonYear}...`);
  const previousYear = (seasonYear - 1).toString();

  const rankingsDoc = await db.doc(`final_rankings/${previousYear}`).get();
  if (!rankingsDoc.exists) {
    throw new Error(`Cannot start live season: Final rankings for ${previousYear} not found.`);
  }

  const rankings = rankingsDoc.data().data || [];
  const assignedCorps = rankings.slice(0, 25).map((entry, index) => ({
    name: entry.corps,
    corpsName: entry.corps, // Include both for compatibility
    sourceYear: previousYear,
    value: 25 - index,
    pointCost: 25 - index,
    rank: index + 1,
    finalScore: entry.originalScore || 0,
  }));
  
  functions.logger.info(`Assigned ${assignedCorps.length} corps from ${previousYear} rankings.`);
  return assignedCorps;
}

async function assignCorpsForOffSeason(db) {
  functions.logger.info("Assigning corps for OFF-SEASON with rank-by-rank randomization...");
  
  const rankingsSnapshot = await db.collection("final_rankings").get();
  if (rankingsSnapshot.empty) {
    throw new Error("No final rankings found. Cannot assign corps.");
  }

  // Pre-load all ranking data
  const rankingsByYear = {};
  rankingsSnapshot.forEach(doc => {
    rankingsByYear[doc.id] = doc.data().data || [];
  });
  const availableYears = Object.keys(rankingsByYear);

  const assignedCorps = [];
  const usedCorpsNames = new Set();
  
  // Select one corps for each rank/value slot
  for (let rank = 1; rank <= 25; rank++) {
    let corpsFound = false;
    let attempts = 0;

    while (!corpsFound && attempts < 100) {
      const randomYear = availableYears[Math.floor(Math.random() * availableYears.length)];
      const yearRankings = rankingsByYear[randomYear];
      
      if (yearRankings.length >= rank) {
        const candidate = yearRankings[rank - 1];
        
        if (candidate && !usedCorpsNames.has(candidate.corps)) {
          assignedCorps.push({
            name: candidate.corps,
            corpsName: candidate.corps, // Include both for compatibility
            sourceYear: randomYear,
            value: 26 - rank,
            pointCost: 26 - rank,
            rank: rank,
            finalScore: candidate.originalScore || 0,
          });
          usedCorpsNames.add(candidate.corps);
          corpsFound = true;
        }
      }
      attempts++;
    }

    if (!corpsFound) {
      functions.logger.warn(`Could not find unique corps for rank ${rank}, using placeholder`);
      assignedCorps.push({
        name: `Corps ${rank}`,
        corpsName: `Corps ${rank}`,
        sourceYear: 'placeholder',
        value: 26 - rank,
        pointCost: 26 - rank,
        rank: rank,
        finalScore: 0,
      });
    }
  }

  functions.logger.info(`Assigned ${assignedCorps.length} corps via rank-by-rank randomization.`);
  return assignedCorps;
}

// === SCHEDULE GENERATION FROM HISTORICAL DATA ===
async function generateScheduleFromHistory(db, seasonInfo, seasonId) {
  functions.logger.info(`Generating schedule for ${seasonInfo.totalDays}-day season...`);

  // Load historical events
  const scoresSnapshot = await db.collection("historical_scores").get();
  const showsByDay = new Map();
  
  scoresSnapshot.forEach((yearDoc) => {
    const yearData = yearDoc.data().data || [];
    yearData.forEach((event) => {
      if (event.eventName && event.offSeasonDay) {
        const showData = {
          eventName: event.eventName,
          date: event.date,
          location: event.location || 'Various Locations',
        };
        if (!showsByDay.has(event.offSeasonDay)) {
          showsByDay.set(event.offSeasonDay, []);
        }
        showsByDay.get(event.offSeasonDay).push(showData);
      }
    });
  });

  // Initialize schedule template
  const scheduleTemplate = Array.from({ length: seasonInfo.totalDays }, (_, i) => ({ 
    day: i + 1, 
    shows: [] 
  }));
  const usedEventNames = new Set();

  // Helper to place exclusive shows
  const placeExclusiveShow = (day, namePattern, location = null) => {
    const dayObject = scheduleTemplate.find((d) => d.day === day);
    if (!dayObject) return;

    const candidates = (showsByDay.get(day) || [])
      .filter(s => s.eventName.toLowerCase().includes(namePattern.toLowerCase()));
    
    const showToPlace = shuffleArray(candidates)[0] || {
      eventName: namePattern,
      location: location || 'Indianapolis, IN'
    };
    
    dayObject.shows = [showToPlace];
    usedEventNames.add(showToPlace.eventName);
  };

  // Place championship shows based on season type and gameplay requirements
  if (seasonInfo.seasonType === 'live') {
    // Live season championships (days 68-70)
    placeExclusiveShow(68, "DCI World Championship Prelims", "Indianapolis, IN");
    placeExclusiveShow(69, "DCI World Championship Semifinals", "Indianapolis, IN");
    placeExclusiveShow(70, "DCI World Championship Finals", "Indianapolis, IN");
    
    // Regional championships
    placeExclusiveShow(49, "Eastern Classic", "Allentown, PA");
    placeExclusiveShow(56, "Southeastern Championship", "Atlanta, GA");
    placeExclusiveShow(62, "Southwestern Championship", "San Antonio, TX");
  } else {
    // Off-season championships per requirements
    placeExclusiveShow(28, "Southwestern Championship", "San Antonio, TX");
    placeExclusiveShow(35, "Southeastern Championship", "Atlanta, GA");
    
    // Eastern Classic (2-day event on days 41-42)
    const ecShow = {
      eventName: "Eastern Classic",
      location: "Allentown, PA"
    };
    scheduleTemplate[40].shows = [ecShow]; // Day 41 (0-indexed)
    scheduleTemplate[41].shows = [ecShow]; // Day 42
    usedEventNames.add(ecShow.eventName);
    
    // Open/A Class Championships
    placeExclusiveShow(45, "Open and A Class Prelims", "Marion, IN");
    placeExclusiveShow(46, "Open and A Class Finals", "Marion, IN");
    
    // World Championships
    placeExclusiveShow(47, "World Championships Prelims", "Indianapolis, IN");
    placeExclusiveShow(48, "World Championships Semifinals", "Indianapolis, IN");
    placeExclusiveShow(49, "World Championships Finals", "Indianapolis, IN");
    
    // SoundSport on same day as Finals
    scheduleTemplate[48].shows.push({
      eventName: "SoundSport International Music & Food Festival",
      location: "Indianapolis, IN"
    });
  }

  // Fill remaining days with available shows
  scheduleTemplate.filter(d => d.shows.length === 0).forEach(dayObject => {
    const potentialShows = shuffleArray(showsByDay.get(dayObject.day) || []);
    const pickedShows = [];
    
    for (const show of potentialShows) {
      if (pickedShows.length >= 3) break; // Max 3 shows per day
      if (!usedEventNames.has(show.eventName)) {
        pickedShows.push(show);
        usedEventNames.add(show.eventName);
      }
    }
    
    // If no historical shows, generate placeholder
    if (pickedShows.length === 0) {
      pickedShows.push({
        eventName: generateShowName(dayObject.day),
        location: generateShowLocation()
      });
    }
    
    dayObject.shows = pickedShows;
  });

  // Convert to competition format
  const competitions = [];
  scheduleTemplate.forEach(dayObject => {
    dayObject.shows.forEach((show, index) => {
      const competitionDate = new Date(seasonInfo.startDate);
      competitionDate.setDate(competitionDate.getDate() + dayObject.day - 1);
      
      competitions.push({
        id: `${seasonId}_day${dayObject.day}_${index}`,
        day: dayObject.day,
        week: Math.ceil(dayObject.day / 7),
        date: admin.firestore.Timestamp.fromDate(competitionDate),
        name: show.eventName,
        location: show.location,
        type: determineCompetitionType(show.eventName, dayObject.day, seasonInfo.seasonType),
        allowedClasses: determineAllowedClasses(show.eventName, dayObject.day, seasonInfo.seasonType),
        status: 'scheduled'
      });
    });
  });

  functions.logger.info(`Generated schedule with ${competitions.length} competitions.`);
  return competitions;
}

function determineCompetitionType(eventName, day, seasonType) {
  const name = eventName.toLowerCase();
  if (name.includes('championship') || name.includes('finals')) return 'championship';
  if (name.includes('regional') || name.includes('classic')) return 'regional';
  return 'regular';
}

function determineAllowedClasses(eventName, day, seasonType) {
  const name = eventName.toLowerCase();
  
  // SoundSport only events
  if (name.includes('soundsport') || name.includes('music & food')) {
    return ['SoundSport'];
  }
  
  // Open/A Class specific events (days 45-46 in off-season)
  if (seasonType !== 'live' && (day === 45 || day === 46)) {
    return ['Open Class', 'A Class'];
  }
  
  // World Championships (exclude SoundSport)
  if ((seasonType === 'live' && day >= 68) || (seasonType !== 'live' && day >= 47 && day <= 49)) {
    return ['World Class', 'Open Class', 'A Class'];
  }
  
  // Regional championships (exclude SoundSport)
  if (name.includes('championship') || name.includes('classic')) {
    return ['World Class', 'Open Class', 'A Class'];
  }
  
  // Default: all classes except SoundSport for regular shows
  return ['World Class', 'Open Class', 'A Class'];
}

function generateShowName(day) {
  const week = Math.ceil(day / 7);
  const names = [
    'Season Opener', 'Early Season Classic', 'Spring Preview',
    'Regional Showcase', 'Mid-Season Invitational', 'Summer Classic',
    'Championship Preview', 'Late Season Tournament', 'Finals Warmup',
    'Championship Series'
  ];
  return names[week - 1] || `Competition Day ${day}`;
}

function generateShowLocation() {
  const locations = [
    'San Antonio, TX', 'Atlanta, GA', 'Denver, CO', 'Nashville, TN',
    'Phoenix, AZ', 'Portland, OR', 'Minneapolis, MN', 'Charlotte, NC',
    'Kansas City, MO', 'Seattle, WA', 'Detroit, MI', 'Orlando, FL',
    'St. Louis, MO', 'Cincinnati, OH', 'Pittsburgh, PA', 'Milwaukee, WI',
    'Indianapolis, IN', 'Columbus, OH', 'Memphis, TN', 'Louisville, KY'
  ];
  return locations[Math.floor(Math.random() * locations.length)];
}

// === SEASONAL SCORE GRID - USING EXISTING COLLECTION ===
async function createSeasonalScoreGrid(db, seasonId, assignedCorps, seasonInfo) {
  functions.logger.info(`Creating Seasonal Score Grid for ${seasonId}...`);

  // Group corps by source year for efficient fetching
  const corpsByYear = {};
  assignedCorps.forEach(corps => {
    const year = corps.sourceYear;
    if (!corpsByYear[year]) corpsByYear[year] = [];
    corpsByYear[year].push(corps.name);
  });

  const scoreGrid = {};

  // Fetch historical scores for each year
  for (const year of Object.keys(corpsByYear)) {
    if (year === 'placeholder') continue;
    
    const historicalDoc = await db.doc(`historical_scores/${year}`).get();
    if (!historicalDoc.exists) continue;
    
    const yearData = historicalDoc.data().data || [];
    const corpsInYear = new Set(corpsByYear[year]);
    
    // Process each event in the year
    yearData.forEach(event => {
      if (!event.scores || !event.offSeasonDay) return;
      
      event.scores.forEach(score => {
        if (corpsInYear.has(score.corps)) {
          if (!scoreGrid[score.corps]) scoreGrid[score.corps] = {};
          
          scoreGrid[score.corps][event.offSeasonDay] = {
            totalScore: score.score,
            captions: score.captions || {},
            eventName: event.eventName,
            date: event.date
          };
        }
      });
    });
  }

  // Save score grid to existing seasonal_scores collection
  const scoreGridRef = db.collection('seasonal_scores').doc(seasonId);
  await scoreGridRef.set({
    seasonId: seasonId,
    seasonType: seasonInfo.seasonType,
    grid: scoreGrid,
    corpsCount: Object.keys(scoreGrid).length,
    createdAt: admin.firestore.FieldValue.serverTimestamp()
  });

  functions.logger.info(`Score grid created with data for ${Object.keys(scoreGrid).length} corps.`);
  return scoreGrid;
}

// === MAIN INITIALIZATION ===
async function initializeNewSeason(db, seasonInfo) {
  functions.logger.info(`Initializing ${seasonInfo.seasonName}...`);

  // Fixed season ID generation - using consistent format with hyphen
  const seasonId = seasonInfo.seasonType === 'live' ?
    `live_${seasonInfo.finalsYear}` :
    `${seasonInfo.seasonType}_${seasonInfo.finalsYear - 1}-${seasonInfo.finalsYear.toString().slice(-2)}`;

  try {
    // 1. Assign corps
    const assignedCorps = seasonInfo.seasonType === 'live' ?
      await assignCorpsForLiveSeason(db, seasonInfo.finalsYear) :
      await assignCorpsForOffSeason(db);

    // 2. Generate schedule
    const schedule = await generateScheduleFromHistory(db, seasonInfo, seasonId);
    
    // 3. Create seasonal score grid
    await createSeasonalScoreGrid(db, seasonId, assignedCorps, seasonInfo);
    
    // 4. Get season number
    const seasonNumber = await getNextSeasonNumber(db);
    
    // 5. Calculate current progress
    const now = new Date();
    const daysSinceStart = Math.max(0, Math.floor((now - seasonInfo.startDate) / (1000 * 60 * 60 * 24)));
    const currentDay = Math.min(daysSinceStart + 1, seasonInfo.totalDays);
    const currentWeek = Math.min(Math.ceil(currentDay / 7), seasonInfo.totalWeeks);

    // 6. Create season data - FIXED FOR EXISTING STRUCTURE
    const seasonData = {
      activeSeasonId: seasonId,
      currentSeasonId: seasonId, // Both for compatibility
      seasonId: seasonId,
      seasonType: seasonInfo.seasonType === 'live' ? 'live' : 'off',
      seasonNumber: seasonNumber,
      seasonName: seasonInfo.seasonName,
      status: 'active',
      currentWeek: currentWeek,
      currentDay: currentDay,
      startDate: admin.firestore.Timestamp.fromDate(seasonInfo.startDate),
      endDate: admin.firestore.Timestamp.fromDate(seasonInfo.endDate),
      totalWeeks: seasonInfo.totalWeeks,
      totalDays: seasonInfo.totalDays,
      finalsYear: seasonInfo.finalsYear,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      lastProgressionCheck: admin.firestore.FieldValue.serverTimestamp()
    };

    // 7. Generate weekly schedule structure
    const weeks = {};
    for (let week = 1; week <= seasonInfo.totalWeeks; week++) {
      weeks[`week${week}`] = {
        weekNumber: week,
        competitions: schedule.filter(comp => comp.week === week)
      };
    }

    // 8. Save everything in a batch
    const batch = db.batch();
    
    // Game settings - using existing structure
    batch.set(db.collection('game-settings').doc('current'), seasonData);
    
    // DCI data - fixed collection name and structure
    batch.set(db.collection('dci-data').doc(seasonId), {
      seasonId: seasonId,
      seasonType: seasonInfo.seasonType,
      corps: assignedCorps,
      corpsValues: assignedCorps, // Keep both formats for compatibility
      assignedAt: admin.firestore.FieldValue.serverTimestamp()
    });
    
    // Schedule
    batch.set(db.collection('schedules').doc(seasonId), {
      seasonId: seasonId,
      competitions: schedule,
      weeks: weeks,
      generatedAt: admin.firestore.FieldValue.serverTimestamp()
    });
    
    // Initialize leaderboard
    batch.set(db.collection('leaderboards').doc(seasonId), {
      seasonId: seasonId,
      rankings: [],
      lastUpdated: admin.firestore.FieldValue.serverTimestamp()
    });
    
    // Initialize fantasy_recaps structure
    batch.set(db.collection('fantasy_recaps').doc(seasonId), {
      seasonId: seasonId,
      recaps: [],
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    });
    
    await batch.commit();

    functions.logger.info(`${seasonInfo.seasonName} initialized successfully!`);
    return { seasonId, seasonData };

  } catch (error) {
    functions.logger.error('Error initializing season:', error);
    throw error;
  }
}

// === SEASON PROGRESSION ===
async function checkAndProgressSeason(db) {
  const currentRef = db.collection('game-settings').doc('current');
  const currentDoc = await currentRef.get();
  
  if (!currentDoc.exists) {
    functions.logger.info('No active season found. Creating new season...');
    const seasonInfo = determineCurrentSeason(new Date());
    return await initializeNewSeason(db, seasonInfo);
  }
  
  const seasonData = currentDoc.data();
  const now = new Date();
  const seasonEnd = seasonData.endDate.toDate();
  
  // Check if season has ended
  if (now > seasonEnd) {
    functions.logger.info(`Season ${seasonData.seasonName} has ended. Archiving and starting new season...`);
    
    // Archive current season
    await db.collection('season-archives').doc(seasonData.seasonId).set({
      ...seasonData,
      archivedAt: admin.firestore.FieldValue.serverTimestamp()
    });
    
    // Start new season
    const newSeasonInfo = determineCurrentSeason(now);
    return await initializeNewSeason(db, newSeasonInfo);
  }
  
  // Update current day/week
  const seasonStart = seasonData.startDate.toDate();
  const daysSinceStart = Math.max(0, Math.floor((now - seasonStart) / (1000 * 60 * 60 * 24)));
  const currentDay = Math.min(daysSinceStart + 1, seasonData.totalDays);
  const currentWeek = Math.min(Math.ceil(currentDay / 7), seasonData.totalWeeks);
  
  if (currentDay !== seasonData.currentDay || currentWeek !== seasonData.currentWeek) {
    await currentRef.update({
      currentDay: currentDay,
      currentWeek: currentWeek,
      lastProgressionCheck: admin.firestore.FieldValue.serverTimestamp()
    });
    functions.logger.info(`Updated season progress: Day ${currentDay}, Week ${currentWeek}`);
  }
  
  return { message: 'Season progression checked', currentDay, currentWeek };
}

// === CLOUD FUNCTIONS ===

/**
 * Daily season scheduler - runs at 3:00 AM ET
 */
exports.seasonScheduler = functions
  .runWith({ timeoutSeconds: 300, memory: '512MB' })
  .pubsub.schedule('every day 03:00')
  .timeZone('America/New_York')
  .onRun(async (context) => {
    functions.logger.info("Running daily season scheduler...");
    const db = admin.firestore();
    
    try {
      const result = await checkAndProgressSeason(db);
      functions.logger.info('Season scheduler completed:', result);
      return result;
    } catch (error) {
      functions.logger.error('Season scheduler error:', error);
      throw error;
    }
  });

/**
 * Manual season initialization (admin only)
 */
exports.initializeSeasonManually = functions
  .runWith({ timeoutSeconds: 300, memory: '512MB' })
  .https.onCall(async (data, context) => {
    // Verify admin
    if (!context.auth || context.auth.uid !== 'o8vfRCOevjTKBY0k2dISlpiYiIH2') {
      throw new functions.https.HttpsError('permission-denied', 'Admin access required.');
    }
    
    const db = admin.firestore();
    
    try {
      const forceNewSeason = data?.forceNew || false;
      
      if (forceNewSeason) {
        // Archive current season if exists
        const currentDoc = await db.collection('game-settings').doc('current').get();
        if (currentDoc.exists) {
          const seasonData = currentDoc.data();
          await db.collection('season-archives').doc(seasonData.seasonId).set({
            ...seasonData,
            archivedAt: admin.firestore.FieldValue.serverTimestamp(),
            forcedEnd: true
          });
        }
      }
      
      const seasonInfo = determineCurrentSeason(new Date());
      const result = await initializeNewSeason(db, seasonInfo);
      
      return {
        success: true,
        message: `${seasonInfo.seasonName} initialized successfully`,
        seasonId: result.seasonId,
        seasonData: result.seasonData
      };
    } catch (error) {
      functions.logger.error("Manual season initialization failed:", error);
      throw new functions.https.HttpsError('internal', `Failed to initialize season: ${error.message}`);
    }
  });

/**
 * Get available corps for current season - FIXED FOR LINEUP EDITOR
 */
exports.getAvailableCorps = functions
  .runWith({ timeoutSeconds: 60, memory: '256MB' })
  .https.onCall(async (data, context) => {
    if (!context.auth) {
      throw new functions.https.HttpsError('unauthenticated', 'Authentication required.');
    }
    
    const db = admin.firestore();
    
    try {
      // Get current season - check both field names for compatibility
      const currentDoc = await db.collection('game-settings').doc('current').get();
      if (!currentDoc.exists) {
        throw new functions.https.HttpsError('failed-precondition', 'No active season found.');
      }
      
      const currentData = currentDoc.data();
      const seasonId = currentData.activeSeasonId || currentData.currentSeasonId;
      
      if (!seasonId) {
        throw new functions.https.HttpsError('failed-precondition', 'Season ID not found.');
      }
      
      // Get corps for this season
      const corpsDoc = await db.collection('dci-data').doc(seasonId).get();
      if (!corpsDoc.exists) {
        throw new functions.https.HttpsError('not-found', 'Corps data not found for current season.');
      }
      
      const corpsData = corpsDoc.data();
      const corps = corpsData.corps || corpsData.corpsValues || [];

      // Add this debug log
      functions.logger.info(`Raw corps data sample:`, JSON.stringify(corps[0]));

      // Ensure corps have required fields for LineupEditor
      const formattedCorps = corps.map(c => ({
        name: c.name || c.corpsName,
        corpsName: c.corpsName || c.name, 
        value: c.value,
        pointCost: c.pointCost || c.value,
        sourceYear: c.sourceYear,  // This should be picking it up
        rank: c.rank,
        finalScore: c.finalScore
      }));

      // Add this debug log too
      functions.logger.info(`Formatted corps sample:`, JSON.stringify(formattedCorps[0]));
      
      return {
        success: true,
        seasonId: seasonId,
        corps: formattedCorps
      };
      
    } catch (error) {
      if (error.code) throw error; // Re-throw HTTP errors
      functions.logger.error('Error getting available corps:', error);
      throw new functions.https.HttpsError('internal', 'Failed to get available corps.');
    }
  });