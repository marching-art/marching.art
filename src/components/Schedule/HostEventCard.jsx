// HostEventCard — director-hosted events (Phase 6.2 client, design §5.10).
// ALL-class feature: any director with a fielded corps can rent a venue and
// put a show on the season schedule through open enrollment. CorpsCoin
// economy only — hosting confers zero competitive advantage. Flag-gated with
// the Podium rollout (game-settings/features.podiumClass) and self-hiding, so
// the Schedule page renders it unconditionally.

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Landmark, Loader2 } from 'lucide-react';
import { hostEvent } from '../../api/podium';
import { usePodiumEnabled } from '../../hooks/useFeatures';
import { useProfileStore } from '../../store/profileStore';
import { useSeasonStore } from '../../store/seasonStore';
import { useScheduleStore } from '../../store/scheduleStore';
import { resolveVenueId } from '../../utils/venues';
import { loadPlaces, makeTownResolver, placeIdentity } from '../../utils/places';
import TownPicker from '../Podium/TownPicker';
import { formatEventName } from '../../utils/season';
import { VENUE_TIERS, HOSTING_RULES } from '../Podium/podiumConstants';

/** @typedef {import('../Podium/TownPicker').SelectedHome} HostCity */
/** @typedef {import('../../utils/places').HomePlace} HomePlace */
/** @typedef {(typeof VENUE_TIERS)[number]} VenueTier */
/** @typedef {import('../../api/podium').HostedEventRecord} HostedEventRecord */

// `events` and `onReload` come from the parent (Schedule) via the shared
// useHostedEvents hook, so this card and the schedule's hosted-show badges read
// one fetch of hosted-events/{seasonUid}/events rather than two.
/**
 * @param {{
 *   seasonUid: string|null|undefined,
 *   events?: HostedEventRecord[]|null,
 *   onReload?: () => unknown,
 * }} props
 */
