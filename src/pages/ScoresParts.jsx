// Presentational sections for the Scores page: pill tabs, recap data grid,
// SoundSport medal list, and class standings grid. Extracted verbatim from
// Scores.jsx.

import React, { useMemo, memo, useRef, useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  Trophy,
  TrendingUp,
  TrendingDown,
  Music,
  ChevronRight,
  MapPin,
  Medal,
  Users,
} from 'lucide-react';
import { TeamAvatar } from '../components/ui/TeamAvatar';
import { formatEventName } from '../utils/season';
import {
  RATING_CONFIG,
  getSoundSportRating,
  seededShuffle,
  getCaptionBreakdown,
  mergeTwoNightShows,
} from '../utils/scoresUtils';

const BlueRibbonIcon = ({ className = 'w-5 h-5' }) => (
  <svg viewBox="0 0 24 24" fill="none" className={className} xmlns="http://www.w3.org/2000/svg">
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

const PillTabControl = ({ tabs, activeTab, onTabChange, haptic }) => {
  const scrollRef = useRef(null);
  const [canScrollRight, setCanScrollRight] = useState(false);

  // Right-edge fade hint when tabs overflow off-screen (matches DataTable's
  // scroll-hint pattern) — without it, off-screen tabs are undiscoverable.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const checkScroll = () => {
      const hasMore = el.scrollWidth > el.clientWidth;
      const notAtEnd = el.scrollLeft < el.scrollWidth - el.clientWidth - 1;
      setCanScrollRight(hasMore && notAtEnd);
    };
    checkScroll();
    window.addEventListener('resize', checkScroll);
    el.addEventListener('scroll', checkScroll);
    return () => {
      window.removeEventListener('resize', checkScroll);
      el.removeEventListener('scroll', checkScroll);
    };
  }, [tabs]);

  return (
    <div className="relative">
      <div
        ref={scrollRef}
        className="flex items-center overflow-x-auto scrollbar-hide bg-transparent border-b border-[#333]"
      >
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => {
              haptic?.('medium');
              onTabChange(tab.id);
            }}
            className={`px-3 sm:px-4 py-2.5 min-h-touch text-[10px] font-bold uppercase tracking-wider transition-all whitespace-nowrap flex-shrink-0 border-b-2 -mb-px ${
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
      {canScrollRight && (
        <div
          className="absolute top-0 right-0 bottom-0 w-6 pointer-events-none bg-gradient-to-l from-[#0a0a0a] to-transparent"
          aria-hidden="true"
        />
      )}
    </div>
  );
};

// =============================================================================
// CAPTION BREAKDOWN - GE / VIS / MUS secondary line
// Rendered under the corps name so the numbers never push off the right edge
// on mobile (the old wide-table layout clipped these columns).
// =============================================================================

const CaptionBreakdown = ({ captions, highlight }) => {
  if (!captions) return null;
  const fmt = (v) => (v !== null && v !== undefined ? v.toFixed(2) : '-');
  const items = [
    ['GE', captions.ge],
    ['VIS', captions.vis],
    ['MUS', captions.mus],
  ];
  return (
    <div className="flex items-center gap-x-3 gap-y-0.5 flex-wrap mt-0.5 text-[10px] font-data tabular-nums">
      {items.map(([label, value]) => (
        <span key={label} className={highlight === label ? 'text-[#0057B8]' : 'text-gray-500'}>
          {label}{' '}
          <span className={highlight === label ? 'text-white font-bold' : 'text-gray-300'}>
            {fmt(value)}
          </span>
        </span>
      ))}
    </div>
  );
};

// Director / display name shown next to the corps name. Truncates so a long
// name can never break the row width.
const DirectorTag = ({ displayName, uid }) => {
  if (!displayName) return null;
  const cls = 'text-[10px] text-gray-500 truncate flex-shrink-0 max-w-[45%]';
  return uid ? (
    <Link to={`/profile/${uid}`} className={`${cls} hover:text-[#0057B8]`}>
      {displayName}
    </Link>
  ) : (
    <span className={cls}>{displayName}</span>
  );
};

// =============================================================================
// RECAP DATA GRID - HIGH DENSITY, MOBILE-SAFE ROWS
// OPTIMIZATION #3: Memoized to prevent re-renders when sibling recap grids update
// =============================================================================

