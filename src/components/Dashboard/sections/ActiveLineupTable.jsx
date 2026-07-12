// ActiveLineupTable - Main roster table for dashboard
// OPTIMIZATION #4: Extracted from Dashboard.jsx to reduce file size and isolate renders

import React, { memo } from 'react';
import { Edit, TrendingUp, TrendingDown, Minus, Lock, MapPin } from 'lucide-react';
import { CAPTIONS } from './constants';

// Skeleton row for loading state
const SkeletonRow = memo(() => (
  <div className="flex items-center gap-3 px-3 py-2.5 border-b border-line-subtle">
    <div className="w-11 h-6 bg-line animate-pulse flex-shrink-0" />
    <div className="flex-1 min-w-0 space-y-1.5">
      <div className="w-32 h-3.5 bg-line animate-pulse" />
      <div className="w-24 h-3 bg-surface-raised animate-pulse" />
    </div>
    <div className="w-12 h-4 bg-line animate-pulse flex-shrink-0" />
  </div>
));

// Trend chip (up/down/flat) shown next to the score.
const TrendChip = ({ trend }) => {
  if (!trend) return null;
  const color =
    trend.direction === 'up'
      ? 'text-green-500'
      : trend.direction === 'down'
        ? 'text-red-500'
        : 'text-muted';
  return (
    <span
      className={`inline-flex items-center gap-0.5 text-[11px] font-data tabular-nums ${color}`}
    >
      {trend.direction === 'up' && <TrendingUp className="w-3 h-3" />}
      {trend.direction === 'down' && <TrendingDown className="w-3 h-3" />}
      {trend.direction === 'same' && <Minus className="w-3 h-3" />}
      {trend.delta}
    </span>
  );
};

// Memoized lineup row - compact layout that fits the mobile width. The "next
// show" is a corps-level fact (every caption competes together at the shows the
// director registered for), so it lives in the table header, not per row.
const LineupTableRow = memo(({ caption, value, captionData, onSlotClick, scoresAvailable }) => {
  const hasValue = !!value;
  const [corpsName, sourceYear] = hasValue ? value.split('|') : [null, null];
  const { score, trend } = captionData || {};

  return (
    <button
      type="button"
      onClick={() => onSlotClick(caption.id)}
      className="w-full text-left flex items-center gap-3 px-3 py-2.5 border-b border-line-subtle hover:bg-surface-raised active:bg-surface-raised transition-colors"
    >
      {/* Slot Badge */}
      <span
        className={`flex-shrink-0 w-11 text-center px-1.5 py-1 text-[10px] font-bold ${
          hasValue ? 'bg-interactive/20 text-interactive' : 'bg-line text-muted'
        }`}
      >
        {caption.name}
      </span>

      {/* Corps + score */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-baseline gap-1.5 min-w-0">
            {hasValue ? (
              <>
                <span className="text-sm text-white truncate">{corpsName}</span>
                {sourceYear && (
                  <span className="text-[10px] text-muted flex-shrink-0">
                    '{String(sourceYear).slice(-2)}
                  </span>
                )}
              </>
            ) : (
              <span className="text-sm text-muted italic">Empty slot</span>
            )}
          </div>

          {scoresAvailable && hasValue && (
            <div className="flex items-center gap-2 flex-shrink-0">
              {score !== null && score !== undefined ? (
                <span className="text-sm font-bold text-white font-data tabular-nums">
                  {score.toFixed(2)}
                </span>
              ) : (
                <span className="text-sm text-muted">—</span>
              )}
              <TrendChip trend={trend} />
            </div>
          )}
        </div>

        {/* Draft prompt for empty slots (filled slots need no second line —
            the corps-level next show is surfaced in the header). */}
        {!hasValue && (
          <div className="mt-0.5">
            <span className="text-[11px] text-interactive font-bold">+ Draft player</span>
          </div>
        )}
      </div>
    </button>
  );
});

const ActiveLineupTable = memo(
  ({
    lineup,
    lineupScoreData,
    loading,
    onManageLineup,
    onSlotClick,
    scoresAvailable = true,
    nextShow = null,
  }) => {
    const lineupCount = Object.keys(lineup).length;

    return (
      <div className="bg-surface-card border border-line overflow-hidden">
        {/* Header */}
        <div className="bg-surface-raised px-4 py-3 border-b border-line flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h2 className="text-[10px] font-bold uppercase tracking-wider text-muted">
              Active Lineup
            </h2>
            <span
              className={`text-xs font-bold px-2 py-0.5 ${
                lineupCount === 8 ? 'bg-green-500/20 text-green-500' : 'bg-warning/20 text-warning'
              }`}
            >
              {lineupCount}/8
            </span>
          </div>
        </div>

        {/* Corps-level next show — the whole lineup competes together at the
            director's next registered show. */}
        {!loading &&
          (nextShow ? (
            <div className="px-4 py-2 border-b border-line bg-surface-sunken flex items-center gap-1.5 text-[11px] text-muted min-w-0">
              <MapPin className="w-3 h-3 flex-shrink-0 text-purple-400" />
              <span className="font-bold uppercase tracking-wider text-muted flex-shrink-0">
                Next Show
              </span>
              <span className="text-muted flex-shrink-0">·</span>
              <span className="truncate text-secondary">
                Day {nextShow.day}
                {nextShow.eventName ? ` · ${nextShow.eventName}` : ''}
                {nextShow.location ? ` · ${nextShow.location}` : ''}
              </span>
            </div>
          ) : (
            <div className="px-4 py-2 border-b border-line bg-surface-sunken flex items-center gap-1.5 text-[11px] text-muted">
              <Lock className="w-3 h-3 flex-shrink-0" />
              <span className="font-bold uppercase tracking-wider">No upcoming show selected</span>
            </div>
          ))}

        {/* Roster - stacked rows that fit the mobile width */}
        <div>
          {loading
            ? Array.from({ length: 8 }).map((_, i) => <SkeletonRow key={i} />)
            : CAPTIONS.map((caption) => (
                <LineupTableRow
                  key={caption.id}
                  caption={caption}
                  value={lineup[caption.id]}
                  captionData={lineupScoreData?.[caption.id]}
                  onSlotClick={onSlotClick}
                  scoresAvailable={scoresAvailable}
                />
              ))}
        </div>

        {/* Manage Lineup Button */}
        <div className="p-3 border-t border-line bg-surface-sunken">
          <button
            onClick={onManageLineup}
            className="w-full py-3 bg-interactive hover:bg-interactive-hover text-white text-sm font-bold transition-colors flex items-center justify-center gap-2"
          >
            <Edit className="w-4 h-4" />
            Manage Lineup
          </button>
        </div>
      </div>
    );
  }
);

export default ActiveLineupTable;
