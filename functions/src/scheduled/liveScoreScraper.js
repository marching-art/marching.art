/**
 * marching.art Live Season Score Scraper
 * Runs daily at 1:00 AM ET during live seasons
 * Scrapes previous day's DCI scores and saves to historical_scores
 * Optimized for cost efficiency - single daily execution
 */

const functions = require('firebase-functions');
const admin = require('firebase-admin');
const axios = require('axios');
const cheerio = require('cheerio');
const { getFunctionConfig } = require('../../config');

/**
 * Daily scraper - runs at 1:00 AM ET (one hour before score processing)
 * Only executes during live seasons
 */
exports.scrapeDailyLiveScores = functions
  .runWith(getFunctionConfig('standard'))
  .pubsub.schedule('0 1 * * *')
  .timeZone('America/New_York')
  .onRun(async (context) => {
    const logger = functions.logger;
    
    try {
      logger.info('Starting daily live score scraper...');
      
      const db = admin.firestore();
      
      // Check if we're in a live season
      const seasonDoc = await db.doc('game-settings/current').get();
      
      if (!seasonDoc.exists) {
        logger.info('No active season found. Skipping scrape.');
        return;
      }
      
      const seasonData = seasonDoc.data();
      
      if (seasonData.seasonType !== 'live') {
        logger.info('Current season is not a live season. Skipping scrape.');
        return;
      }
      
      logger.info('Live season detected. Proceeding with scrape...');
      
      // Calculate which day we're scoring
      const seasonStartDate = seasonData.startDate.toDate();
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const diffInMillis = yesterday.getTime() - seasonStartDate.getTime();
      const scoredDay = Math.floor(diffInMillis / (1000 * 60 * 60 * 24)) + 1;
      
      if (scoredDay < 1 || scoredDay > 70) {
        logger.info(`Scored day (${scoredDay}) is outside live season range. Skipping.`);
        return;
      }
      
      // Scrape the latest DCI scores
      const scrapedData = await scrapeDciScoresPage();
      
      if (!scrapedData || scrapedData.length === 0) {
        logger.info('No new scores found to scrape.');
        return;
      }
      
      // Save to historical_scores
      await saveToHistoricalScores(db, scrapedData, scoredDay);
      
      // Also save to live_scores for current season tracking
      await saveToLiveScores(db, seasonData.activeSeasonId, scrapedData, scoredDay);
      
      logger.info(`Successfully scraped and saved ${scrapedData.length} corps scores for day ${scoredDay}`);
      
    } catch (error) {
      logger.error('Error in daily live score scraper:', error);
      // Don't throw - let score processing continue even if scrape fails
    }
  });

/**
 * Scrape DCI scores from the main scores page
 */
async function scrapeDciScoresPage() {
  const logger = functions.logger;
  
  try {
    const baseUrl = 'https://www.dci.org';
    const scoresPageUrl = `${baseUrl}/scores?pageno=1`;
    
    logger.info(`Fetching scores page: ${scoresPageUrl}`);
    
    // Get the main scores page
    const { data: mainPage } = await axios.get(scoresPageUrl, { timeout: 30000 });
    const $ = cheerio.load(mainPage);
    
    // Find the most recent recap link
    const recapLinkSelector = 'a.arrow-btn[href*="/scores/recap/"]';
    const latestRecapLink = $(recapLinkSelector).first().attr('href');
    
    if (!latestRecapLink) {
      logger.info('No recap links found on scores page.');
      return null;
    }
    
    const fullRecapUrl = new URL(latestRecapLink, baseUrl).href;
    logger.info(`Found latest recap: ${fullRecapUrl}`);
    
    // Scrape the recap page
    const scoresData = await scrapeRecapPage(fullRecapUrl);
    
    return scoresData;
    
  } catch (error) {
    logger.error('Error scraping DCI scores page:', error);
    return null;
  }
}

/**
 * Scrape a specific DCI recap page for scores
 */
