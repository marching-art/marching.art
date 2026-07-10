// Season schedule generation: the live-season schedule built from scraped
// DCI events and the off-season schedule built from the historical archive,
// plus off-season date math. Extracted verbatim from season.js.

const { logger } = require("firebase-functions/v2");
const { getDb } = require("../config");
const { enrichEventsWithDetails } = require("./eventDetails");
const {
  applyEnrichment,
  SPRING_TRAINING_DAYS,
  scrapeUpcomingDciEvents,
  shuffleArray,
  brandEventName,
} = require("./seasonSchedule");

async function generateLiveSeasonSchedule(seasonLength, startDay, finalsYear, startDate, _finalsDate) {
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
      const dayNumber = calendarDay - SPRING_TRAINING_DAYS;

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
              location: event.location,
              date: event.date,
              isChampionship: false,
            };
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
  const scoresSnapshot = await db.collection("historical_scores").get();

  const showsByDay = new Map();
  scoresSnapshot.forEach((yearDoc) => {
    const yearData = yearDoc.data().data || [];
    yearData.forEach((event) => {
      // "DCI Competition - {location}" is the placeholder name given to
      // events the From The Pressbox import (2000-2012) had no title for.
      // Their scores still feed regression/stats, but they make poor
      // schedule entries, so keep them out of the generated season.
      // Historical majors (Southwestern/Southeastern/DCI East/Eastern
      // Classic) are excluded too: their days are hard-coded below as
      // branded marching.art majors, and letting the source events into
      // the random pool would double them up on neighboring days.
      if (event.eventName && event.offSeasonDay &&
          !event.eventName.toLowerCase().includes("open class") &&
          !event.eventName.startsWith("DCI Competition - ") &&
          !/southwestern|southeastern|eastern classic|dci east\b/i.test(event.eventName)) {
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

  placeMajor([28], "marching.art Southwestern Championship", "Dallas, Texas");
  placeMajor([35], "marching.art Southeastern Championship", "Atlanta, Georgia");
  placeMajor([41, 42], "marching.art Eastern Classic", "Allentown, Pennsylvania");

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
    // endDate is the first moment of the day AFTER day 49, so day 49 is fully included
    // This prevents the scheduler (which runs at 3 AM) from triggering on day 49
    const seasonEndDate = new Date(liveSeasonStartDate.getTime() - (i * 49 * millisInDay));
    const seasonStartDate = new Date(seasonEndDate.getTime() - 49 * millisInDay);
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

module.exports = {
  generateLiveSeasonSchedule,
  generateOffSeasonSchedule,
  calculateOffSeasonDay,
  getThematicOffSeasonName,
  getNextOffSeasonWindow,
};
