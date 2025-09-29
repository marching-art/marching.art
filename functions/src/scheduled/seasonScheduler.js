/**
 * marching.art Season Scheduler - DATE-AWARE AUTO-CORRECTING VERSION
 * Automated season management with self-correction capabilities
 * Works perpetually for any year from 2025 onward
 * Handles season creation, corps assignment, schedule generation, and progression
 * Optimized for 10,000+ users with minimal cost
 */

const functions = require('firebase-functions');
const admin = require('firebase-admin');

/**
 * Get function configuration based on complexity
 */
function getFunctionConfig(complexity = 'standard') {
  const configs = {
    light: {
      timeoutSeconds: 60,
      memory: '256MB',
      maxInstances: 100
    },
    standard: {
      timeoutSeconds: 300,
      memory: '512MB',
      maxInstances: 50
    },
    heavy: {
      timeoutSeconds: 540,
      memory: '1GB',
      maxInstances: 10
    }
  };
  
  return configs[complexity] || configs.standard;
}

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
    45: { name: 'Open and A Class Prelims', location: 'Marion, IN', classes: ['Open', 'A'] },
    46: { name: 'Open and A Class Finals', location: 'Marion, IN', classes: ['Open', 'A'] },
    47: { name: 'World Championships Prelims', location: 'Indianapolis, IN', classes: ['World', 'Open', 'A'] },
    48: { name: 'World Championships Semifinals', location: 'Indianapolis, IN', classes: ['World', 'Open', 'A'] },
    49: { name: 'World Championships Finals', location: 'Indianapolis, IN', classes: ['World', 'Open', 'A'] }
  },
  
  LIVE_SEASON_CHAMPIONSHIPS: {
    65: { name: 'Open and A Class Prelims', location: 'Marion, IN', classes: ['Open', 'A'] },
    66: { name: 'Open and A Class Finals', location: 'Marion, IN', classes: ['Open', 'A'] },
    68: { name: 'World Championships Prelims', location: 'Indianapolis, IN', classes: ['World', 'Open', 'A'] },
    69: { name: 'World Championships Semifinals', location: 'Indianapolis, IN', classes: ['World', 'Open', 'A'] },
    70: { name: 'World Championships Finals', location: 'Indianapolis, IN', classes: ['World', 'Open', 'A'] }
  },
  
  // Regional competition days
  OFF_SEASON_REGIONALS: {
    28: { name: 'Southwestern Championship', location: 'San Antonio, TX' },
    35: { name: 'Southeastern Championship', location: 'Atlanta, GA' },
    41: { name: 'Eastern Classic Day 1', location: 'Allentown, PA' },
    42: { name: 'Eastern Classic Day 2', location: 'Allentown, PA' }
  },
  
  LIVE_SEASON_REGIONALS: {
    42: { name: 'DCI West', location: 'Stanford, CA' },
    49: { name: 'DCI Southwest', location: 'San Antonio, TX' },
    56: { name: 'DCI Atlanta', location: 'Atlanta, GA' },
    62: { name: 'DCI Eastern Classic Day 1', location: 'Allentown, PA' },
    63: { name: 'DCI Eastern Classic Day 2', location: 'Allentown, PA' }
  },
  
  // Competition locations for regular shows
  COMPETITION_LOCATIONS: [
    'Buffalo, NY', 'Rochester, NY', 'Syracuse, NY', 'Clifton, NJ', 
    'Chester, PA', 'Annapolis, MD', 'Akron, OH', 'Massillon, OH',
    'Centerville, OH', 'Muncie, IN', 'Metamora, MI', 'Oconomowoc, WI',
    'DeKalb, IL', 'Rockford, IL', 'Cedar Rapids, IA', 'Minneapolis, MN',
    'Kansas City, MO', 'Broken Arrow, OK', 'Denton, TX', 'Houston, TX',
    'Denver, CO', 'Ogden, UT', 'Riverside, CA', 'Fresno, CA',
    'Winston-Salem, NC', 'Murfreesboro, TN', 'Orlando, FL', 'Rome, GA'
  ],
  
  // Venue names
  VENUE_TYPES: [
    'Stadium', 'Field', 'High School', 'University Stadium', 
    'Memorial Stadium', 'Athletic Complex', 'Sports Complex'
  ]
};

