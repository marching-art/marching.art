// =============================================================================
// SCORES - CONSOLIDATED RECAP TERMINAL
// =============================================================================
// High-density data grid for scores with caption breakdowns (GE, VIS, MUS)
// Laws: App Shell, Pill Tab Segmented Control, High-Density Tables, no glow

import React, { useState, useMemo, useEffect } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import {
  Trophy, Calendar, TrendingUp, TrendingDown, Music,
  ChevronRight, MapPin, Medal, Users, Activity
} from 'lucide-react';
import { useAuth } from '../App';
import { useUserStore } from '../store/userStore';
import { useSeasonStore } from '../store/seasonStore';
import { formatEventName } from '../utils/season';
import { useScoresData } from '../hooks/useScoresData';
import { PullToRefresh } from '../components/ui/PullToRefresh';
import { TeamAvatar } from '../components/ui/TeamAvatar';
import { useHaptic } from '../hooks/useHaptic';

// =============================================================================
// CONSTANTS
// =============================================================================

const TABS = [
  { id: 'latest', label: 'Latest' },
  { id: 'world', label: 'World' },
  { id: 'open', label: 'Open Class' },
  { id: 'aclass', label: 'Class A' },
  { id: 'soundsport', label: 'SoundSport', accent: 'green' },
];

const RATING_CONFIG = {
  Gold: { bg: 'bg-yellow-500', text: 'text-black', badge: 'bg-yellow-500/20 text-yellow-500' },
  Silver: { bg: 'bg-gray-300', text: 'text-black', badge: 'bg-gray-300/20 text-gray-300' },
  Bronze: { bg: 'bg-orange-400', text: 'text-black', badge: 'bg-orange-400/20 text-orange-400' },
  Participation: { bg: 'bg-gray-600', text: 'text-white', badge: 'bg-gray-600/20 text-gray-400' },
};

const CLASS_LABELS = {
  worldClass: 'World Class',
  openClass: 'Open Class',
  aClass: 'Class A',
  soundSport: 'SoundSport',
};

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

const getSoundSportRating = (score) => {
  if (score >= 90) return 'Gold';
  if (score >= 75) return 'Silver';
  if (score >= 60) return 'Bronze';
  return 'Participation';
};

/**
 * Generate mocked caption breakdown from total score
 * Uses realistic DCI-style proportions:
 * - GE: ~40% of total (max 40 points)
 * - VIS: ~30% of total (max 30 points)
 * - MUS: ~30% of total (max 30 points)
 */
const generateCaptionBreakdown = (totalScore, existingCaptions) => {
  // If we already have caption data, use it
  if (existingCaptions?.geScore && existingCaptions?.visualScore && existingCaptions?.musicScore) {
    return {
      ge: existingCaptions.geScore,
      vis: existingCaptions.visualScore,
      mus: existingCaptions.musicScore,
    };
  }

  // Generate realistic breakdown based on total
  // Add slight variance to make each corps unique
  const baseRatio = totalScore / 100;
  const variance = () => (Math.random() - 0.5) * 0.08;

  const ge = Math.min(40, Math.max(0, (baseRatio * 40) + (variance() * 40)));
  const vis = Math.min(30, Math.max(0, (baseRatio * 30) + (variance() * 30)));
  const mus = Math.min(30, Math.max(0, (baseRatio * 30) + (variance() * 30)));

  return {
    ge: Number(ge.toFixed(2)),
    vis: Number(vis.toFixed(2)),
    mus: Number(mus.toFixed(2)),
  };
};

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
// =============================================================================

