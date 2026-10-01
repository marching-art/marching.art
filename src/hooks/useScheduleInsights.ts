// Schedule-page tour insights, each a one-shot callable read:
//   - usePodiumShowTravel: per-show mileage / travel stamina / heat for the
//     Podium corps, routed from where it will be standing the night before
//     (getPodiumShowTravel — the same math the route sheet uses);
//   - useRivalAttendance: which upcoming shows the director's rivals are on
//     (getRivalShowAttendance).
// Both are decorative: a failed read leaves the cards exactly as they were.

import { useEffect, useState } from 'react';
import { getPodiumShowTravel, type PodiumShowTravelLeg } from '../api/podium';
import { getRivalShowAttendance, type RivalAttendee } from '../api/functions';

/**
 * @param enabled - a Podium corps exists this season
 * @param reloadKey - changes whenever the corps' picks change (each pick moves
 *   the stops every later show is routed from), triggering a refetch
 * @returns legs keyed `${day}|${eventName}`, or null until loaded / when off
 */
export function usePodiumShowTravel(
  enabled: boolean,
  reloadKey: string
): Record<string, PodiumShowTravelLeg> | null {
  const [legs, setLegs] = useState<Record<string, PodiumShowTravelLeg> | null>(null);

  useEffect(() => {
    if (!enabled) {
      setLegs(null);
      return undefined;
    }
    let cancelled = false;
    getPodiumShowTravel()
      .then((res) => {
        if (!cancelled) setLegs(res.data?.exists ? res.data.legs || {} : null);
      })
      .catch(() => {
        if (!cancelled) setLegs(null);
      });
    return () => {
      cancelled = true;
    };
  }, [enabled, reloadKey]);

  return legs;
}

/**
 * @param enabled - signed in with at least one rival on the profile
 * @returns rival rows keyed `${week}|${eventName}`, or null until loaded / when off
 */
export function useRivalAttendance(enabled: boolean): Record<string, RivalAttendee[]> | null {
  const [shows, setShows] = useState<Record<string, RivalAttendee[]> | null>(null);

  useEffect(() => {
    if (!enabled) {
      setShows(null);
      return undefined;
    }
    let cancelled = false;
    getRivalShowAttendance()
      .then((res) => {
        if (!cancelled) setShows(res.data?.shows || {});
      })
      .catch(() => {
        if (!cancelled) setShows(null);
      });
    return () => {
      cancelled = true;
    };
  }, [enabled]);

  return shows;
}

/** The key both maps above share with a schedule show card. */
export const travelKey = (show: { day: number; eventName: string }) =>
  `${show.day}|${show.eventName}`;
export const rivalKey = (show: { week?: number | null; day: number; eventName: string }) =>
  `${show.week ?? Math.ceil(show.day / 7)}|${show.eventName}`;