// === HELPER FUNCTIONS ===

/**
 * Get the second Saturday of August for any given year
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
 * Determine which season should be active for any given date
 * Works perpetually for any year
 */
function determineCurrentSeason(currentDate) {
  const currentYear = currentDate.getFullYear();
  
  // Check if we're in the current year's live season or after
  const currentYearFinalsDate = getSecondSaturdayOfAugust(currentYear);
  const liveSeasonStart = new Date(currentYearFinalsDate);
  liveSeasonStart.setDate(liveSeasonStart.getDate() - 69);
  liveSeasonStart.setHours(SEASON_CONFIG.SEASON_START_HOUR, 0, 0, 0);
  
  if (currentDate >= liveSeasonStart) {
    // We're in or after the current year's live season
    const liveSeasonEnd = new Date(currentYearFinalsDate);
    liveSeasonEnd.setHours(23, 59, 59, 999);
    
    if (currentDate <= liveSeasonEnd) {
      // We're in the live season
      return {
        seasonType: 'live',
        seasonName: `DCI ${currentYear} Live Season`,
        finalsYear: currentYear,
        startDate: liveSeasonStart,
        endDate: liveSeasonEnd,
        totalWeeks: 10,
        totalDays: 70
      };
    } else {
      // We're after finals - start of next cycle (Overture for next year)
      const nextYear = currentYear + 1;
      const cycleStartDate = new Date(currentYearFinalsDate);
      cycleStartDate.setDate(cycleStartDate.getDate() + 1);
      cycleStartDate.setHours(SEASON_CONFIG.SEASON_START_HOUR, 0, 0, 0);
      
      const cycleEndDate = new Date(cycleStartDate);
      cycleEndDate.setDate(cycleEndDate.getDate() + 48);
      cycleEndDate.setHours(23, 59, 59, 999);
      
      return {
        seasonType: 'overture',
        seasonName: `Overture Season ${currentYear}-${nextYear.toString().slice(-2)}`,
        finalsYear: nextYear,
        startDate: cycleStartDate,
        endDate: cycleEndDate,
        totalWeeks: 7,
        totalDays: 49
      };
    }
  }
  
  // We're in an off-season leading up to this year's live season
  // Calculate which off-season based on days since last year's finals
  const previousYearFinalsDate = getSecondSaturdayOfAugust(currentYear - 1);
  const cycleStartDate = new Date(previousYearFinalsDate);
  cycleStartDate.setDate(cycleStartDate.getDate() + 1); // Day after finals
  cycleStartDate.setHours(SEASON_CONFIG.SEASON_START_HOUR, 0, 0, 0);
  
  const daysSinceCycleStart = Math.floor((currentDate - cycleStartDate) / (1000 * 60 * 60 * 24));
  const offSeasonNumber = Math.min(Math.floor(daysSinceCycleStart / 49) + 1, 6);
  
  // Calculate this off-season's dates
  const seasonStartDate = new Date(cycleStartDate);
  seasonStartDate.setDate(seasonStartDate.getDate() + ((offSeasonNumber - 1) * 49));
  
  const seasonEndDate = new Date(seasonStartDate);
  seasonEndDate.setDate(seasonEndDate.getDate() + 48);
  seasonEndDate.setHours(23, 59, 59, 999);
  
  const seasonTheme = SEASON_CONFIG.SEASON_THEMES[offSeasonNumber - 1];
  
  return {
    seasonType: seasonTheme.toLowerCase(),
    seasonName: `${seasonTheme} Season ${currentYear - 1}-${currentYear.toString().slice(-2)}`,
    finalsYear: currentYear,
    startDate: seasonStartDate,
    endDate: seasonEndDate,
    totalWeeks: 7,
    totalDays: 49
  };
}

/**
 * Extract season type from season ID
 */
function getSeasonTypeFromId(seasonId) {
  if (seasonId.startsWith('live_')) return 'live';
  
  // Extract season type from ID like "overture_2024-25"
  const parts = seasonId.split('_');
  if (parts.length > 0) {
    return parts[0].toLowerCase();
  }
  
  return 'unknown';
}

/**
 * Get next season number (incremental counter)
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
 * Generate random show name
 */
