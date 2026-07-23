// @ts-nocheck -- grandfathered before checkJs; remove when this file is typed or cleaned up
// Presentational sub-components for the Caption Selection modal.
// Extracted from CaptionSelectionModal.jsx.

import { useState, useEffect } from 'react';
import {
  Check,
  Flame,
  Zap,
  Save,
  Download,
  Trash2,
  ChevronDown,
  ChevronUp,
  History,
  X,
  PartyPopper,
  RefreshCw,
  Lock,
  Search,
} from 'lucide-react';
import { formatEtShort, formatEtDayTime } from '../../utils/seasonClock';
import { useEscapeKey } from '../../hooks/useEscapeKey';
import { Heading } from '../ui';

// -----------------------------------------------------------------------------
// LINEUP CELEBRATION
// -----------------------------------------------------------------------------
const LineupCelebration = ({ onComplete }) => {
  useEffect(() => {
    const timer = setTimeout(onComplete, 2500);
    return () => clearTimeout(timer);
  }, [onComplete]);

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/90">
      <div className="text-center p-8">
        <div className="mb-4">
          <PartyPopper className="w-16 h-16 text-interactive mx-auto" />
        </div>
        <Heading level="display" as="h2" className="mb-2">
          LINEUP LOCKED
        </Heading>
        <p className="text-muted">Your draft is set. Good luck!</p>
      </div>
    </div>
  );
};

// -----------------------------------------------------------------------------
// CORPS OPTION ROW
// -----------------------------------------------------------------------------
const CorpsOptionRow = ({ corps, isSelected, onSelect, disabled, captionHotStatus }) => {
  return (
    <button
      onClick={() => !disabled && onSelect(corps)}
      disabled={disabled}
      className={`w-full min-h-touch flex items-center justify-between px-3 py-2.5 text-left transition-colors ${
        isSelected
          ? 'bg-interactive/10 border-l-2 border-l-interactive'
          : disabled
            ? 'opacity-50 cursor-not-allowed'
            : 'hover:bg-white/5 cursor-pointer'
      }`}
    >
      <div className="flex items-center gap-2 min-w-0 flex-1">
        <div
          className={`w-5 h-5 border-2 flex items-center justify-center flex-shrink-0 rounded-none ${
            isSelected ? 'bg-interactive border-interactive' : 'border-line-strong'
          }`}
        >
          {isSelected && <Check className="w-3 h-3 text-white" />}
        </div>
        <span className="font-medium text-white text-sm truncate">{corps.corpsName}</span>
        <span className="text-[10px] text-muted">
          '{corps.sourceYear != null ? String(corps.sourceYear).slice(-2) : ''}
        </span>
        {captionHotStatus?.isHot && (
          <span
            className="flex items-center gap-0.5 px-1 py-0.5 bg-orange-500/20 text-orange-400 text-[10px] rounded-none"
            title={
              captionHotStatus.improvement > 0
                ? `Up ${captionHotStatus.improvement}% in this caption recently`
                : 'Top performer in this caption recently'
            }
          >
            <Flame className="w-2.5 h-2.5" /> Hot
          </span>
        )}
      </div>
      <div
        className={`text-xs font-data font-bold ${isSelected ? 'text-interactive' : 'text-muted'}`}
      >
        Cost {corps.points}
      </div>
    </button>
  );
};

