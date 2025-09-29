/**
 * marching.art Season Scheduler - ULTIMATE INTEGRATED VERSION
 * Combines proven algorithms with new features
 * Automated season management designed for ultimate efficiency
 * Handles season creation, corps assignment, schedule generation, and progression
 * Optimized for 10,000+ users with minimal cost
 */

const functions = require('firebase-functions');
const admin = require('firebase-admin');
const { 
  DATA_NAMESPACE, 
  GAME_CONFIG, 
  SCHEDULE_CONFIG,
  getFunctionConfig 
} = require('../../config');

// === SEASON CONFIGURATION ===
const SEASON_CONFIG = {
  LIVE_SEASON_DAYS: 70,      // 10 weeks
  OFF_SEASON_DAYS: 49,        // 7 weeks
  FINALS_DATE: { month: 7, weekOfMonth: 2, dayOfWeek: 6 }, // Second Saturday of August
  SEASON_START_HOUR: 3,       // 3:00 AM EASTERN TIME
  
  // Themed off-season names (musical terms)
  SEASON_THEMES: ['Overture', 'Allegro', 'Adagio', 'Scherzo', 'Crescendo', 'Finale'],
  
  // Championship days
  OFF_SEASON_CHAMPIONSHIPS: {
    47: 'World Championships Prelims',
    48: 'World Championships Semifinals', 
    49: 'World Championships Finals'
  },
  
  LIVE_SEASON_CHAMPIONSHIPS: {
    68: 'World Championships Prelims',
    69: 'World Championships Semifinals',
    70: 'World Championships Finals'
  },
  
  // Regional competition days
  OFF_SEASON_REGIONALS: [28, 35, 41, 42],
  LIVE_SEASON_REGIONALS: [49, 56, 62, 63]
};

/**
 * Daily season check - runs at 3:00 AM
 */
exports.checkSeasonStatus = functions
  .runWith(getFunctionConfig('standard'))
  .pubsub.schedule(SCHEDULE_CONFIG.SEASON_CHECK_TIME)
  .timeZone('America/New_York')
  .onRun(async (context) => {
    const logger = functions.logger;
    
    try {
      logger.info('Starting daily season status check...');
      
      const db = admin.firestore();
      const currentDate = new Date();
      
      // Check current season status
      const gameSettingsRef = db.collection('game-settings').doc('current');
      const gameSettings = await gameSettingsRef.get();
      
      if (!gameSettings.exists || !gameSettings.data().activeSeasonId) {
        // No active season - start new one
        logger.info('No active season found. Initializing new season...');
        await initializeNewSeason(db, currentDate);
      } else {
        // Check if season needs progression
        const seasonData = gameSettings.data();
        await checkSeasonProgression(db, seasonData, currentDate);
      }
      
      logger.info('Daily season check completed successfully');
      
    } catch (error) {
      logger.error('Error in daily season check:', error);
      throw error;
    }
  });

/**
 * Initialize a new season
 */