function generateShowName(day, isChampionship = false) {
  const showPrefixes = [
    'Summer', 'Classic', 'Premier', 'Showcase', 'Regional',
    'Invitational', 'Championship', 'Masters', 'Open', 'Festival'
  ];
  
  const showSuffixes = [
    'Competition', 'Classic', 'Showcase', 'Championships',
    'Invitational', 'Festival', 'Celebration', 'Spectacular'
  ];
  
  if (isChampionship) {
    return `Championship Week Day ${day}`;
  }
  
  const prefix = showPrefixes[Math.floor(Math.random() * showPrefixes.length)];
  const suffix = showSuffixes[Math.floor(Math.random() * showSuffixes.length)];
  
  return `${prefix} ${suffix}`;
}

/**
 * Generate venue name
 */
function generateVenueName() {
  const venueNames = [
    'Veterans', 'Memorial', 'Central', 'North', 'South', 'East', 'West',
    'Community', 'Regional', 'County', 'State', 'University', 'College'
  ];
  
  const venueName = venueNames[Math.floor(Math.random() * venueNames.length)];
  const venueType = SEASON_CONFIG.VENUE_TYPES[Math.floor(Math.random() * SEASON_CONFIG.VENUE_TYPES.length)];
  
  return `${venueName} ${venueType}`;
}

// === MAIN FUNCTIONS ===

/**
 * Daily season check - runs at 3:00 AM
 * ENHANCED: Always validates current season matches expected season
 */
exports.checkSeasonStatus = functions
  .runWith(getFunctionConfig('standard'))
  .pubsub.schedule('0 3 * * *')
  .timeZone('America/New_York')
  .onRun(async (context) => {
    const logger = functions.logger;
    
    try {
      logger.info('Starting daily season status check...');
      
      const db = admin.firestore();
      const currentDate = new Date();
      
      // Determine what season SHOULD be active right now
      const expectedSeasonInfo = determineCurrentSeason(currentDate);
      logger.info(`Expected season for ${currentDate.toISOString()}: ${expectedSeasonInfo.seasonName}`);
      
      // Check current season status
      const gameSettingsRef = db.collection('game-settings').doc('current');
      const gameSettings = await gameSettingsRef.get();
      
      if (!gameSettings.exists || !gameSettings.data().activeSeasonId) {
        // No active season - start the correct one
        logger.info('No active season found. Initializing correct season...');
        await initializeNewSeason(db, currentDate, expectedSeasonInfo);
      } else {
        const seasonData = gameSettings.data();
        
        // ENHANCED: Verify current season matches expected season
        const currentSeasonType = getSeasonTypeFromId(seasonData.activeSeasonId);
        const expectedSeasonType = expectedSeasonInfo.seasonType;
        
        if (currentSeasonType !== expectedSeasonType) {
          // Wrong season is active! End it and start the correct one
          logger.warn(`Season mismatch detected! Current: ${currentSeasonType}, Expected: ${expectedSeasonType}`);
          logger.info('Auto-correcting: Ending incorrect season and starting correct one...');
          
          await endSeason(db, seasonData);
          await initializeNewSeason(db, currentDate, expectedSeasonInfo);
        } else {
          // Correct season is active - check progression
          await checkSeasonProgression(db, seasonData, currentDate);
        }
      }
      
      logger.info('Daily season check completed successfully');
      
    } catch (error) {
      logger.error('Error in daily season check:', error);
      throw error;
    }
  });

/**
 * Initialize a new season with auto-correction
 */
