// @ts-nocheck -- grandfathered before checkJs; remove when this file is typed or cleaned up
import React, { useState, useEffect } from 'react';
import { Clock, Star } from 'lucide-react';
import { getRunningOrderStatus } from '../../utils/scheduleUtils';
import { normalizeCorpsName as normalize, highlightLabel } from '../../utils/pickHighlights';

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
 * @param {string} [props.myUid] - The viewing director's uid. Their own corps
 *   (matched by uid on the real-field lineup) is marked "You" and gold-accented —
 *   the "that's MY corps on the field" moment.
 * @param {boolean} [props.compact] - Tighter layout for dashboard panels.
 */
const RunningOrder = ({ show, highlights, highlightCorps, myUid, compact = false }) => {
  // Tick every 60s so the performing-now marker stays current without a reload.
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60 * 1000);
    return () => clearInterval(id);
  }, []);

  const lineup = Array.isArray(show?.lineup) ? show.lineup : [];
  if (lineup.length === 0) return null;

  // "Also competing" — the overflow safety valve (docs/EVENT_SCHEDULES_AND_SLOTS.md):
  // corps that competed and scored but didn't fit the timed order on a huge night.
  const overflow = Array.isArray(show?.overflow) ? show.overflow : [];

  // The cosmetic encore corps (performs after scores read). Mine if uid matches.
  const encore = show?.encore && show.encore.corps ? show.encore : null;
  const encoreMine = !!(encore && myUid && encore.uid === myUid);

  const { current, next } = getRunningOrderStatus(show, now);
  const currentOrder = current?.order ?? null;
  const nextOrder = next?.order ?? null;

  return (
    <div className="bg-surface-card border border-line rounded-none">
      <div className="bg-surface-raised px-4 py-2.5 border-b border-line flex items-center justify-between">
        <h3 className="text-[10px] font-bold text-muted uppercase tracking-wider flex items-center gap-2">
          <Clock className="w-3.5 h-3.5 text-interactive" />
          Running Order
        </h3>
        <span className="text-[10px] font-data text-muted">
          {lineup.length + overflow.length} corps
        </span>
      </div>

      <div className="divide-y divide-line/50">
        {lineup.map((entry) => {
          const isNow = entry.order === currentOrder;
          const isNext = entry.order === nextOrder;
          // The director's OWN corps, matched precisely by uid (not brand name) —
          // this is the "that's MY corps on the field right now" moment.
          const isMine = !!(myUid && entry.uid && entry.uid === myUid);
          const key = normalize(entry.corps);
          const hi = highlights?.get(key);
          const tier = hi?.tier || (highlightCorps?.has(key) ? 'full' : null);
          const isFull = tier === 'full';
          const isDim = tier === 'dim';

          return (
            <div
              key={`${entry.order}-${entry.corps}`}
              title={isMine ? 'Your corps' : hi ? highlightLabel(hi) : undefined}
              className={`flex items-center justify-between px-4 ${compact ? 'py-1.5' : 'py-2'} ${
                isMine
                  ? `bg-brand/10 border-l-2 border-brand ${isNow ? 'bg-brand/20' : ''}`
                  : isNow
                    ? 'bg-interactive/10'
                    : isFull
                      ? 'bg-interactive/[0.06]'
                      : isDim
                        ? 'bg-interactive/[0.02]'
                        : ''
              }`}
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <span className="text-xs font-bold font-data text-muted tabular-nums w-14 flex-shrink-0">
                  {entry.performanceTime}
                </span>
                <span className="text-sm text-white truncate flex items-center gap-1.5">
                  {isMine && <Star className="w-3 h-3 text-brand fill-brand flex-shrink-0" />}
                  {!isMine && isFull && (
                    <Star className="w-3 h-3 text-interactive fill-interactive flex-shrink-0" />
                  )}
                  {!isMine && isDim && (
                    <Star className="w-3 h-3 text-interactive/50 flex-shrink-0" />
                  )}
                  <span
                    className={`truncate ${isMine ? 'text-brand font-semibold' : isDim ? 'text-secondary' : ''}`}
                  >
                    {entry.corps}
                  </span>
                  {isMine && (
                    <span className="text-[9px] font-bold uppercase tracking-wider text-brand/80 flex-shrink-0">
                      You
                    </span>
                  )}
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
                  <span className="text-[10px] font-bold uppercase tracking-wider text-interactive">
                    Up Next
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {overflow.length > 0 && (
        <div className="px-4 py-2.5 border-t border-line bg-surface-raised/40">
          <div className="text-[10px] font-bold text-muted uppercase tracking-wider mb-1">
            Also Competing · {overflow.length}
          </div>
          <div className="flex flex-wrap gap-x-3 gap-y-0.5">
            {overflow.map((o, i) => {
              const key = normalize(o.corps);
              const hi = highlights?.get(key);
              const mine = hi || highlightCorps?.has(key);
              return (
                <span
                  key={`${o.uid || 'anon'}-${i}`}
                  className={`text-xs truncate ${mine ? 'text-interactive font-semibold' : 'text-secondary'}`}
                >
                  {o.corps}
                </span>
              );
            })}
          </div>
        </div>
      )}

      {encore && (
        <div
          className={`px-4 py-2.5 border-t border-line flex items-center justify-between gap-2 ${
            encoreMine ? 'bg-brand/15' : 'bg-surface-raised/40'
          }`}
        >
          <div className="flex items-center gap-2 min-w-0">
            <Star
              className={`w-3.5 h-3.5 flex-shrink-0 ${encoreMine ? 'text-brand fill-brand' : 'text-brand'}`}
            />
            <span className="text-[10px] font-bold uppercase tracking-wider text-brand">
              Encore
            </span>
            <span
              className={`text-sm truncate ${encoreMine ? 'text-brand font-semibold' : 'text-white'}`}
            >
              {encore.corps}
            </span>
            {encoreMine && (
              <span className="text-[9px] font-bold uppercase tracking-wider text-brand/80 flex-shrink-0">
                You
              </span>
            )}
          </div>
          <span className="text-[10px] text-muted flex-shrink-0">
            {encore.reason === 'host' ? 'Home field' : 'Hometown crowd'}
          </span>
        </div>
      )}
    </div>
  );
};

export default RunningOrder;