async function initializeNewSeason(db, startDate) {
  const logger = functions.logger;
  logger.info('Initializing new season...');
  
  // Determine season type and calculate dates
  const seasonInfo = calculateSeasonDates(startDate);
  const seasonId = `season_${Date.now()}`;
  
  // Assign corps based on season type
  let assignedCorps;
  if (seasonInfo.type === 'live') {
    assignedCorps = await assignLiveSeasonCorps(db, seasonId, seasonInfo);
  } else {
    assignedCorps = await assignOffSeasonCorps(db, seasonId, seasonInfo);
  }
  
  // Generate schedule
  let schedule;
  if (seasonInfo.type === 'live') {
    schedule = await generateLiveSeasonSchedule(db, seasonId, seasonInfo);
  } else {
    schedule = await generateOffSeasonSchedule(db, seasonId, seasonInfo);
  }
  
  // Get season name
  const seasonName = getSeasonName(seasonInfo);
  const seasonNumber = await getNextSeasonNumber(db);
  
  // Create season document
  const seasonData = {
    activeSeasonId: seasonId,
    seasonId: seasonId,
    seasonType: seasonInfo.type,
    seasonNumber: seasonNumber,
    seasonName: seasonName,
    status: 'active',
    currentWeek: 1,
    currentDay: 1,
    startDate: admin.firestore.Timestamp.fromDate(seasonInfo.startDate),
    endDate: admin.firestore.Timestamp.fromDate(seasonInfo.endDate),
    totalWeeks: seasonInfo.type === 'live' ? 10 : 7,
    totalDays: seasonInfo.type === 'live' ? 70 : 49,
    finalsDate: admin.firestore.Timestamp.fromDate(seasonInfo.finalsDate),
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    lastProgressionCheck: admin.firestore.FieldValue.serverTimestamp()
  };
  
  // Save to game settings
  await db.collection('game-settings').doc('current').set(seasonData);
  
  // Save corps assignments
  await db.collection('dci-data').doc(seasonId).set({
    seasonId: seasonId,
    seasonType: seasonInfo.type,
    corps: assignedCorps,
    assignedAt: admin.firestore.FieldValue.serverTimestamp()
  });
  
  // Save schedule
  await db.collection('schedules').doc(seasonId).set({
    seasonId: seasonId,
    seasonType: seasonInfo.type,
    competitions: schedule,
    generatedAt: admin.firestore.FieldValue.serverTimestamp()
  });
  
  // Initialize leaderboard
  await db.collection('leaderboards').doc(seasonId).set({
    seasonId: seasonId,
    rankings: [],
    lastUpdated: admin.firestore.FieldValue.serverTimestamp()
  });
  
  logger.info(`New ${seasonInfo.type} season ${seasonId} (${seasonName}) initialized successfully`);
  
  return { seasonId, seasonData };
}

/**
 * Calculate season start/end dates - INTEGRATED VERSION
 */
function calculateSeasonDates(currentDate) {
  const year = currentDate.getFullYear();
  
  // Calculate DCI Finals date (second Saturday of August)
  const finalsDate = getSecondSaturdayOfAugust(year);
  
  const millisInDay = 24 * 60 * 60 * 1000;
  
  // === LIVE SEASON (70 days) ===
  const liveSeasonEnd = new Date(finalsDate);
  liveSeasonEnd.setHours(23, 59, 59, 999);
  
  const liveSeasonStart = new Date(finalsDate);
  liveSeasonStart.setDate(liveSeasonStart.getDate() - 69); // 70 days total
  liveSeasonStart.setHours(SEASON_CONFIG.SEASON_START_HOUR, 0, 0, 0);
  
  // Check if we're in live season
  if (currentDate >= liveSeasonStart && currentDate <= liveSeasonEnd) {
    return {
      type: 'live',
      seasonNumber: 'LIVE',
      startDate: liveSeasonStart,
      endDate: liveSeasonEnd,
      totalWeeks: 10,
      totalDays: 70,
      finalsDate: finalsDate
    };
  }
  
  // === OFF-SEASONS (6 periods of 49 days each) ===
  // Work backward from live season start
  const offSeasons = [];
  
  for (let i = 0; i < 6; i++) {
    const offSeasonEnd = new Date(liveSeasonStart);
    offSeasonEnd.setDate(offSeasonEnd.getDate() - (i * 49) - 1);
    offSeasonEnd.setHours(23, 59, 59, 999);
    
    const offSeasonStart = new Date(offSeasonEnd);
    offSeasonStart.setDate(offSeasonStart.getDate() - 48); // 49 days total
    offSeasonStart.setHours(SEASON_CONFIG.SEASON_START_HOUR, 0, 0, 0);
    
    offSeasons.push({
      type: 'off',
      seasonNumber: 6 - i, // Reverse order so Overture = 1, Finale = 6
      startDate: offSeasonStart,
      endDate: offSeasonEnd,
      totalWeeks: 7,
      totalDays: 49,
      finalsDate: finalsDate
    });
  }
  
  // Check which off-season we're in
  for (const season of offSeasons) {
    if (currentDate >= season.startDate && currentDate <= season.endDate) {
      return season;
    }
  }
  
  // Edge case: we're after this year's finals but before next off-season 1
  // Start off-season 1 immediately
  const nextOffSeasonStart = new Date(finalsDate);
  nextOffSeasonStart.setDate(nextOffSeasonStart.getDate() + 1);
  nextOffSeasonStart.setHours(SEASON_CONFIG.SEASON_START_HOUR, 0, 0, 0);
  
  const nextOffSeasonEnd = new Date(nextOffSeasonStart);
  nextOffSeasonEnd.setDate(nextOffSeasonEnd.getDate() + 48);
  nextOffSeasonEnd.setHours(23, 59, 59, 999);
  
  return {
    type: 'off',
    seasonNumber: 1,
    startDate: nextOffSeasonStart,
    endDate: nextOffSeasonEnd,
    totalWeeks: 7,
    totalDays: 49,
    finalsDate: finalsDate
  };
}