async function initializeNewSeason(db, startDate, seasonInfo) {
  const logger = functions.logger;
  logger.info(`Initializing ${seasonInfo.seasonName}...`);
  
  // Generate proper season ID
  const seasonId = seasonInfo.seasonType === 'live' ?
    `live_${seasonInfo.finalsYear}` :
    `${seasonInfo.seasonType}_${seasonInfo.finalsYear - 1}-${seasonInfo.finalsYear.toString().slice(-2)}`;
  
  // Calculate current day and week (for mid-season starts)
  const now = new Date();
  let currentDay = 1;
  let currentWeek = 1;
  
  if (now > seasonInfo.startDate) {
    const daysSinceStart = Math.floor((now - seasonInfo.startDate) / (1000 * 60 * 60 * 24));
    currentDay = Math.min(daysSinceStart + 1, seasonInfo.totalDays);
    currentWeek = Math.min(Math.floor(daysSinceStart / 7) + 1, seasonInfo.totalWeeks);
  }
  
  // Get next season number
  const seasonNumber = await getNextSeasonNumber(db);
  
  // Assign corps based on season type
  let assignedCorps;
  if (seasonInfo.seasonType === 'live') {
    assignedCorps = await assignLiveSeasonCorps(db, seasonId, seasonInfo.finalsYear);
  } else {
    assignedCorps = await assignOffSeasonCorps(db, seasonId, seasonInfo.finalsYear);
  }
  
  // Generate schedule
  const schedule = await generateSeasonSchedule(db, seasonId, seasonInfo);
  
  // Create season document
  const seasonData = {
    activeSeasonId: seasonId,
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
    finalsDate: admin.firestore.Timestamp.fromDate(getSecondSaturdayOfAugust(seasonInfo.finalsYear)),
    finalsYear: seasonInfo.finalsYear,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    lastProgressionCheck: admin.firestore.FieldValue.serverTimestamp()
  };
  
  // Save to game settings
  await db.collection('game-settings').doc('current').set(seasonData);
  
  // Save corps assignments with values
  await db.collection('dci-data').doc(seasonId).set({
    seasonId: seasonId,
    seasonType: seasonInfo.seasonType,
    corpsValues: assignedCorps, // This is the key collection for caption selections
    corps: assignedCorps, // Backward compatibility
    assignedAt: admin.firestore.FieldValue.serverTimestamp()
  });
  
  // Save schedule
  await db.collection('schedules').doc(seasonId).set({
    seasonId: seasonId,
    seasonType: seasonInfo.seasonType,
    competitions: schedule,
    weeks: generateWeeklySchedule(schedule, seasonInfo.totalWeeks),
    generatedAt: admin.firestore.FieldValue.serverTimestamp()
  });
  
  // Initialize leaderboard
  await db.collection('leaderboards').doc(seasonId).set({
    seasonId: seasonId,
    rankings: [],
    lastUpdated: admin.firestore.FieldValue.serverTimestamp()
  });
  
  // Initialize recap collection for the season
  await db.collection('fantasy_recaps').doc(seasonId).set({
    seasonId: seasonId,
    recaps: {},
    createdAt: admin.firestore.FieldValue.serverTimestamp()
  });
  
  logger.info(`${seasonInfo.seasonName} initialized successfully - Day ${currentDay} of ${seasonInfo.totalDays}`);
  
  return { seasonId, seasonData };
}

/**
 * Check and update season progression
 */
