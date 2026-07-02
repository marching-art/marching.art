// Presentational sections for the Scores page: pill tabs, recap data grid,
// SoundSport medal list, and class standings grid. Extracted verbatim from
// Scores.jsx.

import React, { useMemo, memo } from 'react';
import { Link } from 'react-router-dom';
import {
  Trophy, TrendingUp, TrendingDown, Music,
  ChevronRight, MapPin, Medal, Users,
} from 'lucide-react';
import { TeamAvatar } from '../components/ui/TeamAvatar';
import { formatEventName } from '../utils/season';
import {
  RATING_CONFIG,
  getSoundSportRating,
  seededShuffle,
  getCaptionBreakdown,
} from '../utils/scoresUtils';

const BlueRibbonIcon = ({ className = "w-5 h-5" }) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    className={className}
    xmlns="http://www.w3.org/2000/svg"
  >
    {/* Ribbon circle/badge */}
    <circle cx="12" cy="9" r="7" fill="#0057B8" stroke="#003d82" strokeWidth="1" />
    {/* Inner circle highlight */}
    <circle cx="12" cy="9" r="4" fill="#0066d6" />
    {/* Star in center */}
    <path
      d="M12 5.5l1.09 2.21 2.44.35-1.77 1.72.42 2.43L12 11.1l-2.18 1.15.42-2.43-1.77-1.72 2.44-.35L12 5.5z"
      fill="#FFD700"
    />
    {/* Ribbon tails */}
    <path d="M8 15l-2 7 4-2.5V15H8z" fill="#0057B8" stroke="#003d82" strokeWidth="0.5" />
    <path d="M16 15l2 7-4-2.5V15h2z" fill="#0057B8" stroke="#003d82" strokeWidth="0.5" />
  </svg>
);

// =============================================================================
// PILL TAB CONTROL (Design System)
// =============================================================================

const PillTabControl = ({ tabs, activeTab, onTabChange, haptic }) => (
  <div className="flex items-center overflow-x-auto scrollbar-hide bg-transparent border-b border-[#333]">
    {tabs.map((tab) => (
      <button
        key={tab.id}
        onClick={() => { haptic?.('medium'); onTabChange(tab.id); }}
        className={`px-3 sm:px-4 py-2.5 text-[10px] font-bold uppercase tracking-wider transition-all whitespace-nowrap flex-shrink-0 border-b-2 -mb-px ${
          activeTab === tab.id
            ? tab.accent === 'green'
              ? 'text-green-400 border-green-500'
              : tab.accent === 'yellow'
              ? 'text-yellow-400 border-yellow-500'
              : 'text-white border-[#0057B8]'
            : 'text-gray-500 hover:text-gray-300 border-transparent'
        }`}
      >
        {tab.label}
      </button>
    ))}
  </div>
);

// =============================================================================
// RECAP DATA GRID - HIGH DENSITY TABLE
// OPTIMIZATION #3: Memoized to prevent re-renders when sibling recap grids update
// =============================================================================

