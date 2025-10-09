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
  
  // Calculate the second Saturday of August for this year
  const augustFirst = new Date(currentYear, 7, 1); // August is month 7 (0-indexed)
  const firstDayOfWeek = augustFirst.getDay();
  const daysUntilFirstSaturday = (6 - firstDayOfWeek + 7) % 7;
  const firstSaturday = 1 + daysUntilFirstSaturday;
  const secondSaturday = firstSaturday + 7;
  
  // Finals day is the second Saturday of August at 23:00 (11 PM)
  const finalsDay = new Date(currentYear, 7, secondSaturday, 23, 0, 0);
  
  // Live season is 70 days (10 weeks) ending on finals day
  const liveSeasonStart = new Date(finalsDay);
  liveSeasonStart.setDate(liveSeasonStart.getDate() - 69); // 70 days total (including finals day)
  
  const liveSeasonEnd = new Date(finalsDay);
  liveSeasonEnd.setHours(23, 59, 59, 999);
  
  // Off-season is 49 days (7 weeks)
  const OFF_SEASON_DAYS = 49;
  const OFF_SEASON_WEEKS = 7;
  
  // Check if we're in the live season
  if (currentDate >= liveSeasonStart && currentDate <= liveSeasonEnd) {
    functions.logger.info(`Current date is in LIVE SEASON ${currentYear}`);
    return {
      seasonType: 'live',
      seasonName: `Live Season ${currentYear}`,
      finalsYear: currentYear,
      startDate: liveSeasonStart,
      endDate: liveSeasonEnd,
      totalWeeks: 10,
      totalDays: 70
    };
  }
  
  // We're in an off-season - determine which one
  // Off-seasons are named by the live season they lead up to
  
  // Calculate when off-seasons start after previous live season
  const prevYearFinalsDay = new Date(currentYear - 1, 7, secondSaturday, 23, 0, 0);
  const prevLiveSeasonEnd = new Date(prevYearFinalsDay);
  prevLiveSeasonEnd.setHours(23, 59, 59, 999);
  
  // First off-season starts at 3 AM Eastern the day after previous finals
  const offSeasonsStartDate = new Date(prevLiveSeasonEnd);
  offSeasonsStartDate.setDate(offSeasonsStartDate.getDate() + 1);
  offSeasonsStartDate.setHours(3, 0, 0, 0); // 3 AM reset
  
  // Calculate which of the 6 off-seasons we're in
  const daysSinceOffSeasonStart = Math.floor((currentDate - offSeasonsStartDate) / (1000 * 60 * 60 * 24));
  
  if (daysSinceOffSeasonStart < 0) {
    // Before this year's off-seasons, use previous year
    const prevPrevYearFinalsDay = new Date(currentYear - 2, 7, secondSaturday, 23, 0, 0);
    const prevPrevLiveEnd = new Date(prevPrevYearFinalsDay);
    prevPrevLiveEnd.setHours(23, 59, 59, 999);
    
    const prevOffSeasonsStart = new Date(prevPrevLiveEnd);
    prevOffSeasonsStart.setDate(prevOffSeasonsStart.getDate() + 1);
    prevOffSeasonsStart.setHours(3, 0, 0, 0);
    
    const daysSincePrevStart = Math.floor((currentDate - prevOffSeasonsStart) / (1000 * 60 * 60 * 24));
    const offSeasonNumber = Math.floor(daysSincePrevStart / OFF_SEASON_DAYS) + 1;
    const dayIntoOffSeason = daysSincePrevStart % OFF_SEASON_DAYS;
    
    const seasonStartDate = new Date(prevOffSeasonsStart);
    seasonStartDate.setDate(seasonStartDate.getDate() + ((offSeasonNumber - 1) * OFF_SEASON_DAYS));
    
    const seasonEndDate = new Date(seasonStartDate);
    seasonEndDate.setDate(seasonEndDate.getDate() + OFF_SEASON_DAYS - 1);
    seasonEndDate.setHours(23, 59, 59, 999);
    
    const seasonTheme = getOffSeasonTheme(offSeasonNumber);
    const baseYear = currentYear - 1;
    
    return {
      seasonType: seasonTheme.toLowerCase(),
      seasonName: `${seasonTheme} Season ${baseYear}-${(baseYear + 1).toString().slice(-2)}`,
      finalsYear: currentYear,
      startDate: seasonStartDate,
      endDate: seasonEndDate,
      totalWeeks: OFF_SEASON_WEEKS,
      totalDays: OFF_SEASON_DAYS
    };
  }
  
  // Calculate which off-season (1-6)
  const offSeasonNumber = Math.floor(daysSinceOffSeasonStart / OFF_SEASON_DAYS) + 1;
  
  // If we're past the 6th off-season, we should be in the live season
  // This is a safety check
  if (offSeasonNumber > 6) {
    functions.logger.warn(`Calculated off-season ${offSeasonNumber} > 6, defaulting to live season`);
    return {
      seasonType: 'live',
      seasonName: `Live Season ${currentYear}`,
      finalsYear: currentYear,
      startDate: liveSeasonStart,
      endDate: liveSeasonEnd,
      totalWeeks: 10,
      totalDays: 70
    };
  }
  
  // Calculate start date of this off-season
  const seasonStartDate = new Date(offSeasonsStartDate);
  seasonStartDate.setDate(seasonStartDate.getDate() + ((offSeasonNumber - 1) * OFF_SEASON_DAYS));
  
  const seasonEndDate = new Date(seasonStartDate);
  seasonEndDate.setDate(seasonEndDate.getDate() + OFF_SEASON_DAYS - 1);
  seasonEndDate.setHours(23, 59, 59, 999);
  
  const seasonTheme = getOffSeasonTheme(offSeasonNumber);
  const baseYear = currentYear - 1;
  
  functions.logger.info(`Current date is in ${seasonTheme.toUpperCase()} SEASON (${offSeasonNumber}/6) for year ${baseYear}-${baseYear + 1}`);
  
  return {
    seasonType: seasonTheme.toLowerCase(),
    seasonName: `${seasonTheme} Season ${baseYear}-${(baseYear + 1).toString().slice(-2)}`,
    finalsYear: currentYear,
    startDate: seasonStartDate,
    endDate: seasonEndDate,
    totalWeeks: OFF_SEASON_WEEKS,
    totalDays: OFF_SEASON_DAYS
  };
}