async function checkSeasonProgression(db, seasonData, currentDate) {
  const logger = functions.logger;
  
  const seasonStart = seasonData.startDate.toDate();
  const seasonEnd = seasonData.endDate.toDate();
  
  // Check if season has ended
  if (currentDate > seasonEnd) {
    logger.info(`Season ${seasonData.activeSeasonId} has ended. Archiving and starting new season...`);
    await endSeason(db, seasonData);
    
    // Determine and start the next season
    const nextSeasonInfo = determineCurrentSeason(currentDate);
    await initializeNewSeason(db, currentDate, nextSeasonInfo);
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
 * Assign corps for LIVE SEASON using previous year's final rankings
 */
async function assignLiveSeasonCorps(db, seasonId, finalsYear) {
  const logger = functions.logger;
  logger.info('Assigning LIVE season corps from final rankings...');
  
  try {
    const previousYear = (finalsYear - 1).toString();
    
    // Get previous year's final rankings
    const rankingsDoc = await db.doc(`final_rankings/${previousYear}`).get();
    
    if (!rankingsDoc.exists) {
      logger.warn(`No final rankings found for ${previousYear}. Using random assignment.`);
      return await assignOffSeasonCorps(db, seasonId, finalsYear);
    }
    
    const rankings = rankingsDoc.data().rankings || [];
    const assignedCorps = [];
    
    // Assign top 25 corps with values 25 down to 1
    for (let i = 0; i < Math.min(25, rankings.length); i++) {
      assignedCorps.push({
        corpsName: rankings[i].name,
        sourceYear: previousYear,
        value: 25 - i,
        rank: i + 1
      });
    }
    
    logger.info(`Assigned ${assignedCorps.length} corps from ${previousYear} final rankings`);
    return assignedCorps;
    
  } catch (error) {
    logger.error('Error assigning live season corps:', error);
    // Fallback to random assignment
    return await assignOffSeasonCorps(db, seasonId, finalsYear);
  }
}

/**
 * Assign corps for OFF-SEASON using random historical data
 */
async function assignOffSeasonCorps(db, seasonId, finalsYear) {
  const logger = functions.logger;
  logger.info('Assigning OFF-SEASON corps randomly from historical data...');
  
  try {
    // Get available years from historical_scores
    const yearsSnapshot = await db.collection('historical_scores').get();
    const availableYears = yearsSnapshot.docs.map(doc => doc.id);
    
    if (availableYears.length === 0) {
      throw new Error('No historical data available');
    }
    
    // Select a random year
    const randomYear = availableYears[Math.floor(Math.random() * availableYears.length)];
    
    // Get corps from that year
    const corpsSnapshot = await db.collection(`historical_scores/${randomYear}/data`).get();
    const allCorps = corpsSnapshot.docs.map(doc => ({
      corpsName: doc.id,
      sourceYear: randomYear,
      ...doc.data()
    }));
    
    // Filter to World Class corps and get their final scores
    const worldClassCorps = allCorps
      .filter(c => !c.corpsName.includes('All Age') && !c.corpsName.includes('International'))
      .map(corps => {
        // Try to get finals score, fallback to semifinals, then prelims
        let finalScore = 0;
        if (corps.scores) {
          finalScore = corps.scores.finals || corps.scores.semifinals || corps.scores.prelims || 0;
        }
        return { ...corps, finalScore };
      })
      .sort((a, b) => b.finalScore - a.finalScore)
      .slice(0, 25);
    
    // Assign values 25 down to 1
    const assignedCorps = worldClassCorps.map((corps, index) => ({
      corpsName: corps.corpsName,
      sourceYear: randomYear,
      value: 25 - index,
      rank: index + 1,
      finalScore: corps.finalScore
    }));
    
    logger.info(`Assigned ${assignedCorps.length} corps from ${randomYear} historical data`);
    return assignedCorps;
    
  } catch (error) {
    logger.error('Error assigning off-season corps:', error);
    throw error;
  }
}

/**
 * Generate season schedule
 */
async function generateSeasonSchedule(db, seasonId, seasonInfo) {
  const logger = functions.logger;
  logger.info(`Generating schedule for ${seasonInfo.seasonName}...`);
  
  const competitions = [];
  const isLiveSeason = seasonInfo.seasonType === 'live';
  const totalDays = seasonInfo.totalDays;
  
  // Championship days
  const championships = isLiveSeason ? 
    SEASON_CONFIG.LIVE_SEASON_CHAMPIONSHIPS : 
    SEASON_CONFIG.OFF_SEASON_CHAMPIONSHIPS;
  
  // Regional days
  const regionals = isLiveSeason ?
    SEASON_CONFIG.LIVE_SEASON_REGIONALS :
    SEASON_CONFIG.OFF_SEASON_REGIONALS;
  
  // Generate competitions for each day
  for (let day = 1; day <= totalDays; day++) {
    const competitionDate = new Date(seasonInfo.startDate);
    competitionDate.setDate(competitionDate.getDate() + day - 1);
    
    // Check if it's a championship day
    if (championships[day]) {
      const championship = championships[day];
      competitions.push({
        day: day,
        date: admin.firestore.Timestamp.fromDate(competitionDate),
        name: championship.name,
        location: championship.location,
        venue: 'Lucas Oil Stadium',
        type: 'championship',
        classes: championship.classes,
        isChampionship: true
      });
    }
    // Check if it's a regional day
    else if (regionals[day]) {
      const regional = regionals[day];
      competitions.push({
        day: day,
        date: admin.firestore.Timestamp.fromDate(competitionDate),
        name: regional.name,
        location: regional.location,
        venue: generateVenueName(),
        type: 'regional',
        classes: ['World', 'Open', 'A'],
        isRegional: true
      });
    }
    // Regular competition days (Fridays and Saturdays)
    else if (competitionDate.getDay() === 5 || competitionDate.getDay() === 6) {
      const location = SEASON_CONFIG.COMPETITION_LOCATIONS[
        Math.floor(Math.random() * SEASON_CONFIG.COMPETITION_LOCATIONS.length)
      ];
      
      competitions.push({
        day: day,
        date: admin.firestore.Timestamp.fromDate(competitionDate),
        name: generateShowName(day),
        location: location,
        venue: generateVenueName(),
        type: 'regular',
        classes: ['World', 'Open', 'A', 'SoundSport']
      });
    }
  }
  
  // Add SoundSport International on Day 49 for off-seasons
  if (!isLiveSeason) {
    const soundsportDate = new Date(seasonInfo.startDate);
    soundsportDate.setDate(soundsportDate.getDate() + 48);
    
    competitions.push({
      day: 49,
      date: admin.firestore.Timestamp.fromDate(soundsportDate),
      name: 'SoundSport International Music & Food Festival',
      location: 'Indianapolis, IN',
      venue: 'Pan Am Plaza',
      type: 'championship',
      classes: ['SoundSport'],
      isSoundSport: true
    });
  }
  
  logger.info(`Generated ${competitions.length} competitions for ${seasonInfo.seasonName}`);
  return competitions;
}

/**
 * Generate weekly schedule structure
 */
function generateWeeklySchedule(competitions, totalWeeks) {
  const weeks = {};
  
  for (let week = 1; week <= totalWeeks; week++) {
    weeks[`week${week}`] = {
      weekNumber: week,
      competitions: competitions.filter(comp => {
        const compDay = comp.day;
        return compDay > ((week - 1) * 7) && compDay <= (week * 7);
      })
    };
  }
  
  return weeks;
}

/**
 * Archive season results with achievements
 */
async function archiveSeasonResults(db, seasonData) {
  const logger = functions.logger;
  logger.info('Archiving season results...');
  
  const seasonId = seasonData.activeSeasonId;
  
  // Get final leaderboard
  const leaderboardDoc = await db.collection('leaderboards').doc(seasonId).get();
  
  if (leaderboardDoc.exists) {
    const rankings = leaderboardDoc.data().rankings || [];
    
    // If this was a live season, save as final rankings for the year
    if (seasonData.seasonType === 'live' && seasonData.finalsYear) {
      await db.doc(`final_rankings/${seasonData.finalsYear}`).set({
        seasonId: seasonId,
        year: seasonData.finalsYear,
        rankings: rankings.slice(0, 25).map(r => ({
          name: r.corpsName,
          userId: r.userId,
          score: r.totalScore,
          rank: r.rank
        })),
        archivedAt: admin.firestore.FieldValue.serverTimestamp()
      });
    }
    
    // Award achievements to top performers
    if (rankings.length > 0) {
      const batch = db.batch();
      
      // Champion
      if (rankings[0]) {
        const championRef = db.doc(`artifacts/marching-art/users/${rankings[0].userId}/achievements/${seasonId}_champion`);
        batch.set(championRef, {
          type: 'season_champion',
          seasonId: seasonId,
          seasonName: seasonData.seasonName,
          rank: 1,
          awardedAt: admin.firestore.FieldValue.serverTimestamp()
        });
      }
      
      // Top 3 (Medalists)
      for (let i = 0; i < Math.min(3, rankings.length); i++) {
        const medalistRef = db.doc(`artifacts/marching-art/users/${rankings[i].userId}/achievements/${seasonId}_medalist`);
        batch.set(medalistRef, {
          type: 'season_medalist',
          seasonId: seasonId,
          seasonName: seasonData.seasonName,
          rank: i + 1,
          awardedAt: admin.firestore.FieldValue.serverTimestamp()
        });
      }
      
      // Top 12 (Finalists)
      for (let i = 0; i < Math.min(12, rankings.length); i++) {
        const finalistRef = db.doc(`artifacts/marching-art/users/${rankings[i].userId}/achievements/${seasonId}_finalist`);
        batch.set(finalistRef, {
          type: 'season_finalist',
          seasonId: seasonId,
          seasonName: seasonData.seasonName,
          rank: i + 1,
          awardedAt: admin.firestore.FieldValue.serverTimestamp()
        });
      }
      
      await batch.commit();
      logger.info('Season achievements awarded');
    }
  }
  
  // Archive league champions
  const leaguesSnapshot = await db.collection('leagues').get();
  
  if (!leaguesSnapshot.empty) {
    const batch = db.batch();
    
    for (const leagueDoc of leaguesSnapshot.docs) {
      const leagueData = leagueDoc.data();
      const leagueId = leagueDoc.id;
      
      // Get league leaderboard for this season
      const leagueLeaderboardDoc = await db.doc(`leagues/${leagueId}/seasons/${seasonId}`).get();
      
      if (leagueLeaderboardDoc.exists) {
        const leagueRankings = leagueLeaderboardDoc.data().rankings || [];
        
        if (leagueRankings.length > 0) {
          // Archive league champion
          const leagueChampionRef = db.doc(`leagues/${leagueId}/champions/${seasonId}`);
          batch.set(leagueChampionRef, {
            seasonId: seasonId,
            seasonName: seasonData.seasonName,
            champion: leagueRankings[0],
            topThree: leagueRankings.slice(0, 3),
            archivedAt: admin.firestore.FieldValue.serverTimestamp()
          });
        }
      }
    }
    
    await batch.commit();
    logger.info('League champions archived');
  }
}

/**
 * Award XP and CorpsCoin at season end
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
    const seasonDoc = await db.doc('game-settings/current').get();
    const isLiveSeason = seasonDoc.exists && seasonDoc.data().seasonType === 'live';
    
    // Award XP and CorpsCoin based on final ranking
    const batch = db.batch();
    let updateCount = 0;
    
    for (let i = 0; i < Math.min(rankings.length, 100); i++) {
      const entry = rankings[i];
      const rank = i + 1;
      
      // Calculate XP reward (higher for live season)
      let xpReward = 100; // Base reward
      if (isLiveSeason) {
        if (rank === 1) xpReward = 1000;
        else if (rank <= 3) xpReward = 600;
        else if (rank <= 12) xpReward = 400;
        else if (rank <= 25) xpReward = 300;
        else xpReward = 200;
      } else {
        if (rank === 1) xpReward = 500;
        else if (rank <= 3) xpReward = 300;
        else if (rank <= 12) xpReward = 200;
        else if (rank <= 25) xpReward = 150;
      }
      
      // Calculate CorpsCoin reward based on class and performance
      let corpsCoinReward = 0;
      if (entry.corpsClass === 'World Class') {
        corpsCoinReward = Math.floor(100 + (25 - Math.min(rank, 25)) * 10);
      } else if (entry.corpsClass === 'Open Class') {
        corpsCoinReward = Math.floor(50 + (25 - Math.min(rank, 25)) * 5);
      } else if (entry.corpsClass === 'A Class') {
        corpsCoinReward = Math.floor(25 + (25 - Math.min(rank, 25)) * 2);
      }
      // SoundSport gets no CorpsCoin as per requirements
      
      // Update user profile
      const userRef = db.doc(`artifacts/marching-art/users/${entry.userId}/profile/data`);
      const updates = {
        xp: admin.firestore.FieldValue.increment(xpReward),
        [`seasonHistory.${seasonId}`]: {
          rank: rank,
          score: entry.totalScore,
          xpEarned: xpReward,
          corpsCoinEarned: corpsCoinReward,
          completedAt: admin.firestore.FieldValue.serverTimestamp()
        }
      };
      
      if (corpsCoinReward > 0) {
        updates.corpsCoin = admin.firestore.FieldValue.increment(corpsCoinReward);
      }
      
      batch.update(userRef, updates);
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
 * ENHANCED: Uses date-aware logic to create the correct season
 */
exports.initializeSeasonManually = functions
  .runWith(getFunctionConfig('heavy'))
  .https.onCall(async (data, context) => {
    // Verify admin access
    if (!context.auth || context.auth.uid !== 'o8vfRCOevjTKBY0k2dISlpiYiIH2') {
      throw new functions.https.HttpsError('permission-denied', 'Admin access required');
    }
    
    const db = admin.firestore();
    const currentDate = new Date();
    
    try {
      // Use date-aware logic to determine correct season
      const seasonInfo = determineCurrentSeason(currentDate);
      
      const result = await initializeNewSeason(db, currentDate, seasonInfo);
      return {
        success: true,
        message: `${seasonInfo.seasonName} initialized successfully`,
        seasonId: result.seasonId,
        seasonName: result.seasonData.seasonName,
        currentDay: result.seasonData.currentDay,
        totalDays: result.seasonData.totalDays
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