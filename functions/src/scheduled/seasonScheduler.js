/**
 * marching.art Season Scheduler - CORRECTED VERSION
 * Ensures values are ALWAYS 1-25 based on rank, never uses originalScore as value
 */

const functions = require('firebase-functions');
const admin = require('firebase-admin');
const { getFunctionConfig } = require('../../config');

const SEASON_CONFIG = {
  LIVE_SEASON_DAYS: 70,
  OFF_SEASON_DAYS: 49,
  SEASON_START_HOUR: 3,
  SEASON_THEMES: ['Overture', 'Allegro', 'Adagio', 'Scherzo', 'Crescendo', 'Finale'],
};

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

/**
 * BULLETPROOF: Assigns corps for LIVE season with proper validation
 */
async function assignCorpsForLiveSeason(db, seasonId, finalsYear) {
  const previousYear = (parseInt(finalsYear) - 1).toString();
  
  functions.logger.info(`Assigning live season corps from ${previousYear} finals...`);
  
  const rankingsRef = db.collection('final_rankings').doc(previousYear);
  const rankingsDoc = await rankingsRef.get();

  if (!rankingsDoc.exists) {
    throw new Error(`Cannot create live season. Final rankings for ${previousYear} not found.`);
  }

  const data = rankingsDoc.data();
  
  // Handle different data structures
  let rankings = null;
  if (data.rankings && Array.isArray(data.rankings)) {
    rankings = data.rankings;
  } else if (data.data && Array.isArray(data.data)) {
    rankings = data.data;
  }
  
  if (!rankings || rankings.length < 25) {
    throw new Error(
      `Insufficient corps in ${previousYear} rankings: ` +
      `${rankings ? rankings.length : 0}/25 required`
    );
  }

  functions.logger.info(`Found ${rankings.length} corps in ${previousYear} finals`);

  // Assign with rank-based values: 1st=25pts, 2nd=24pts, ..., 25th=1pt
  const assignedCorps = rankings.slice(0, 25).map((entry, index) => {
    const rankBasedValue = 25 - index;
    
    return {
      name: entry.corps,
      corpsName: entry.corps,
      sourceYear: previousYear,
      value: rankBasedValue,           // CORRECT: 25-index
      pointCost: rankBasedValue,       // Same as value
      rank: index + 1,                 // 1-25
      finalScore: entry.originalScore || entry.score || 0,
    };
  });

  // Verify values
  const invalidCorps = assignedCorps.filter(c => c.value < 1 || c.value > 25);
  if (invalidCorps.length > 0) {
    throw new Error(`Invalid values: ${invalidCorps.map(c => `${c.name}=${c.value}`).join(', ')}`);
  }

  functions.logger.info(`✅ Assigned 25 corps from ${previousYear} with values 1-25`);
  functions.logger.info(`Top 3: ${assignedCorps.slice(0, 3).map(c => `${c.name}=${c.value}pts`).join(', ')}`);

  // Save (OVERWRITE mode)
  await db.collection('dci-data').doc(seasonId).set({
    assignedAt: admin.firestore.FieldValue.serverTimestamp(),
    corps: assignedCorps,
    seasonType: 'live',
    finalsYear: parseInt(finalsYear),
    sourceYear: previousYear,
    totalCorps: assignedCorps.length
  }, { merge: false });

  return assignedCorps;
}

/**
 * BULLETPROOF: Assigns 25 corps for OFF-SEASON from various historical years
 * Handles missing/malformed data gracefully
 */
