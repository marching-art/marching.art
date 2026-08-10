// @ts-nocheck -- grandfathered before checkJs; remove when this file is typed or cleaned up
// Shared reader for a season's director-hosted events
// (hosted-events/{seasonUid}/events — public read; see helpers/podium/hostedEvents.js).
//
// Two places on the Schedule page need this same list: the "Host Your Own Show"
// card (to show what's already booked and disable the form once you've hosted)
// and the schedule's show cards (to badge hosted shows and show their capacity,
// host, and attendees). Reading it once here avoids two fetches of the same
// bounded, public collection.

import { useCallback, useEffect, useMemo, useState } from 'react';
import { collection, getDocs, orderBy, query } from 'firebase/firestore';
import { db } from '../api';
import { getShowRegistrations } from '../api/functions';

/**
 * @param {string|null|undefined} seasonUid
 * @returns {{ events: Array<object>|null, reload: () => Promise<void> }}
 *   `events` is null until the first load resolves, then an array (empty on
 *   error — the list is decorative, so consumers still function without it).
 */
export function useHostedEvents(seasonUid) {
  const [events, setEvents] = useState(null);

  const load = useCallback(async () => {
    if (!seasonUid) {
      setEvents([]);
      return;
    }
    try {
      const snapshot = await getDocs(
        query(collection(db, 'hosted-events', seasonUid, 'events'), orderBy('day'))
      );
      setEvents(snapshot.docs.map((d) => ({ id: d.id, ...d.data() })));
    } catch {
      setEvents([]); // decorative — the schedule and hosting form still work
    }
  }, [seasonUid]);

  useEffect(() => {
    setEvents(null); // reset to the loading sentinel when the season changes
    load();
  }, [load]);

  return { events, reload: load };
}

/**
 * Live attendance for a director-hosted show: the registered corps plus how many
 * of the venue's performance slots are filled/left. A "slot" is one DISTINCT
 * DIRECTOR — the unit the venue capacity and the hosting payout are both measured
 * in (the alt-farm guard, §5.10) — and usernames are unique per director, so
 * distinct usernames stand in for distinct directors.
 *
 * getShowRegistrations is a per-show read, so this only fires when `enabled`
 * (i.e. the show is actually hosted) — system shows never pay for it. Returns
 * everything HostedShowPanel renders, so a consumer can spread it straight in.
 *
 * @param {{enabled: boolean, show: object, hostedEvent?: object|null}} params
 *   `show` is the transformed schedule show; `hostedEvent` is its hosting record
 *   (carries capacity + host name), null until it loads.
 * @returns {{hostName: string|null, capacity: number|null,
 *   attendees: Array<object>|null, loading: boolean, slotsFilled: number,
 *   slotsAvailable: number|null, full: boolean}}
 */
export function useHostedShowRegistrations({ enabled, show, hostedEvent }) {
  const week = show?.week;
  const eventName = show?.eventName;
  const date = show?.date ?? null;
  const day = Number.isInteger(show?.day) ? show.day : null;
  const capacity = hostedEvent?.capacity ?? null;
  const hostName = hostedEvent?.hostName ?? null;
  const [attendees, setAttendees] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!enabled) return undefined;
    let cancelled = false;
    setLoading(true);
    // Pass `day` so the server folds in Podium corps that picked this show
    // (their day-based picks live outside the fantasy registration index).
    getShowRegistrations({ week, eventName, date: date ?? null, day })
      .then((res) => {
        if (!cancelled) setAttendees(res?.data?.registrations || []);
      })
      .catch(() => {
        if (!cancelled) setAttendees([]); // roster is informational — never blocks registering
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [enabled, week, eventName, date, day]);

  // One slot per DISTINCT DIRECTOR — dedupe by uid (a director fielding both a
  // fantasy and a Podium corps at the show spends one slot), falling back to
  // username/corpsName for any legacy entry without a uid.
  const slotsFilled = useMemo(
    () => new Set((attendees || []).map((a) => a.uid || a.username || a.corpsName)).size,
    [attendees]
  );
  const slotsAvailable = capacity != null ? Math.max(0, capacity - slotsFilled) : null;
  const full = capacity != null && slotsFilled >= capacity;

  return { hostName, capacity, attendees, loading, slotsFilled, slotsAvailable, full };
}

export default useHostedEvents;
