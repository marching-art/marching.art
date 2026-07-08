// Season schedule core: scraped-event enrichment, the DCI event scraper
// client, Firestore schedule storage (subcollection + legacy collection), and
// small shared utilities. Extracted verbatim from season.js.

const { logger } = require("firebase-functions/v2");
const { getDb } = require("../config");
const { defineSecret } = require("firebase-functions/params");
const axios = require("axios");

// Fields carried from an enriched scraped event onto a stored show/competition.
// Kept in one place so generate + refresh + write all stay in sync.
const ENRICHMENT_FIELDS = ["startsAt", "scoresAt", "gatesAt", "timezone", "lineup", "venue", "url", "heritageSource"];

/**
 * Copy the detail-page enrichment fields (timing + running order) from a scraped
 * event onto a stored show object, skipping undefined values.
 * @param {object} target - Show/competition object being built.
 * @param {object} source - Scraped (possibly enriched) event.
 * @returns {object} target
 */
function applyEnrichment(target, source) {
  for (const field of ENRICHMENT_FIELDS) {
    if (source[field] !== undefined && source[field] !== null) target[field] = source[field];
  }
  return target;
}

// Shared secret authenticating calls to the scraper codebase's HTTP endpoint.
// Set via: firebase functions:secrets:set SCRAPER_INVOKE_KEY
// Any function that calls scrapeUpcomingDciEvents() must declare this secret
// in its `secrets: [scraperInvokeKey]` option so it can read the value.
const scraperInvokeKey = defineSecret("SCRAPER_INVOKE_KEY");

// The live season opens with a spring-training period before competition day 1.
// startDate (stored in game-settings/season) is calendar day 1; competition day
// (offSeasonDay) 1 falls SPRING_TRAINING_DAYS calendar days later. This must match
// the offset used when scoring in scheduled/dailyProcessors.js, otherwise scraped
// events land on the wrong schedule day.
const SPRING_TRAINING_DAYS = 21;

/**
 * Call the isolated scraper function to get upcoming DCI events.
 * The Puppeteer-based scraper lives in the separate `functions-scraper`
 * codebase to keep cold starts fast for the main codebase. We invoke it
 * server-to-server via its HTTP endpoint, authenticated by SCRAPER_INVOKE_KEY.
 * @param {number} year - The year to scrape events for
 * @returns {Promise<Array>} Array of event objects (empty on failure)
 */
async function scrapeUpcomingDciEvents(year) {
  logger.info(`[Season] Calling isolated scraper for year ${year}...`);

  // NOTE: This throws on infrastructure failures (missing config, unbound/empty
  // secret, transport error, non-2xx, or an unsuccessful scraper response) rather
  // than silently returning []. A genuine successful response with zero events
  // still returns []. Callers decide how to react: startNewLiveSeason degrades
  // gracefully (empty schedule) while the admin refresh surfaces the message.
  const project = process.env.GCLOUD_PROJECT || process.env.GCP_PROJECT;
  if (!project) {
    throw new Error("GCLOUD_PROJECT env var not set; cannot locate the scraper endpoint.");
  }

  let invokeKey;
  try {
    invokeKey = scraperInvokeKey.value();
  } catch {
    throw new Error(
      "SCRAPER_INVOKE_KEY secret not bound to this function. Add `secrets: [scraperInvokeKey]` " +
      "to the calling function's options and run `firebase functions:secrets:set SCRAPER_INVOKE_KEY`."
    );
  }
  if (!invokeKey) {
    throw new Error("SCRAPER_INVOKE_KEY is empty. Run `firebase functions:secrets:set SCRAPER_INVOKE_KEY`.");
  }

  const url = `https://us-central1-${project}.cloudfunctions.net/scrapeUpcomingDciEventsHttp`;

  let response;
  try {
    response = await axios.post(
      url,
      { year },
      {
        headers: { "x-invoke-key": invokeKey, "Content-Type": "application/json" },
        timeout: 290000,
      }
    );
  } catch (error) {
    const detail = error.response ? `${error.response.status} ${JSON.stringify(error.response.data)}` : error.message;
    logger.error(`[Season] Error calling isolated scraper: ${detail}`);
    throw new Error(`Scraper request failed: ${detail}`);
  }

  if (!response.data || !response.data.success) {
    logger.error("[Season] Scraper returned unsuccessful response:", response.data);
    throw new Error(`Scraper returned an unsuccessful response: ${JSON.stringify(response.data)}`);
  }

  logger.info(`[Season] Scraper returned ${response.data.count} events.`);
  return response.data.events || [];
}