/**
 * Get season name with themed naming
 */
function getSeasonName(seasonInfo) {
  const finalsYear = seasonInfo.finalsDate.getFullYear();
  const startYear = finalsYear - 1;
  
  if (seasonInfo.type === 'live') {
    return `DCI ${finalsYear} Live Season`;
  } else {
    const themeIndex = (seasonInfo.seasonNumber - 1) % SEASON_CONFIG.SEASON_THEMES.length;
    const themeName = SEASON_CONFIG.SEASON_THEMES[themeIndex];
    return `${themeName} Season ${startYear}-${finalsYear.toString().slice(-2)}`;
  }
}

/**
 * Get the second Saturday of August for a given year
 */
function getSecondSaturdayOfAugust(year) {
  const august = new Date(year, 7, 1); // Month 7 = August
  
  // Find first Saturday
  let firstSaturday = 1;
  while (new Date(year, 7, firstSaturday).getDay() !== 6) {
    firstSaturday++;
  }
  
  // Second Saturday is 7 days later
  const secondSaturday = firstSaturday + 7;
  
  return new Date(year, 7, secondSaturday, SEASON_CONFIG.SEASON_START_HOUR, 0, 0);
}

/**
 * Get next season number
 */
async function getNextSeasonNumber(db) {
  const seasonsSnapshot = await db.collection('season-archives')
    .orderBy('seasonNumber', 'desc')
    .limit(1)
    .get();
  
  if (seasonsSnapshot.empty) {
    return 1;
  }
  
  return (seasonsSnapshot.docs[0].data().seasonNumber || 0) + 1;
}

/**
 * Assign corps for LIVE SEASON using previous year's final rankings
 */
async function assignLiveSeasonCorps(db, seasonId, seasonInfo) {
  const logger = functions.logger;
  logger.info('Assigning LIVE season corps from final rankings...');
  
  try {
    const finalsYear = seasonInfo.finalsDate.getFullYear();
    const previousYear = (finalsYear - 1).toString();
    
    // Get previous year's final rankings
    const rankingsDoc = await db.doc(`final_rankings/${previousYear}`).get();
    
    if (!rankingsDoc.exists) {
      logger.warn(`No final rankings found for ${previousYear}. Using fallback method.`);
      return await assignOffSeasonCorps(db, seasonId, seasonInfo);
    }
    
    const rankingsData = rankingsDoc.data().data || [];
    
    // Map to our format
    const corps = rankingsData.map(c => ({
      name: c.corps,
      value: c.points,
      pointCost: c.points,
      sourceYear: previousYear
    }));
    
    logger.info(`Assigned ${corps.length} corps from ${previousYear} final rankings`);
    
    return corps;
    
  } catch (error) {
    logger.error('Error assigning live season corps:', error);
    return await assignOffSeasonCorps(db, seasonId, seasonInfo);
  }
}

/**
 * Assign corps for OFF-SEASON using randomized selection from all years
 */