// -----------------------------------------------------------------------------
// CORPS SELECTION LIST (search box + scrollable option rows)
// -----------------------------------------------------------------------------
const CorpsSelectionList = ({
  corpsList,
  searchValue,
  onSearchChange,
  selections,
  activeCaption,
  activeCaptionSelection,
  totalPoints,
  pointLimit,
  hotCorpsData,
  onSelect,
}) => (
  <>
    {/* Search — 16px text so iOS doesn't zoom on focus, 44px touch height */}
    <div className="px-3 py-2 bg-surface-card border-b border-line flex-shrink-0">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted pointer-events-none" />
        <input
          type="search"
          inputMode="search"
          value={searchValue}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Search corps or year..."
          aria-label="Search available corps"
          className="w-full h-11 pl-9 pr-9 bg-background border border-line rounded-none text-base text-white placeholder-muted focus:border-interactive focus:outline-none"
        />
        {searchValue && (
          <button
            onClick={() => onSearchChange('')}
            className="absolute right-0 top-0 h-11 w-11 flex items-center justify-center text-muted hover:text-white active:text-white"
            aria-label="Clear search"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>

    <div className="flex-1 overflow-y-auto min-h-0">
      {corpsList.length === 0 && (
        <p className="px-4 py-8 text-sm text-muted text-center">
          No corps match &ldquo;{searchValue}&rdquo;
        </p>
      )}
      <div className="divide-y divide-line-subtle">
        {corpsList.map((corps) => {
          const value = `${corps.corpsName}|${corps.sourceYear}|${corps.points}`;
          const isCurrentSel = selections[activeCaption] === value;
          const wouldExceed =
            !isCurrentSel &&
            totalPoints - (activeCaptionSelection?.points || 0) + corps.points > pointLimit;
          // Get caption-specific hot status for this corps
          const corpsId = `${corps.corpsName}|${corps.sourceYear}`;
          const captionHotStatus = hotCorpsData[corpsId]?.[activeCaption];
          return (
            <CorpsOptionRow
              key={value}
              corps={corps}
              isSelected={isCurrentSel}
              onSelect={() => onSelect(corps)}
              disabled={wouldExceed}
              captionHotStatus={captionHotStatus}
            />
          );
        })}
      </div>
      <p className="px-4 py-3 text-[10px] text-muted text-center border-t border-line-subtle">
        Showing this season's draftable corps (cost 50 or less). Cost counts against your budget —
        scores come from real performances.
      </p>
    </div>
  </>
);

// -----------------------------------------------------------------------------
// TEMPLATE MODAL
// -----------------------------------------------------------------------------
const TemplateModal = ({ isOpen, onClose, templates, onSave, onLoad, onDelete, currentLineup }) => {
  const [newTemplateName, setNewTemplateName] = useState('');
  useEscapeKey(onClose, isOpen);
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/80"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Lineup templates"
    >
      <div
        className="w-full max-w-md bg-surface-card border border-line rounded-none"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-line bg-surface-raised">
          <h3 className="text-xs font-bold uppercase tracking-wider text-secondary">
            Lineup Templates
          </h3>
          <button onClick={onClose} className="p-1 text-muted hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-4">
          {/* Save current */}
          <div className="mb-4 p-3 bg-background border border-line">
            <h4 className="text-[10px] font-bold text-muted uppercase tracking-wider mb-2">
              Save Current
            </h4>
            <div className="flex gap-2">
              <input
                type="text"
                value={newTemplateName}
                onChange={(e) => setNewTemplateName(e.target.value)}
                placeholder="Template name..."
                className="flex-1 px-3 py-2 bg-surface-card border border-line text-sm text-white placeholder-muted focus:outline-none focus:border-interactive"
              />
              <button
                onClick={() => {
                  if (newTemplateName.trim()) {
                    onSave(newTemplateName.trim());
                    setNewTemplateName('');
                  }
                }}
                disabled={!newTemplateName.trim() || Object.keys(currentLineup).length === 0}
                className="px-3 py-2 bg-interactive text-white text-sm font-bold hover:bg-interactive-hover disabled:opacity-50"
              >
                <Save className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Saved templates */}
          <div className="space-y-2 max-h-48 overflow-y-auto">
            {templates.length === 0 ? (
              <p className="text-center text-muted py-4 text-sm">No saved templates</p>
            ) : (
              templates.map((template, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between p-2 bg-background border border-line"
                >
                  <div>
                    <div className="font-bold text-white text-sm">{template.name}</div>
                    <div className="text-[10px] text-muted">
                      {Object.keys(template.lineup).length} selections • cost {template.totalPoints}
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => onLoad(template)}
                      className="p-1.5 hover:bg-interactive/20 text-interactive"
                    >
                      <Download className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => onDelete(idx)}
                      className="p-1.5 hover:bg-red-500/20 text-red-400"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="px-4 py-3 border-t border-line bg-surface-sunken flex justify-end">
          <button
            onClick={onClose}
            className="h-9 px-4 bg-interactive text-white text-sm font-bold uppercase tracking-wider hover:bg-interactive-hover"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};

// -----------------------------------------------------------------------------
// DRAFT HELPER
// -----------------------------------------------------------------------------
const DraftHelper = ({ suggestions, onSelectSuggestion, selections, activeCaption }) => {
  const [activeTab, setActiveTab] = useState('hot');
  const [isExpanded, setIsExpanded] = useState(false);

  const tabs = [
    { id: 'hot', label: 'Hot', icon: Flame, color: 'text-orange-400' },
    { id: 'value', label: 'Value', icon: Zap, color: 'text-green-400' },
    { id: 'history', label: 'History', icon: History, color: 'text-interactive' },
  ];

  const currentSuggestions = suggestions[activeTab] || [];

  return (
    <div className="bg-background border border-line">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between p-3 hover:bg-white/5"
      >
        <span className="text-[10px] font-bold uppercase tracking-wider text-muted">
          Draft Helper
        </span>
        {isExpanded ? (
          <ChevronUp className="w-4 h-4 text-muted" />
        ) : (
          <ChevronDown className="w-4 h-4 text-muted" />
        )}
      </button>

      {isExpanded && (
        <>
          <div className="flex border-t border-line">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex-1 flex items-center justify-center gap-1 px-2 py-2 text-[10px] font-bold uppercase transition-colors ${
                    activeTab === tab.id
                      ? `${tab.color} bg-white/5 border-b-2 border-current`
                      : 'text-muted hover:text-muted'
                  }`}
                >
                  <Icon className="w-3 h-3" />
                  {tab.label}
                </button>
              );
            })}
          </div>
          <div className="p-2 space-y-1 max-h-32 overflow-y-auto border-t border-line">
            {currentSuggestions.length === 0 ? (
              <p className="text-center text-muted py-2 text-xs">No suggestions</p>
            ) : (
              currentSuggestions.slice(0, 4).map((corps, idx) => {
                const isAlreadySelected = Object.values(selections).some(
                  (s) => s && s.split('|')[0] === corps.corpsName
                );
                return (
                  <button
                    key={idx}
                    onClick={() =>
                      !isAlreadySelected &&
                      activeCaption &&
                      onSelectSuggestion(corps, activeCaption)
                    }
                    disabled={isAlreadySelected || !activeCaption}
                    className={`w-full flex items-center justify-between p-2 text-xs ${
                      isAlreadySelected || !activeCaption ? 'opacity-50' : 'hover:bg-white/5'
                    }`}
                  >
                    <span className="text-secondary">{corps.corpsName}</span>
                    <span className="text-muted font-data">Cost {corps.points}</span>
                  </button>
                );
              })
            )}
          </div>
        </>
      )}
    </div>
  );
};

// -----------------------------------------------------------------------------
// TRADES REMAINING INDICATOR
// -----------------------------------------------------------------------------
const TradesRemainingIndicator = ({ tradesRemaining, isInitialSetup, changeInfo }) => {
  if (isInitialSetup) {
    return (
      <div className="flex items-center gap-1.5 px-2 py-1 bg-green-500/10 border border-green-500/30 rounded-none">
        <RefreshCw className="w-3 h-3 text-green-400" />
        <span className="text-[10px] font-bold text-green-400 uppercase tracking-wider">
          Initial Setup - Unlimited Changes
        </span>
      </div>
    );
  }

  if (!changeInfo) return null;

  // Nightly lockout: Saturday 8 PM ET (and every championship night) until
  // scores are processed at ~2 AM ET.
  if (changeInfo.status === 'locked') {
    return (
      <div
        className="flex items-center gap-1.5 px-2 py-1 bg-warning/10 border border-warning/30 rounded-none"
        title={`Caption changes reopen once scores are processed (~${formatEtDayTime(changeInfo.reopensAt)})`}
      >
        <Lock className="w-3 h-3 text-warning" />
        <span className="text-[10px] font-bold text-warning uppercase tracking-wider">
          Changes Locked
        </span>
        <span className="text-[9px] text-warning/70 normal-case whitespace-nowrap">
          until scores process (~{formatEtShort(changeInfo.reopensAt)})
        </span>
      </div>
    );
  }

  if (changeInfo.status === 'closed') {
    const isBlackout = changeInfo.phase === 'blackout';
    // Championship + closed means this class has finished competing for the
    // season (Open/A wrap after Day 47, World/SoundSport after Day 49).
    const isClassDone = changeInfo.phase === 'championship';
    let title;
    let label;
    if (isBlackout) {
      title = `No caption changes on Days 43-44. Championship changes (${changeInfo.nextLimit}) open ${formatEtDayTime(changeInfo.reopensAt)}`;
      label = 'Changes Closed (Days 43-44)';
    } else if (isClassDone) {
      title = 'This class has finished competing for the season — its caption changes are closed.';
      label = 'Class Season Complete';
    } else {
      title = 'The season has ended — changes reopen next season';
      label = 'Season Complete';
    }
    return (
      <div
        className="flex items-center gap-1.5 px-2 py-1 bg-red-500/10 border border-red-500/30 rounded-none"
        title={title}
      >
        <Lock className="w-3 h-3 text-red-400" />
        <span className="text-[10px] font-bold text-red-400 uppercase tracking-wider">{label}</span>
        {isBlackout && (
          <span className="text-[9px] text-red-400/70 normal-case whitespace-nowrap">
            reopen {formatEtShort(changeInfo.reopensAt)}
          </span>
        )}
      </div>
    );
  }

  if (changeInfo.phase === 'unlimited') {
    return (
      <div
        className="flex items-center gap-1.5 px-2 py-1 bg-interactive/10 border border-interactive/30 rounded-none"
        title={
          changeInfo.unlimitedEndsAt
            ? `Weekly limits begin ${formatEtDayTime(changeInfo.unlimitedEndsAt)}`
            : undefined
        }
      >
        <RefreshCw className="w-3 h-3 text-interactive" />
        <span className="text-[10px] font-bold text-interactive uppercase tracking-wider">
          Unlimited Changes
        </span>
        {changeInfo.unlimitedEndsAt && (
          <span className="text-[9px] text-interactive/70 normal-case whitespace-nowrap">
            until {formatEtShort(changeInfo.unlimitedEndsAt)}
          </span>
        )}
      </div>
    );
  }

  const isChampionship = changeInfo.phase === 'championship';
  const isLow = tradesRemaining <= 1;
  const colorClass = isLow
    ? 'text-warning border-warning/30 bg-warning/10'
    : 'text-muted border-line bg-surface-raised';

  if (isChampionship) {
    return (
      <div
        className={`flex items-center gap-1.5 px-2 py-1 border rounded-none ${colorClass}`}
        title={`${changeInfo.tradeLimit} caption changes per day during Championship Week (Days 45-49). Changes lock nightly at ${formatEtDayTime(changeInfo.locksAt)} until scores process.`}
      >
        <RefreshCw className="w-3 h-3" />
        <span className="text-[10px] font-bold uppercase tracking-wider">
          {tradesRemaining} of {changeInfo.tradeLimit} Championship Changes Left
        </span>
        {changeInfo.locksAt && (
          <span className="text-[9px] opacity-70 normal-case whitespace-nowrap">
            lock {formatEtShort(changeInfo.locksAt)}
          </span>
        )}
      </div>
    );
  }

  return (
    <div
      className={`flex items-center gap-1.5 px-2 py-1 border rounded-none ${colorClass}`}
      title={
        changeInfo.resetsAt
          ? `Change limit resets ${formatEtDayTime(changeInfo.resetsAt)}. Changes lock ${formatEtDayTime(changeInfo.locksAt)} until scores process.`
          : undefined
      }
    >
      <RefreshCw className="w-3 h-3" />
      <span className="text-[10px] font-bold uppercase tracking-wider">
        {tradesRemaining} Change{tradesRemaining !== 1 ? 's' : ''} Left This Week
      </span>
      {changeInfo.resetsAt && (
        <span className="text-[9px] opacity-70 normal-case whitespace-nowrap">
          resets {formatEtShort(changeInfo.resetsAt)}
        </span>
      )}
    </div>
  );
};

// -----------------------------------------------------------------------------
// CAPTION BUTTON (for Your Lineup panel)
// -----------------------------------------------------------------------------
const CaptionButton = ({ caption, selected, isActive, onClick, categoryColor }) => {
  const hasValue = !!selected;

  return (
    <button
      onClick={onClick}
      className={`w-full min-h-touch flex items-center justify-between p-2.5 border transition-all ${
        isActive
          ? 'border-interactive bg-interactive/10'
          : hasValue
            ? 'border-green-500/30 bg-green-500/5 hover:border-interactive hover:bg-interactive/10'
            : 'border-line hover:border-interactive hover:bg-interactive/10'
      }`}
    >
      <div className="flex items-center gap-2 min-w-0">
        <div className={`w-1.5 h-4 rounded-none ${categoryColor}`} />
        <div className="text-left min-w-0">
          <div className="text-xs font-bold text-white">{caption.id}</div>
          <div className="text-[10px] text-muted truncate">{caption.name}</div>
        </div>
      </div>
      {hasValue ? (
        <div className="flex items-center gap-2">
          <div className="text-right min-w-0">
            <div className="text-xs text-white truncate max-w-[100px]">{selected.name}</div>
            <div className="text-[10px] font-data text-interactive">Cost {selected.points}</div>
          </div>
          <Check className="w-4 h-4 text-green-500 flex-shrink-0" />
        </div>
      ) : (
        <div className="text-[10px] text-interactive font-bold">+ DRAFT</div>
      )}
    </button>
  );
};

// -----------------------------------------------------------------------------
// MAIN MODAL
// -----------------------------------------------------------------------------

export {
  LineupCelebration,
  CorpsOptionRow,
  CorpsSelectionList,
  TemplateModal,
  DraftHelper,
  TradesRemainingIndicator,
  CaptionButton,
};
