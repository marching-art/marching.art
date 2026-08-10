// @ts-nocheck -- grandfathered before checkJs; remove when this file is typed or cleaned up
// Show registration sub-parts: the per-corps selection rows (fantasy + Podium).
// Extracted from ShowRegistrationModal.jsx for file-size hygiene.

import { Check, Landmark, Users } from 'lucide-react';
import { formatEventName } from '../../utils/season';
import { CLASS_CONFIG, sameDayShowFor } from './showRegistrationConfig';

// =============================================================================
// HOSTED SHOW PANEL
// =============================================================================
// Director-hosted shows (design §5.10) are rented by a director and open to
// every class. This panel makes the show read as hosted (not a system/scraped
// show), names the host, and shows how many of the venue's performance slots
// are left — one slot per DISTINCT DIRECTOR, the unit the venue capacity and the
// hosting payout are both measured in (the alt-farm guard). The modal computes
// the slot math and passes it in; this only renders.

export const HostedShowPanel = ({
  hostName,
  capacity,
  slotsFilled,
  slotsAvailable,
  full,
  attendees,
  loading,
}) => (
  <div className="mx-4 mt-4 p-3 bg-surface-sunken border border-cyan-500/30 space-y-3">
    <div className="flex items-start justify-between gap-2">
      <div className="flex items-center gap-2 min-w-0">
        <Landmark className="w-4 h-4 text-cyan-400 flex-shrink-0" />
        <div className="min-w-0">
          <p className="text-xs font-bold text-cyan-400">Director-Hosted Show</p>
          <p className="text-[10px] text-muted truncate">Hosted by {hostName || 'a director'}</p>
        </div>
      </div>
      {capacity != null &&
        (full ? (
          <span className="flex-shrink-0 px-2 py-1 text-[10px] font-bold uppercase bg-red-500/10 text-red-400">
            Full
          </span>
        ) : (
          <span className="flex-shrink-0 px-2 py-1 text-[10px] font-bold uppercase bg-green-500/10 text-green-400 tabular-nums">
            {slotsAvailable} {slotsAvailable === 1 ? 'slot' : 'slots'} open
          </span>
        ))}
    </div>

    {/* Performance-slot meter (distinct directors vs venue capacity) */}
    {capacity != null && (
      <div>
        <div className="flex items-center justify-between text-[10px] text-muted mb-1">
          <span>Performance slots</span>
          <span className="font-data tabular-nums text-secondary">
            {slotsFilled}/{capacity}
          </span>
        </div>
        <div className="h-1.5 bg-line overflow-hidden">
          <div
            className={`h-full ${full ? 'bg-red-400' : 'bg-cyan-400'}`}
            style={{ width: `${Math.min(100, (slotsFilled / capacity) * 100)}%` }}
          />
        </div>
        {full && (
          <p className="mt-1 text-[10px] text-muted">
            The venue is full — corps can still register, but the host is only paid for the first{' '}
            {capacity} directors.
          </p>
        )}
      </div>
    )}

    {/* Attendee roster */}
    <div>
      <div className="flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-wider text-muted mb-2">
        <Users className="w-3 h-3" />
        Attending{attendees ? ` (${attendees.length})` : ''}
      </div>
      {loading && attendees === null ? (
        <div className="text-[10px] text-muted">Loading attendees…</div>
      ) : attendees && attendees.length > 0 ? (
        <div className="space-y-1 max-h-40 overflow-y-auto">
          {attendees.map((a, i) => {
            const config = CLASS_CONFIG[a.corpsClass] || {};
            return (
              <div
                key={`${a.username || a.corpsName}_${a.corpsClass}_${i}`}
                className="flex items-center gap-2 text-[11px]"
              >
                <span className="text-secondary truncate flex-1">{a.corpsName}</span>
                {config.name && (
                  <span
                    className={`flex-shrink-0 text-[9px] px-1 py-0.5 font-bold uppercase ${config.bgColor} ${config.color}`}
                  >
                    {config.shortName || config.name}
                  </span>
                )}
                {a.username && (
                  <span className="text-muted text-[10px] flex-shrink-0">@{a.username}</span>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <div className="text-[10px] text-muted">No corps registered yet — be the first.</div>
      )}
    </div>
  </div>
);

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
            Already attending {formatEventName(sameDayShow.eventName)} this day
          </div>
        )}
      </div>
    </button>
  );
};

export default CorpsSelectionItem;