async function assignOffSeasonCorps(db, seasonId, seasonInfo) {
  const logger = functions.logger;
  logger.info('Assigning OFF-SEASON corps from historical data...');
  
  try {
    // Get all final rankings from all years
    const rankingsSnapshot = await db.collection('final_rankings').get();
    
    if (rankingsSnapshot.empty) {
      logger.warn('No final rankings found. Creating placeholder corps.');
      return createPlaceholderCorps();
    }
    
    // Collect all corps by point value
    const pointsMap = new Map();
    const allCorpsList = [];
    
    rankingsSnapshot.forEach(doc => {
      const year = doc.id;
      const corpsData = doc.data().data || [];
      
      corpsData.forEach(corps => {
        const pointValue = corps.points;
        if (pointValue) {
          const entry = {
            name: corps.corps,
            sourceYear: year,
            value: pointValue,
            pointCost: pointValue
          };
          
          if (!pointsMap.has(pointValue)) {
            pointsMap.set(pointValue, []);
          }
          pointsMap.get(pointValue).push(entry);
          allCorpsList.push(entry);
        }
      });
    });
    
    // Select 25 unique corps (one per point value 25-1)
    const selectedCorps = [];
    const usedCorpsNames = new Set();
    const shuffledAll = shuffleArray([...allCorpsList]);
    
    for (let points = 25; points >= 1; points--) {
      let candidates = pointsMap.get(points) || [];
      let chosenCorps = null;
      
      if (candidates.length > 0) {
        const shuffledCandidates = shuffleArray([...candidates]);
        chosenCorps = shuffledCandidates.find(c => !usedCorpsNames.has(c.name));
        if (!chosenCorps) chosenCorps = shuffledCandidates[0];
      }
      
      if (!chosenCorps) {
        const fallback = shuffledAll.find(c => !usedCorpsNames.has(c.name));
        if (fallback) {
          chosenCorps = { ...fallback, value: points, pointCost: points };
        }
      }
      
      if (chosenCorps) {
        selectedCorps.push(chosenCorps);
        usedCorpsNames.add(chosenCorps.name);
      }
    }
    
    logger.info(`Assigned ${selectedCorps.length} corps for off-season`);
    
    return selectedCorps;
    
  } catch (error) {
    logger.error('Error assigning off-season corps:', error);
    return createPlaceholderCorps();
  }
}

/**
 * Create placeholder corps when no historical data available
 */
function createPlaceholderCorps() {
  const placeholderNames = [
    'Blue Devils', 'The Cavaliers', 'Carolina Crown', 'Bluecoats', 'Santa Clara Vanguard',
    'The Cadets', 'Boston Crusaders', 'Phantom Regiment', 'The Academy', 'Blue Knights',
    'Crossmen', 'Madison Scouts', 'Mandarins', 'Pacific Crest', 'Spirit of Atlanta',
    'Colts', 'Blue Stars', 'Troopers', 'Jersey Surf', 'Genesis',
    'Music City', 'Guardians', 'Shadow', 'Southwind', 'Pioneer'
  ];
  
  return placeholderNames.map((name, index) => ({
    name: name,
    value: 25 - index,
    pointCost: 25 - index,
    sourceYear: new Date().getFullYear().toString(),
    isPlaceholder: true
  }));
}

/**
 * Generate LIVE SEASON schedule
 */
async function generateLiveSeasonSchedule(db, seasonId, seasonInfo) {
  const logger = functions.logger;
  logger.info('Generating LIVE season schedule...');
  
  const competitions = [];
  const startDate = seasonInfo.startDate;
  
  // Get live season template if exists
  const templateDoc = await db.doc('schedules/live_season_template').get();
  const templateEvents = templateDoc.exists ? templateDoc.data().events : [];
  
  // Generate 70 days of competitions
  for (let day = 1; day <= 70; day++) {
    const compDate = new Date(startDate);
    compDate.setDate(compDate.getDate() + day - 1);
    
    // Check if this is a championship day
    const championshipInfo = SEASON_CONFIG.LIVE_SEASON_CHAMPIONSHIPS[day];
    
    if (championshipInfo) {
      competitions.push({
        id: `live_day${day}_championship`,
        day: day,
        week: Math.ceil(day / 7),
        name: championshipInfo,
        location: 'Indianapolis, IN',
        date: admin.firestore.Timestamp.fromDate(compDate),
        allowedClasses: ['World Class', 'Open Class', 'A Class'],
        status: 'scheduled',
        isChampionship: true,
        cutoff: day === 69 ? 25 : (day === 70 ? 12 : null)
      });
    } else {
      // Regular competition days
      const showsPerDay = day <= 14 ? 2 : (day <= 42 ? 3 : 4);
      
      for (let show = 0; show < showsPerDay; show++) {
        competitions.push({
          id: `live_day${day}_show${show + 1}`,
          day: day,
          week: Math.ceil(day / 7),
          name: generateLiveShowName(day, show + 1),
          location: generateShowLocation(),
          date: admin.firestore.Timestamp.fromDate(compDate),
          allowedClasses: ['World Class', 'Open Class', 'A Class', 'SoundSport'],
          status: 'scheduled',
          isChampionship: false
        });
      }
    }
  }
  
  logger.info(`Generated ${competitions.length} competitions for live season`);
  
  return competitions;
}