async function scrapeRecapPage(recapUrl) {
  const logger = functions.logger;
  
  try {
    logger.info(`Scraping recap page: ${recapUrl}`);
    
    const { data } = await axios.get(recapUrl, { timeout: 30000 });
    const $ = cheerio.load(data);
    
    // Extract event information
    const eventNameSelector = 'div[data-widget_type="theme-post-title.default"] h1.elementor-heading-title';
    const eventName = $(eventNameSelector).text().trim() || 'Unknown Event';
    
    const dateLocationDiv = $('div[data-widget_type="shortcode.default"] div.score-date-location');
    const dateText = dateLocationDiv.find('p').eq(0).text().trim();
    const locationText = dateLocationDiv.find('p').eq(1).text().trim();
    
    let eventDate = new Date();
    let year = eventDate.getFullYear();
    
    if (dateText) {
      const parsedDate = new Date(dateText);
      if (!isNaN(parsedDate.getTime())) {
        eventDate = parsedDate;
        year = eventDate.getFullYear();
      }
    }
    
    const eventLocation = locationText || 'Unknown Location';
    
    logger.info(`Event: ${eventName}, Date: ${eventDate.toISOString()}, Location: ${eventLocation}`);
    
    // Parse caption headers
    const headerSelector = 'table#effect-table-0 > tbody > tr.table-top';
    const headerRow = $(headerSelector);
    const orderedCaptionTitles = [];
    
    headerRow.find('td.type').each((_i, el) => {
      orderedCaptionTitles.push($(el).text().trim());
    });
    
    // Parse corps scores
    const scoresData = [];
    
    $('table#effect-table-0 > tbody > tr').not('.table-top').each((i, row) => {
      const corpsName = $(row).find('td.sticky-td').first().text().trim();
      if (!corpsName) return;
      
      const totalScore = parseFloat(
        $(row).find('td.data-total').last().find('span').first().text().trim()
      );
      
      // Collect caption scores
      const tempScores = {
        'General Effect 1': [],
        'General Effect 2': [],
        'Visual Proficiency': [],
        'Visual Analysis': [],
        'Color Guard': [],
        'Music Brass': [],
        'Music Analysis': [],
        'Music Percussion': []
      };
      
      const mapCaptionTitle = (title) => {
        const normalized = title.replace(/\s-\s/g, ' ').trim();
        return tempScores.hasOwnProperty(normalized) ? normalized : null;
      };
      
      const scoreTables = $(row).find('table.data');
      
      scoreTables.each((index, table) => {
        const captionTitle = orderedCaptionTitles[index];
        const mappedTitle = mapCaptionTitle(captionTitle);
        
        if (mappedTitle) {
          const score = parseFloat($(table).find('td').eq(2).text().trim());
          if (!isNaN(score)) {
            tempScores[mappedTitle].push(score);
          }
        }
      });
      
      // Process captions (average if multiple judges)
      const processCaption = (captionName) => {
        const scores = tempScores[captionName];
        if (!scores || scores.length === 0) return 0;
        if (scores.length === 1) return scores[0];
        const sum = scores.reduce((a, b) => a + b, 0);
        return parseFloat((sum / scores.length).toFixed(3));
      };
      
      const captions = {
        GE1: processCaption('General Effect 1'),
        GE2: processCaption('General Effect 2'),
        VP: processCaption('Visual Proficiency'),
        VA: processCaption('Visual Analysis'),
        CG: processCaption('Color Guard'),
        B: processCaption('Music Brass'),
        MA: processCaption('Music Analysis'),
        P: processCaption('Music Percussion')
      };
      
      scoresData.push({
        corps: corpsName,
        corpsName: corpsName,
        totalScore: totalScore,
        captions: captions
      });
    });
    
    if (scoresData.length === 0) {
      logger.warn(`No scores found on ${recapUrl}`);
      return null;
    }
    
    logger.info(`Scraped ${scoresData.length} corps from ${eventName}`);
    
    return {
      eventName: eventName,
      eventDate: eventDate,
      eventLocation: eventLocation,
      year: year,
      scores: scoresData
    };
    
  } catch (error) {
    logger.error(`Error scraping recap page ${recapUrl}:`, error);
    return null;
  }
}

/**
 * Save scraped data to historical_scores collection
 */
