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
 * CORRECT: Assigns corps for LIVE season using points field from final_rankings
 * Uses the pre-assigned points value, NOT index calculation
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

  // Validate all have points field
  const validRankings = rankings.filter(entry =>
    entry &&
    entry.corps &&
    entry.points &&
    typeof entry.points === 'number' &&
    entry.points >= 1 && entry.points <= 25
  );

  if (validRankings.length < 25) {
    throw new Error(
      `Insufficient corps with valid points in ${previousYear}: ` +
      `${validRankings.length}/25 required`
    );
  }

  // Sort by points descending, then take top 25
  const sortedRankings = validRankings
    .sort((a, b) => b.points - a.points)
    .slice(0, 25);

  // Assign using POINTS field from database
  const assignedCorps = sortedRankings.map(entry => ({
    name: entry.corps,
    corpsName: entry.corps,
    sourceYear: previousYear,
    value: entry.points,                    // USE points field directly
    pointCost: entry.points,                // Same as value
    rank: entry.rank || 0,                  // Store rank for reference
    finalScore: entry.originalScore || entry.score || 0,
  }));

  // Verify values
  const invalidCorps = assignedCorps.filter(c => c.value < 1 || c.value > 25);
  if (invalidCorps.length > 0) {
    throw new Error(`Invalid values: ${invalidCorps.map(c => `${c.name}=${c.value}`).join(', ')}`);
  }

  functions.logger.info(`✅ Assigned 25 corps from ${previousYear} using points field`);
  functions.logger.info(`Top 3: ${assignedCorps.slice(0, 3).map(c => `${c.name}=${c.value}pts (rank ${c.rank})`).join(', ')}`);

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
 * CORRECT: Assigns corps for OFF-SEASON using points field from final_rankings
 * Uses the pre-assigned points value, NOT rank calculation
 */
async function assignCorpsForOffSeason(db, seasonId) {
  functions.logger.info('Starting off-season corps assignment...');
  
  const rankingsSnapshot = await db.collection("final_rankings").get();
  
  if (rankingsSnapshot.empty) {
    throw new Error("No final rankings found. Cannot assign corps.");
  }

  // Pool ALL corps from ALL years into a single array
  const allCorps = [];
  
  rankingsSnapshot.forEach(doc => {
    const data = doc.data();
    const year = doc.id;
    
    // Handle different data structures
    let rankings = null;
    if (data.rankings && Array.isArray(data.rankings)) {
      rankings = data.rankings;
    } else if (data.data && Array.isArray(data.data)) {
      rankings = data.data;
    }
    
    if (rankings && Array.isArray(rankings)) {
      // Add all valid corps from this year to the pool
      rankings.forEach(entry => {
        if (entry && 
            entry.corps && 
            typeof entry.corps === 'string' &&
            entry.points &&
            typeof entry.points === 'number' &&
            entry.points >= 1 && 
            entry.points <= 25) {
          
          allCorps.push({
            corps: entry.corps,
            points: entry.points,
            rank: entry.rank || 0,
            score: entry.originalScore || entry.score || 0,
            sourceYear: year
          });
        }
      });
    }
  });

  if (allCorps.length === 0) {
    throw new Error("No valid corps found in any final_rankings documents.");
  }

  functions.logger.info(`Pooled ${allCorps.length} total corps from all years`);

  // Group corps by point value
  const corpsByPoints = {};
  for (let p = 1; p <= 25; p++) {
    corpsByPoints[p] = [];
  }
  
  allCorps.forEach(corps => {
    if (corpsByPoints[corps.points]) {
      corpsByPoints[corps.points].push(corps);
    }
  });

  // Log availability
  for (let p = 25; p >= 1; p--) {
    const count = corpsByPoints[p].length;
    if (count === 0) {
      functions.logger.warn(`⚠️  No corps available with ${p} points`);
    } else {
      functions.logger.info(`Points ${p}: ${count} corps available`);
    }
  }

  // Select one corps for each point value (25 down to 1)
  const assignedCorps = [];
  const usedCorpsNames = new Set();

  for (let pointValue = 25; pointValue >= 1; pointValue--) {
    const candidates = corpsByPoints[pointValue].filter(c => !usedCorpsNames.has(c.corps));
    
    if (candidates.length === 0) {
      throw new Error(
        `No available corps with ${pointValue} points. ` +
        `Cannot complete 25-corps assignment. ` +
        `Already assigned: ${assignedCorps.length}/25`
      );
    }

    // Randomly select one from available candidates
    const selected = candidates[Math.floor(Math.random() * candidates.length)];
    
    assignedCorps.push({
      name: selected.corps,
      corpsName: selected.corps,
      sourceYear: selected.sourceYear,
      value: selected.points,
      pointCost: selected.points,
      rank: selected.rank,
      finalScore: selected.score,
    });
    
    usedCorpsNames.add(selected.corps);
    
    functions.logger.info(
      `Points ${pointValue}: ${selected.corps} (${selected.sourceYear}, rank ${selected.rank})`
    );
  }

  if (assignedCorps.length !== 25) {
    throw new Error(`Assignment incomplete: only ${assignedCorps.length}/25 corps assigned`);
  }

  // Sort by value descending for display
  assignedCorps.sort((a, b) => b.value - a.value);

  functions.logger.info(`✅ Successfully assigned 25 corps with values 1-25`);
  functions.logger.info(`Top 3: ${assignedCorps.slice(0, 3).map(c => `${c.name}=${c.value}pts`).join(', ')}`);

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
  
  // SoundSport ONLY events
  if (name.includes('soundsport') || name.includes('music & food')) {
    return ['SoundSport'];
  }
  
  // Open/A Class specific events (days 45-46 in off-season)
  if (seasonType !== 'live' && (day === 45 || day === 46)) {
    return ['Open Class', 'A Class'];
  }
  
  // World Championships (exclude SoundSport) - Days 47-49
  if ((seasonType === 'live' && day >= 68) || (seasonType !== 'live' && day >= 47 && day <= 49)) {
    return ['World Class', 'Open Class', 'A Class'];
  }
  
  // Regional championships (exclude SoundSport)
  // Off-season: Days 28, 35, 41, 42
  // Live season: Days 49, 56, 62
  if (name.includes('championship') || name.includes('classic')) {
    return ['World Class', 'Open Class', 'A Class'];
  }
  
  // FIXED: Default regular shows - ALL CLASSES INCLUDING SOUNDSPORT
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