export default function HostEventCard({ seasonUid, events = null, onReload }) {
  const enabled = usePodiumEnabled();
  const profile = useProfileStore((state) => state.profile);
  const currentUid = useProfileStore((state) => state._currentUid);
  const currentDay = useSeasonStore((state) => state.currentDay);
  const competitions = useScheduleStore((state) => state.competitions);

  const [eventName, setEventName] = useState('');
  // The town picker keeps the confirmed town separate from the search box
  // text, so submit only ever sends a REAL, un-taken town.
  const [selectedVenue, setSelectedVenue] = useState(/** @type {HostCity|null} */ (null));
  const [venueQuery, setVenueQuery] = useState('');
  const [places, setPlaces] = useState(/** @type {HomePlace[] | null} */ (null));
  const [day, setDay] = useState('');
  const [venueTier, setVenueTier] = useState('highSchool');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(/** @type {string|null} */ (null));
  const [success, setSuccess] = useState(/** @type {string|null} */ (null));

  // Any real US/Canadian town can host. Load the town index (shared with the
  // picker, fetched once) so schedule locations off the tour map resolve too.
  useEffect(() => {
    // Only once the card is live — the Schedule page renders it unconditionally.
    if (!enabled || !seasonUid) return undefined;
    let live = true;
    loadPlaces()
      .then((rows) => live && setPlaces(rows))
      .catch(() => {
        /* the picker shows its own load error */
      });
    return () => {
      live = false;
    };
  }, [enabled, seasonUid]);

  const resolveTown = useMemo(() => (places ? makeTownResolver(places) : null), [places]);

  // Towns already on the season schedule (scraped shows + other hosted events)
  // can't be booked again — a tour-map city by venueId (any historical
  // spelling), any other town by its resolved identity.
  const takenPlaces = useMemo(() => {
    const taken = new Set();
    for (const comp of competitions || []) {
      const venueId = resolveVenueId(comp?.location);
      if (venueId) {
        taken.add(venueId);
        continue;
      }
      const town = resolveTown ? resolveTown(comp?.location) : null;
      if (town) taken.add(placeIdentity(town));
    }
    return taken;
  }, [competitions, resolveTown]);

  const unavailable = useCallback(
    /** @param {HomePlace} place */
    (place) => (takenPlaces.has(placeIdentity(place)) ? 'On schedule' : null),
    [takenPlaces]
  );

  if (!enabled || !seasonUid) return null;

  const corpsCoin = profile?.corpsCoin || 0;
  const hasCorps = Object.values(profile?.corps || {}).filter(Boolean).length > 0;
  // One show per director per season (server-enforced in the hostEvent
  // callable; mirrored here so the form self-disables once you've hosted).
  const myEventsThisSeason = (events || []).filter((e) => e.hostUid === currentUid).length;
  const seasonLimitReached = myEventsThisSeason >= HOSTING_RULES.maxEventsPerSeasonPerHost;
  /** @type {Record<string, {successful?: number}>} */
  const hostingByTier =
    /** @type {{hosting?: {byTier?: Record<string, {successful?: number}>}}|null} */ (profile)
      ?.hosting?.byTier || {};
  // Venue ladder: bigger stadiums are earned by running successful smaller
  // shows (server-enforced; this mirrors the gate for display).
  /** @param {VenueTier} t */
  const tierLocked = (t) => {
    if (!t.unlock) return false;
    return (hostingByTier[t.unlock.tier]?.successful || 0) < t.unlock.successful;
  };
  const tier = VENUE_TIERS.find((t) => t.id === venueTier) || VENUE_TIERS[0];
  const minDay = Math.max(1, (currentDay || 1) + HOSTING_RULES.minDaysAhead);

  /** @param {React.FormEvent<HTMLFormElement>} e */
  const submit = async (e) => {
    e.preventDefault();
    if (!selectedVenue) {
      setError('Pick a host town from the list.');
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
      // The server brands the name it stores (DCI -> marching.art), so echo
      // back what it returned rather than what was typed into the box.
      setSuccess(
        `${formatEventName(result.data.eventName)} is on the schedule for Day ${result.data.day}.`
      );
      setEventName('');
      setSelectedVenue(null);
      setVenueQuery('');
      setDay('');
      if (onReload) await onReload(); // refetch so the new event appears here + on the schedule
    } catch (err) {
      setError(/** @type {{message?: string}} */ (err)?.message || 'Hosting failed.');
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
        <span className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-secondary">
          <Landmark className="w-3 h-3" /> Host Your Own Show
        </span>
      </div>

      <p className="text-[10px] text-muted leading-relaxed">
        Rent a venue with CorpsCoin and your event joins the season schedule — open enrollment for
        every class. You earn CC per corps that performs, paid the night the show is scored, so a
        well-drawn show profits. Run successful shows to unlock bigger stadiums: 2 successful High
        School events open the College Bowl, 3 successful College Bowls open the NFL Stadium. Days{' '}
        {minDay}&ndash;{HOSTING_RULES.lastHostableDay}; the majors' days (
        {HOSTING_RULES.majorDays.join(', ')}) are exclusive. One show per director per season. Host
        in any US or Canadian town &mdash; towns already on the schedule are greyed out, since each
        town hosts one show per season.
      </p>

      {!hasCorps && (
        <div className="text-[10px] text-warning">Field a corps before hosting events.</div>
      )}

      {hasCorps && seasonLimitReached && (
        <div className="text-[10px] text-warning">
          You&apos;ve already hosted a show this season — directors can host one show per season.
        </div>
      )}

      {/* Venue tier picker */}
      <div className="grid grid-cols-3 gap-1.5">
        {VENUE_TIERS.map((t) => {
          const { unlock } = t;
          const locked = tierLocked(t);
          const unlockLabel = unlock
            ? VENUE_TIERS.find((x) => x.id === unlock.tier)?.label
            : undefined;
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
                locked && unlock
                  ? `Unlocks after ${unlock.successful} successful ${unlockLabel} events (${progress})`
                  : `Success = ${t.successAttendance}+ corps attending`
              }
              className={`text-left px-2 py-1.5 rounded-none border press-feedback ${
                locked
                  ? 'border-line-muted opacity-50 cursor-not-allowed'
                  : venueTier === t.id
                    ? 'border-interactive bg-interactive/10'
                    : 'border-line hover:border-line-strong'
              }`}
            >
              <div className="text-[10px] font-bold text-white leading-tight">
                {locked && '🔒 '}
                {t.label}
              </div>
              <div className="text-[9px] text-muted tabular-nums">
                {locked
                  ? `${progress} successful ${unlockLabel?.split(' ')[0]} shows`
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
        {/* Host-town picker: any real town that isn't already on the
            schedule. No free-text guessing, no double-booking a town. */}
        <TownPicker
          label="Host town"
          placeholder="Any US or Canadian town"
          tourBadge={null}
          query={venueQuery}
          onQueryChange={setVenueQuery}
          selected={selectedVenue}
          onSelect={setSelectedVenue}
          unavailable={unavailable}
        />
        <div className="grid grid-cols-2 gap-2">
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
                  bg-interactive text-white disabled:bg-line disabled:text-muted press-feedback"
          >
            {busy ? <Loader2 className="w-3 h-3 animate-spin inline" /> : 'Book Venue'}
          </button>
        </div>
      </form>

      {error && <div className="text-[11px] text-red-400">{error}</div>}
      {success && <div className="text-[11px] text-green-400">{success}</div>}

      {/* Every director's hosted shows this season — this is the "what's
          already booked" board, NOT your résumé (it reads the whole season
          collection). Your own shows are marked; the cross-season history
          with attendee rosters and earnings lives on your profile. */}
      {events && events.length > 0 && (
        <div className="pt-2 border-t border-line-subtle space-y-1">
          <div className="flex items-center justify-between">
            <div className="text-[9px] font-bold uppercase tracking-wider text-muted">
              All Hosted Shows This Season
            </div>
            <Link to="/profile" className="text-[9px] uppercase tracking-wider text-interactive">
              Your history
            </Link>
          </div>
          {events.map((event) => {
            const mine = event.hostUid === currentUid;
            return (
              <div key={event.id} className="flex items-center justify-between text-[10px]">
                <span className={`truncate pr-2 ${mine ? 'text-white' : 'text-secondary'}`}>
                  <span className="text-muted tabular-nums">D{event.day}</span>{' '}
                  {formatEventName(event.eventName)}
                  <span className="text-muted"> · {event.location}</span>
                  {mine && <span className="text-brand"> · yours</span>}
                </span>
                <span className="text-muted tabular-nums flex-shrink-0">
                  {event.paidOut ? `${event.attendance} corps · +${event.payout} CC` : 'upcoming'}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