/**
 * Generate OFF-SEASON schedule with proper show placement
 */
async function generateOffSeasonSchedule(db, seasonId, seasonInfo) {
  const logger = functions.logger;
  logger.info('Generating OFF-SEASON schedule...');
  
  // Get historical shows from all years
  const scoresSnapshot = await db.collection('historical_scores').get();
  
  const showsByDay = new Map();
  scoresSnapshot.forEach(yearDoc => {
    const yearData = yearDoc.data().data || [];
    yearData.forEach(event => {
      if (event.eventName && event.offSeasonDay && 
          !event.eventName.toLowerCase().includes('open class')) {
        const showData = {
          eventName: event.eventName,
          date: event.date,
          location: event.location,
          offSeasonDay: event.offSeasonDay
        };
        
        if (!showsByDay.has(event.offSeasonDay)) {
          showsByDay.set(event.offSeasonDay, []);
        }
        showsByDay.get(event.offSeasonDay).push(showData);
      }
    });
  });
  
  const competitions = [];
  const usedEventNames = new Set();
  const usedLocations = new Set();
  const startDate = seasonInfo.startDate;
  
  // Helper function to place exclusive show
  const placeExclusiveShow = (day, showNamePattern, isMandatory) => {
    const compDate = new Date(startDate);
    compDate.setDate(compDate.getDate() + day - 1);
    
    const showsForDay = showsByDay.get(day) || [];
    const candidates = showsForDay.filter(s => {
      const nameMatches = s.eventName.toLowerCase().includes(showNamePattern.toLowerCase());
      const isUnused = !usedEventNames.has(s.eventName);
      return nameMatches && isUnused;
    });
    
    const selectedShow = shuffleArray(candidates)[0];
    
    if (selectedShow) {
      competitions.push({
        id: `off_day${day}_${selectedShow.eventName.replace(/[^a-z0-9]/gi, '_')}`,
        day: day,
        week: Math.ceil(day / 7),
        name: selectedShow.eventName,
        location: selectedShow.location,
        date: admin.firestore.Timestamp.fromDate(compDate),
        allowedClasses: day >= 47 ? ['World Class', 'Open Class', 'A Class'] : 
                        ['World Class', 'Open Class', 'A Class', 'SoundSport'],
        status: 'scheduled',
        isChampionship: day >= 47,
        isMandatory: isMandatory,
        cutoff: day === 48 ? 25 : (day === 49 ? 12 : null)
      });
      
      usedEventNames.add(selectedShow.eventName);
      usedLocations.add(selectedShow.location);
    } else {
      logger.warn(`Could not find show for day ${day} matching "${showNamePattern}"`);
    }
  };
  
  // Place championship shows (days 47-49)
  placeExclusiveShow(49, 'DCI World Championship Finals', true);
  placeExclusiveShow(48, 'DCI World Championship Semifinals', true);
  placeExclusiveShow(47, 'DCI World Championship Prelims', true);
  
  // Place regional shows
  placeExclusiveShow(28, 'DCI Southwestern Championship', true);
  placeExclusiveShow(35, 'championship', false);
  
  // Eastern Classic (days 41-42) - same show, split participants
  const easternClassicCandidates = [
    ...(showsByDay.get(41) || []),
    ...(showsByDay.get(42) || [])
  ].filter(s => 
    s.eventName.includes('DCI Eastern Classic') && 
    !usedEventNames.has(s.eventName)
  );
  
  const easternClassic = shuffleArray(easternClassicCandidates)[0];
  
  if (easternClassic) {
    for (const day of [41, 42]) {
      const compDate = new Date(startDate);
      compDate.setDate(compDate.getDate() + day - 1);
      
      competitions.push({
        id: `off_day${day}_eastern_classic`,
        day: day,
        week: Math.ceil(day / 7),
        name: easternClassic.eventName,
        location: easternClassic.location,
        date: admin.firestore.Timestamp.fromDate(compDate),
        allowedClasses: ['World Class', 'Open Class', 'A Class'],
        status: 'scheduled',
        isRegional: true,
        isSplitShow: true
      });
    }
    
    usedEventNames.add(easternClassic.eventName);
    usedLocations.add(easternClassic.location);
  }
  
  // Fill remaining days (1-40, 43-46)
  const remainingDays = [];
  for (let day = 1; day <= 49; day++) {
    if (![28, 35, 41, 42, 47, 48, 49].includes(day)) {
      remainingDays.push(day);
    }
  }
  
  // Determine show counts (20% get 2 shows, rest get 3)
  const twoShowDayCount = Math.floor(remainingDays.length * 0.2);
  const dayCounts = shuffleArray([
    ...Array(twoShowDayCount).fill(2),
    ...Array(remainingDays.length - twoShowDayCount).fill(3)
  ]);
  
  for (const day of remainingDays) {
    const numShows = dayCounts.pop() || 3;
    const compDate = new Date(startDate);
    compDate.setDate(compDate.getDate() + day - 1);
    
    const potentialShows = shuffleArray(showsByDay.get(day) || []);
    const pickedShows = [];
    
    for (const show of potentialShows) {
      if (pickedShows.length >= numShows) break;
      
      if (!usedEventNames.has(show.eventName) && !usedLocations.has(show.location)) {
        pickedShows.push(show);
        usedEventNames.add(show.eventName);
        usedLocations.add(show.location);
      }
    }
    
    // Add picked shows as competitions
    pickedShows.forEach((show, index) => {
      competitions.push({
        id: `off_day${day}_show${index + 1}`,
        day: day,
        week: Math.ceil(day / 7),
        name: show.eventName,
        location: show.location,
        date: admin.firestore.Timestamp.fromDate(compDate),
        allowedClasses: ['World Class', 'Open Class', 'A Class', 'SoundSport'],
        status: 'scheduled',
        isChampionship: false
      });
    });
  }
  
  // Skip days 45-46 (Open Class championships - not used in fantasy)
  
  logger.info(`Generated ${competitions.length} competitions for off-season`);
  
  return competitions;
}

