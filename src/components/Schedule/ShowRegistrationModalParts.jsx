// @ts-nocheck -- grandfathered before checkJs; remove when this file is typed or cleaned up
// Show registration sub-parts: the per-corps selection rows (fantasy + Podium).
// Extracted from ShowRegistrationModal.jsx for file-size hygiene.

import { Check } from 'lucide-react';
import { CLASS_CONFIG, sameDayShowFor } from './showRegistrationConfig';

// =============================================================================
// PODIUM SELECTION ROW
// =============================================================================
// The Podium corps' day-based tour pick — separate rules from fantasy lineups.
// All state/gating is computed in the modal; this renders it.

export const PodiumSelectionRow = ({
  info,
  attend,
  atMax,
  isMyAutoDay,
  isEasternOffNight,
  isPast,
  picksThisWeek,
  maxPicks,
  autoSlotNote,
  onToggle,
}) => {
  const disabled = isMyAutoDay || isEasternOffNight || isPast;
  return (
    <button
      onClick={onToggle}
      disabled={disabled}
      className={`
        flex items-center gap-3 p-4 w-full text-left transition-colors min-h-[60px]
        ${attend ? 'bg-brand/5 border-l-2 border-l-brand' : 'hover:bg-white/5 active:bg-white/10'}
        ${disabled ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'}
      `}
    >
      <div
        className={`
        w-5 h-5 border-2 flex items-center justify-center flex-shrink-0
        ${attend || isMyAutoDay ? 'bg-brand border-brand' : 'border-line-strong'}
      `}
      >
        {(attend || isMyAutoDay) && <Check className="w-3.5 h-3.5 text-black" />}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-bold text-white text-sm truncate">{info.corpsName}</span>
          <span className="text-[10px] font-bold uppercase text-brand">Podium</span>
        </div>
        <div className="mt-0.5 flex items-center gap-2">
          <span className={`text-[11px] ${atMax ? 'text-red-400' : 'text-muted'}`}>
            {isMyAutoDay
              ? 'Auto-attended — major / championship'
              : isEasternOffNight
                ? 'Eastern Classic — not your assigned night'
                : isPast
                  ? 'This day has passed'
                  : `${picksThisWeek}/${maxPicks} tour picks this week` +
                    (autoSlotNote ? ` · ${autoSlotNote}` : '')}
          </span>
          {atMax && (
            <span className="text-[10px] text-red-400 font-bold px-1.5 py-0.5 bg-red-400/10">
              MAX
            </span>
          )}
        </div>
      </div>
    </button>
  );
};

// =============================================================================
// CORPS SELECTION ITEM
// =============================================================================

const CorpsSelectionItem = ({
  corpsClass,
  corpsData,
  isSelected,
  onToggle,
  show,
  isDisabled,
  maxShows,
}) => {
  const config = CLASS_CONFIG[corpsClass] || { name: corpsClass, color: 'text-muted' };
  const weekKey = `week${show.week}`;
  const currentShows = corpsData.selectedShows?.[weekKey] || [];
  const showsThisWeek = currentShows.length;
  const isAtMax = showsThisWeek >= maxShows;
  // Match by eventName only - dates can have type mismatches (Timestamp vs string)
  const isAlreadyAtShow = currentShows.some((s) => s.eventName === show.eventName);
  // A different show already on this day — one show per corps per day, so this
  // row can't be added no matter how much weekly budget remains.
  const sameDayShow = isAlreadyAtShow
    ? undefined
    : sameDayShowFor(currentShows, show.day, show.eventName);

  return (
    <button
      onClick={() => !isDisabled && onToggle(corpsClass)}
      disabled={isDisabled}
      className={`
        flex items-center gap-3 p-4 w-full text-left transition-colors min-h-[60px]
        ${
          isSelected
            ? 'bg-interactive/10 border-l-2 border-l-interactive'
            : 'hover:bg-white/5 active:bg-white/10'
        }
        ${isDisabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
      `}
    >
      {/* Checkbox */}
      <div
        className={`
        w-5 h-5 border-2 flex items-center justify-center flex-shrink-0
        ${isSelected ? 'bg-interactive border-interactive' : 'border-line-strong'}
      `}
      >
        {isSelected && <Check className="w-3.5 h-3.5 text-white" />}
      </div>

      {/* Corps Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-bold text-white text-sm truncate">
            {corpsData.corpsName || corpsData.name || 'Unnamed Corps'}
          </span>
          <span className={`text-[10px] font-bold uppercase ${config.color}`}>
            {config.shortName}
          </span>
        </div>
        <div className="flex items-center gap-2 mt-0.5">
          <span
            className={`text-[11px] ${isAtMax && !isAlreadyAtShow ? 'text-red-400' : 'text-muted'}`}
          >
            {showsThisWeek}/{maxShows} shows this week
          </span>
          {isAtMax && !isAlreadyAtShow && (
            <span className="text-[10px] text-red-400 font-bold px-1.5 py-0.5 bg-red-400/10">
              MAX
            </span>
          )}
        </div>
        {sameDayShow && (
          <div className="mt-0.5 text-[10px] text-red-400 truncate">
            Already attending {sameDayShow.eventName} this day
          </div>
        )}
      </div>
    </button>
  );
};

export default CorpsSelectionItem;
