import React, { useState, useEffect } from 'react';
import { Clock, Star } from 'lucide-react';
import { getRunningOrderStatus } from '../../utils/scheduleUtils';

/**
 * RunningOrder
 *
 * Renders a show's real running order (each corps + the minute it takes the
 * field, scraped from the dci.org event detail page) with a live "PERFORMING NOW"
 * / "UP NEXT" marker that advances as the evening progresses.
 *
 * Optionally highlights corps that appear in the director's own caption lineup
 * (the "your picks are live" tie-in), in two tiers:
 *   - full: the picked (corps, year) had a real result on this show's day.
 *   - dim:  the brand is present but the day's score is interpolated.
 * Pass `highlights` (a Map from buildShowHighlights). The legacy `highlightCorps`
 * (a Set of normalized names) is still accepted and rendered as full-tier.
 *
 * Renders nothing when the show has no lineup, so it's safe to drop in anywhere.
 *
 * @param {Object} props
 * @param {Object} props.show - Enriched show ({ lineup, timezone, startsAt, scoresAt }).
 * @param {Map<string,{tier:string,corps:string,captions:string[],sourceYear:any}>} [props.highlights]
 * @param {Set<string>} [props.highlightCorps] - Legacy: normalized names, full tier.
 * @param {boolean} [props.compact] - Tighter layout for dashboard panels.
 */
import { normalizeCorpsName as normalize, highlightLabel } from '../../utils/pickHighlights';

const RunningOrder = ({ show, highlights, highlightCorps, compact = false }) => {
  // Tick every 60s so the performing-now marker stays current without a reload.
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60 * 1000);
    return () => clearInterval(id);
  }, []);

  const lineup = Array.isArray(show?.lineup) ? show.lineup : [];
  if (lineup.length === 0) return null;

  const { current, next } = getRunningOrderStatus(show, now);
  const currentOrder = current?.order ?? null;
  const nextOrder = next?.order ?? null;

  return (
    <div className="bg-[#1a1a1a] border border-[#333] rounded-sm">
      <div className="bg-[#222] px-4 py-2.5 border-b border-[#333] flex items-center justify-between">
        <h3 className="text-[10px] font-bold text-gray-400 uppercase tracking-wider flex items-center gap-2">
          <Clock className="w-3.5 h-3.5 text-[#0057B8]" />
          Running Order
        </h3>
        <span className="text-[10px] font-data text-gray-500">{lineup.length} corps</span>
      </div>

      <div className="divide-y divide-[#333]/50">
        {lineup.map((entry) => {
          const isNow = entry.order === currentOrder;
          const isNext = entry.order === nextOrder;
          const key = normalize(entry.corps);
          const hi = highlights?.get(key);
          const tier = hi?.tier || (highlightCorps?.has(key) ? 'full' : null);
          const isFull = tier === 'full';
          const isDim = tier === 'dim';

          return (
            <div
              key={`${entry.order}-${entry.corps}`}
              title={hi ? highlightLabel(hi) : undefined}
              className={`flex items-center justify-between px-4 ${compact ? 'py-1.5' : 'py-2'} ${
                isNow
                  ? 'bg-[#0057B8]/10'
                  : isFull
                    ? 'bg-[#F5A623]/[0.06]'
                    : isDim
                      ? 'bg-[#F5A623]/[0.02]'
                      : ''
              }`}
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <span className="text-xs font-bold font-data text-gray-500 tabular-nums w-14 flex-shrink-0">
                  {entry.performanceTime}
                </span>
                <span className="text-sm text-white truncate flex items-center gap-1.5">
                  {isFull && (
                    <Star className="w-3 h-3 text-[#F5A623] fill-[#F5A623] flex-shrink-0" />
                  )}
                  {isDim && <Star className="w-3 h-3 text-[#F5A623]/50 flex-shrink-0" />}
                  <span className={`truncate ${isDim ? 'text-gray-300' : ''}`}>{entry.corps}</span>
                </span>
              </div>
              <div className="flex-shrink-0 pl-2">
                {isNow && (
                  <span className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-green-500">
                    <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
                    On Field
                  </span>
                )}
                {isNext && (
                  <span className="text-[10px] font-bold uppercase tracking-wider text-[#0057B8]">
                    Up Next
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default RunningOrder;