const RecapDataGrid = memo(({ scores, eventName, location, date, userCorpsName }) => {
  // Pre-compute all caption breakdowns once (real data only, no synthetic values)
  const captionMap = useMemo(() => {
    if (!scores || scores.length === 0) return new Map();
    return new Map(scores.map((score, idx) => [idx, getCaptionBreakdown(score)]));
  }, [scores]);

  if (!scores || scores.length === 0) return null;

  return (
    <div className="border-b border-[#333]">
      {/* Event Header - Super Row integrated with table */}
      <div className="bg-[#222] px-4 py-2.5 flex items-center justify-between">
        <div className="flex items-center gap-2 min-w-0">
          <span className="font-bold text-white text-sm truncate">
            {formatEventName(eventName)}
          </span>
          <span className="text-gray-500 text-xs hidden sm:flex items-center gap-1">
            <MapPin className="w-3 h-3" />
            {location}
          </span>
        </div>
        <span className="text-[10px] text-gray-500 font-data tabular-nums flex-shrink-0">
          {date}
        </span>
      </div>

      {/* Data Grid - stacked rows so caption scores never clip off the right */}
      <div className="border-t border-[#333]">
        {scores.map((score, idx) => {
          const captions = captionMap.get(idx);
          const isUserCorps =
            userCorpsName &&
            (score.corps?.toLowerCase() === userCorpsName.toLowerCase() ||
              score.corpsName?.toLowerCase() === userCorpsName.toLowerCase());
          const rowBg = idx % 2 === 0 ? 'bg-[#1a1a1a]' : 'bg-[#111]';

          return (
            <div
              key={idx}
              className={`${rowBg} flex items-center gap-2.5 px-3 py-2.5 ${
                isUserCorps ? 'border-l-2 border-l-[#0057B8]' : ''
              }`}
            >
              {/* Rank */}
              <span className="flex-shrink-0 w-6 h-6 bg-[#222] border border-[#333] flex items-center justify-center text-[10px] font-bold text-gray-400 tabular-nums">
                {idx + 1}
              </span>

              {/* Avatar */}
              <TeamAvatar
                name={score.corpsName || score.corps}
                logoUrl={score.avatarUrl}
                size="xs"
              />

              {/* Corps name + caption breakdown */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 min-w-0">
                  <span className="font-bold text-white text-sm truncate">
                    {score.corpsName || score.corps}
                  </span>
                  <DirectorTag displayName={score.displayName} uid={score.uid} />
                </div>
                <CaptionBreakdown captions={captions} />
              </div>

              {/* Total */}
              <span className="flex-shrink-0 font-bold text-white font-data tabular-nums text-base">
                {(score.score || score.totalScore || 0).toFixed(3)}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
});

// =============================================================================
// TWO-NIGHT COMBINED STANDINGS — the Eastern Classic (days 41-42, §5.11).
// One event, two nightly drops: once Saturday processes, this sheet merges
// both nights into per-class combined standings with Night 1/2 badges. The
// small uniform night-two growth bump is published, not hidden — that's the
// real DCI recap-thread experience.
// =============================================================================

const NIGHT_BADGE = {
  1: 'bg-[#0057B8]/15 text-[#4d9fff]',
  2: 'bg-purple-500/15 text-purple-300',
};

const EasternCombinedSheet = memo(({ shows, userCorpsName }) => {
  const combined = useMemo(() => mergeTwoNightShows(shows || []), [shows]);
  if (!combined) return null;

  return (
    <div className="border-b border-[#333]">
      {/* Masthead */}
      <div className="bg-gradient-to-r from-[#c9a227]/15 to-transparent px-4 py-3 border-b border-[#c9a227]/30">
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0">
            <div className="text-[9px] font-bold uppercase tracking-[0.2em] text-[#c9a227]">
              Combined Standings · Both Nights
            </div>
            <div className="font-bold text-white text-sm truncate">
              {formatEventName(combined.eventName)}
            </div>
            {combined.location && (
              <div className="text-[10px] text-gray-500 flex items-center gap-1">
                <MapPin className="w-3 h-3" />
                {combined.location}
              </div>
            )}
          </div>
          <span className="text-[10px] text-gray-500 font-data tabular-nums flex-shrink-0">
            {combined.dateRange}
          </span>
        </div>
      </div>

      {/* Per-class sections */}
      {combined.sections.map((section) => (
        <div key={section.corpsClass}>
          <div className="bg-[#161616] px-4 py-1.5 border-y border-[#2a2a2a] flex items-center justify-between">
            <span className="text-[9px] font-bold uppercase tracking-wider text-gray-400">
              {section.label}
            </span>
            <span className="text-[9px] text-gray-600 tabular-nums">
              {section.rows.length} corps
            </span>
          </div>
          {section.rows.map((row, idx) => {
            const isUserCorps =
              userCorpsName && row.corpsName?.toLowerCase() === userCorpsName.toLowerCase();
            const rowBg = idx % 2 === 0 ? 'bg-[#1a1a1a]' : 'bg-[#111]';
            return (
              <div
                key={`${row.corpsName}-${idx}`}
                className={`${rowBg} flex items-center gap-2.5 px-3 py-2 ${
                  isUserCorps ? 'border-l-2 border-l-[#0057B8]' : ''
                }`}
              >
                <span className="flex-shrink-0 w-6 h-6 bg-[#222] border border-[#333] flex items-center justify-center text-[10px] font-bold text-gray-400 tabular-nums">
                  {idx + 1}
                </span>
                <TeamAvatar name={row.corpsName || row.corps} logoUrl={row.avatarUrl} size="xs" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className="font-bold text-white text-sm truncate">
                      {row.corpsName || row.corps}
                    </span>
                    <DirectorTag displayName={row.displayName} uid={row.uid} />
                  </div>
                  <CaptionBreakdown captions={getCaptionBreakdown(row)} />
                </div>
                <span
                  className={`flex-shrink-0 px-1.5 py-0.5 text-[9px] font-bold uppercase rounded-sm ${NIGHT_BADGE[row.night]}`}
                >
                  N{row.night}
                </span>
                <span className="flex-shrink-0 font-bold text-white font-data tabular-nums text-base">
                  {(row.score || row.totalScore || 0).toFixed(3)}
                </span>
              </div>
            );
          })}
        </div>
      ))}

      {/* Footnote: the published night-two effect */}
      <div className="px-4 py-2 bg-[#111] text-[9px] text-gray-600">
        Night 2 corps carry one extra day of growth — the split is seeded evenly per class, and
        night parity alternates each season.
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
      .filter((show) => show.scores?.some((s) => s.corpsClass === 'soundSport'))
      .forEach((show) => {
        const soundSportScores = show.scores
          .filter((s) => s.corpsClass === 'soundSport')
          .map((score) => ({
            ...score,
            rating: getSoundSportRating(score.score),
          }));

        if (soundSportScores.length > 0) {
          // Find best in show (highest score at this event)
          const maxScore = Math.max(...soundSportScores.map((s) => s.score || 0));
          const bestInShowCorps =
            soundSportScores.find((s) => s.score === maxScore)?.corps ||
            soundSportScores.find((s) => s.score === maxScore)?.corpsName;

          // Mark best in show
          soundSportScores.forEach((score) => {
            const corpsName = score.corps || score.corpsName;
            score.isBestInShow = corpsName === bestInShowCorps;
          });

          // Use show eventName or mock one for display
          const eventName =
            show.eventName || MOCK_EVENT_NAMES[mockNameIndex % MOCK_EVENT_NAMES.length];

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
    groupedResults.forEach((group) => {
      group.scores.forEach((r) => {
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
              <span className="font-bold text-white text-sm truncate">
                {formatEventName(group.eventName)}
              </span>
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
                    <div
                      className={`w-6 h-6 ${config.bg} flex items-center justify-center flex-shrink-0`}
                    >
                      <Medal className={`w-4 h-4 ${config.text}`} />
                    </div>
                    <TeamAvatar
                      name={result.corps || result.corpsName}
                      logoUrl={result.avatarUrl}
                      size="xs"
                    />
                    <div className="min-w-0">
                      <span className="font-bold text-white text-sm block truncate">
                        {result.corps || result.corpsName}
                      </span>
                      {result.displayName &&
                        (result.uid ? (
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
                        ))}
                    </div>
                  </div>

                  {/* Right: Best in Show + Rating Badge */}
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {result.isBestInShow && <BlueRibbonIcon className="w-5 h-5" />}
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

// Caption Leaders sorting (§5.4): the fantasy classes sort by the CONDENSED
// captions only (GE/VIS/MUS) — per-caption detail stays Podium-exclusive so
// lineups can't be harvested from the sheet.
const STANDINGS_SORTS = [
  { id: 'total', label: 'Score' },
  { id: 'GE', label: 'GE' },
  { id: 'VIS', label: 'VIS' },
  { id: 'MUS', label: 'MUS' },
];

const ClassStandingsGrid = ({ standings, className, userCorpsName }) => {
  const [sortBy, setSortBy] = useState('total');

  // Pre-compute breakdowns per entry (real data only, no synthetic values),
  // then order by the selected caption — corps without caption data sort last.
  const sorted = useMemo(() => {
    if (!standings || standings.length === 0) return [];
    const withCaptions = standings.map((entry) => ({
      entry,
      captions: getCaptionBreakdown(entry.scores?.[0] || entry),
    }));
    if (sortBy === 'total') return withCaptions;
    const key = { GE: 'ge', VIS: 'vis', MUS: 'mus' }[sortBy];
    return [...withCaptions].sort((a, b) => (b.captions[key] ?? -1) - (a.captions[key] ?? -1));
  }, [standings, sortBy]);

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
      <div className="bg-[#1a1a1a] px-4 py-3 border-b border-[#333] flex items-center justify-between gap-2">
        <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400 truncate">
          {className} {sortBy === 'total' ? 'Season Standings' : `Caption Leaders · ${sortBy}`}
        </span>
        <div className="flex items-center gap-1 flex-shrink-0">
          {STANDINGS_SORTS.map((sort) => (
            <button
              key={sort.id}
              onClick={() => setSortBy(sort.id)}
              aria-pressed={sortBy === sort.id}
              className={`px-2 py-1 text-[9px] font-bold uppercase tracking-wider rounded-sm transition-colors ${
                sortBy === sort.id
                  ? 'bg-[#0057B8] text-white'
                  : 'bg-[#222] text-gray-500 hover:text-gray-300'
              }`}
            >
              {sort.label}
            </button>
          ))}
        </div>
      </div>

      {/* Data Grid - stacked rows so caption scores never clip off the right */}
      <div>
        {sorted.map(({ entry, captions }, idx) => {
          const isUserCorps =
            userCorpsName && entry.corpsName?.toLowerCase() === userCorpsName.toLowerCase();
          const rowBg = idx % 2 === 0 ? 'bg-[#1a1a1a]' : 'bg-[#111]';
          const trend = entry.trend?.direction || 0;

          return (
            <div
              key={entry.corpsName || idx}
              className={`${rowBg} flex items-center gap-2.5 px-3 py-2.5 ${
                isUserCorps ? 'border-l-2 border-l-[#0057B8]' : ''
              }`}
            >
              {/* Rank — position under the active sort (caption rank when caption-sorted) */}
              <span className="flex-shrink-0 w-6 h-6 bg-[#222] border border-[#333] flex items-center justify-center text-[10px] font-bold text-gray-400 tabular-nums">
                {sortBy === 'total' ? entry.rank : idx + 1}
              </span>

              {/* Avatar */}
              <TeamAvatar name={entry.corpsName} logoUrl={entry.avatarUrl} size="xs" />

              {/* Corps name + caption breakdown */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 min-w-0">
                  <span className="font-bold text-white text-sm truncate">{entry.corpsName}</span>
                  <DirectorTag displayName={entry.displayName} uid={entry.uid} />
                </div>
                <CaptionBreakdown
                  captions={captions}
                  highlight={sortBy === 'total' ? undefined : sortBy}
                />
              </div>

              {/* Avg score + trend */}
              <div className="flex-shrink-0 flex items-center gap-2">
                <span className="font-bold text-white font-data tabular-nums text-base">
                  {typeof entry.score === 'number' ? entry.score.toFixed(3) : '-'}
                </span>
                <span className="w-4 flex items-center justify-center">
                  {trend > 0 ? (
                    <TrendingUp className="w-3.5 h-3.5 text-green-500" />
                  ) : trend < 0 ? (
                    <TrendingDown className="w-3.5 h-3.5 text-red-500" />
                  ) : (
                    <span className="text-gray-600 text-xs">-</span>
                  )}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export {
  BlueRibbonIcon,
  PillTabControl,
  RecapDataGrid,
  EasternCombinedSheet,
  SoundSportMedalList,
  ClassStandingsGrid,
};
