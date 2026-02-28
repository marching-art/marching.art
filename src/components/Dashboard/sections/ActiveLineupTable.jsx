// ActiveLineupTable - Main roster table for dashboard
// OPTIMIZATION #4: Extracted from Dashboard.jsx to reduce file size and isolate renders

import React, { memo } from 'react';
import { Edit, TrendingUp, TrendingDown, Minus, Lock, MapPin } from 'lucide-react';
import { CAPTIONS } from './constants';

// Skeleton row for loading state
const SkeletonRow = memo(({ scoresAvailable = true }) => (
  <tr className="border-b border-[#222]">
    <td className="py-2.5 px-3"><div className="w-10 h-6 bg-[#333] animate-pulse" /></td>
    <td className="py-2.5 px-3"><div className="w-32 h-4 bg-[#333] animate-pulse" /></td>
    {scoresAvailable && <td className="py-2.5 px-2 text-right"><div className="w-14 h-4 bg-[#333] animate-pulse ml-auto" /></td>}
    {scoresAvailable && <td className="py-2.5 px-2 text-center"><div className="w-8 h-4 bg-[#333] animate-pulse mx-auto" /></td>}
    <td className="py-2.5 px-3 text-right"><div className="w-20 h-4 bg-[#333] animate-pulse ml-auto" /></td>
  </tr>
));

// Memoized lineup row to prevent unnecessary re-renders
const LineupTableRow = memo(({ caption, value, captionData, onSlotClick, scoresAvailable }) => {
  const hasValue = !!value;
  const [corpsName, sourceYear] = hasValue ? value.split('|') : [null, null];
  const { score, trend, nextShow } = captionData || {};

  return (
    <tr
      onClick={() => onSlotClick(caption.id)}
      className="border-b border-[#222] hover:bg-[#222] cursor-pointer transition-colors"
    >
      {/* Slot Badge */}
      <td className="py-2.5 px-3">
        <span className={`inline-block px-2 py-1 text-[10px] font-bold ${
          hasValue
            ? 'bg-[#0057B8]/20 text-[#0057B8]'
            : 'bg-[#333] text-gray-500'
        }`}>
          {caption.name}
        </span>
      </td>

      {/* Corps Name + Year */}
      <td className="py-2.5 px-3">
        {hasValue ? (
          <div>
            <span className="text-sm text-white">{corpsName}</span>
            {sourceYear && (
              <span className="text-[10px] text-gray-500 ml-1.5">
                '{sourceYear.slice(-2)}
              </span>
            )}
          </div>
        ) : (
          <span className="text-sm text-gray-500 italic">Empty slot</span>
        )}
      </td>

      {/* Last Score */}
      {scoresAvailable && (
        <td className="py-2.5 px-2 text-right">
          {hasValue && score !== null && score !== undefined ? (
            <span className="text-sm font-bold text-white font-data tabular-nums">
              {score.toFixed(2)}
            </span>
          ) : (
            <span className="text-sm text-gray-600">—</span>
          )}
        </td>
      )}

      {/* Trend */}
      {scoresAvailable && (
        <td className="py-2.5 px-2 text-center">
          {hasValue && trend ? (
            <span className={`inline-flex items-center gap-0.5 text-xs font-data tabular-nums ${
              trend.direction === 'up' ? 'text-green-500' :
              trend.direction === 'down' ? 'text-red-500' :
              'text-gray-500'
            }`}>
              {trend.direction === 'up' && <TrendingUp className="w-3 h-3" />}
              {trend.direction === 'down' && <TrendingDown className="w-3 h-3" />}
              {trend.direction === 'same' && <Minus className="w-3 h-3" />}
              {trend.delta}
            </span>
          ) : (
            <span className="text-gray-600">—</span>
          )}
        </td>
      )}

      {/* Next Show (Day + Location) */}
      <td className="py-2.5 px-3 text-right">
        {hasValue && nextShow ? (
          <div className="text-right">
            <span className="text-[10px] text-gray-500 block">Day {nextShow.day}</span>
            <span className="text-[11px] text-gray-400 truncate block max-w-[120px] flex items-center justify-end gap-1">
              <MapPin className="w-3 h-3 flex-shrink-0" />
              <span className="truncate">{nextShow.location}</span>
            </span>
          </div>
        ) : hasValue ? (
          <span className="text-[11px] text-gray-600 flex items-center justify-end gap-1">
            <Lock className="w-3 h-3" />
            Season complete
          </span>
        ) : (
          <span className="text-[11px] text-yellow-500 font-bold">
            + Draft
          </span>
        )}
      </td>
    </tr>
  );
});

const ActiveLineupTable = memo(({
  lineup,
  lineupScoreData,
  loading,
  onManageLineup,
  onSlotClick,
  scoresAvailable = true
}) => {
  const lineupCount = Object.keys(lineup).length;

  return (
    <div className="bg-[#1a1a1a] border border-[#333] overflow-hidden">
      {/* Header */}
      <div className="bg-[#222] px-4 py-3 border-b border-[#333] flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h2 className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
            Active Lineup
          </h2>
          <span className={`text-xs font-bold px-2 py-0.5 ${
            lineupCount === 8
              ? 'bg-green-500/20 text-green-500'
              : 'bg-yellow-500/20 text-yellow-500'
          }`}>
            {lineupCount}/8
          </span>
        </div>
      </div>

      {/* Roster Table */}
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-[#333] bg-[#111]">
              <th className="text-left py-2 px-3 text-[10px] font-bold uppercase tracking-wider text-gray-500 w-16">
                Slot
              </th>
              <th className="text-left py-2 px-3 text-[10px] font-bold uppercase tracking-wider text-gray-500">
                Corps
              </th>
              {scoresAvailable && (
                <th className="text-right py-2 px-2 text-[10px] font-bold uppercase tracking-wider text-gray-500 w-20">
                  Last Score
                </th>
              )}
              {scoresAvailable && (
                <th className="text-center py-2 px-2 text-[10px] font-bold uppercase tracking-wider text-gray-500 w-20">
                  Trend
                </th>
              )}
              <th className="text-right py-2 px-3 text-[10px] font-bold uppercase tracking-wider text-gray-500 w-32">
                Next Show
              </th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              Array.from({ length: 8 }).map((_, i) => <SkeletonRow key={i} scoresAvailable={scoresAvailable} />)
            ) : (
              CAPTIONS.map((caption) => (
                <LineupTableRow
                  key={caption.id}
                  caption={caption}
                  value={lineup[caption.id]}
                  captionData={lineupScoreData?.[caption.id]}
                  onSlotClick={onSlotClick}
                  scoresAvailable={scoresAvailable}
                />
              ))
            )}
          </tbody>
        </table>
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
});

export default ActiveLineupTable;
