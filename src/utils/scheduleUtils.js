/**
 * Schedule Utilities
 *
 * Shared transformation functions for schedule/competition data.
 * Used by scheduleStore and any component that needs schedule data.
 */

/**
 * Transform a competition object from Firestore to a show object for UI
 * @param {Object} competition - Raw competition from Firestore
 * @returns {Object} Transformed show object
 */
export function transformCompetitionToShow(competition) {
  return {
    eventName: competition.name,
    location: competition.location || '',
    date: competition.date,
    day: competition.day,
    week: competition.week || Math.ceil(competition.day / 7),
    type: competition.type,
    isChampionship: competition.type === 'championship',
    allowedClasses: competition.allowedClasses || [],
    mandatory: competition.mandatory || false,
  };
}

/**
 * Filter and transform competitions for a specific week
 * @param {Array} competitions - Raw competitions array from Firestore
 * @param {number} weekNumber - Week to filter (1-7)
 * @param {Object} options - Filter options
 * @param {boolean} options.skipChampionship - Skip championship shows
 * @returns {Array} Filtered and transformed shows
 */
export function getShowsForWeek(competitions, weekNumber, options = {}) {
  const { skipChampionship = false } = options;

  return competitions
    .filter(comp => {
      const week = comp.week || Math.ceil(comp.day / 7);
      if (week !== weekNumber) return false;
      if (skipChampionship && comp.type === 'championship') return false;
      return true;
    })
    .map(transformCompetitionToShow)
    .sort((a, b) => a.day - b.day);
}

/**
 * Group competitions by week
 * @param {Array} competitions - Raw competitions array
 * @returns {Object} Object with week numbers as keys, arrays of shows as values
 */
export function groupShowsByWeek(competitions) {
  const grouped = {};

  competitions.forEach(comp => {
    const week = comp.week || Math.ceil(comp.day / 7);
    if (!grouped[week]) grouped[week] = [];
    grouped[week].push(transformCompetitionToShow(comp));
  });

  // Sort shows within each week by day
  Object.keys(grouped).forEach(week => {
    grouped[week].sort((a, b) => a.day - b.day);
  });

  return grouped;
}

/**
 * Group competitions by day (for Schedule page day-based view)
 * @param {Array} competitions - Raw competitions array
 * @returns {Array} Array of day objects with shows
 */
export function groupShowsByDay(competitions) {
  const dayMap = {};

  competitions.forEach(comp => {
    const day = comp.day || 0;
    if (!dayMap[day]) {
      dayMap[day] = {
        offSeasonDay: day,
        week: comp.week || Math.ceil(day / 7),
        shows: []
      };
    }
    dayMap[day].shows.push(transformCompetitionToShow(comp));
  });

  return Object.values(dayMap).sort((a, b) => a.offSeasonDay - b.offSeasonDay);
}

/**
 * Get shows for a specific day
 * @param {Array} competitions - Raw competitions array
 * @param {number} dayNumber - Day number (1-49)
 * @returns {Array} Shows for that day
 */
export function getShowsForDay(competitions, dayNumber) {
  return competitions
    .filter(comp => comp.day === dayNumber)
    .map(transformCompetitionToShow);
}

/**
 * Count shows per week (for week pills display)
 * @param {Array} competitions - Raw competitions array
 * @returns {Object} Object with week numbers as keys, counts as values
 */
export function getShowCountsByWeek(competitions) {
  const counts = {};

  competitions.forEach(comp => {
    const week = comp.week || Math.ceil(comp.day / 7);
    counts[week] = (counts[week] || 0) + 1;
  });

  return counts;
}

/**
 * Check if an event date is considered "past" for display purposes.
 * Events are considered past only after 2 AM the following day,
 * which is when scores are processed.
 * @param {Date|null} eventDate - The date of the event
 * @returns {boolean} True if the event is past
 */
export function isEventPast(eventDate) {
  if (!eventDate) return false;
  const nextDay2AM = new Date(eventDate);
  nextDay2AM.setDate(nextDay2AM.getDate() + 1);
  nextDay2AM.setHours(2, 0, 0, 0);
  return new Date() >= nextDay2AM;
}
