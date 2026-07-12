// Show registration sub-parts: the per-corps selection row. Extracted from
// ShowRegistrationModal.jsx for file-size hygiene.

import { Check } from 'lucide-react';
import { CLASS_CONFIG } from './showRegistrationConfig';

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
  const config = CLASS_CONFIG[corpsClass] || { name: corpsClass, color: 'text-gray-400' };
  const weekKey = `week${show.week}`;
  const currentShows = corpsData.selectedShows?.[weekKey] || [];
  const showsThisWeek = currentShows.length;
  const isAtMax = showsThisWeek >= maxShows;
  // Match by eventName only - dates can have type mismatches (Timestamp vs string)
  const isAlreadyAtShow = currentShows.some((s) => s.eventName === show.eventName);

  return (
    <button
      onClick={() => !isDisabled && onToggle(corpsClass)}
      disabled={isDisabled}
      className={`
        flex items-center gap-3 p-4 w-full text-left transition-colors min-h-[60px]
        ${
          isSelected
            ? 'bg-[#0057B8]/10 border-l-2 border-l-[#0057B8]'
            : 'hover:bg-white/5 active:bg-white/10'
        }
        ${isDisabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
      `}
    >
      {/* Checkbox */}
      <div
        className={`
        w-5 h-5 border-2 flex items-center justify-center flex-shrink-0
        ${isSelected ? 'bg-[#0057B8] border-[#0057B8]' : 'border-[#444]'}
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
      </div>
    </button>
  );
};

export default CorpsSelectionItem;