async function assignCorpsForOffSeason(db, seasonId) {
  functions.logger.info('Starting off-season corps assignment...');
  
  const rankingsSnapshot = await db.collection("final_rankings").get();
  
  if (rankingsSnapshot.empty) {
    throw new Error("No final rankings found. Cannot assign corps.");
  }

  // Build rankings map with validation
  const allRankingsByYear = {};
  let totalValidYears = 0;
  
  rankingsSnapshot.forEach(doc => {
    const data = doc.data();
    const year = doc.id;
    
    // CRITICAL: Handle different data structures
    let rankings = null;
    
    // Try rankings field first
    if (data.rankings && Array.isArray(data.rankings)) {
      rankings = data.rankings;
    }
    // Try data field (alternate structure)
    else if (data.data && Array.isArray(data.data)) {
      rankings = data.data;
    }
    
    // Validate rankings array
    if (rankings && rankings.length >= 25) {
      // Ensure each entry has required fields
      const validRankings = rankings.filter(entry => 
        entry && 
        entry.corps && 
        typeof entry.corps === 'string' &&
        entry.rank && 
        typeof entry.rank === 'number'
      );
      
      if (validRankings.length >= 25) {
        allRankingsByYear[year] = validRankings;
        totalValidYears++;
        functions.logger.info(`Loaded ${validRankings.length} corps from ${year}`);
      } else {
        functions.logger.warn(`Year ${year} has insufficient valid rankings (${validRankings.length}/25)`);
      }
    } else {
      functions.logger.warn(`Year ${year} skipped: ${rankings ? `only ${rankings.length} corps` : 'no rankings array'}`);
    }
  });

  if (totalValidYears === 0) {
    throw new Error("No valid final rankings found with sufficient corps data.");
  }

  functions.logger.info(`Found ${totalValidYears} valid years for corps assignment`);

  const availableYears = Object.keys(allRankingsByYear);
  const assignedCorps = [];
  const usedCorpsNames = new Set();

  // Assign one corps per rank (1-25)
  for (let rank = 1; rank <= 25; rank++) {
    let corpsFound = false;
    let attempts = 0;
    const maxAttempts = availableYears.length * 5; // More attempts for flexibility

    while (!corpsFound && attempts < maxAttempts) {
      const randomYear = availableYears[Math.floor(Math.random() * availableYears.length)];
      const yearRankings = allRankingsByYear[randomYear];
      
      // Safety check (should never be undefined due to validation above)
      if (!yearRankings) {
        attempts++;
        continue;
      }
      
      const candidate = yearRankings.find(c => c.rank === rank);

      if (candidate && !usedCorpsNames.has(candidate.corps)) {
        const rankBasedValue = 26 - rank; // rank 1=25, rank 2=24, ..., rank 25=1
        
        assignedCorps.push({
          name: candidate.corps,
          corpsName: candidate.corps,
          sourceYear: randomYear,
          value: rankBasedValue,          // CORRECT: 26-rank gives values 1-25
          pointCost: rankBasedValue,      // Same as value
          rank: rank,                     // 1-25
          finalScore: candidate.originalScore || candidate.score || 0,
        });
        
        usedCorpsNames.add(candidate.corps);
        corpsFound = true;
        
        functions.logger.info(`Rank ${rank}: ${candidate.corps} (${randomYear}) = ${rankBasedValue}pts`);
      }
      attempts++;
    }

    if (!corpsFound) {
      functions.logger.error(`FAILED to find unique corps for rank ${rank} after ${maxAttempts} attempts`);
      throw new Error(`Could not assign corps for rank ${rank}. Insufficient unique corps in rankings data.`);
    }
  }

  if (assignedCorps.length !== 25) {
    throw new Error(`Assignment incomplete: only ${assignedCorps.length}/25 corps assigned`);
  }

  // Verify values are correct (1-25 range)
  const invalidCorps = assignedCorps.filter(c => c.value < 1 || c.value > 25);
  if (invalidCorps.length > 0) {
    throw new Error(`Invalid values detected: ${invalidCorps.map(c => `${c.name}=${c.value}`).join(', ')}`);
  }

  functions.logger.info(`✅ Successfully assigned 25 corps with values 1-25`);
  functions.logger.info(`Sample: ${assignedCorps[0].name}=${assignedCorps[0].value}pts (rank ${assignedCorps[0].rank})`);

  // Save to database (OVERWRITE mode)
  await db.collection('dci-data').doc(seasonId).set({
    assignedAt: admin.firestore.FieldValue.serverTimestamp(),
    corps: assignedCorps,
    seasonType: 'off-season',
    totalCorps: assignedCorps.length
  }, { merge: false });

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
  return ['World Class', 'Open Class', 'A Class', 'SoundSport'];
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

/**
 * Initialize new season - FIXED to always overwrite dci-data
 */
async function initializeNewSeason(db, seasonInfo) {
  const seasonId = seasonInfo.seasonType === 'live' ?
    `live_${seasonInfo.finalsYear}` :
    `${seasonInfo.seasonType}_${seasonInfo.finalsYear - 1}-${seasonInfo.finalsYear.toString().slice(-2)}`;

  try {
    functions.logger.info(`Initializing ${seasonInfo.seasonName} (${seasonId})`);

    // Check if season already exists
    const existingSeasonDoc = await db.collection('dci-data').doc(seasonId).get();
    if (existingSeasonDoc.exists) {
      functions.logger.warn(`Season ${seasonId} already exists. OVERWRITING with fresh data.`);
    }

    // 1. Assign corps (this will OVERWRITE existing data)
    const assignedCorps = seasonInfo.seasonType === 'live' ?
      await assignCorpsForLiveSeason(db, seasonId, seasonInfo.finalsYear) :
      await assignCorpsForOffSeason(db, seasonId);

    // Verify values are correct
    const invalidCorps = assignedCorps.filter(c => c.value < 1 || c.value > 25);
    if (invalidCorps.length > 0) {
      throw new Error(`Invalid corps values detected: ${invalidCorps.map(c => `${c.name}=${c.value}`).join(', ')}`);
    }

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

    // 6. Create season data
    const seasonData = {
      activeSeasonId: seasonId,
      currentSeasonId: seasonId,
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

    // 8. Save everything in a batch (OVERWRITE mode)
    const batch = db.batch();
    
    batch.set(db.collection('game-settings').doc('current'), seasonData, { merge: false });
    
    // dci-data already set above with overwrite
    
    batch.set(db.collection('schedules').doc(seasonId), {
      seasonId: seasonId,
      competitions: schedule,
      weeks: weeks,
      generatedAt: admin.firestore.FieldValue.serverTimestamp()
    }, { merge: false });
    
    batch.set(db.collection('leaderboards').doc(seasonId), {
      seasonId: seasonId,
      rankings: [],
      lastUpdated: admin.firestore.FieldValue.serverTimestamp()
    }, { merge: false });
    
    batch.set(db.collection('fantasy_recaps').doc(seasonId), {
      seasonId: seasonId,
      recaps: [],
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    }, { merge: false });
    
    await batch.commit();

    functions.logger.info(`✅ ${seasonInfo.seasonName} initialized successfully with ${assignedCorps.length} corps (values 1-25)`);
    
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

exports.checkSeasonStatus = functions
  .runWith(getFunctionConfig('scheduled'))
  .pubsub.schedule('0 3 * * *')
  .timeZone('America/New_York')
  .onRun(async (context) => {
    const db = admin.firestore();
    await checkAndProgressSeason(db);
  });

exports.initializeSeasonManually = functions
  .runWith(getFunctionConfig('default'))
  .https.onCall(async (data, context) => {
    if (!context.auth || context.auth.uid !== 'o8vfRCOevjTKBY0k2dISlpiYiIH2') {
      throw new functions.https.HttpsError('permission-denied', 'Admin only');
    }

    try {
      const db = admin.firestore();
      const currentDate = new Date();
      const seasonInfo = determineCurrentSeason(currentDate);
      const result = await initializeNewSeason(db, seasonInfo);
      
      return {
        success: true,
        message: `${seasonInfo.seasonName} initialized successfully`,
        seasonId: result.seasonId,
        corpsCount: (await db.collection('dci-data').doc(result.seasonId).get()).data().corps.length
      };
    } catch (error) {
      functions.logger.error('Manual initialization error:', error);
      throw new functions.https.HttpsError('internal', error.message);
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
      const currentDoc = await db.collection('game-settings').doc('current').get();
      if (!currentDoc.exists) {
        throw new functions.https.HttpsError('failed-precondition', 'No active season found.');
      }
      
      const currentData = currentDoc.data();
      const seasonId = currentData.activeSeasonId || currentData.currentSeasonId;
      
      const corpsDoc = await db.collection('dci-data').doc(seasonId).get();
      if (!corpsDoc.exists) {
        throw new functions.https.HttpsError('not-found', 'Corps data not found for current season.');
      }
      
      const corpsData = corpsDoc.data();
      const corps = corpsData.corps || corpsData.corpsValues || [];
      
      // Log the first corps to see what we're getting
      functions.logger.info('First corps from database:', JSON.stringify(corps[0]));
      
      // Just return the corps as-is without any mapping
      return {
        success: true,
        seasonId: seasonId,
        corps: corps  // Return directly without formatting
      };
      
    } catch (error) {
      if (error.code) throw error;
      functions.logger.error('Error getting available corps:', error);
      throw new functions.https.HttpsError('internal', 'Failed to get available corps.');
    }
  });