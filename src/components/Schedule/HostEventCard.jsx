// HostEventCard — director-hosted events (Phase 6.2 client, design §5.10).
// ALL-class feature: any director with a fielded corps can rent a venue and
// put a show on the season schedule through open enrollment. CorpsCoin
// economy only — hosting confers zero competitive advantage. Flag-gated with
// the Podium rollout (game-settings/features.podiumClass) and self-hiding, so
// the Schedule page renders it unconditionally.

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { collection, getDocs, orderBy, query } from 'firebase/firestore';
import { Landmark, Loader2, MapPin, Check } from 'lucide-react';
import { db } from '../../api';
import { hostEvent } from '../../api/podium';
import { usePodiumEnabled } from '../../hooks/useFeatures';
import { useProfileStore } from '../../store/profileStore';
import { useSeasonStore } from '../../store/seasonStore';
import { useScheduleStore } from '../../store/scheduleStore';
import { HOSTABLE_VENUES, scheduledVenueIds } from '../../utils/venues';
import { VENUE_TIERS, HOSTING_RULES } from '../Podium/podiumConstants';

// Cap the rendered dropdown so a bare focus (empty query) doesn't paint all
// ~390 cities. A real search narrows well below this.
const VENUE_RESULTS_LIMIT = 40;

export default function HostEventCard({ seasonUid }) {
  const enabled = usePodiumEnabled();
  const profile = useProfileStore((state) => state.profile);
  const currentUid = useProfileStore((state) => state._currentUid);
  const currentDay = useSeasonStore((state) => state.currentDay);
  const competitions = useScheduleStore((state) => state.competitions);

  const [events, setEvents] = useState(null);
  const [eventName, setEventName] = useState('');
  // The location picker keeps the confirmed venue separate from the search box
  // text, so submit only ever sends a KNOWN, un-taken city.
  const [selectedVenue, setSelectedVenue] = useState(null);
  const [venueQuery, setVenueQuery] = useState('');
  const [venueListOpen, setVenueListOpen] = useState(false);
  const [day, setDay] = useState('');
  const [venueTier, setVenueTier] = useState('highSchool');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  // Cities already on the season schedule (scraped shows + other hosted events)
  // can't be booked again — resolve each competition's location to a venueId.
  const takenVenueIds = useMemo(() => scheduledVenueIds(competitions), [competitions]);

  // Filter the hostable cities by the search box, taken cities last so the
  // available ones surface first, then cap for render.
  const venueResults = useMemo(() => {
    const q = venueQuery.trim().toLowerCase();
    const matches = q
      ? HOSTABLE_VENUES.filter((v) => v.label.toLowerCase().includes(q))
      : HOSTABLE_VENUES;
    const available = [];
    const taken = [];
    for (const v of matches) {
      (takenVenueIds.has(v.venueId) ? taken : available).push(v);
      if (available.length >= VENUE_RESULTS_LIMIT) break;
    }
    return [...available, ...taken].slice(0, VENUE_RESULTS_LIMIT);
  }, [venueQuery, takenVenueIds]);

  const loadEvents = useCallback(async () => {
    if (!seasonUid) return;
    try {
      const snapshot = await getDocs(
        query(collection(db, 'hosted-events', seasonUid, 'events'), orderBy('day'))
      );
      setEvents(snapshot.docs.map((d) => ({ id: d.id, ...d.data() })));
    } catch {
      setEvents([]); // list is decorative — the form still works
    }
  }, [seasonUid]);

  useEffect(() => {
    if (events === null) loadEvents();
  }, [events, loadEvents]);

  if (!enabled || !seasonUid) return null;

  const corpsCoin = profile?.corpsCoin || 0;
  const hasCorps = Object.values(profile?.corps || {}).filter(Boolean).length > 0;
  // One show per director per season (server-enforced in the hostEvent
  // callable; mirrored here so the form self-disables once you've hosted).
  const myEventsThisSeason = (events || []).filter((e) => e.hostUid === currentUid).length;
  const seasonLimitReached = myEventsThisSeason >= HOSTING_RULES.maxEventsPerSeasonPerHost;
  const hostingByTier = profile?.hosting?.byTier || {};
  // Venue ladder: bigger stadiums are earned by running successful smaller
  // shows (server-enforced; this mirrors the gate for display).
  const tierLocked = (t) => {
    if (!t.unlock) return false;
    return (hostingByTier[t.unlock.tier]?.successful || 0) < t.unlock.successful;
  };
  const tier = VENUE_TIERS.find((t) => t.id === venueTier) || VENUE_TIERS[0];
  const minDay = Math.max(1, (currentDay || 1) + HOSTING_RULES.minDaysAhead);

  const pickVenue = (venue) => {
    setSelectedVenue(venue);
    setVenueQuery(venue.label);
    setVenueListOpen(false);
  };

  const submit = async (e) => {
    e.preventDefault();
    if (!selectedVenue) {
      setError('Pick a host city from the list.');
      return;
    }
    setBusy(true);
    setError(null);
    setSuccess(null);
    try {
      const result = await hostEvent({
        eventName: eventName.trim(),
        venueTier,
        day: Number(day),
        location: selectedVenue.label,
      });
      setSuccess(`${result.data.eventName} is on the schedule for Day ${result.data.day}.`);
      setEventName('');
      setSelectedVenue(null);
      setVenueQuery('');
      setDay('');
      setEvents(null); // refetch with the new event
      await loadEvents();
    } catch (err) {
      setError(err?.message || 'Hosting failed.');
    } finally {
      setBusy(false);
    }
  };

  const inputClass =
    'w-full bg-surface-sunken border border-line rounded-none px-2 py-1.5 text-xs text-white ' +
    'placeholder-muted focus:border-interactive focus:outline-none';

  return (
    <div className="mx-3 my-4 bg-surface-card border border-line rounded-none p-4 space-y-3">
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-[#c9a227]">
          <Landmark className="w-3 h-3" /> Host Your Own Show
        </span>
      </div>

      <p className="text-[10px] text-muted leading-relaxed">
        Rent a venue with CorpsCoin and your event joins the season schedule — open enrollment for
        every class. You earn CC per corps that performs, paid the night the show is scored, so a
        well-drawn show profits. Run successful shows to unlock bigger stadiums: 2 successful High
        School events open the College Bowl, 3 successful College Bowls open the NFL Stadium. Days{' '}
        {minDay}&ndash;{HOSTING_RULES.lastHostableDay}; the majors' days (
        {HOSTING_RULES.majorDays.join(', ')}) are exclusive. One show per director per season. Pick
        a host city from the tour map &mdash; cities already on the schedule are greyed out, since
        each city hosts one show per season.
      </p>

      {!hasCorps && (
        <div className="text-[10px] text-amber-400">Field a corps before hosting events.</div>
      )}

      {hasCorps && seasonLimitReached && (
        <div className="text-[10px] text-amber-400">
          You&apos;ve already hosted a show this season — directors can host one show per season.
        </div>
      )}

      {/* Venue tier picker */}
      <div className="grid grid-cols-3 gap-1.5">
        {VENUE_TIERS.map((t) => {
          const locked = tierLocked(t);
          const progress = t.unlock
            ? `${hostingByTier[t.unlock.tier]?.successful || 0}/${t.unlock.successful}`
            : null;
          return (
            <button
              key={t.id}
              type="button"
              disabled={locked}
              onClick={() => setVenueTier(t.id)}
              title={
                locked
                  ? `Unlocks after ${t.unlock.successful} successful ${
                      VENUE_TIERS.find((x) => x.id === t.unlock.tier)?.label
                    } events (${progress})`
                  : `Success = ${t.successAttendance}+ corps attending`
              }
              className={`text-left px-2 py-1.5 rounded-none border press-feedback ${
                locked
                  ? 'border-line-muted opacity-50 cursor-not-allowed'
                  : venueTier === t.id
                    ? 'border-[#c9a227] bg-[#c9a227]/10'
                    : 'border-line hover:border-line-strong'
              }`}
            >
              <div className="text-[10px] font-bold text-white leading-tight">
                {locked && '🔒 '}
                {t.label}
              </div>
              <div className="text-[9px] text-muted tabular-nums">
                {locked
                  ? `${progress} successful ${VENUE_TIERS.find((x) => x.id === t.unlock.tier)?.label.split(' ')[0]} shows`
                  : `${t.rentalCC} CC · cap ${t.capacity} · ${t.payoutPerCorpsCC}/corps`}
              </div>
            </button>
          );
        })}
      </div>

      <form onSubmit={submit} className="space-y-2">
        <input
          type="text"
          value={eventName}
          onChange={(e) => setEventName(e.target.value)}
          placeholder="Event name (e.g. Riverside Invitational)"
          minLength={HOSTING_RULES.nameMin}
          maxLength={HOSTING_RULES.nameMax}
          required
          className={inputClass}
        />
        <div className="grid grid-cols-2 gap-2">
          {/* Host-city picker: only known cities that aren't already on the
                  schedule. No free-text guessing, no double-booking a city. */}
          <div className="relative">
            <div className="relative">
              <MapPin className="w-3 h-3 text-muted absolute left-2 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={venueQuery}
                onChange={(e) => {
                  setVenueQuery(e.target.value);
                  setSelectedVenue(null);
                  setVenueListOpen(true);
                }}
                onFocus={() => setVenueListOpen(true)}
                // Delay so a click on a result registers before the list closes.
                onBlur={() => setTimeout(() => setVenueListOpen(false), 150)}
                placeholder="Search host city"
                autoComplete="off"
                className={`${inputClass} pl-6 pr-6`}
                aria-label="Host city"
              />
              {selectedVenue && (
                <Check className="w-3 h-3 text-green-400 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />
              )}
            </div>
            {venueListOpen && (
              <div className="absolute z-20 mt-1 w-full max-h-44 overflow-y-auto bg-surface-sunken border border-line rounded-none shadow-lg">
                {venueResults.length === 0 ? (
                  <div className="px-2 py-1.5 text-[10px] text-muted">
                    No matching city — try a nearby one.
                  </div>
                ) : (
                  venueResults.map((v) => {
                    const taken = takenVenueIds.has(v.venueId);
                    return (
                      <button
                        key={v.venueId}
                        type="button"
                        disabled={taken}
                        // onMouseDown fires before the input's onBlur, so the
                        // pick lands even though blur closes the list.
                        onMouseDown={(e) => {
                          e.preventDefault();
                          if (!taken) pickVenue(v);
                        }}
                        className={`w-full flex items-center justify-between px-2 py-1.5 text-[10px] text-left ${
                          taken
                            ? 'text-muted cursor-not-allowed'
                            : 'text-secondary hover:bg-surface-sunken'
                        }`}
                      >
                        <span className="truncate">{v.label}</span>
                        {taken && (
                          <span className="text-[8px] uppercase tracking-wider text-muted flex-shrink-0 pl-2">
                            On schedule
                          </span>
                        )}
                      </button>
                    );
                  })
                )}
              </div>
            )}
          </div>
          <input
            type="number"
            value={day}
            onChange={(e) => setDay(e.target.value)}
            placeholder={`Day (${minDay}-${HOSTING_RULES.lastHostableDay})`}
            min={minDay}
            max={HOSTING_RULES.lastHostableDay}
            required
            className={inputClass}
          />
        </div>
        <div className="flex items-center justify-between">
          <span className="text-[10px] text-muted tabular-nums">
            Rental: <span className="text-white font-bold">{tier.rentalCC} CC</span>
            <span className="text-muted"> · you have {corpsCoin.toLocaleString()} CC</span>
          </span>
          <button
            type="submit"
            disabled={
              busy || !hasCorps || seasonLimitReached || !selectedVenue || corpsCoin < tier.rentalCC
            }
            className="px-3 py-1.5 rounded-none text-[10px] font-bold uppercase tracking-wider
                  bg-[#c9a227] text-black disabled:bg-line disabled:text-muted press-feedback"
          >
            {busy ? <Loader2 className="w-3 h-3 animate-spin inline" /> : 'Book Venue'}
          </button>
        </div>
      </form>

      {error && <div className="text-[11px] text-red-400">{error}</div>}
      {success && <div className="text-[11px] text-green-400">{success}</div>}

      {/* This season's hosted events */}
      {events && events.length > 0 && (
        <div className="pt-2 border-t border-line-subtle space-y-1">
          <div className="text-[9px] font-bold uppercase tracking-wider text-muted">
            Hosted This Season
          </div>
          {events.map((event) => (
            <div key={event.id} className="flex items-center justify-between text-[10px]">
              <span className="text-secondary truncate pr-2">
                <span className="text-muted tabular-nums">D{event.day}</span> {event.eventName}
                <span className="text-muted"> · {event.location}</span>
              </span>
              <span className="text-muted tabular-nums flex-shrink-0">
                {event.paidOut ? `${event.attendance} corps · +${event.payout} CC` : 'upcoming'}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
