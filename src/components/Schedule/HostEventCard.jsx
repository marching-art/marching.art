// HostEventCard — director-hosted events (Phase 6.2 client, design §5.10).
// ALL-class feature: any director with a fielded corps can rent a venue and
// put a show on the season schedule through open enrollment. CorpsCoin
// economy only — hosting confers zero competitive advantage. Flag-gated with
// the Podium rollout (game-settings/features.podiumClass) and self-hiding, so
// the Schedule page renders it unconditionally.

import React, { useCallback, useEffect, useState } from 'react';
import { collection, getDocs, orderBy, query } from 'firebase/firestore';
import { Landmark, Loader2, ChevronDown, ChevronUp } from 'lucide-react';
import { db } from '../../api';
import { hostEvent } from '../../api/podium';
import { usePodiumEnabled } from '../../hooks/useFeatures';
import { useProfileStore } from '../../store/profileStore';
import { useSeasonStore } from '../../store/seasonStore';
import { VENUE_TIERS, HOSTING_RULES } from '../Podium/podiumConstants';

export default function HostEventCard({ seasonUid }) {
  const enabled = usePodiumEnabled();
  const profile = useProfileStore((state) => state.profile);
  const currentDay = useSeasonStore((state) => state.currentDay);

  const [open, setOpen] = useState(false);
  const [events, setEvents] = useState(null);
  const [eventName, setEventName] = useState('');
  const [location, setLocation] = useState('');
  const [day, setDay] = useState('');
  const [venueTier, setVenueTier] = useState('highSchool');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

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
    if (open && events === null) loadEvents();
  }, [open, events, loadEvents]);

  if (!enabled || !seasonUid) return null;

  const corpsCoin = profile?.corpsCoin || 0;
  const hasCorps = Object.values(profile?.corps || {}).filter(Boolean).length > 0;
  const tier = VENUE_TIERS.find((t) => t.id === venueTier) || VENUE_TIERS[0];
  const minDay = Math.max(1, (currentDay || 1) + HOSTING_RULES.minDaysAhead);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setSuccess(null);
    try {
      const result = await hostEvent({
        eventName: eventName.trim(),
        venueTier,
        day: Number(day),
        location: location.trim(),
      });
      setSuccess(`${result.data.eventName} is on the schedule for Day ${result.data.day}.`);
      setEventName('');
      setLocation('');
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
    'w-full bg-[#0f0f0f] border border-[#333] rounded-sm px-2 py-1.5 text-xs text-white ' +
    'placeholder-gray-600 focus:border-[#0057B8] focus:outline-none';

  return (
    <div className="mx-3 my-4 bg-[#1a1a1a] border border-[#333] rounded-sm p-4 space-y-3">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between press-feedback"
      >
        <span className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-[#c9a227]">
          <Landmark className="w-3 h-3" /> Host Your Own Show
        </span>
        {open ? (
          <ChevronUp className="w-3.5 h-3.5 text-gray-500" />
        ) : (
          <ChevronDown className="w-3.5 h-3.5 text-gray-500" />
        )}
      </button>

      {open && (
        <>
          <p className="text-[10px] text-gray-500 leading-relaxed">
            Rent a venue with CorpsCoin and your event joins the season schedule — open enrollment
            for every class. You earn CC per corps that performs, paid the night the show is scored.
            Days {minDay}&ndash;{HOSTING_RULES.lastHostableDay}; the majors' days (
            {HOSTING_RULES.majorDays.join(', ')}) are exclusive.
          </p>

          {!hasCorps && (
            <div className="text-[10px] text-amber-400">Field a corps before hosting events.</div>
          )}

          {/* Venue tier picker */}
          <div className="grid grid-cols-3 gap-1.5">
            {VENUE_TIERS.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setVenueTier(t.id)}
                className={`text-left px-2 py-1.5 rounded-sm border press-feedback ${
                  venueTier === t.id
                    ? 'border-[#c9a227] bg-[#c9a227]/10'
                    : 'border-[#333] hover:border-[#555]'
                }`}
              >
                <div className="text-[10px] font-bold text-white leading-tight">{t.label}</div>
                <div className="text-[9px] text-gray-500 tabular-nums">
                  {t.rentalCC} CC · cap {t.capacity} · {t.payoutPerCorpsCC}/corps
                </div>
              </button>
            ))}
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
              <input
                type="text"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="City, State (e.g. Canton, OH)"
                required
                className={inputClass}
              />
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
              <span className="text-[10px] text-gray-500 tabular-nums">
                Rental: <span className="text-white font-bold">{tier.rentalCC} CC</span>
                <span className="text-gray-600"> · you have {corpsCoin.toLocaleString()} CC</span>
              </span>
              <button
                type="submit"
                disabled={busy || !hasCorps || corpsCoin < tier.rentalCC}
                className="px-3 py-1.5 rounded-sm text-[10px] font-bold uppercase tracking-wider
                  bg-[#c9a227] text-black disabled:bg-[#333] disabled:text-gray-600 press-feedback"
              >
                {busy ? <Loader2 className="w-3 h-3 animate-spin inline" /> : 'Book Venue'}
              </button>
            </div>
          </form>

          {error && <div className="text-[11px] text-red-400">{error}</div>}
          {success && <div className="text-[11px] text-green-400">{success}</div>}

          {/* This season's hosted events */}
          {events && events.length > 0 && (
            <div className="pt-2 border-t border-[#242424] space-y-1">
              <div className="text-[9px] font-bold uppercase tracking-wider text-gray-600">
                Hosted This Season
              </div>
              {events.map((event) => (
                <div key={event.id} className="flex items-center justify-between text-[10px]">
                  <span className="text-gray-300 truncate pr-2">
                    <span className="text-gray-600 tabular-nums">D{event.day}</span>{' '}
                    {event.eventName}
                    <span className="text-gray-600"> · {event.location}</span>
                  </span>
                  <span className="text-gray-500 tabular-nums flex-shrink-0">
                    {event.paidOut ? `${event.attendance} corps · +${event.payout} CC` : 'upcoming'}
                  </span>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
