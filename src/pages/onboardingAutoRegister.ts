// First-week show registration for a brand-new director: pick the current
// week's non-championship shows off the schedule store and register the new
// corps for the first few, so the season starts scoring on night one.

import { selectUserShows } from '../api/functions';
import type { ScheduleShow } from '../store/scheduleStore';
import { competitionDayToDate } from '../utils/competitionCalendar';
import { isEventPast } from '../utils/scheduleUtils';

/** How many of the week's shows a new corps is signed up for automatically. */
export const AUTO_REGISTER_SHOW_LIMIT = 4;

export async function autoRegisterForShows({
  season,
  corpsClass,
  currentWeek,
  getWeekShows,
}: {
  season:
    | {
        schedule?: { startDate?: unknown; springTrainingDays?: number } | null;
        seasonUid?: string;
        status?: string;
      }
    | null
    | undefined;
  corpsClass: string;
  currentWeek: number;
  getWeekShows: (week: number, options?: { skipChampionship?: boolean }) => ScheduleShow[];
}): Promise<void> {
  if (!season?.schedule || !season?.seasonUid) return;

  try {
    // Skip nights whose scores have already run — the server rejects joining
    // a scored show, which would fail the whole registration.
    const weekShows = getWeekShows(currentWeek, { skipChampionship: true }).filter(
      (show) => !isEventPast(competitionDayToDate(season.schedule, show.day), season)
    );
    if (weekShows.length === 0) {
      console.log('[Onboarding] No shows found for week', currentWeek);
      return;
    }

    // Map to the format expected by the backend.
    const shows = weekShows.slice(0, AUTO_REGISTER_SHOW_LIMIT).map((show) => ({
      eventName: show.eventName,
      date: show.date,
      location: show.location,
      day: show.day,
    }));

    await selectUserShows({ week: currentWeek, shows, corpsClass });
  } catch (error) {
    console.error('Error auto-registering for shows:', error);
    throw error;
  }
}
