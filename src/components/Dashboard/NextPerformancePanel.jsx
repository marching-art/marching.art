import React, { useMemo, useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { CalendarClock, Radio, MapPin, ChevronRight } from 'lucide-react';
import {
  isShowLive,
  showStartsAtDate,
  transformCompetitionToShow,
  formatDayKey,
  showCalendarDay,
} from '../../utils/scheduleUtils';
import RunningOrder from '../Schedule/RunningOrder';
import {
  CAPTION_LABELS,
  normalizeCorpsName as normalize,
  buildShowHighlights,
} from '../../utils/pickHighlights';

function formatStart(show) {
  const start = showStartsAtDate(show);
  if (!start) return null;
  try {
    return new Intl.DateTimeFormat('en-US', {
      weekday: 'short',
      hour: 'numeric',
      minute: '2-digit',
      timeZone: show.timezone || undefined,
      timeZoneName: 'short',
    }).format(start);
  } catch {
    return new Intl.DateTimeFormat('en-US', {
      weekday: 'short',
      hour: 'numeric',
      minute: '2-digit',
    }).format(start);
  }
}

function formatPerformTime(entry, timezone) {
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

/**
 * NextPerformancePanel
 *
 * Surfaces real show timing on the dashboard, using the scraped start times +
 * running order:
 *   1. "Your next competition" — the director's next selected show, with its real
 *      start time and a countdown; plus its running order once available.
 *   2. "Your picks are live" — because caption picks reference real corps, if any
 *      of the director's picked corps perform at a show TODAY, spotlight when they
 *      take the field (e.g. "Bluecoats — your Brass pick — performs at 9:16 PM").
 *
 * Renders nothing when there's no enriched timing to show (off-season / unscraped),
 * so it's inert outside live seasons.
 *
 * @param {Object} props
 * @param {Array} props.competitions - Raw enriched competitions from scheduleStore.
 * @param {Object} props.selectedShows - activeCorps.selectedShows ({ week1: [...] }).
 * @param {Object} props.lineup - Caption -> "CorpsName|Year" map (activeCorps.lineup).
 * @param {Array} props.poolCorps - dci-data corpsValues; supplies resultDays so the
 *   running-order highlight can distinguish real-result (full) from interpolated (dim).
 */
const NextPerformancePanel = ({
  competitions = [],
  selectedShows = {},
  lineup = {},
  poolCorps = [],
}) => {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60 * 1000);
    return () => clearInterval(id);
  }, []);

  // Index enriched competitions by day + normalized name for joining snapshots.
  const compByKey = useMemo(() => {
    const map = new Map();
    for (const comp of competitions) {
      map.set(`${comp.day}::${normalize(comp.name)}`, comp);
    }
    return map;
  }, [competitions]);

  // The director's picked real corps -> caption labels they fill.
  const picksByCorps = useMemo(() => {
    const map = new Map();
    for (const [caption, value] of Object.entries(lineup || {})) {
      if (!value) continue;
      const corpsName = String(value).split('|')[0];
      const key = normalize(corpsName);
      if (!key) continue;
      if (!map.has(key)) map.set(key, { corps: corpsName, captions: [] });
      map.get(key).captions.push(CAPTION_LABELS[caption] || caption);
    }
    return map;
  }, [lineup]);

  // Director's selected shows, joined to enriched competitions, that are upcoming
  // or live — pick the soonest as "your next competition".
  const nextCompetition = useMemo(() => {
    const joined = [];
    for (const weekShows of Object.values(selectedShows || {})) {
      if (!Array.isArray(weekShows)) continue;
      for (const sel of weekShows) {
        const comp = compByKey.get(`${sel.day}::${normalize(sel.eventName || sel.name)}`);
        const show = comp ? transformCompetitionToShow(comp) : null;
        if (!show || !show.startsAt) continue;
        joined.push(show);
      }
    }
    // Prefer a show live right now, else the soonest still upcoming.
    const live = joined.find((s) => isShowLive(s, now));
    if (live) return live;
    return (
      joined
        .filter((s) => showStartsAtDate(s) > now)
        .sort((a, b) => showStartsAtDate(a) - showStartsAtDate(b))[0] || null
    );
  }, [selectedShows, compByKey, now]);

  // "Your picks are live": scan TODAY's shows for performers in the director's roster.
  const spotlight = useMemo(() => {
    if (picksByCorps.size === 0) return [];
    const todayKey = formatDayKey(now);
    const entries = [];
    for (const comp of competitions) {
      if (!Array.isArray(comp.lineup) || comp.lineup.length === 0) continue;
      if (showCalendarDay(comp) !== todayKey) continue;
      for (const performer of comp.lineup) {
        const pick = picksByCorps.get(normalize(performer.corps));
        if (!pick) continue;
        entries.push({
          corps: pick.corps,
          captions: pick.captions,
          showName: comp.name,
          timezone: comp.timezone,
          performsAt: performer.performsAt ? new Date(performer.performsAt) : null,
          performLabel: formatPerformTime(performer, comp.timezone),
        });
      }
    }
    return entries.sort((a, b) => (a.performsAt || 0) - (b.performsAt || 0));
  }, [competitions, picksByCorps, now]);

  // Inert when there's nothing enriched to show.
  if (!nextCompetition && spotlight.length === 0) return null;

  const nextLive = nextCompetition && isShowLive(nextCompetition, now);

  return (
    <div className="bg-surface-card border border-line rounded-none">
      <div className="bg-surface-raised px-4 py-3 border-b border-line flex items-center justify-between">
        <h3 className="text-[10px] font-bold text-muted uppercase tracking-wider flex items-center gap-2">
          <CalendarClock className="w-3.5 h-3.5 text-secondary" />
          Next Performance
        </h3>
        {nextLive && (
          <span className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-green-500">
            <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
            Live
          </span>
        )}
      </div>

      {/* Your picks are performing live today */}
      {spotlight.length > 0 && (
        <div className="px-4 py-3 border-b border-line bg-interactive/5">
          <div className="flex items-center gap-1.5 mb-2">
            <Radio className="w-3.5 h-3.5 text-interactive" />
            <span className="text-[10px] font-bold uppercase tracking-wider text-interactive">
              Your picks are on tour today
            </span>
          </div>
          <ul className="space-y-1.5">
            {spotlight.map((s, idx) => (
              <li
                key={`${s.corps}-${idx}`}
                className="text-sm text-secondary flex items-baseline justify-between gap-2"
              >
                <span className="truncate">
                  <span className="text-white font-medium">{s.corps}</span>
                  <span className="text-muted"> — your {s.captions.join(' & ')} pick</span>
                </span>
                {s.performLabel && (
                  <span className="text-xs font-data text-secondary tabular-nums flex-shrink-0">
                    {s.performLabel}
                  </span>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Your next competition */}
      {nextCompetition && (
        <div className="px-4 py-3">
          <div className="text-[10px] font-bold uppercase tracking-wider text-muted mb-1">
            {nextLive ? 'Your corps is competing' : 'Your corps competes next'}
          </div>
          <div className="text-sm text-white font-medium">{nextCompetition.eventName}</div>
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted">
            {formatStart(nextCompetition) && (
              <span className="font-data">{formatStart(nextCompetition)}</span>
            )}
            {nextCompetition.location && (
              <span className="flex items-center gap-1">
                <MapPin className="w-3 h-3" /> {nextCompetition.location}
              </span>
            )}
          </div>
        </div>
      )}

      {/* Running order for the next/live competition */}
      {nextCompetition?.lineup?.length > 0 && (
        <div className="px-3 pb-3">
          <RunningOrder
            show={nextCompetition}
            compact
            highlights={buildShowHighlights({ show: nextCompetition, lineup, poolCorps })}
          />
        </div>
      )}

      <div className="px-2 py-1.5 border-t border-line bg-surface-sunken">
        <Link
          to="/schedule"
          className="min-h-[40px] px-2 text-xs text-interactive hover:text-interactive-hover font-bold uppercase tracking-wider transition-colors flex items-center gap-1.5 rounded-none"
        >
          Full Schedule
          <ChevronRight className="w-4 h-4" />
        </Link>
      </div>
    </div>
  );
};

export default NextPerformancePanel;
