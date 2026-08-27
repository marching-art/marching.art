// Season schedule generation: the live-season schedule built from scraped
// DCI events and the off-season schedule built from the historical archive,
// plus off-season date math. Extracted verbatim from season.js.

const { logger } = require("firebase-functions/v2");
const { getDb } = require("../config");
const { enrichEventsWithDetails } = require("./eventDetails");
const { loadAllHistoricalYears } = require("./historicalScores");
const { standardizeLocation, isUnknownLocation } = require("./locationFormat");
const {
  applyEnrichment,
  SPRING_TRAINING_DAYS,
  scrapeUpcomingDciEvents,
  shuffleArray,
  brandEventName,
  regionalTierForEventName,
} = require("./seasonSchedule");

async function generateLiveSeasonSchedule(seasonLength, startDay, finalsYear, startDate, _finalsDate, springTrainingDays = SPRING_TRAINING_DAYS) {
  logger.info(`Generating live season schedule for ${seasonLength} days, starting on day ${startDay}.`);

  // Create schedule structure matching off-season format
  const schedule = Array.from({ length: seasonLength }, (_, i) => ({ offSeasonDay: startDay + i, shows: [] }));

  // Scrape upcoming DCI events and populate days 1-44
  try {
    logger.info(`Scraping upcoming DCI events for ${finalsYear}...`);
    const upcomingEvents = (await scrapeUpcomingDciEvents(finalsYear)).map((e) => ({
      ...e,
      eventName: brandEventName(e.eventName),
    }));
    logger.info(`Found ${upcomingEvents.length} upcoming events to map to schedule.`);

    // Visit each event's detail page to capture real start/scores times + running
    // order. Enrichment is best-effort: events that fail keep their base fields.
    // NOTE: corps names in the lineup are real DCI corps and are deliberately NOT
    // branded (brandEventName), so the dashboard "your picks are live" match works.
    await enrichEventsWithDetails(upcomingEvents);

    // Map each event to its corresponding offSeasonDay (competition day)
    const millisInDay = 24 * 60 * 60 * 1000;

    for (const event of upcomingEvents) {
      if (!event.date) continue;

      const eventDate = new Date(event.date);

      // startDate is calendar day 1. The first SPRING_TRAINING_DAYS calendar days
      // are spring training, so competition day (offSeasonDay) = calendarDay - 21.
      // offSeasonDay 1 = startDate + 21 days, offSeasonDay 49 = finalsDate.
      const diffFromStart = eventDate.getTime() - startDate.getTime();
      const calendarDay = Math.floor(diffFromStart / millisInDay) + 1;
      const dayNumber = calendarDay - springTrainingDays;

      // Only include events within days 1-44 (non-championship days)
      if (dayNumber >= 1 && dayNumber <= 44) {
        const dayEntry = schedule.find((d) => d.offSeasonDay === dayNumber);
        if (dayEntry) {
          // Check if this event already exists on this day
          const alreadyExists = dayEntry.shows.some(
            (s) => s.eventName === event.eventName
          );
          if (!alreadyExists) {
            const show = {
              eventName: event.eventName,
              location: standardizeLocation(event.location),
              date: event.date,
              isChampionship: false,
            };
            // Tag the branded majors so live seasons mark them like the
            // off-season generator does — the anchor Podium corps auto-attend
            // and the only show that carries the "major" treatment on its day.
            const eventTier = regionalTierForEventName(event.eventName);
            if (eventTier) show.eventTier = eventTier;
            applyEnrichment(show, event);
            dayEntry.shows.push(show);
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

async function generateOffSeasonSchedule(seasonLength, startDay) {
  logger.info(`Generating schedule for a ${seasonLength}-day season, starting on day ${startDay}.`);
  const db = getDb();
  // Events are sharded into historical_scores/{year}/events subcollections;
  // loadAllHistoricalYears unions those with any legacy in-array events.
  const historicalByYear = await loadAllHistoricalYears(db);

  const showsByDay = new Map();
  Object.values(historicalByYear).forEach((yearData) => {
    yearData.forEach((event) => {
      // "DCI Competition - {location}" is the placeholder name given to
      // events the From The Pressbox import (2000-2012) had no title for.
      // Their scores still feed regression/stats, but they make poor
      // schedule entries, so keep them out of the generated season.
      // Historical majors (Southwestern/Southeastern/DCI East/Eastern
      // Classic) are excluded too: their days are hard-coded below as
      // branded marching.art majors, and letting the source events into
      // the random pool would double them up on neighboring days.
      //
      // Shows whose archived venue is missing or the "Unknown Location"
      // placeholder are dropped as well: they'd render as a broken entry on
      // the schedule, so they must never be placed on the off-season schedule.
      if (event.eventName && event.offSeasonDay &&
          !isUnknownLocation(event.location) &&
          !event.eventName.toLowerCase().includes("open class") &&
          !event.eventName.startsWith("DCI Competition - ") &&
          !/southwestern|southeastern|eastern classic|dci east\b/i.test(event.eventName)) {
        const showData = {
          eventName: event.eventName,
          date: event.date,
          // Standardize the region to a two-letter code up front so the
          // `usedLocations` de-dup below treats "Rockford, Illinois" and
          // "Rockford, IL" as the same venue (see helpers/locationFormat.js).
          location: standardizeLocation(event.location),
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

  // The marching.art majors are hard-coded like Championship Week: branded
  // events on fixed days at fixed sites, never sourced from the historical
  // pool, and never sharing their day with another show. The Eastern Classic
  // is one two-night event placed on both days — registering for it counts
  // as a single show, and attendees are split evenly per class across the
  // two nights at scoring time.
  const placeMajor = (days, eventName, location) => {
    const multiNight = days.length > 1 ? { nights: [...days] } : null;
    for (const day of days) {
      const dayObject = schedule.find((d) => d.offSeasonDay === day);
      if (!dayObject) continue;
      dayObject.shows = [{
        eventName,
        location,
        offSeasonDay: day,
        eventTier: "regional",
        mandatory: false,
        ...(multiNight ? { multiNight } : {}),
      }];
    }
    usedEventNames.add(eventName);
    usedLocations.add(location);
  };

  placeMajor([28], "marching.art Southwestern Championship", "Dallas, TX");
  placeMajor([35], "marching.art Southeastern Championship", "Atlanta, GA");
  placeMajor([41, 42], "marching.art Eastern Classic", "Allentown, PA");

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

  // Update Day 47-49 to include championship metadata (create fallbacks if missing)
  const day47 = schedule.find((d) => d.offSeasonDay === 47);
  if (day47) {
    const prelimsShow = day47.shows[0] || {
      eventName: "marching.art World Championship Prelims",
      location: "Indianapolis, IN",
      date: null,
    };
    prelimsShow.isChampionship = true;
    prelimsShow.eligibleClasses = ["worldClass", "openClass", "aClass"];
    prelimsShow.mandatory = true;
    day47.shows = [prelimsShow];
  }

  const day48 = schedule.find((d) => d.offSeasonDay === 48);
  if (day48) {
    const semisShow = day48.shows[0] || {
      eventName: "marching.art World Championship Semifinals",
      location: "Indianapolis, IN",
      date: null,
    };
    semisShow.isChampionship = true;
    semisShow.eligibleClasses = ["worldClass", "openClass", "aClass"];
    semisShow.advancementRules = { all: 25 }; // Top 25 from Day 47
    semisShow.mandatory = true;
    day48.shows = [semisShow];
  }

  const day49 = schedule.find((d) => d.offSeasonDay === 49);
  if (day49) {
    // Day 49 has two shows: World Finals and SoundSport Festival
    const worldFinalsShow = day49.shows[0] || {
      eventName: "marching.art World Championship Finals",
      location: "Indianapolis, IN",
      date: null,
    };
    worldFinalsShow.isChampionship = true;
    worldFinalsShow.eligibleClasses = ["worldClass", "openClass", "aClass"];
    worldFinalsShow.advancementRules = { all: 12 }; // Top 12 from Day 48
    worldFinalsShow.mandatory = true;

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
        show.eventName = brandEventName(show.eventName);
      }
    });
  });

  logger.info("Advanced schedule generated successfully.");
  return schedule;
}

const MILLIS_IN_DAY = 1000 * 60 * 60 * 24;

/**
 * DCI World Championship Finals date (UTC) for a given finals year: the SECOND
 * Saturday of August. This is the single anchor that both the forward mapping
 * (date -> competition day, `calculateOffSeasonDay`) and the inverse
 * (`competitionDayToDateUTC`) derive from, so they can never drift apart.
 * @param {number} year - Finals year.
 * @returns {Date} UTC-midnight Date of finals (competition day 49).
 */
function computeFinalsDateUTC(year) {
  const firstOfAugust = new Date(Date.UTC(year, 7, 1));
  const dayOfWeek = firstOfAugust.getUTCDay();
  const daysUntilFirstSaturday = (6 - dayOfWeek + 7) % 7;
  const firstSaturdayDate = 1 + daysUntilFirstSaturday;
  const finalsDay = firstSaturdayDate + 7; // second Saturday
  return new Date(Date.UTC(year, 7, finalsDay));
}

function calculateOffSeasonDay(eventDate, year) {
  if (!eventDate || isNaN(eventDate.getTime())) return null;

  const finalsDateUTC = computeFinalsDateUTC(year);
  const seasonEndDate = new Date(finalsDateUTC);
  const seasonStartDate = new Date(finalsDateUTC.getTime() - 48 * MILLIS_IN_DAY);
  const eventDateUTC = new Date(Date.UTC(eventDate.getUTCFullYear(), eventDate.getUTCMonth(), eventDate.getUTCDate()));

  if (eventDateUTC < seasonStartDate || eventDateUTC > seasonEndDate) return null;

  const diffInMillis = eventDateUTC.getTime() - seasonStartDate.getTime();
  const diffInDays = Math.round(diffInMillis / MILLIS_IN_DAY);

  return diffInDays + 1;
}

/**
 * Inverse of `calculateOffSeasonDay`: the UTC calendar date a given competition
 * day (1-49) falls on for a finals year. Day 1 is finals - 48 days; day 49 is
 * finals. Returns null for days outside 1-49.
 * @param {number} day - Competition day, 1-49.
 * @param {number} finalsYear - Finals year (season's `seasonYear`).
 * @returns {Date|null} UTC-midnight Date for that competition day.
 */
function competitionDayToDateUTC(day, finalsYear) {
  if (!Number.isInteger(day) || day < 1 || day > 49) return null;
  const finalsDateUTC = computeFinalsDateUTC(finalsYear);
  const seasonStartDate = new Date(finalsDateUTC.getTime() - 48 * MILLIS_IN_DAY);
  return new Date(seasonStartDate.getTime() + (day - 1) * MILLIS_IN_DAY);
}

function getThematicOffSeasonName(seasonType, finalsYear) {
  const startYear = finalsYear - 1;
  return `${seasonType.toLowerCase()}_${startYear}-${finalsYear.toString().slice(-2)}`;
}

// A game year is six 49-day off-seasons plus a 49-day live-season competition
// stretch = 343 fixed days. The remaining calendar days between two consecutive
// DCI finals (364 or 371 — 52 or 53 weeks) are the live season's SPRING
// TRAINING. Making spring training the variable buffer keeps every off-season a
// fixed 49 days and pins competition day 49 to the real DCI finals date, while
// the first off-season begins the day after the previous finals with no dead
// gap. See docs/SCHEDULE_SYSTEM.md.
const OFF_SEASON_COUNT = 6;
const OFF_SEASON_LENGTH_DAYS = 49;
const FIXED_SEASON_DAYS = OFF_SEASON_COUNT * OFF_SEASON_LENGTH_DAYS + 49; // 343

/**
 * The DCI finals date for a year: a manual override when one is on record,
 * otherwise the computed 2nd Saturday of August (computeFinalsDateUTC).
 *
 * The override is the safety valve for the rare year DCI schedules finals off
 * the 2nd Saturday. `overrides` is a plain map keyed by finals year (number or
 * string) to a "YYYY-MM-DD" UTC date; a malformed entry is ignored so a bad
 * override can never break the season calendar — it just falls back to the
 * computed date. Only the season-window layer consults overrides;
 * calculateOffSeasonDay / competitionDayToDateUTC stay on the pure 2nd-Saturday
 * rule because they map HISTORICAL DCI events, which follow their own real dates.
 *
 * @param {number} year - Finals year.
 * @param {Object<string|number, string>} [overrides] - Year -> "YYYY-MM-DD".
 * @returns {Date} UTC-midnight finals date.
 */
function resolveFinalsDateUTC(year, overrides = {}) {
  const raw = overrides && (overrides[year] != null ? overrides[year] : overrides[String(year)]);
  if (raw != null) {
    const s = String(raw);
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
      const d = new Date(`${s}T00:00:00.000Z`);
      // Round-trip guard rejects impossible dates like 2029-02-31.
      if (!Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s) return d;
    }
    // Malformed override: fall through to the computed 2nd Saturday.
  }
  return computeFinalsDateUTC(year);
}

/**
 * The next DCI finals (UTC midnight): this year's if it hasn't happened yet,
 * otherwise next year's. Honors manual overrides via resolveFinalsDateUTC.
 * @param {Date} now
 * @param {Object} [overrides] - Finals-date overrides (see resolveFinalsDateUTC).
 * @returns {Date}
 */
function upcomingFinalsUTC(now, overrides = {}) {
  const thisYear = resolveFinalsDateUTC(now.getUTCFullYear(), overrides);
  return now.getTime() >= thisYear.getTime()
    ? resolveFinalsDateUTC(now.getUTCFullYear() + 1, overrides)
    : thisYear;
}

/**
 * Spring-training length (calendar days) for the live season ending on
 * `finalsDate`: the slack between consecutive finals once the six off-seasons
 * and the 49 competition days are accounted for. 21 in a 364-day year, 28 in a
 * 371-day (53-week) year.
 * @param {Date} finalsDate
 * @returns {number}
 */
function springTrainingDaysFor(finalsDate, overrides = {}) {
  const prevFinals = resolveFinalsDateUTC(finalsDate.getUTCFullYear() - 1, overrides);
  const gapDays = Math.round((finalsDate.getTime() - prevFinals.getTime()) / MILLIS_IN_DAY);
  return gapDays - FIXED_SEASON_DAYS;
}

/**
 * The live season's calendar start (spring-training day 1) for a finals date:
 * competition day 1 is finals - 48 days, and spring training precedes it.
 * @param {Date} finalsDate
 * @returns {Date}
 */
function liveSeasonStartFor(finalsDate, overrides = {}) {
  return new Date(finalsDate.getTime() - (48 + springTrainingDaysFor(finalsDate, overrides)) * MILLIS_IN_DAY);
}

// Off-seasons in the order the backward layout builds them: Finale sits closest
// to the live season, Overture furthest back (right after the previous finals).
const OFF_SEASON_TYPES_BACKWARD = ["Finale", "Crescendo", "Scherzo", "Adagio", "Allegro", "Overture"];

/**
 * The off-season window `now` falls in.
 *
 * The six 49-day off-seasons are laid out BACKWARD from the next live season's
 * start, which itself sits exactly six off-seasons after the previous finals
 * (spring training absorbs the yearly 364/371-day slack). The upshot: the first
 * off-season (Overture) begins the day AFTER finals — no dead gap — and the last
 * (Finale) ends the day the live season begins.
 *
 * Returns null once `now` is in the live-season run-up (past the sixth
 * off-season); the scheduler reads that as "start the live season next" via
 * isLiveSeasonTime.
 *
 * @param {Date} [now]
 * @param {Object} [overrides] - Finals-date overrides (see resolveFinalsDateUTC).
 * @returns {{startDate: Date, endDate: Date, seasonType: string, finalsYear: number}|null}
 */
function getNextOffSeasonWindow(now = new Date(), overrides = {}) {
  const nextFinalsDate = upcomingFinalsUTC(now, overrides);
  const liveSeasonStartDate = liveSeasonStartFor(nextFinalsDate, overrides);
  const seasonWindows = [];

  for (let i = 0; i < OFF_SEASON_COUNT; i++) {
    // endDate is the first moment of the day AFTER day 49, so day 49 is fully
    // included and the 3 AM scheduler triggers the next morning, not on day 49.
    const seasonEndDate = new Date(liveSeasonStartDate.getTime() - i * OFF_SEASON_LENGTH_DAYS * MILLIS_IN_DAY);
    const seasonStartDate = new Date(seasonEndDate.getTime() - OFF_SEASON_LENGTH_DAYS * MILLIS_IN_DAY);
    seasonWindows.push({
      startDate: seasonStartDate,
      endDate: seasonEndDate,
      seasonType: OFF_SEASON_TYPES_BACKWARD[i],
    });
  }

  seasonWindows.reverse();
  const currentWindow = seasonWindows.find((window) => now.getTime() < window.endDate.getTime());
  if (!currentWindow) return null;

  return { ...currentWindow, finalsYear: nextFinalsDate.getUTCFullYear() };
}

/**
 * The upcoming (or in-progress) live season window, anchored on the next DCI
 * finals. Spring training is variable so the six off-seasons pack in right after
 * the previous finals and competition day 49 lands on the real finals date.
 *
 * @param {Date} [now]
 * @param {Object} [overrides] - Finals-date overrides (see resolveFinalsDateUTC).
 * @returns {{startDate: Date, finalsDate: Date, springTrainingDays: number, seasonEndDate: Date, finalsYear: number}}
 */
function getLiveSeasonWindow(now = new Date(), overrides = {}) {
  const finalsDate = upcomingFinalsUTC(now, overrides);
  const startDate = liveSeasonStartFor(finalsDate, overrides);
  const springTrainingDays = springTrainingDaysFor(finalsDate, overrides);
  // endDate is the first moment of the day AFTER finals so finals day is fully
  // included (mirrors the off-season convention).
  const seasonEndDate = new Date(finalsDate.getTime() + MILLIS_IN_DAY);
  return { startDate, finalsDate, springTrainingDays, seasonEndDate, finalsYear: finalsDate.getUTCFullYear() };
}

/**
 * True when `now` is in the live-season run-up (spring training onward) and
 * before that season's finals — i.e. past the sixth off-season. The scheduler
 * uses this to route a rollover to the live season vs an off-season. It is the
 * exact complement of getNextOffSeasonWindow returning a window: off-season time
 * spans [previous finals + 1, live start), live time spans [live start, finals].
 *
 * @param {Date} [now]
 * @param {Object} [overrides] - Finals-date overrides (see resolveFinalsDateUTC).
 * @returns {boolean}
 */
function isLiveSeasonTime(now = new Date(), overrides = {}) {
  const { startDate, seasonEndDate } = getLiveSeasonWindow(now, overrides);
  return now.getTime() >= startDate.getTime() && now.getTime() < seasonEndDate.getTime();
}

/**
 * Read the manual finals-date overrides from game-settings/config. Returns a
 * plain { [year]: "YYYY-MM-DD" } map, or {} when none are set or the read fails
 * (the season calendar then uses the computed 2nd-Saturday dates). Set/cleared
 * via the admin "setFinalsDateOverride" trigger.
 *
 * @param {FirebaseFirestore.Firestore} db
 * @returns {Promise<Object<string, string>>}
 */
async function getFinalsDateOverrides(db) {
  try {
    const doc = await db.doc("game-settings/config").get();
    const raw = doc.exists ? doc.data().finalsDateOverrides : null;
    return raw && typeof raw === "object" ? raw : {};
  } catch (error) {
    logger.warn(`Could not read finals-date overrides; using computed dates: ${error.message}`);
    return {};
  }
}

module.exports = {
  generateLiveSeasonSchedule,
  generateOffSeasonSchedule,
  calculateOffSeasonDay,
  competitionDayToDateUTC,
  computeFinalsDateUTC,
  getThematicOffSeasonName,
  getNextOffSeasonWindow,
  getLiveSeasonWindow,
  isLiveSeasonTime,
  resolveFinalsDateUTC,
  getFinalsDateOverrides,
};