const RecapDataGrid = ({
  scores,
  eventName,
  location,
  date,
  userCorpsName
}) => {
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
              const captions = generateCaptionBreakdown(score.score, score);
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
                      <TeamAvatar name={score.corpsName || score.corps} size="xs" />
                      <div className="min-w-0">
                        <span className="font-bold text-white text-sm block truncate">
                          {score.corpsName || score.corps}
                        </span>
                        {score.displayName && (
                          <span className="text-[10px] text-gray-500 block truncate">
                            {score.displayName}
                          </span>
                        )}
                      </div>
                    </div>
                  </td>

                  {/* GE */}
                  <td className="py-2 px-2 text-right">
                    <span className="text-gray-400 font-data tabular-nums text-sm">
                      {captions.ge.toFixed(2)}
                    </span>
                  </td>

                  {/* VIS */}
                  <td className="py-2 px-2 text-right">
                    <span className="text-gray-400 font-data tabular-nums text-sm">
                      {captions.vis.toFixed(2)}
                    </span>
                  </td>

                  {/* MUS */}
                  <td className="py-2 px-2 text-right">
                    <span className="text-gray-400 font-data tabular-nums text-sm">
                      {captions.mus.toFixed(2)}
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
};

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

// Mock special awards - in production these would come from data
const getSpecialAward = (ensembleName, eventIndex, resultIndex) => {
  // Simulate awards: first ensemble in each event gets "Best of Show"
  // Every 3rd ensemble gets "Class Winner"
  if (resultIndex === 0 && eventIndex % 2 === 0) return 'BEST OF SHOW';
  if (resultIndex % 3 === 0 && resultIndex !== 0) return 'CLASS WINNER';
  return null;
};