/**
 * Get themed name for off-season based on number (1-6)
 */
function getOffSeasonTheme(offSeasonNumber) {
  const themes = ['Overture', 'Prelude', 'Intermezzo', 'Nocturne', 'Allegro', 'Finale'];
  return themes[offSeasonNumber - 1] || 'Allegro';
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
    // First, try to find unused corps
    let candidates = corpsByPoints[pointValue].filter(c => !usedCorpsNames.has(c.corps));
    
    // If all corps at this point value have been used, allow reusing
    if (candidates.length === 0) {
      candidates = corpsByPoints[pointValue];
      functions.logger.warn(
        `⚠️  All corps with ${pointValue} points already used. Reusing from pool of ${candidates.length}.`
      );
    }
    
    if (candidates.length === 0) {
      throw new Error(
        `No corps available with ${pointValue} points. ` +
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
  functions.logger.info(`Season starts: ${seasonInfo.startDate.toISOString()}`);
  functions.logger.info(`Season ends: ${seasonInfo.endDate.toISOString()}`);

  // Load historical events
  const scoresSnapshot = await db.collection("historical_scores").get();
  const showsByDay = new Map();
  
  scoresSnapshot.forEach((yearDoc) => {
    const yearData = yearDoc.data().data || [];
    yearData.forEach((event) => {
      if (event.eventName && event.offSeasonDay && event.location) {
        const showData = {
          eventName: event.eventName,
          location: event.location,
          date: event.date,
        };
        if (!showsByDay.has(event.offSeasonDay)) {
          showsByDay.set(event.offSeasonDay, []);
        }
        showsByDay.get(event.offSeasonDay).push(showData);
      }
    });
  });

  functions.logger.info(`Loaded historical shows for ${showsByDay.size} different days`);

  // Track used cities and event names to avoid duplicates
  const usedCities = new Set();
  const regionalCities = new Set(); // Multi-day regionals can reuse cities
  const usedEventNames = new Set();

  // Initialize schedule template
  const scheduleTemplate = Array.from({ length: seasonInfo.totalDays }, (_, i) => ({
    day: i + 1,
    shows: []
  }));

  // Helper to place exclusive shows
  function placeExclusiveShow(day, name, location) {
    scheduleTemplate[day - 1].shows = [{
      eventName: name,
      location: location
    }];
    usedEventNames.add(name);
    
    const city = location.split(',')[0].trim();
    usedCities.add(city);
  }

  // Helper to place multi-day regional
  function placeRegional(days, baseName, location) {
    const city = location.split(',')[0].trim();
    regionalCities.add(city); // Allow this city to be used multiple times
    
    days.forEach((day, index) => {
      const dayLabel = days.length > 1 ? ` - Day ${index + 1}` : '';
      placeExclusiveShow(day, `${baseName}${dayLabel}`, location);
    });
  }

  // Place championship/regional shows based on season type
  if (seasonInfo.seasonType !== 'live') {
    // Off-season schedule (49 days)
    // Regionals on specific days only
    placeExclusiveShow(28, "Southwestern Championship", "San Antonio, TX");
    placeExclusiveShow(35, "Southern Championship", "Atlanta, GA");
    placeRegional([41, 42], "Eastern Classic", "Allentown, PA");
    
    // Championships - only use Marion and Indianapolis for finals
    placeExclusiveShow(45, "Open Class Prelims", "Marion, IN");
    placeExclusiveShow(46, "Open Class Finals", "Marion, IN");
    placeExclusiveShow(47, "World Championships Prelims", "Indianapolis, IN");
    placeExclusiveShow(48, "World Championships Semifinals", "Indianapolis, IN");
    placeExclusiveShow(49, "World Championships Finals", "Indianapolis, IN");
    
    // SoundSport on same day as Finals
    scheduleTemplate[48].shows.push({
      eventName: "SoundSport International Music & Food Festival",
      location: "Indianapolis, IN"
    });
    usedEventNames.add("SoundSport International Music & Food Festival");
  } else {
    // Live season schedule (70 days)
    // Regionals on specific days only
    placeExclusiveShow(49, "Southwestern Championship", "San Antonio, TX");
    placeExclusiveShow(56, "Southern Championship", "Atlanta, GA");
    placeExclusiveShow(62, "Eastern Classic", "Allentown, PA");
    
    // Finals week - only use Indianapolis for World Championships
    placeExclusiveShow(68, "World Championships Prelims", "Indianapolis, IN");
    placeExclusiveShow(69, "World Championships Semifinals", "Indianapolis, IN");
    placeExclusiveShow(70, "World Championships Finals", "Indianapolis, IN");
    
    // SoundSport
    scheduleTemplate[69].shows.push({
      eventName: "SoundSport International Music & Food Festival",
      location: "Indianapolis, IN"
    });
    usedEventNames.add("SoundSport International Music & Food Festival");
  }

  // Fill remaining days with historical shows ONLY
  scheduleTemplate.filter(d => d.shows.length === 0).forEach(dayObject => {
    const potentialShows = shuffleArray(showsByDay.get(dayObject.day) || []);
    const pickedShows = [];
    
    for (const show of potentialShows) {
      if (pickedShows.length >= 3) break;
      
      // Check if event name already used
      if (usedEventNames.has(show.eventName)) continue;
      
      // Check if city already used (unless it's a regional city)
      const city = show.location ? show.location.split(',')[0].trim() : '';
      if (!city) continue; // Skip shows without valid location
      
      if (usedCities.has(city) && !regionalCities.has(city)) continue;
      
      // Don't use Marion or Indianapolis during regular season
      if (!isChampionshipDay(dayObject.day, seasonInfo) && 
          (city === 'Marion' || city === 'Indianapolis')) continue;
      
      pickedShows.push(show);
      usedEventNames.add(show.eventName);
      usedCities.add(city);
    }
    
    // If no shows found for this exact day, try nearby days
    if (pickedShows.length === 0) {
      const nearbyDays = [
        dayObject.day - 1, 
        dayObject.day + 1, 
        dayObject.day - 2, 
        dayObject.day + 2
      ].filter(d => d > 0 && d <= seasonInfo.totalDays);
      
      for (const nearbyDay of nearbyDays) {
        if (pickedShows.length >= 3) break;
        
        const nearbyShows = shuffleArray(showsByDay.get(nearbyDay) || []);
        
        for (const show of nearbyShows) {
          if (pickedShows.length >= 3) break;
          
          if (usedEventNames.has(show.eventName)) continue;
          
          const city = show.location ? show.location.split(',')[0].trim() : '';
          if (!city) continue;
          
          if (usedCities.has(city) && !regionalCities.has(city)) continue;
          
          if (!isChampionshipDay(dayObject.day, seasonInfo) && 
              (city === 'Marion' || city === 'Indianapolis')) continue;
          
          pickedShows.push(show);
          usedEventNames.add(show.eventName);
          usedCities.add(city);
        }
        
        if (pickedShows.length > 0) {
          functions.logger.info(`Day ${dayObject.day}: Used shows from nearby day ${nearbyDay}`);
          break;
        }
      }
    }
    
    // If still no shows found, log warning but don't generate placeholder
    if (pickedShows.length === 0) {
      functions.logger.warn(`Day ${dayObject.day}: No historical shows available after filtering`);
    } else {
      dayObject.shows = pickedShows;
    }
  });

  // Convert to competition format with CORRECT dates
  const competitions = [];
  scheduleTemplate.forEach(dayObject => {
    // Only create competitions if there are shows for this day
    if (dayObject.shows.length === 0) return;
    
    dayObject.shows.forEach((show, index) => {
      const competitionDate = new Date(seasonInfo.startDate);
      competitionDate.setDate(competitionDate.getDate() + (dayObject.day - 1));
      
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

  functions.logger.info(`Generated schedule with ${competitions.length} competitions from historical data.`);
  
  // Log days without shows
  const daysWithoutShows = scheduleTemplate.filter(d => d.shows.length === 0).length;
  if (daysWithoutShows > 0) {
    functions.logger.warn(`${daysWithoutShows} days have no shows after filtering`);
  }
  
  return competitions;
}

// Helper to check if a day is a championship day
function isChampionshipDay(day, seasonInfo) {
  if (seasonInfo.seasonType !== 'live') {
    // Off-season championships: days 45-49
    return day >= 45 && day <= 49;
  } else {
    // Live season championships: days 68-70
    return day >= 68 && day <= 70;
  }
}

// UPDATED: Competition type determination based on specific days only
function determineCompetitionType(eventName, day, seasonType) {
  const name = eventName.toLowerCase();
  
  // Finals
  if (name.includes('finals')) return 'championship';
  
  // Regionals on specific days ONLY
  if (seasonType !== 'live') {
    // Off-season regionals: days 28, 35, 41-42
    if ([28, 35, 41, 42].includes(day)) return 'regional';
  } else {
    // Live season regionals: days 49, 56, 62
    if ([49, 56, 62].includes(day)) return 'regional';
  }
  
  // Championships (prelims, semis, finals week)
  if (name.includes('championship') || name.includes('prelim') || name.includes('semi')) {
    return 'championship';
  }
  
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
  
  // World Championships (exclude SoundSport) - Days 47-49 off-season, 68-70 live
  if ((seasonType === 'live' && day >= 68) || (seasonType !== 'live' && day >= 47 && day <= 49)) {
    return ['World Class', 'Open Class', 'A Class'];
  }
  
  // Regional championships (exclude SoundSport)
  if (seasonType !== 'live' && [28, 35, 41, 42].includes(day)) {
    return ['World Class', 'Open Class', 'A Class'];
  }
  if (seasonType === 'live' && [49, 56, 62].includes(day)) {
    return ['World Class', 'Open Class', 'A Class'];
  }
  
  // Default regular shows - ALL CLASSES INCLUDING SOUNDSPORT
  return ['World Class', 'Open Class', 'A Class', 'SoundSport'];
}

function shuffleArray(array) {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

// === SEASONAL SCORE GRID - USING EXISTING COLLECTION ===
async function createSeasonalScoreGrid(db, seasonId, assignedCorps, seasonInfo) {
  functions.logger.info(`Creating Seasonal Score Grid for ${seasonId}...`);

  const scoreGrid = {};

  // Process each corps individually with their specific source year
  for (const corps of assignedCorps) {
    const corpsName = corps.name;
    const sourceYear = corps.sourceYear;
    
    // Use a unique key that includes both name and value to prevent duplicates
    const uniqueKey = `${corpsName}_${corps.value}`;
    
    functions.logger.info(`Fetching scores for ${corpsName} from year ${sourceYear} (value ${corps.value})`);
    
    // Fetch historical scores for this specific year
    const historicalDoc = await db.doc(`historical_scores/${sourceYear}`).get();
    
    if (!historicalDoc.exists) {
      functions.logger.warn(`No historical data found for year ${sourceYear}`);
      continue;
    }
    
    const yearData = historicalDoc.data().data || [];
    
    // Initialize score grid for this unique corps
    scoreGrid[uniqueKey] = {
      corpsName: corpsName,
      sourceYear: sourceYear,
      value: corps.value,
      scores: {}
    };
    
    // Process each event in the year
    yearData.forEach(event => {
      if (!event.scores || !event.offSeasonDay) return;
      
      // Find this specific corps in the event scores
      const corpsScore = event.scores.find(s => s.corps === corpsName);
      
      if (corpsScore && corpsScore.score && corpsScore.score > 0) {
        scoreGrid[uniqueKey].scores[event.offSeasonDay] = {
          totalScore: corpsScore.score,
          captions: corpsScore.captions || {},
          eventName: event.eventName,
          date: event.date
        };
      }
    });
    
    const scoreDays = Object.keys(scoreGrid[uniqueKey].scores).length;
    functions.logger.info(`  ${corpsName} (${sourceYear}): Found scores for ${scoreDays} days`);
  }

  // Save score grid to seasonal_scores collection
  const scoreGridRef = db.collection('seasonal_scores').doc(seasonId);
  await scoreGridRef.set({
    seasonId: seasonId,
    seasonType: seasonInfo.seasonType,
    grid: scoreGrid,
    corpsCount: Object.keys(scoreGrid).length,
    createdAt: admin.firestore.FieldValue.serverTimestamp()
  });

  functions.logger.info(`Score grid created with data for ${Object.keys(scoreGrid).length} unique corps entries.`);
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