/**
 * Generate show names for live season
 */
function generateLiveShowName(day, showNumber) {
  const names = [
    ['Season Opener', 'First Performance', 'Spring Training'],
    ['Regional Preview', 'State Championship', 'District Finals'],
    ['Memorial Day Classic', 'Patriot Games', 'Summer Kickoff'],
    ['Independence Day Spectacular', 'Freedom Festival', 'Liberty Bell'],
    ['Midwest Showcase', 'Southwest Classic', 'East Coast Challenge'],
    ['West Coast Invitational', 'Great Plains Championship', 'Southern Showdown'],
    ['Championship Qualifier', 'Regional Finals', 'State Championships'],
    ['Pre-Finals Showcase', 'Championship Preview', 'Elite Performance'],
    ['Final Tuneup', 'Last Rehearsal', 'Finals Eve'],
    ['DCI World Championships', 'Finals Weekend', 'Championship Series']
  ];
  
  const weekIndex = Math.min(Math.floor(day / 7), names.length - 1);
  const showIndex = Math.min(showNumber - 1, names[weekIndex].length - 1);
  
  return names[weekIndex][showIndex] || `Day ${day} Show ${showNumber}`;
}

/**
 * Generate show locations
 */
function generateShowLocation() {
  const locations = [
    'San Antonio, TX', 'Denver, CO', 'Atlanta, GA', 'Nashville, TN', 'Phoenix, AZ',
    'Portland, OR', 'Minneapolis, MN', 'Charlotte, NC', 'Kansas City, MO', 'Seattle, WA',
    'Austin, TX', 'Orlando, FL', 'Detroit, MI', 'Sacramento, CA', 'Cincinnati, OH',
    'Pittsburgh, PA', 'St. Louis, MO', 'Tampa, FL', 'Cleveland, OH', 'Columbus, OH',
    'Indianapolis, IN', 'Milwaukee, WI', 'Memphis, TN', 'Louisville, KY', 'Baltimore, MD'
  ];
  
  return locations[Math.floor(Math.random() * locations.length)];
}

/**
 * Shuffle array (Fisher-Yates algorithm)
 */
