import React, { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { CalendarClock, ChevronRight, MapPin, Radio, Star, Thermometer } from 'lucide-react';
import { useNow } from '../../hooks/useNow';
import { useSeasonDeadlines } from '../../hooks/useSeasonClock';
import {
  joinFantasyShows,
  joinPodiumShows,
  buildShowdayModel,
  buildPicksSpotlight,
  findMyEncore,
} from '../../utils/showday';
import { showStartsAtDate } from '../../utils/scheduleUtils';
import { formatCompetitionDate } from '../../utils/competitionCalendar';
import { formatCountdown } from '../../utils/seasonClock';
import { CORPS_CLASS_LABELS } from '../../utils/corps';
import { formatEventName } from '../../utils/season';

/**
 * @typedef {import('../../utils/showday').ShowLike} ShowLike
 * @typedef {import('../../utils/showday').RawCompetition} RawCompetition
 */

/**
 * A show's real start, formatted in its own timezone ("Sat 7:30 PM CDT").
 * @param {ShowLike} show
 * @returns {string|null}
 */
function formatStart(show) {
  const start = showStartsAtDate(show);
  if (!start) return null;
  /** @type {Intl.DateTimeFormatOptions} */
  const opts = { weekday: 'short', hour: 'numeric', minute: '2-digit' };
  try {
    return new Intl.DateTimeFormat('en-US', {
      ...opts,
      timeZone: show.timezone || undefined,
      timeZoneName: 'short',
    }).format(start);
  } catch {
    return new Intl.DateTimeFormat('en-US', opts).format(start);
  }
}

/**
 * A running-order slot's field time ("9:16 PM"), preferring the materialized
 * label over re-formatting the instant.
 * @param {{performanceTime?: string, performsAt?: string}} entry
 * @param {string|null|undefined} timezone
 * @returns {string}
 */
function formatFieldTime(entry, timezone) {
  if (entry.performanceTime) return entry.performanceTime;
  if (!entry.performsAt) return '';
  try {
    return new Intl.DateTimeFormat('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      timeZone: timezone || undefined,
    }).format(new Date(entry.performsAt));
  } catch {
    return '';
  }
}

/** Phase -> the strip's header label. @type {Record<string, string>} */
const PHASE_LABELS = {
  live: 'Show Day',
  today: 'Show Day',
  done: 'Show Day',
  upcoming: 'Next Show',
  none: 'Your Schedule',
};

/**
 * ShowdayStrip
 *
 * The who/what/where/when of the director's own show day, elevated to the top
 * of the dashboard for BOTH divisions (Fantasy and Podium). One glance answers:
 * what event is my corps at today (or next), where is it, when does the show
 * start, and when do *I* take the field — with a live on-field ticker while the
 * show is running. The full schedule and complete running order stay on the
 * Schedule page (one tap away); this strip is deliberately just the director's
 * own story.
 *
 * Self-guards to a slim "pick your shows" nudge when nothing is scheduled, so
 * it never renders an empty box.
 *
 * @param {Object} props
 * @param {('fantasy'|'podium')} props.division - Which field the active corps competes on.
 * @param {RawCompetition[]} props.competitions - Raw enriched competitions (scheduleStore).
 * @param {Record<string, Array<Object>>} [props.selectedShows] - Fantasy: corps.selectedShows.
 * @param {{selectedShows?: Record<number, {eventName?: string}|null>|null, autoDays?: number[]|null}|null} [props.podiumPicks]
 *   Podium: self-picked shows by day + auto-enrolled major days (usePodium state).
 * @param {Record<string, string>} [props.lineup] - Fantasy: caption -> "CorpsName|Year".
 * @param {string|null} [props.myUid]
 * @param {number|null} [props.currentDay] - Season day in progress.
 * @param {string|null} [props.corpsClass] - Active class id (slot matching + label).
 * @param {string} [props.corpsName] - The director's corps name (the WHO).
 * @param {Object|null} [props.seasonSchedule] - seasonData.schedule, for day -> date.
 */