const SoundSportMedalList = ({ shows }) => {
  // Group results by event, preserving show context
  const groupedResults = useMemo(() => {
    const groups = [];
    let mockNameIndex = 0;

    shows
      .filter(show => show.scores?.some(s => s.corpsClass === 'soundSport'))
      .forEach((show, showIdx) => {
        const soundSportScores = show.scores
          .filter(s => s.corpsClass === 'soundSport')
          .map((score, idx) => ({
            ...score,
            rating: getSoundSportRating(score.score),
            specialAward: getSpecialAward(score.corps || score.corpsName, showIdx, idx),
          }));

        if (soundSportScores.length > 0) {
          // Sort within group by rating priority (Gold first) then alphabetically
          const ratingOrder = { Gold: 0, Silver: 1, Bronze: 2, Participation: 3 };
          soundSportScores.sort((a, b) => {
            const orderDiff = ratingOrder[a.rating] - ratingOrder[b.rating];
            if (orderDiff !== 0) return orderDiff;
            return (a.corps || '').localeCompare(b.corps || '');
          });

          // Use show eventName or mock one for display
          const eventName = show.eventName || MOCK_EVENT_NAMES[mockNameIndex % MOCK_EVENT_NAMES.length];
          mockNameIndex++;

          groups.push({
            eventName,
            date: show.date || 'TBD',
            location: show.location || 'Various Locations',
            scores: soundSportScores,
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
          <div className="bg-[#222] border-y border-[#333] px-4 py-2 flex justify-between items-center">
            <span className="text-xs font-bold uppercase text-white truncate pr-4">
              {formatEventName(group.eventName)}
            </span>
            <span className="text-[10px] text-gray-500 flex-shrink-0">
              {group.date} • {group.location}
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
                  className={`${rowBg} px-4 py-2 flex items-center justify-between hover:bg-[#222] transition-colors`}
                >
                  {/* Left: Medal Icon + Ensemble Name */}
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={`w-6 h-6 ${config.bg} flex items-center justify-center flex-shrink-0`}>
                      <Medal className={`w-4 h-4 ${config.text}`} />
                    </div>
                    <span className="text-sm text-white truncate">
                      {result.corps || result.corpsName}
                    </span>
                  </div>

                  {/* Right: Rating Badge + Special Award */}
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {result.specialAward && (
                      <span className="text-[9px] uppercase font-bold px-1.5 py-0.5 rounded-sm bg-yellow-500/20 text-yellow-400 border border-yellow-500/30">
                        {result.specialAward}
                      </span>
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
              const captions = generateCaptionBreakdown(entry.score, entry.scores?.[0] || entry);
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
                      <TeamAvatar name={entry.corpsName} size="xs" />
                      <div className="min-w-0">
                        <span className="font-bold text-white text-sm block truncate">
                          {entry.corpsName}
                        </span>
                        {entry.displayName && (
                          <span className="text-[10px] text-gray-500 block truncate">
                            {entry.displayName}
                          </span>
                        )}
                      </div>
                    </div>
                  </td>

                  {/* GE */}
                  <td className="py-2.5 px-2 text-right">
                    <span className="text-gray-400 font-data tabular-nums text-sm">
                      {captions.ge.toFixed(2)}
                    </span>
                  </td>

                  {/* VIS */}
                  <td className="py-2.5 px-2 text-right">
                    <span className="text-gray-400 font-data tabular-nums text-sm">
                      {captions.vis.toFixed(2)}
                    </span>
                  </td>

                  {/* MUS */}
                  <td className="py-2.5 px-2 text-right">
                    <span className="text-gray-400 font-data tabular-nums text-sm">
                      {captions.mus.toFixed(2)}
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

// =============================================================================
// MAIN SCORES COMPONENT
// =============================================================================

const Scores = () => {
  const { user } = useAuth();
  const loggedInProfile = useUserStore((state) => state.loggedInProfile);
  const completeDailyChallenge = useUserStore((state) => state.completeDailyChallenge);
  const formatSeasonName = useSeasonStore((state) => state.formatSeasonName);
  const [searchParams] = useSearchParams();
  const { trigger: haptic } = useHaptic();

  const targetShowName = searchParams.get('show');
  const targetSeasonId = searchParams.get('season');

  const [activeTab, setActiveTab] = useState('latest');
  const [selectedShow, setSelectedShow] = useState(null);

  const {
    loading,
    error,
    allShows,
    unfilteredShows,
    stats,
    aggregatedScores,
    refetch,
  } = useScoresData({
    seasonId: targetSeasonId,
    classFilter: 'all',
    enabledCaptions: { ge: true, vis: true, mus: true }
  });

  const handleRefresh = async () => {
    haptic('pull');
    await refetch?.();
    haptic('success');
  };

  const currentSeasonName = useMemo(() => {
    return formatSeasonName?.() || 'Current Season';
  }, [formatSeasonName]);

  const userCorpsName = useMemo(() => {
    if (!loggedInProfile?.corps) return null;
    const activeCorps = Object.values(loggedInProfile.corps).find(c => c?.lineup);
    return activeCorps?.corpsName || null;
  }, [loggedInProfile?.corps]);

  useEffect(() => {
    if (user && loggedInProfile && completeDailyChallenge) {
      completeDailyChallenge('check_leaderboard');
    }
  }, [user, loggedInProfile, completeDailyChallenge]);

  useEffect(() => {
    if (targetShowName) {
      setActiveTab('latest');
    }
  }, [targetShowName]);


  // Filter standings by class for each tab
  const worldStandings = useMemo(() =>
    aggregatedScores.filter(s => s.corpsClass === 'worldClass'),
    [aggregatedScores]
  );

  const openStandings = useMemo(() =>
    aggregatedScores.filter(s => s.corpsClass === 'openClass'),
    [aggregatedScores]
  );

  const aClassStandings = useMemo(() =>
    aggregatedScores.filter(s => s.corpsClass === 'aClass'),
    [aggregatedScores]
  );

  // Latest Recaps - aggregate most recent shows from all classes (excluding SoundSport)
  const latestShows = useMemo(() => {
    return unfilteredShows
      .filter(s => s.scores && s.scores.length > 0)
      .map(show => ({
        ...show,
        // Filter out SoundSport from the recap view, but keep all other classes
        scores: show.scores.filter(s => s.corpsClass !== 'soundSport')
      }))
      .filter(show => show.scores.length > 0)
      .slice(0, 10);
  }, [unfilteredShows]);

  // =============================================================================
  // RENDER
  // =============================================================================

  return (
    <div className="h-full flex flex-col overflow-hidden bg-[#0A0A0A]">
      {/* FIXED HEADER */}
      <div className="flex-shrink-0 bg-[#1a1a1a] border-b border-[#333] px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Activity className="w-5 h-5 text-[#0057B8]" />
            <div>
              <h1 className="text-sm font-bold text-white uppercase tracking-wider">
                Scores & Recaps
              </h1>
              <p className="text-[10px] text-gray-500">{currentSeasonName}</p>
            </div>
          </div>
          <div className="flex items-center gap-4 text-xs">
            <div className="text-right">
              <div className="text-[10px] text-gray-500 uppercase">Corps</div>
              <div className="font-bold text-white tabular-nums">{stats.corpsActive || 0}</div>
            </div>
            <div className="text-right">
              <div className="text-[10px] text-gray-500 uppercase">High</div>
              <div className="font-bold text-green-400 tabular-nums">{stats.topScore || '-'}</div>
            </div>
          </div>
        </div>
      </div>

      {/* TAB STRIP */}
      <div className="flex-shrink-0 bg-[#0A0A0A] px-3">
        <PillTabControl
          tabs={TABS}
          activeTab={activeTab}
          onTabChange={setActiveTab}
          haptic={haptic}
        />
      </div>

      {/* SCROLLABLE CONTENT */}
      <div className="flex-1 overflow-y-auto min-h-0 pb-20 md:pb-4">
        <PullToRefresh onRefresh={handleRefresh}>
          {loading ? (
            <div className="p-8 text-center text-gray-500 text-sm">Loading scores...</div>
          ) : error ? (
            <div className="p-8 text-center text-red-500 text-sm">{error}</div>
          ) : (
            <>
              {/* LATEST RECAPS TAB */}
              {activeTab === 'latest' && (
                <div>
                  {latestShows.length > 0 ? (
                    latestShows.map((show, idx) => (
                      <RecapDataGrid
                        key={idx}
                        scores={show.scores}
                        eventName={show.eventName}
                        location={show.location}
                        date={show.date}
                        userCorpsName={userCorpsName}
                      />
                    ))
                  ) : (
                    <div className="p-8 text-center">
                      <Calendar className="w-8 h-8 text-gray-600 mx-auto mb-2" />
                      <p className="text-gray-500 text-sm">No recent shows</p>
                    </div>
                  )}
                </div>
              )}

              {/* WORLD CLASS TAB */}
              {activeTab === 'world' && (
                <ClassStandingsGrid
                  standings={worldStandings}
                  className="World Class"
                  userCorpsName={userCorpsName}
                />
              )}

              {/* OPEN CLASS TAB */}
              {activeTab === 'open' && (
                <ClassStandingsGrid
                  standings={openStandings}
                  className="Open Class"
                  userCorpsName={userCorpsName}
                />
              )}

              {/* CLASS A TAB */}
              {activeTab === 'aclass' && (
                <ClassStandingsGrid
                  standings={aClassStandings}
                  className="Class A"
                  userCorpsName={userCorpsName}
                />
              )}

              {/* SOUNDSPORT TAB */}
              {activeTab === 'soundsport' && (
                <SoundSportMedalList shows={unfilteredShows} />
              )}
            </>
          )}
        </PullToRefresh>
      </div>

      {/* SELECTED SHOW MODAL (Full Recap) */}
      {selectedShow && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
          <div
            className="absolute inset-0 bg-black/80"
            onClick={() => setSelectedShow(null)}
          />
          <div className="relative w-full max-w-lg max-h-[80vh] bg-[#1a1a1a] border border-[#333] sm:rounded-sm overflow-hidden flex flex-col">
            {/* Modal Header */}
            <div className="bg-[#222] px-4 py-3 border-b border-[#333] flex items-center justify-between flex-shrink-0">
              <div>
                <h2 className="text-sm font-bold text-white">{formatEventName(selectedShow.eventName)}</h2>
                <p className="text-[10px] text-gray-500">
                  {selectedShow.location} • {selectedShow.date}
                </p>
              </div>
              <button
                onClick={() => setSelectedShow(null)}
                className="text-gray-400 hover:text-white text-xs font-bold"
              >
                CLOSE
              </button>
            </div>

            {/* Modal Content - Uses same RecapDataGrid */}
            <div className="flex-1 overflow-y-auto">
              <RecapDataGrid
                scores={selectedShow.scores}
                eventName={selectedShow.eventName}
                location={selectedShow.location}
                date={selectedShow.date}
                userCorpsName={userCorpsName}
              />
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default Scores;
