// =============================================================================
// NIGHTLY REVEAL HOOK — "scores are up" eligibility + payload
// =============================================================================
// Decides whether tonight's reveal ceremony should run and assembles what it
// shows: the signed-in director's results from the most recent processed
// night (fantasy_recaps), their season standing, and the night's resolved
// predictions. Shown once per game day (localStorage marker), lowest modal
// priority — celebrations and setup always come first.
//
// Works in both season types: after the 9 PM ET off-season score drop this
// IS the prime-time reveal; in live season it greets the first visit after
// the overnight 2 AM run. Reads the same react-query recap cache as the
// Scores page and ticker, so eligibility costs no extra reads.

import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getSeasonRecaps } from '../api/season';
import { queryKeys } from '../lib/queryClient';
import { getEffectiveDay } from '../utils/dashboardScoring';
import { getGameDay } from '../utils/dailyChallenges';

const DAY_MS = 24 * 60 * 60 * 1000;

/** localStorage marker so each night's ceremony runs exactly once. */
export function revealSeenKey(seasonUid, day) {
  return `ma_nightlyReveal_${seasonUid}_${day}`;
}

/**
 * The prediction bucket the just-posted scores resolved: the COMPLETED game
 * day, i.e. one day before the active bucket key.
 */
function completedBucketKey(seasonStatus) {
  const active = new Date(getGameDay(new Date(), seasonStatus));
  return new Date(active.getTime() - DAY_MS).toDateString();
}

/**
 * @returns {null | {
 *   day: number,
 *   seasonUid: string,
 *   results: Array<{corpsClass, corpsName, eventName, totalScore, geScore,
 *     visualScore, musicScore, placement, fieldSize, seasonRank, seasonRankOf}>,
 *   predictions: {correct: number, total: number} | null,
 *   markSeen: () => void,
 * }}
 */
export function useNightlyReveal(user, seasonData, currentDay, profile) {
  const seasonUid = seasonData?.seasonUid;
  const uid = user?.uid;
  const enabled = !!uid && !!seasonUid && !!currentDay;

  const { data: recaps } = useQuery({
    queryKey: queryKeys.fantasyRecaps(seasonUid),
    queryFn: () => getSeasonRecaps(seasonUid),
    enabled,
    staleTime: 5 * 60 * 1000,
  });

  return useMemo(() => {
    if (!enabled || !recaps || recaps.length === 0) return null;

    const day = getEffectiveDay(currentDay, undefined, seasonData?.status);
    if (!day || day < 1) return null;

    // Once per night, ever. localStorage failures (private mode) fail closed
    // rather than replaying the ceremony forever.
    let seen = false;
    try {
      seen = !!localStorage.getItem(revealSeenKey(seasonUid, day));
    } catch {
      seen = true;
    }
    if (seen) return null;

    const recap = recaps.find((r) => r.offSeasonDay === day);
    if (!recap) return null;

    // The director's own rows from every show they performed in that night.
    // Recap rows carry no placement field — like the Scores page, placement
    // is derived by ranking the show's same-class field by total score.
    const results = [];
    for (const show of recap.shows || []) {
      const rows = show.results || [];
      for (const r of rows) {
        if (r.uid !== uid) continue;
        const corps = profile?.corps?.[r.corpsClass] || {};
        const classField = rows
          .filter((x) => x.corpsClass === r.corpsClass && typeof x.totalScore === 'number')
          .sort((a, b) => b.totalScore - a.totalScore);
        const rankIndex = classField.findIndex((x) => x.uid === r.uid);
        results.push({
          corpsClass: r.corpsClass,
          corpsName: r.corpsName,
          eventName: show.eventName || show.name || 'Show',
          totalScore: r.totalScore,
          geScore: r.geScore,
          visualScore: r.visualScore,
          musicScore: r.musicScore,
          placement: rankIndex >= 0 ? rankIndex + 1 : null,
          fieldSize: classField.length,
          seasonRank: corps.seasonRank ?? null,
          seasonRankOf: corps.seasonRankOf ?? null,
        });
      }
    }
    if (results.length === 0) return null;

    // Predictions the run just resolved (display only; XP/CC was paid by
    // resolvePredictions and shows in its own toasts).
    let predictions = null;
    const bucket = profile?.predictions?.[completedBucketKey(seasonData?.status)];
    if (bucket?.resolved && bucket.results && Object.keys(bucket.results).length > 0) {
      // Outcome rows are {isCorrect: boolean} (see helpers/dailyPredictions).
      const outcomes = Object.values(bucket.results);
      predictions = {
        correct: outcomes.filter((o) => o === true || o?.isCorrect === true).length,
        total: outcomes.length,
      };
    }

    return {
      day,
      seasonUid,
      results,
      predictions,
      markSeen: () => {
        try {
          localStorage.setItem(revealSeenKey(seasonUid, day), new Date().toISOString());
        } catch {
          // best-effort
        }
      },
    };
  }, [enabled, recaps, uid, seasonUid, currentDay, seasonData?.status, profile]);
}

export default useNightlyReveal;