const ShowdayStrip = ({
  division,
  competitions = [],
  selectedShows = {},
  podiumPicks = null,
  lineup = {},
  myUid = null,
  currentDay = null,
  corpsClass = null,
  corpsName = '',
  seasonSchedule = null,
}) => {
  const now = useNow(30000);
  const { scoresInMs, scoresPending } = useSeasonDeadlines();

  const shows = useMemo(
    () =>
      division === 'podium'
        ? joinPodiumShows(competitions, podiumPicks)
        : joinFantasyShows(competitions, selectedShows),
    [division, competitions, podiumPicks, selectedShows]
  );

  const model = useMemo(
    () =>
      buildShowdayModel({
        shows,
        currentDay,
        myUid,
        corpsClass: division === 'podium' ? null : corpsClass,
        now,
      }),
    [shows, currentDay, myUid, corpsClass, division, now]
  );

  // Fantasy flavor: picks performing on real fields today, and the encore nod.
  const spotlight = useMemo(
    () => (division === 'fantasy' ? buildPicksSpotlight(competitions, lineup, now) : []),
    [division, competitions, lineup, now]
  );
  const myEncore = useMemo(() => findMyEncore(shows, myUid), [shows, myUid]);

  const { phase, show, mySlot, onNow, upNext } = model;
  const isShowday = phase === 'live' || phase === 'today' || phase === 'done';
  const myOnField = mySlot?.state === 'onNow';
  const classLabel = (corpsClass && CORPS_CLASS_LABELS[corpsClass]) || '';

  // Nothing scheduled at all: a slim nudge to the Schedule page instead of an
  // empty box — the answer to "what's my day?" is "nothing yet, go pick shows".
  if (phase === 'none') {
    return (
      <Link
        to="/schedule"
        className="flex items-center justify-between gap-3 bg-surface-card border border-line rounded-none px-4 py-2.5 hover:border-interactive transition-colors"
      >
        <span className="flex items-center gap-2 text-xs text-muted min-w-0">
          <CalendarClock className="w-3.5 h-3.5 text-secondary flex-shrink-0" />
          <span className="truncate">
            No upcoming shows for{' '}
            <span className="text-secondary">{corpsName || 'your corps'}</span> — pick your
            competitions on the schedule.
          </span>
        </span>
        <span className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-interactive flex-shrink-0">
          Schedule <ChevronRight className="w-3.5 h-3.5" />
        </span>
      </Link>
    );
  }

  const startLabel = show ? formatStart(show) : null;
  const dateLabel =
    show && !startLabel
      ? formatCompetitionDate(seasonSchedule, show.day, {
          weekday: 'short',
          month: 'short',
          day: 'numeric',
        })
      : null;
  const startDate = show ? showStartsAtDate(show) : null;
  const startsInMs = startDate ? startDate.getTime() - now.getTime() : null;
  const slotTime = mySlot
    ? formatFieldTime(mySlot.entry, /** @type {ShowLike} */ (mySlot.show).timezone)
    : '';
  const weather = show?.weather || null;
  const fieldSize = Array.isArray(show?.lineup)
    ? show.lineup.length + (Array.isArray(show?.overflow) ? show.overflow.length : 0)
    : null;

  // The one WHEN line for the director's own corps.
  let myLine = null;
  if (myOnField) {
    myLine = 'ON THE FIELD NOW';
  } else if (mySlot?.state === 'upcoming') {
    myLine =
      mySlot.minutesUntil === 0
        ? 'Takes the field any moment'
        : mySlot.minutesUntil != null && mySlot.minutesUntil <= 90
          ? `Takes the field in ${mySlot.minutesUntil} min`
          : `Takes the field at ${slotTime}`;
  } else if (mySlot?.state === 'done' || phase === 'done') {
    myLine = 'Performance complete';
  } else if (phase === 'live' || phase === 'today') {
    myLine = 'Competing tonight';
  }

  return (
    <div
      className={`bg-surface-card border rounded-none ${phase === 'live' ? 'border-brand/60' : 'border-line'}`}
    >
      {/* Header: what kind of day this is + live state */}
      <div className="bg-surface-raised px-4 py-2.5 border-b border-line flex items-center justify-between gap-2">
        <h3 className="text-[10px] font-bold text-muted uppercase tracking-wider flex items-center gap-2 min-w-0">
          <CalendarClock className="w-3.5 h-3.5 text-secondary flex-shrink-0" />
          <span className="truncate">
            {PHASE_LABELS[phase]}
            {phase === 'today' && <span className="text-brand"> · Tonight</span>}
            {phase === 'done' && <span className="text-secondary"> · Complete</span>}
            {phase === 'upcoming' && show && (
              <span className="text-secondary"> · Day {show.day}</span>
            )}
          </span>
        </h3>
        {phase === 'live' ? (
          <span className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-green-500 flex-shrink-0">
            <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
            Live
          </span>
        ) : (
          isShowday &&
          !scoresPending && (
            <span className="text-[10px] font-data text-cyan-400 tabular-nums flex-shrink-0">
              Scores in {formatCountdown(scoresInMs)}
            </span>
          )
        )}
      </div>

      {/* WHAT + WHERE + WHEN: the event itself. Tapping it opens the Schedule
          page, where the event's full running order lives. */}
      {show && (
        <Link to="/schedule" className="block px-4 py-3 hover:bg-white/[0.03] transition-colors">
          <div className="flex items-baseline justify-between gap-2">
            <span className="text-sm md:text-base text-white font-bold truncate">
              {formatEventName(show.eventName)}
            </span>
            {show.isChampionship && (
              <span className="text-[9px] font-bold uppercase tracking-wider text-brand border border-brand/40 px-1.5 py-0.5 flex-shrink-0">
                Championship
              </span>
            )}
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted">
            {(startLabel || dateLabel) && (
              <span className="font-data text-secondary">{startLabel || dateLabel}</span>
            )}
            {phase === 'today' &&
              startsInMs != null &&
              startsInMs > 0 &&
              startsInMs < 12 * 60 * 60 * 1000 && (
                <span className="font-data text-cyan-400 tabular-nums">
                  Gates in {formatCountdown(startsInMs)}
                </span>
              )}
            {show.location && (
              <span className="flex items-center gap-1 min-w-0">
                <MapPin className="w-3 h-3 flex-shrink-0" />
                <span className="truncate">
                  {show.location}
                  {show.venue ? ` · ${show.venue}` : ''}
                </span>
              </span>
            )}
            {weather?.summary && (
              <span className="flex items-center gap-1">
                <Thermometer className="w-3 h-3" />
                {typeof weather.tempF === 'number' ? `${Math.round(weather.tempF)}°F ` : ''}
                {weather.summary}
              </span>
            )}
            {fieldSize != null && fieldSize > 0 && (
              <span className="font-data">{fieldSize} corps</span>
            )}
          </div>
        </Link>
      )}

      {/* WHO + WHEN, the director's own corps — the headline moment. */}
      {isShowday && (
        <div
          className={`px-4 py-2.5 border-t border-line ${myOnField ? 'bg-brand/20' : 'bg-brand/5'}`}
        >
          <div className="flex items-center justify-between gap-2">
            <span className="flex items-center gap-2 min-w-0">
              <Radio
                className={`w-3.5 h-3.5 flex-shrink-0 ${myOnField ? 'text-green-500' : 'text-brand'}`}
              />
              <span className="truncate">
                <span className="text-sm text-brand font-bold">{corpsName || 'Your corps'}</span>
                {classLabel && <span className="text-xs text-muted"> · {classLabel}</span>}
              </span>
            </span>
            <span
              className={`text-xs font-data font-bold tabular-nums flex-shrink-0 ${myOnField ? 'text-green-500' : 'text-brand'}`}
            >
              {myLine}
              {mySlot?.state === 'upcoming' && slotTime && !myLine?.includes(slotTime) && (
                <span className="text-muted font-normal"> · {slotTime}</span>
              )}
            </span>
          </div>
        </div>
      )}

      {/* Live on-field ticker: who's out there while you wait. */}
      {phase === 'live' && (onNow || upNext) && (
        <div className="px-4 py-2 border-t border-line flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
          {onNow && (
            <span className="flex items-center gap-1.5 min-w-0">
              <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse flex-shrink-0" />
              <span className="text-[10px] font-bold uppercase tracking-wider text-green-500 flex-shrink-0">
                On field
              </span>
              <span className="text-white truncate">{onNow.corps}</span>
            </span>
          )}
          {upNext && (
            <span className="flex items-center gap-1.5 min-w-0">
              <span className="text-[10px] font-bold uppercase tracking-wider text-interactive flex-shrink-0">
                Up next
              </span>
              <span className="text-secondary truncate">{upNext.corps}</span>
            </span>
          )}
        </div>
      )}

      {/* You're the encore — cosmetic pride moment (fantasy field). */}
      {myEncore && isShowday && (
        <div className="px-4 py-2 border-t border-line bg-brand/10 flex items-center gap-1.5 text-xs">
          <Star className="w-3.5 h-3.5 text-brand fill-brand flex-shrink-0" />
          <span className="text-white truncate">
            <span className="font-bold text-brand">You're the encore</span>
            <span className="text-secondary">
              {' '}
              {myEncore.encore.reason === 'host' ? '— your home field.' : '— hometown crowd.'}
            </span>
          </span>
        </div>
      )}

      {/* Your picks on real fields today (fantasy only) — condensed. */}
      {spotlight.length > 0 && (
        <div className="px-4 py-2 border-t border-line bg-interactive/5">
          <div className="flex items-center gap-1.5 mb-1">
            <Radio className="w-3 h-3 text-interactive" />
            <span className="text-[10px] font-bold uppercase tracking-wider text-interactive">
              Your picks are on tour today
            </span>
          </div>
          <div className="flex flex-wrap gap-x-4 gap-y-0.5">
            {spotlight.slice(0, 4).map((s, idx) => (
              <span key={`${s.corps}-${idx}`} className="text-xs text-secondary truncate">
                <span className="text-white font-medium">{s.corps}</span>
                <span className="text-muted"> · {s.captions.join(' & ')}</span>
                {s.performsAt && (
                  <span className="font-data text-muted tabular-nums">
                    {' '}
                    · {formatFieldTime({ performsAt: s.performsAt.toISOString() }, s.timezone)}
                  </span>
                )}
              </span>
            ))}
            {spotlight.length > 4 && (
              <span className="text-xs text-muted">+{spotlight.length - 4} more</span>
            )}
          </div>
        </div>
      )}

      <div className="px-2 py-1 border-t border-line bg-surface-sunken">
        <Link
          to="/schedule"
          className="min-h-[36px] px-2 text-xs text-interactive hover:text-interactive-hover font-bold uppercase tracking-wider transition-colors flex items-center gap-1.5 rounded-none"
        >
          Full schedule & running order
          <ChevronRight className="w-4 h-4" />
        </Link>
      </div>
    </div>
  );
};

export default ShowdayStrip;