// =============================================================================
// SCHEDULE HELPERS
// =============================================================================
// Schedule data is stored in: schedules/{seasonId} with a competitions array
// This format is used by both web and mobile apps

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
 * Gets a single day's schedule from the schedules collection
 * @param {string} seasonId - The season identifier
 * @param {number} dayNumber - The offSeasonDay (1-49)
 * @returns {Object|null} The day data or null if not found
 */
async function getScheduleDay(seasonId, dayNumber) {
  const db = getDb();
  const scheduleRef = db.doc(`schedules/${seasonId}`);
  const scheduleDoc = await scheduleRef.get();

  if (!scheduleDoc.exists) {
    return null;
  }

  const competitions = scheduleDoc.data().competitions || [];
  const dayShows = competitions
    .filter(comp => comp.day === dayNumber)
    .map(comp => ({
      eventName: comp.name,
      location: comp.location,
      date: comp.date,
      type: comp.type,
      isChampionship: comp.type === "championship",
      eligibleClasses: comp.allowedClasses,
      mandatory: comp.mandatory,
    }));

  if (dayShows.length === 0) {
    return null;
  }

  return {
    offSeasonDay: dayNumber,
    shows: dayShows,
  };
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
  const scheduleRef = db.doc(`schedules/${seasonId}`);
  const scheduleDoc = await scheduleRef.get();

  if (!scheduleDoc.exists) {
    return [];
  }

  const competitions = scheduleDoc.data().competitions || [];

  // Group competitions by day within the range
  const dayMap = {};
  competitions
    .filter(comp => comp.day >= startDay && comp.day <= endDay)
    .forEach(comp => {
      if (!dayMap[comp.day]) {
        dayMap[comp.day] = { offSeasonDay: comp.day, shows: [] };
      }
      dayMap[comp.day].shows.push({
        eventName: comp.name,
        location: comp.location,
        date: comp.date,
        type: comp.type,
        isChampionship: comp.type === "championship",
        eligibleClasses: comp.allowedClasses,
        mandatory: comp.mandatory,
      });
    });

  return Object.values(dayMap).sort((a, b) => a.offSeasonDay - b.offSeasonDay);
}

/**
 * Gets all schedule days for a season
 * @param {string} seasonId - The season identifier
 * @returns {Array} Array of all day objects
 */
async function getAllScheduleDays(seasonId) {
  const db = getDb();
  const scheduleRef = db.doc(`schedules/${seasonId}`);
  const scheduleDoc = await scheduleRef.get();

  if (!scheduleDoc.exists) {
    return [];
  }

  const competitions = scheduleDoc.data().competitions || [];

  // Group competitions by day
  const dayMap = {};
  competitions.forEach(comp => {
    if (!dayMap[comp.day]) {
      dayMap[comp.day] = { offSeasonDay: comp.day, shows: [] };
    }
    dayMap[comp.day].shows.push({
      eventName: comp.name,
      location: comp.location,
      date: comp.date,
      type: comp.type,
      isChampionship: comp.type === "championship",
      eligibleClasses: comp.allowedClasses,
      mandatory: comp.mandatory,
    });
  });

  return Object.values(dayMap).sort((a, b) => a.offSeasonDay - b.offSeasonDay);
}

/**
 * Updates a single day's shows in the schedules collection
 * @param {string} seasonId - The season identifier
 * @param {number} dayNumber - The offSeasonDay to update
 * @param {Array} shows - The new shows array for this day
 */
