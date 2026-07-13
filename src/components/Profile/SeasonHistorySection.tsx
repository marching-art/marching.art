// =============================================================================
// SEASON HISTORY - the corps history archive on the director profile
// =============================================================================
// Every archived season: placement, final score, and the show that was
// performed (title + program style from the archived show concept). Class
// filter tabs appear once a director has history in more than one class, so
// each corps' story reads as its own timeline.

import React, { useMemo, useState } from 'react';
import { Swords, Calendar } from 'lucide-react';
import type { CorpsClass } from '../../types';
import { SeasonRow, EmptyWithCTA } from './DirectorProfileParts';
import { getClassDisplay, type SeasonHistoryEntry } from './directorProfileHelpers';

const CLASS_TAB_ORDER: CorpsClass[] = [
  'worldClass',
  'openClass',
  'aClass',
  'soundSport',
  'podiumClass',
];

const SeasonHistorySection = ({ seasons }: { seasons: SeasonHistoryEntry[] }) => {
  const [classFilter, setClassFilter] = useState<CorpsClass | 'all'>('all');
  const [expandedSeason, setExpandedSeason] = useState<string | null>(null);

  // Only offer tabs for classes that actually have history
  const classesWithHistory = useMemo(
    () => CLASS_TAB_ORDER.filter((cls) => seasons.some((s) => s.classKey === cls)),
    [seasons]
  );

  const visibleSeasons = useMemo(
    () => (classFilter === 'all' ? seasons : seasons.filter((s) => s.classKey === classFilter)),
    [seasons, classFilter]
  );

  return (
    <div className="bg-surface-card border border-line">
      <div className="px-3 py-2 border-b border-line bg-surface-raised flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <Swords className="w-3.5 h-3.5 text-interactive" />
          <span className="text-[10px] font-bold uppercase tracking-wider text-muted">
            Season History
          </span>
        </div>
        <span className="text-[9px] text-muted">
          {visibleSeasons.length} season{visibleSeasons.length === 1 ? '' : 's'}
        </span>
      </div>

      {/* Class tabs (only when there is history in more than one class) */}
      {classesWithHistory.length > 1 && (
        <div className="flex border-b border-line bg-surface-sunken">
          {(['all', ...classesWithHistory] as (CorpsClass | 'all')[]).map((cls) => {
            const isActive = classFilter === cls;
            const label = cls === 'all' ? 'All' : getClassDisplay(cls).short;
            return (
              <button
                key={cls}
                type="button"
                onClick={() => setClassFilter(cls)}
                className={`flex-1 py-2 text-[10px] font-bold uppercase tracking-wider transition-colors ${
                  isActive
                    ? 'text-white border-b-2 border-interactive bg-white/5'
                    : 'text-muted hover:text-secondary'
                }`}
              >
                {label}
              </button>
            );
          })}
        </div>
      )}

      {visibleSeasons.length > 0 ? (
        <div className="max-h-64 overflow-y-auto">
          {visibleSeasons.map((season) => {
            const key = `${season.classKey}-${season.seasonId}`;
            return (
              <SeasonRow
                key={key}
                season={season}
                isExpanded={expandedSeason === key}
                onToggle={() => setExpandedSeason(expandedSeason === key ? null : key)}
              />
            );
          })}
        </div>
      ) : (
        <EmptyWithCTA
          icon={Calendar}
          title="No season history yet"
          cta="Find your first show"
          to="/schedule"
        />
      )}
    </div>
  );
};

export default SeasonHistorySection;
