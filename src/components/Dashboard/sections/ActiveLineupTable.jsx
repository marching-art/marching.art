// ActiveLineupTable - Main roster table for dashboard
// OPTIMIZATION #4: Extracted from Dashboard.jsx to reduce file size and isolate renders

import React, { memo } from 'react';
import { Edit, TrendingUp, TrendingDown, Minus, Lock, MapPin } from 'lucide-react';
import { CAPTIONS } from './constants';

// Skeleton row for loading state
const SkeletonRow = memo(() => (
  <div className="flex items-center gap-3 px-3 py-2.5 border-b border-[#222]">
    <div className="w-11 h-6 bg-[#333] animate-pulse flex-shrink-0" />
    <div className="flex-1 min-w-0 space-y-1.5">
      <div className="w-32 h-3.5 bg-[#333] animate-pulse" />
      <div className="w-24 h-3 bg-[#222] animate-pulse" />
    </div>
    <div className="w-12 h-4 bg-[#333] animate-pulse flex-shrink-0" />
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
        : 'text-gray-500';
  return (
    <span className={`inline-flex items-center gap-0.5 text-[11px] font-data tabular-nums ${color}`}>
      {trend.direction === 'up' && <TrendingUp className="w-3 h-3" />}
      {trend.direction === 'down' && <TrendingDown className="w-3 h-3" />}
      {trend.direction === 'same' && <Minus className="w-3 h-3" />}
      {trend.delta}
    </span>
  );
};

// Memoized lineup row - two-line layout that fits the mobile width instead of
// a wide table whose Next Show column clipped off the right edge.
const LineupTableRow = memo(({ caption, value, captionData, onSlotClick, scoresAvailable }) => {
  const hasValue = !!value;
  const [corpsName, sourceYear] = hasValue ? value.split('|') : [null, null];
  const { score, trend, nextShow } = captionData || {};

  return (
    <button
      type="button"
      onClick={() => onSlotClick(caption.id)}
      className="w-full text-left flex items-center gap-3 px-3 py-2.5 border-b border-[#222] hover:bg-[#222] active:bg-[#222] transition-colors"
    >
      {/* Slot Badge */}
      <span
        className={`flex-shrink-0 w-11 text-center px-1.5 py-1 text-[10px] font-bold ${
          hasValue ? 'bg-[#0057B8]/20 text-[#0057B8]' : 'bg-[#333] text-gray-500'
        }`}
      >
        {caption.name}
      </span>

      {/* Corps + Next Show */}
      <div className="flex-1 min-w-0">
        {/* Line 1: corps name (+year) and score/trend */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-baseline gap-1.5 min-w-0">
            {hasValue ? (
              <>
                <span className="text-sm text-white truncate">{corpsName}</span>
                {sourceYear && (
                  <span className="text-[10px] text-gray-500 flex-shrink-0">
                    '{String(sourceYear).slice(-2)}
                  </span>
                )}
              </>
            ) : (
              <span className="text-sm text-gray-500 italic">Empty slot</span>
            )}
          </div>

          {scoresAvailable && hasValue && (
            <div className="flex items-center gap-2 flex-shrink-0">
              {score !== null && score !== undefined ? (
                <span className="text-sm font-bold text-white font-data tabular-nums">
                  {score.toFixed(2)}
                </span>
              ) : (
                <span className="text-sm text-gray-600">—</span>
              )}
              <TrendChip trend={trend} />
            </div>
          )}
        </div>

        {/* Line 2: next show / status */}
        <div className="mt-0.5">
          {hasValue && nextShow ? (
            <span className="text-[11px] text-gray-500 flex items-center gap-1 min-w-0">
              <MapPin className="w-3 h-3 flex-shrink-0 text-purple-400" />
              <span className="truncate">
                Day {nextShow.day} · {nextShow.location}
              </span>
            </span>
          ) : hasValue ? (
            <span className="text-[11px] text-gray-600 flex items-center gap-1">
              <Lock className="w-3 h-3" />
              Season complete
            </span>
          ) : (
            <span className="text-[11px] text-yellow-500 font-bold">+ Draft player</span>
          )}
        </div>
      </div>
    </button>
  );
});

const ActiveLineupTable = memo(
  ({ lineup, lineupScoreData, loading, onManageLineup, onSlotClick, scoresAvailable = true }) => {
    const lineupCount = Object.keys(lineup).length;

    return (
      <div className="bg-[#1a1a1a] border border-[#333] overflow-hidden">
        {/* Header */}
        <div className="bg-[#222] px-4 py-3 border-b border-[#333] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h2 className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
              Active Lineup
            </h2>
            <span
              className={`text-xs font-bold px-2 py-0.5 ${
                lineupCount === 8
                  ? 'bg-green-500/20 text-green-500'
                  : 'bg-yellow-500/20 text-yellow-500'
              }`}
            >
              {lineupCount}/8
            </span>
          </div>
        </div>

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
        <div className="p-3 border-t border-[#333] bg-[#111]">
          <button
            onClick={onManageLineup}
            className="w-full py-3 bg-[#0057B8] hover:bg-[#0066d6] text-white text-sm font-bold transition-colors flex items-center justify-center gap-2"
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