async function updateScheduleDay(seasonId, dayNumber, shows) {
  const db = getDb();
  const scheduleRef = db.doc(`schedules/${seasonId}`);
  const scheduleDoc = await scheduleRef.get();

  const week = Math.ceil(dayNumber / 7);
  let competitions = scheduleDoc.exists ? (scheduleDoc.data().competitions || []) : [];

  // Remove existing shows for this day
  competitions = competitions.filter(comp => comp.day !== dayNumber);

  // Add new shows for this day
  shows.forEach((show, idx) => {
    competitions.push({
      id: `${seasonId}_day${dayNumber}_${idx}`,
      name: show.eventName,
      location: show.location || "",
      date: show.date || null,
      day: dayNumber,
      week: week,
      type: show.isChampionship ? "championship" : "regular",
      allowedClasses: show.eligibleClasses || ["World Class", "Open Class", "A Class", "SoundSport"],
      mandatory: show.mandatory || false,
    });
  });

  // Sort by day
  competitions.sort((a, b) => a.day - b.day);

  await scheduleRef.set({ competitions }, { merge: true });
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
  const scheduleRef = db.doc(`schedules/${seasonId}`);
  const scheduleDoc = await scheduleRef.get();

  let competitions = scheduleDoc.exists ? (scheduleDoc.data().competitions || []) : [];

  // Check if show already exists on this day
  const alreadyExists = competitions.some(
    (comp) => comp.day === dayNumber && comp.name === show.eventName
  );

  if (alreadyExists) {
    return false;
  }

  const week = Math.ceil(dayNumber / 7);
  const existingDayShows = competitions.filter(comp => comp.day === dayNumber);

  competitions.push({
    id: `${seasonId}_day${dayNumber}_${existingDayShows.length}`,
    name: show.eventName,
    location: show.location || "",
    date: show.date || null,
    day: dayNumber,
    week: week,
    type: show.isChampionship ? "championship" : "regular",
    allowedClasses: show.eligibleClasses || ["World Class", "Open Class", "A Class", "SoundSport"],
    mandatory: show.mandatory || false,
  });

  // Sort by day
  competitions.sort((a, b) => a.day - b.day);

  await scheduleRef.set({ competitions }, { merge: true });
  return true;
}

// =============================================================================
// END SCHEDULE HELPERS
// =============================================================================

/**
 * Writes schedule to the schedules collection in competitions array format
 * This is the format used by the mobile app and web Schedule page
 * @param {string} seasonId - The season identifier
 * @param {Array} schedule - Array of day objects with offSeasonDay and shows
 */
async function writeScheduleToCollection(seasonId, schedule) {
  const db = getDb();

  // Transform to competitions array format
  const competitions = [];
  schedule.forEach(day => {
    const week = Math.ceil(day.offSeasonDay / 7);
    (day.shows || []).forEach((show, idx) => {
      const competition = {
        id: `${seasonId}_day${day.offSeasonDay}_${idx}`,
        name: show.eventName,
        location: show.location || "",
        date: show.date || null,
        day: day.offSeasonDay,
        week: week,
        type: show.isChampionship ? "championship" : "regular",
        allowedClasses: show.eligibleClasses || ["World Class", "Open Class", "A Class", "SoundSport"],
        mandatory: show.mandatory || false,
      };
      // Carry detail-page timing + running order when present (live-season shows).
      applyEnrichment(competition, show);
      competitions.push(competition);
    });
  });

  await db.doc(`schedules/${seasonId}`).set({ competitions });
  logger.info(`Wrote ${competitions.length} competitions to schedules/${seasonId}`);
}

function shuffleArray(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

/**
 * Replaces "DCI" with "marching.art" in an event name for in-game branding.
 * Applied automatically wherever schedules are imported from scraped DCI data.
 */
function brandEventName(name) {
  return typeof name === "string" ? name.replace(/DCI/g, "marching.art") : name;
}

module.exports = {
  ENRICHMENT_FIELDS,
  applyEnrichment,
  SPRING_TRAINING_DAYS,
  scrapeUpcomingDciEvents,
  scraperInvokeKey,
  writeScheduleToSubcollection,
  writeScheduleToCollection,
  getScheduleDay,
  getScheduleDays,
  getAllScheduleDays,
  updateScheduleDay,
  addShowToDay,
  shuffleArray,
  brandEventName,
};