function shuffleArray(array) {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

/**
 * Check if current season needs to progress to next week/day
 */
async function checkSeasonProgression(db, seasonData, currentDate) {
  const logger = functions.logger;
  
  const seasonStart = seasonData.startDate.toDate();
  const seasonEnd = seasonData.endDate.toDate();
  
  // Check if season has ended
  if (currentDate > seasonEnd) {
    logger.info(`Season ${seasonData.activeSeasonId} has ended. Archiving and starting new season...`);
    await endSeason(db, seasonData);
    await initializeNewSeason(db, currentDate);
    return;
  }
  
  // Calculate current week and day
  const daysSinceStart = Math.floor((currentDate - seasonStart) / (1000 * 60 * 60 * 24));
  const currentWeek = Math.floor(daysSinceStart / 7) + 1;
  const currentDay = daysSinceStart + 1;
  
  // Update if week or day has changed
  if (currentWeek !== seasonData.currentWeek || currentDay !== seasonData.currentDay) {
    logger.info(`Progressing season ${seasonData.activeSeasonId} to Week ${currentWeek}, Day ${currentDay}`);
    
    await db.collection('game-settings').doc('current').update({
      currentWeek: currentWeek,
      currentDay: currentDay,
      lastProgressionCheck: admin.firestore.FieldValue.serverTimestamp()
    });
  }
}

/**
 * End current season and archive data
 */
async function endSeason(db, seasonData) {
  const logger = functions.logger;
  logger.info(`Ending season ${seasonData.activeSeasonId}...`);
  
  // Archive season results with achievements
  await archiveSeasonResults(db, seasonData);
  
  // Archive season data
  await db.collection('season-archives').doc(seasonData.activeSeasonId).set({
    ...seasonData,
    endedAt: admin.firestore.FieldValue.serverTimestamp(),
    status: 'completed'
  });
  
  // Award final season bonuses and XP
  await awardSeasonCompletionRewards(db, seasonData.activeSeasonId);
  
  logger.info(`Season ${seasonData.activeSeasonId} archived successfully`);
}

/**
 * Archive season results with league champions and achievements
 */
async function archiveSeasonResults(db, seasonData) {
  const logger = functions.logger;
  logger.info('Archiving season results with achievements...');
  
  const seasonId = seasonData.activeSeasonId;
  const seasonName = seasonData.seasonName;
  
  // Get all leagues
  const leaguesSnapshot = await db.collection('leagues').get();
  if (leaguesSnapshot.empty) {
    logger.info('No leagues to archive.');
    return;
  }
  
  const batch = db.batch();
  
  for (const leagueDoc of leaguesSnapshot.docs) {
    const league = leagueDoc.data();
    const leagueId = leagueDoc.id;
    const members = league.members || [];
    
    if (members.length === 0) continue;
    
    let leagueWinner = {
      userId: null,
      username: 'Unknown',
      finalScore: -1,
      corpsName: 'Unknown'
    };
    
    // Find league winner
    const profilePromises = members.map(uid => 
      db.doc(`artifacts/${DATA_NAMESPACE}/users/${uid}/profile/data`).get()
    );
    const profileDocs = await Promise.all(profilePromises);
    
    profileDocs.forEach(profileDoc => {
      if (profileDoc.exists) {
        const profileData = profileDoc.data();
        
        if (profileData.activeSeasonId === seasonId) {
          const totalScore = profileData.totalSeasonScore || 0;
          
          if (totalScore > leagueWinner.finalScore) {
            leagueWinner = {
              userId: profileDoc.ref.parent.parent.id,
              username: profileData.displayName || profileData.email?.split('@')[0] || 'Unknown',
              finalScore: totalScore,
              corpsName: profileData.corps?.corpsName || 'Unnamed Corps'
            };
          }
        }
      }
    });
    
    if (leagueWinner.userId) {
      // Archive champion in league
      const leagueRef = db.doc(`leagues/${leagueId}`);
      const championEntry = {
        seasonName: seasonName,
        seasonId: seasonId,
        winnerId: leagueWinner.userId,
        winnerUsername: leagueWinner.username,
        winnerCorpsName: leagueWinner.corpsName,
        score: leagueWinner.finalScore,
        archivedAt: admin.firestore.FieldValue.serverTimestamp()
      };
      
      batch.update(leagueRef, {
        champions: admin.firestore.FieldValue.arrayUnion(championEntry)
      });
      
      // Award achievement to winner
      const winnerRef = db.doc(`artifacts/${DATA_NAMESPACE}/users/${leagueWinner.userId}/profile/data`);
      const championAchievement = {
        id: `league_champion_${seasonId}`,
        name: `League Champion: ${seasonName}`,
        description: `Finished 1st in the ${league.name} league during ${seasonName}.`,
        earnedAt: admin.firestore.FieldValue.serverTimestamp(),
        icon: 'trophy'
      };
      
      batch.update(winnerRef, {
        achievements: admin.firestore.FieldValue.arrayUnion(championAchievement)
      });
      
      // Send notifications to all league members
      const notificationMessage = `${leagueWinner.username} has won the ${seasonName} championship in your league, ${league.name}!`;
      
      members.forEach(memberUid => {
        const notificationRef = db.collection(
          `artifacts/${DATA_NAMESPACE}/users/${memberUid}/notifications`
        ).doc();
        
        batch.set(notificationRef, {
          type: 'new_champion',
          message: notificationMessage,
          link: `/leagues/${leagueId}`,
          timestamp: admin.firestore.FieldValue.serverTimestamp(),
          isRead: false
        });
      });
      
      logger.info(`Archived champion for league '${league.name}': ${leagueWinner.username}`);
    }
  }
  
  await batch.commit();
  logger.info('Season results archived successfully.');
}

/**
 * Award XP and bonuses at season end
 */
async function awardSeasonCompletionRewards(db, seasonId) {
  const logger = functions.logger;
  
  try {
    // Get final leaderboard
    const leaderboardDoc = await db.collection('leaderboards').doc(seasonId).get();
    
    if (!leaderboardDoc.exists) {
      logger.warn('No leaderboard found for season completion rewards');
      return;
    }
    
    const rankings = leaderboardDoc.data().rankings || [];
    
    // Award XP based on final ranking
    const batch = db.batch();
    let updateCount = 0;
    
    for (let i = 0; i < Math.min(rankings.length, 100); i++) {
      const entry = rankings[i];
      const rank = i + 1;
      
      // Calculate XP reward
      let xpReward = 100; // Base reward
      if (rank === 1) xpReward = 500;
      else if (rank <= 3) xpReward = 300;
      else if (rank <= 10) xpReward = 200;
      else if (rank <= 25) xpReward = 150;
      
      // Update user XP
      const userRef = db.doc(`artifacts/${DATA_NAMESPACE}/users/${entry.userId}/profile/data`);
      batch.update(userRef, {
        xp: admin.firestore.FieldValue.increment(xpReward),
        [`seasonHistory.${seasonId}`]: {
          rank: rank,
          score: entry.totalScore,
          xpEarned: xpReward
        }
      });
      
      updateCount++;
      
      // Commit batch every 500 updates
      if (updateCount % 500 === 0) {
        await batch.commit();
        logger.info(`Awarded rewards to ${updateCount} users`);
      }
    }
    
    // Commit remaining updates
    if (updateCount % 500 !== 0) {
      await batch.commit();
    }
    
    logger.info(`Season completion rewards awarded to ${updateCount} users`);
    
  } catch (error) {
    logger.error('Error awarding season completion rewards:', error);
  }
}

/**
 * Manual function to initialize season (callable by admin)
 */
exports.initializeSeasonManually = functions
  .runWith(getFunctionConfig('heavy'))
  .https.onCall(async (data, context) => {
    // Verify admin access
    if (!context.auth || context.auth.uid !== 'o8vfRCOevjTKBY0k2dISlpiYiIH2') {
      throw new functions.https.HttpsError('permission-denied', 'Admin access required');
    }
    
    const db = admin.firestore();
    const startDate = data.startDate ? new Date(data.startDate) : new Date();
    
    try {
      const result = await initializeNewSeason(db, startDate);
      return {
        success: true,
        message: 'Season initialized successfully',
        seasonId: result.seasonId,
        seasonName: result.seasonData.seasonName
      };
    } catch (error) {
      throw new functions.https.HttpsError('internal', `Failed to initialize season: ${error.message}`);
    }
  });

// Export functions
module.exports = {
  checkSeasonStatus: exports.checkSeasonStatus,
  initializeSeasonManually: exports.initializeSeasonManually
};