const RecapDataGrid = memo(({
  scores,
  eventName,
  location,
  date,
  userCorpsName
}) => {
  // Pre-compute all caption breakdowns once (real data only, no synthetic values)
  const captionMap = useMemo(() => {
    if (!scores || scores.length === 0) return new Map();
    return new Map(
      scores.map((score, idx) => [idx, getCaptionBreakdown(score)])
    );
  }, [scores]);

  if (!scores || scores.length === 0) return null;

  return (
    <div className="border-b border-[#333]">
      {/* Event Header - Super Row integrated with table */}
      <div className="bg-[#222] px-4 py-2.5 flex items-center justify-between">
        <div className="flex items-center gap-2 min-w-0">
          <span className="font-bold text-white text-sm truncate">{formatEventName(eventName)}</span>
          <span className="text-gray-500 text-xs hidden sm:flex items-center gap-1">
            <MapPin className="w-3 h-3" />
            {location}
          </span>
        </div>
        <span className="text-[10px] text-gray-500 font-data tabular-nums flex-shrink-0">
          {date}
        </span>
      </div>

      {/* Data Grid - Column headers immediately below event header */}
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="bg-[#1a1a1a] border-t border-[#333]">
              <th className="text-left py-2 px-2 text-[10px] font-bold uppercase tracking-wider text-gray-500 w-10">
                #
              </th>
              <th className="text-left py-2 px-2 text-[10px] font-bold uppercase tracking-wider text-gray-500">
                Corps
              </th>
              <th className="text-right py-2 px-2 text-[10px] font-bold uppercase tracking-wider text-gray-500 w-14">
                GE
              </th>
              <th className="text-right py-2 px-2 text-[10px] font-bold uppercase tracking-wider text-gray-500 w-14">
                VIS
              </th>
              <th className="text-right py-2 px-2 text-[10px] font-bold uppercase tracking-wider text-gray-500 w-14">
                MUS
              </th>
              <th className="text-right py-2 px-3 text-[10px] font-bold uppercase tracking-wider text-gray-500 w-20">
                Total
              </th>
            </tr>
          </thead>
          <tbody>
            {scores.map((score, idx) => {
              const captions = captionMap.get(idx);
              const isUserCorps = userCorpsName &&
                (score.corps?.toLowerCase() === userCorpsName.toLowerCase() ||
                 score.corpsName?.toLowerCase() === userCorpsName.toLowerCase());
              const rowBg = idx % 2 === 0 ? 'bg-[#1a1a1a]' : 'bg-[#111]';

              return (
                <tr
                  key={idx}
                  className={rowBg}
                >
                  {/* Rank */}
                  <td className="py-2 px-2">
                    <span className="w-6 h-6 bg-[#222] border border-[#333] flex items-center justify-center text-[10px] font-bold text-gray-400 tabular-nums">
                      {idx + 1}
                    </span>
                  </td>

                  {/* Corps + Location */}
                  <td className="py-2 px-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <TeamAvatar name={score.corpsName || score.corps} logoUrl={score.avatarUrl} size="xs" />
                      <div className="min-w-0">
                        <span className="font-bold text-white text-sm block truncate">
                          {score.corpsName || score.corps}
                        </span>
                        {score.displayName && (
                          score.uid ? (
                            <Link
                              to={`/profile/${score.uid}`}
                              className="text-[10px] text-gray-500 hover:text-[#0057B8] block truncate"
                            >
                              {score.displayName}
                            </Link>
                          ) : (
                            <span className="text-[10px] text-gray-500 block truncate">
                              {score.displayName}
                            </span>
                          )
                        )}
                      </div>
                    </div>
                  </td>

                  {/* GE */}
                  <td className="py-2 px-2 text-right">
                    <span className="text-gray-400 font-data tabular-nums text-sm">
                      {captions.ge !== null ? captions.ge.toFixed(2) : '-'}
                    </span>
                  </td>

                  {/* VIS */}
                  <td className="py-2 px-2 text-right">
                    <span className="text-gray-400 font-data tabular-nums text-sm">
                      {captions.vis !== null ? captions.vis.toFixed(2) : '-'}
                    </span>
                  </td>

                  {/* MUS */}
                  <td className="py-2 px-2 text-right">
                    <span className="text-gray-400 font-data tabular-nums text-sm">
                      {captions.mus !== null ? captions.mus.toFixed(2) : '-'}
                    </span>
                  </td>

                  {/* Total */}
                  <td className="py-2 px-3 text-right">
                    <span className="font-bold text-white font-data tabular-nums text-sm">
                      {(score.score || score.totalScore || 0).toFixed(3)}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
});

// =============================================================================
// SOUNDSPORT MEDAL LIST - GROUPED BY EVENT
// =============================================================================

// Mock event names for shows that may not have proper names
const MOCK_EVENT_NAMES = [
  'SoundSport International Music & Food Festival',
  'DCI Indianapolis SoundSport',
  'Atlanta SoundSport Showcase',
  'Midwest SoundSport Classic',
  'SoundSport Championship Series',
  'Summer Music Games SoundSport',
];

const SoundSportMedalList = ({ shows }) => {
  // Group results by event, preserving show context
  const groupedResults = useMemo(() => {
    const groups = [];
    let mockNameIndex = 0;

    shows
      .filter(show => show.scores?.some(s => s.corpsClass === 'soundSport'))
      .forEach((show) => {
        const soundSportScores = show.scores
          .filter(s => s.corpsClass === 'soundSport')
          .map((score) => ({
            ...score,
            rating: getSoundSportRating(score.score),
          }));

        if (soundSportScores.length > 0) {
          // Find best in show (highest score at this event)
          const maxScore = Math.max(...soundSportScores.map(s => s.score || 0));
          const bestInShowCorps = soundSportScores.find(s => s.score === maxScore)?.corps ||
                                  soundSportScores.find(s => s.score === maxScore)?.corpsName;

          // Mark best in show
          soundSportScores.forEach(score => {
            const corpsName = score.corps || score.corpsName;
            score.isBestInShow = corpsName === bestInShowCorps;
          });

          // Use show eventName or mock one for display
          const eventName = show.eventName || MOCK_EVENT_NAMES[mockNameIndex % MOCK_EVENT_NAMES.length];

          // Shuffle to avoid implied rankings (SoundSport is rating-based, not placement-based)
          // Use deterministic shuffle so order is consistent on re-renders
          const shuffledScores = seededShuffle(soundSportScores, eventName);
          mockNameIndex++;

          groups.push({
            eventName,
            date: show.date || 'TBD',
            location: show.location || 'Various Locations',
            scores: shuffledScores,
          });
        }
      });

    return groups;
  }, [shows]);

  // Aggregate stats across all groups
  const stats = useMemo(() => {
    const counts = { Gold: 0, Silver: 0, Bronze: 0, Participation: 0, total: 0 };
    groupedResults.forEach(group => {
      group.scores.forEach(r => {
        counts[r.rating]++;
        counts.total++;
      });
    });
    return counts;
  }, [groupedResults]);

  if (groupedResults.length === 0) {
    return (
      <div className="p-8 text-center">
        <Music className="w-8 h-8 text-gray-600 mx-auto mb-2" />
        <p className="text-gray-500 text-sm">No SoundSport results yet</p>
      </div>
    );
  }

  return (
    <div>
      {/* Stats Bar */}
      <div className="bg-[#1a1a1a] px-4 py-3 border-b border-[#333] flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Music className="w-4 h-4 text-green-500" />
          <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
            SoundSport Results
          </span>
        </div>
        <div className="flex items-center gap-3 text-[10px]">
          <span className="flex items-center gap-1 text-yellow-500">
            <Medal className="w-3 h-3" />
            {stats.Gold}
          </span>
          <span className="flex items-center gap-1 text-gray-300">
            <Medal className="w-3 h-3" />
            {stats.Silver}
          </span>
          <span className="flex items-center gap-1 text-orange-400">
            <Medal className="w-3 h-3" />
            {stats.Bronze}
          </span>
          <span className="text-gray-500">
            <Users className="w-3 h-3 inline mr-1" />
            {stats.total}
          </span>
        </div>
      </div>

      {/* Grouped Results by Event */}
      {groupedResults.map((group, groupIdx) => (
        <div key={groupIdx}>
          {/* Event Header */}
          <div className="bg-[#222] px-4 py-2.5 flex items-center justify-between">
            <div className="flex items-center gap-2 min-w-0">
              <span className="font-bold text-white text-sm truncate">{formatEventName(group.eventName)}</span>
              <span className="text-gray-500 text-xs hidden sm:flex items-center gap-1">
                <MapPin className="w-3 h-3" />
                {group.location}
              </span>
            </div>
            <span className="text-[10px] text-gray-500 font-data tabular-nums flex-shrink-0">
              {group.date}
            </span>
          </div>

          {/* Medal List - Compact Rows within Group */}
          <div>
            {group.scores.map((result, idx) => {
              const config = RATING_CONFIG[result.rating];
              const rowBg = idx % 2 === 0 ? 'bg-[#1a1a1a]' : 'bg-[#111]';

              return (
                <div
                  key={idx}
                  className={`${rowBg} px-4 py-2.5 flex items-center justify-between hover:bg-[#222] transition-colors`}
                >
                  {/* Left: Medal Icon + Avatar + Ensemble Name + Director */}
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={`w-6 h-6 ${config.bg} flex items-center justify-center flex-shrink-0`}>
                      <Medal className={`w-4 h-4 ${config.text}`} />
                    </div>
                    <TeamAvatar name={result.corps || result.corpsName} logoUrl={result.avatarUrl} size="xs" />
                    <div className="min-w-0">
                      <span className="font-bold text-white text-sm block truncate">
                        {result.corps || result.corpsName}
                      </span>
                      {result.displayName && (
                        result.uid ? (
                          <Link
                            to={`/profile/${result.uid}`}
                            className="text-[10px] text-gray-500 hover:text-[#0057B8] block truncate"
                          >
                            {result.displayName}
                          </Link>
                        ) : (
                          <span className="text-[10px] text-gray-500 block truncate">
                            {result.displayName}
                          </span>
                        )
                      )}
                    </div>
                  </div>

                  {/* Right: Best in Show + Rating Badge */}
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {result.isBestInShow && (
                      <BlueRibbonIcon className="w-5 h-5" />
                    )}
                    <span className={`text-[10px] font-bold uppercase px-2 py-1 ${config.badge}`}>
                      {result.rating}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}

      {/* Learn More Link */}
      <div className="px-4 py-3 bg-[#111] border-t border-[#333]">
        <Link
          to="/soundsport"
          className="flex items-center gap-2 text-xs text-green-400 hover:text-green-300 font-bold transition-colors"
        >
          Learn about SoundSport scoring
          <ChevronRight className="w-3 h-3" />
        </Link>
      </div>
    </div>
  );
};

// =============================================================================
// STANDINGS TABLE FOR CLASS TABS
// =============================================================================

const ClassStandingsGrid = ({
  standings,
  className,
  userCorpsName
}) => {
  // Pre-compute all caption breakdowns once (real data only, no synthetic values)
  const captionMap = useMemo(() => {
    if (!standings || standings.length === 0) return new Map();
    return new Map(
      standings.map((entry, idx) => [idx, getCaptionBreakdown(entry.scores?.[0] || entry)])
    );
  }, [standings]);

  if (!standings || standings.length === 0) {
    return (
      <div className="p-8 text-center">
        <Trophy className="w-8 h-8 text-gray-600 mx-auto mb-2" />
        <p className="text-gray-500 text-sm">No {className} standings yet</p>
      </div>
    );
  }

  return (
    <div>
      {/* Section Header */}
      <div className="bg-[#1a1a1a] px-4 py-3 border-b border-[#333] flex items-center justify-between">
        <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
          {className} Season Standings
        </span>
        <span className="text-[10px] text-gray-500">
          {standings.length} corps
        </span>
      </div>

      {/* Data Grid */}
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="bg-[#111]">
              <th className="text-left py-2 px-2 text-[10px] font-bold uppercase tracking-wider text-gray-500 w-10">
                #
              </th>
              <th className="text-left py-2 px-2 text-[10px] font-bold uppercase tracking-wider text-gray-500">
                Corps
              </th>
              <th className="text-right py-2 px-2 text-[10px] font-bold uppercase tracking-wider text-gray-500 w-14">
                GE
              </th>
              <th className="text-right py-2 px-2 text-[10px] font-bold uppercase tracking-wider text-gray-500 w-14">
                VIS
              </th>
              <th className="text-right py-2 px-2 text-[10px] font-bold uppercase tracking-wider text-gray-500 w-14">
                MUS
              </th>
              <th className="text-right py-2 px-2 text-[10px] font-bold uppercase tracking-wider text-gray-500 w-20">
                Avg
              </th>
              <th className="text-center py-2 px-2 text-[10px] font-bold uppercase tracking-wider text-gray-500 w-12">
                +/-
              </th>
            </tr>
          </thead>
          <tbody>
            {standings.map((entry, idx) => {
              const captions = captionMap.get(idx);
              const isUserCorps = userCorpsName &&
                entry.corpsName?.toLowerCase() === userCorpsName.toLowerCase();
              const rowBg = idx % 2 === 0 ? 'bg-[#1a1a1a]' : 'bg-[#111]';
              const trend = entry.trend?.direction || 0;

              return (
                <tr
                  key={entry.corpsName || idx}
                  className={rowBg}
                >
                  {/* Rank */}
                  <td className="py-2.5 px-2">
                    <span className="w-6 h-6 bg-[#222] border border-[#333] flex items-center justify-center text-[10px] font-bold text-gray-400 tabular-nums">
                      {entry.rank}
                    </span>
                  </td>

                  {/* Corps */}
                  <td className="py-2.5 px-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <TeamAvatar name={entry.corpsName} logoUrl={entry.avatarUrl} size="xs" />
                      <div className="min-w-0">
                        <span className="font-bold text-white text-sm block truncate">
                          {entry.corpsName}
                        </span>
                        {entry.displayName && (
                          entry.uid ? (
                            <Link
                              to={`/profile/${entry.uid}`}
                              className="text-[10px] text-gray-500 hover:text-[#0057B8] block truncate"
                            >
                              {entry.displayName}
                            </Link>
                          ) : (
                            <span className="text-[10px] text-gray-500 block truncate">
                              {entry.displayName}
                            </span>
                          )
                        )}
                      </div>
                    </div>
                  </td>

                  {/* GE */}
                  <td className="py-2.5 px-2 text-right">
                    <span className="text-gray-400 font-data tabular-nums text-sm">
                      {captions.ge !== null ? captions.ge.toFixed(2) : '-'}
                    </span>
                  </td>

                  {/* VIS */}
                  <td className="py-2.5 px-2 text-right">
                    <span className="text-gray-400 font-data tabular-nums text-sm">
                      {captions.vis !== null ? captions.vis.toFixed(2) : '-'}
                    </span>
                  </td>

                  {/* MUS */}
                  <td className="py-2.5 px-2 text-right">
                    <span className="text-gray-400 font-data tabular-nums text-sm">
                      {captions.mus !== null ? captions.mus.toFixed(2) : '-'}
                    </span>
                  </td>

                  {/* Avg Score */}
                  <td className="py-2.5 px-2 text-right">
                    <span className="font-bold text-white font-data tabular-nums text-sm">
                      {typeof entry.score === 'number' ? entry.score.toFixed(3) : '-'}
                    </span>
                  </td>

                  {/* Trend */}
                  <td className="py-2.5 px-2 text-center">
                    {trend > 0 ? (
                      <TrendingUp className="w-3.5 h-3.5 text-green-500 mx-auto" />
                    ) : trend < 0 ? (
                      <TrendingDown className="w-3.5 h-3.5 text-red-500 mx-auto" />
                    ) : (
                      <span className="text-gray-600 text-xs">-</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export { BlueRibbonIcon, PillTabControl, RecapDataGrid, SoundSportMedalList, ClassStandingsGrid };