async function saveToHistoricalScores(db, scrapedData, scoredDay) {
  const logger = functions.logger;
  
  try {
    const year = scrapedData.year.toString();
    const historicalRef = db.collection('historical_scores').doc(year);
    
    // Get existing data for this year
    const historicalDoc = await historicalRef.get();
    const existingData = historicalDoc.exists ? historicalDoc.data() : {};
    
    // Create event entry
    const eventEntry = {
      eventName: scrapedData.eventName,
      location: scrapedData.eventLocation,
      date: scrapedData.eventDate.toISOString(),
      offSeasonDay: scoredDay,
      scores: scrapedData.scores.map(s => ({
        corps: s.corpsName,
        score: s.totalScore,
        captions: s.captions
      }))
    };
    
    // Add to data array
    const dataArray = existingData.data || [];
    
    // Check if event already exists (avoid duplicates)
    const existingEventIndex = dataArray.findIndex(e => 
      e.eventName === eventEntry.eventName && 
      e.date === eventEntry.date
    );
    
    if (existingEventIndex >= 0) {
      // Update existing event
      dataArray[existingEventIndex] = eventEntry;
      logger.info(`Updated existing event in historical_scores: ${eventEntry.eventName}`);
    } else {
      // Add new event
      dataArray.push(eventEntry);
      logger.info(`Added new event to historical_scores: ${eventEntry.eventName}`);
    }
    
    // Save back to Firestore
    await historicalRef.set({
      data: dataArray,
      lastUpdated: admin.firestore.FieldValue.serverTimestamp()
    }, { merge: true });
    
    logger.info(`Successfully saved to historical_scores/${year}`);
    
  } catch (error) {
    logger.error('Error saving to historical_scores:', error);
    throw error;
  }
}

/**
 * Save scraped data to live_scores collection for current season
 */
async function saveToLiveScores(db, seasonId, scrapedData, scoredDay) {
  const logger = functions.logger;
  
  try {
    const batch = db.batch();
    
    for (const corps of scrapedData.scores) {
      const scoreRef = db.collection(`live_scores/${seasonId}/scores`).doc();
      
      batch.set(scoreRef, {
        corpsName: corps.corpsName,
        day: scoredDay,
        totalScore: corps.totalScore,
        captions: corps.captions,
        eventName: scrapedData.eventName,
        eventLocation: scrapedData.eventLocation,
        eventDate: admin.firestore.Timestamp.fromDate(scrapedData.eventDate),
        scrapedAt: admin.firestore.FieldValue.serverTimestamp()
      });
    }
    
    await batch.commit();
    
    logger.info(`Successfully saved to live_scores/${seasonId}`);
    
  } catch (error) {
    logger.error('Error saving to live_scores:', error);
    throw error;
  }
}

/**
 * ADMIN FUNCTION: Manual scrape trigger
 */
exports.triggerManualScrape = functions
  .runWith(getFunctionConfig('standard'))
  .https.onCall(async (data, context) => {
    // Verify admin access
    if (!context.auth || context.auth.uid !== 'o8vfRCOevjTKBY0k2dISlpiYiIH2') {
      throw new functions.https.HttpsError('permission-denied', 'Admin access required');
    }
    
    const logger = functions.logger;
    
    try {
      logger.info('Manual scrape triggered by admin');
      
      const db = admin.firestore();
      const seasonDoc = await db.doc('game-settings/current').get();
      
      if (!seasonDoc.exists) {
        throw new functions.https.HttpsError('failed-precondition', 'No active season found');
      }
      
      const seasonData = seasonDoc.data();
      
      // Allow manual scrape for any season type
      const scrapedData = await scrapeDciScoresPage();
      
      if (!scrapedData || scrapedData.length === 0) {
        return {
          success: false,
          message: 'No scores found on DCI.org'
        };
      }
      
      // Calculate day if in season
      let scoredDay = data.day || 1;
      if (seasonData.seasonType === 'live') {
        const seasonStartDate = seasonData.startDate.toDate();
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        const diffInMillis = yesterday.getTime() - seasonStartDate.getTime();
        scoredDay = Math.floor(diffInMillis / (1000 * 60 * 60 * 24)) + 1;
      }
      
      await saveToHistoricalScores(db, scrapedData, scoredDay);
      
      if (seasonData.seasonType === 'live') {
        await saveToLiveScores(db, seasonData.activeSeasonId, scrapedData, scoredDay);
      }
      
      return {
        success: true,
        message: `Successfully scraped ${scrapedData.scores.length} corps scores`,
        event: scrapedData.eventName,
        date: scrapedData.eventDate.toISOString(),
        corpsCount: scrapedData.scores.length
      };
      
    } catch (error) {
      logger.error('Error in manual scrape:', error);
      throw new functions.https.HttpsError('internal', `Scrape failed: ${error.message}`);
    }
  });

// Export functions
module.exports = {
  scrapeDailyLiveScores: exports.scrapeDailyLiveScores,
  triggerManualScrape: exports.triggerManualScrape
};