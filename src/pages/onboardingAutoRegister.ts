// First-week show registration for a brand-new director: pick the current
// week's non-championship shows off the schedule store and register the new
// corps for the first few, so the season starts scoring on night one.

import { selectUserShows } from '../api/functions';
import type { Competition } from '../store/scheduleStore';

/** How many of the week's shows a new corps is signed up for automatically. */
export const AUTO_REGISTER_SHOW_LIMIT = 4;

export async function autoRegisterForShows({
  season,
  corpsClass,
  currentWeek,
  getWeekShows,
}: {
  season: { schedule?: unknown; seasonUid?: string } | null | undefined;
  corpsClass: string;
  currentWeek: number;
  getWeekShows: (week: number, options?: { skipChampionship?: boolean }) => Competition[];
}): Promise<void> {
  if (!season?.schedule || !season?.seasonUid) return;

  try {
    const weekShows = getWeekShows(currentWeek, { skipChampionship: true });
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
