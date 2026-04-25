// src/pages/HallOfChampions.jsx
// Championship record book — ESPN-style data terminal layout
// Sidebar (Seasons) + Main Stage (Champion plaque + finalists table)
import React, { useState, useEffect, useMemo } from 'react';
import { m } from 'framer-motion';
import { Trophy, Award, Calendar, Crown, Medal, ChevronRight, ArrowLeft, Hash, Users } from 'lucide-react';
import { db } from '../firebase';
import { collection, getDocs } from 'firebase/firestore';
import { Link } from 'react-router-dom';
import LoadingScreen from '../components/LoadingScreen';
import { TeamAvatar } from '../components/ui/TeamAvatar';

// =============================================================================
// CONSTANTS
// =============================================================================

const CLASS_CONFIG = {
  worldClass: { name: 'World Class', short: 'World', icon: Crown },
  openClass:  { name: 'Open Class',  short: 'Open',  icon: Trophy },
  aClass:     { name: 'Class A',     short: 'Class A', icon: Award },
};

const RANK_META = {
  1: { label: 'CHAMPION',  badge: 'bg-yellow-500 text-black',     accent: 'text-yellow-500',  border: 'border-yellow-500/60', medalColor: 'text-yellow-500' },
  2: { label: 'RUNNER-UP', badge: 'bg-gray-300 text-black',       accent: 'text-gray-300',    border: 'border-gray-400/40',   medalColor: 'text-gray-300' },
  3: { label: 'THIRD',     badge: 'bg-orange-400 text-black',     accent: 'text-orange-400',  border: 'border-orange-500/40', medalColor: 'text-orange-400' },
};

// =============================================================================
// HELPERS
// =============================================================================

const parseSeasonName = (name) => {
  if (!name) return { type: 'Unknown', year: '' };
  const parts = name.split('_');
  if (parts.length < 2) return { type: name, year: '' };
  const type = parts[0].charAt(0).toUpperCase() + parts[0].slice(1).toLowerCase();
  const yearParts = parts.slice(1);
  // "2025-26" — collapse trailing 4-digit year to 2-digit suffix
  let year = yearParts.join('-');
  if (yearParts.length === 2 && /^\d{4}$/.test(yearParts[0]) && /^\d{4}$/.test(yearParts[1])) {
    year = `${yearParts[0]}-${yearParts[1].slice(2)}`;
  }
  return { type, year };
};

const formatDate = (date) => {
  if (!date) return '—';
  try {
    return date.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
  } catch {
    return '—';
  }
};

const formatScore = (score) => (typeof score === 'number' ? score.toFixed(3) : '—');

const formatDelta = (delta) => {
  if (typeof delta !== 'number' || Number.isNaN(delta)) return '—';
  const sign = delta > 0 ? '+' : '';
  return `${sign}${delta.toFixed(3)}`;
};

// =============================================================================
// SUB-COMPONENTS
// =============================================================================

const SeasonRow = ({ season, isSelected, classKey, onSelect }) => {
  const champ = season.classes?.[classKey]?.[0];
  if (!champ) return null;
  const { type, year } = parseSeasonName(season.seasonName);

  return (
    <button
      onClick={() => onSelect(season)}
      className={`
        w-full text-left px-4 py-3 border-b border-[#333] transition-colors
        ${isSelected ? 'bg-[#0057B8]/15 border-l-2 border-l-[#0057B8]' : 'border-l-2 border-l-transparent hover:bg-[#1f1f1f]'}
      `}
    >
      <div className="flex items-center justify-between gap-2 mb-1">
        <span className={`text-[11px] font-bold uppercase tracking-wider ${isSelected ? 'text-white' : 'text-gray-300'}`}>
          {type}
        </span>
        <span className="text-[10px] text-gray-500 font-data tabular-nums">{year}</span>
      </div>
      <div className="flex items-center gap-2 min-w-0">
        <Crown className="w-3 h-3 text-yellow-500 flex-shrink-0" />
        <span className="text-xs text-white truncate min-w-0 flex-1">{champ.corpsName || champ.username || '—'}</span>
        <span className="text-[10px] text-gray-400 font-data tabular-nums flex-shrink-0">
          {formatScore(champ.score)}
        </span>
      </div>
      <div className="flex items-center gap-1.5 mt-1.5">
        <Calendar className="w-2.5 h-2.5 text-gray-600" />
        <span className="text-[10px] text-gray-500 font-data tabular-nums">
          {formatDate(season.archivedAt)}
        </span>
        {isSelected && <ChevronRight className="w-3 h-3 text-[#0057B8] ml-auto" />}
      </div>
    </button>
  );
};

const ChampionPlaque = ({ champion, season, classKey, fieldStats }) => {
  const { type, year } = parseSeasonName(season.seasonName);
  const ClassIcon = CLASS_CONFIG[classKey]?.icon || Trophy;
  const corpsName = champion.corpsName || champion.username || '—';

  return (
    <m.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
      className="bg-[#1a1a1a] border border-[#333] mb-4"
    >
      {/* Top banner */}
      <div className="bg-yellow-500 text-black px-4 py-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Crown className="w-4 h-4" />
          <span className="text-[11px] font-bold uppercase tracking-widest">
            {type} {year} Champion
          </span>
        </div>
        <span className="text-[10px] font-bold uppercase tracking-wider opacity-80">
          {CLASS_CONFIG[classKey]?.name}
        </span>
      </div>

      {/* Champion identity */}
      <div className="px-4 sm:px-6 py-5 flex items-center gap-4">
        <TeamAvatar name={corpsName} size="lg" className="!w-14 !h-14 sm:!w-16 sm:!h-16 text-xl" />
        <div className="min-w-0 flex-1">
          <div className="text-xl sm:text-2xl font-bold text-white truncate">
            {corpsName}
          </div>
          {champion.uid ? (
            <Link
              to={`/profile/${champion.uid}`}
              className="text-xs text-gray-400 hover:text-[#0057B8] transition-colors block truncate"
            >
              Director: {champion.username || 'Unknown'}
            </Link>
          ) : (
            <span className="text-xs text-gray-400 block truncate">
              Director: {champion.username || 'Unknown'}
            </span>
          )}
        </div>
        <div className="text-right flex-shrink-0">
          <div className="text-[10px] text-gray-500 uppercase tracking-wider">Final Score</div>
          <div className="text-3xl sm:text-4xl font-bold text-yellow-500 font-data tabular-nums leading-none">
            {formatScore(champion.score)}
          </div>
        </div>
      </div>

      {/* Stats strip */}
      <div className="grid grid-cols-3 border-t border-[#333] divide-x divide-[#333]">
        <div className="px-3 py-2.5">
          <div className="text-[10px] text-gray-500 uppercase tracking-wider">Crowned</div>
          <div className="text-xs text-white font-data tabular-nums truncate">{formatDate(season.archivedAt)}</div>
        </div>
        <div className="px-3 py-2.5">
          <div className="text-[10px] text-gray-500 uppercase tracking-wider">Margin</div>
          <div className={`text-xs font-data tabular-nums truncate ${fieldStats.margin > 0 ? 'text-green-500' : 'text-gray-400'}`}>
            {formatDelta(fieldStats.margin)}
          </div>
        </div>
        <div className="px-3 py-2.5">
          <div className="text-[10px] text-gray-500 uppercase tracking-wider">Division</div>
          <div className="text-xs text-white truncate flex items-center gap-1">
            <ClassIcon className="w-3 h-3 text-yellow-500" />
            {CLASS_CONFIG[classKey]?.short}
          </div>
        </div>
      </div>
    </m.div>
  );
};

const FinalistsTable = ({ champions }) => {
  if (!champions || champions.length === 0) return null;

  return (
    <div className="bg-[#1a1a1a] border border-[#333]">
      <div className="bg-[#222] px-4 py-2.5 flex items-center justify-between border-b border-[#333]">
        <div className="flex items-center gap-2">
          <Trophy className="w-3.5 h-3.5 text-yellow-500" />
          <span className="text-[11px] font-bold uppercase tracking-wider text-gray-300">
            Final Standings
          </span>
        </div>
        <span className="text-[10px] text-gray-500 font-data tabular-nums">
          {champions.length} Finalist{champions.length !== 1 ? 's' : ''}
        </span>
      </div>

      <table className="w-full">
        <thead>
          <tr className="bg-[#111] border-b border-[#333]">
            <th className="text-left py-2 px-3 text-[10px] font-bold uppercase tracking-wider text-gray-500 w-10">#</th>
            <th className="text-left py-2 px-2 text-[10px] font-bold uppercase tracking-wider text-gray-500">Corps</th>
            <th className="text-left py-2 px-2 text-[10px] font-bold uppercase tracking-wider text-gray-500 hidden sm:table-cell">Director</th>
            <th className="text-right py-2 px-3 text-[10px] font-bold uppercase tracking-wider text-gray-500 w-20">Score</th>
          </tr>
        </thead>
        <tbody>
          {champions.map((c, idx) => {
            const meta = RANK_META[c.rank] || {};
            const rowBg = idx % 2 === 0 ? 'bg-[#1a1a1a]' : 'bg-[#111]';
            const corpsName = c.corpsName || c.username || '—';

            return (
              <tr key={`${c.uid}-${c.rank}-${idx}`} className={`${rowBg} border-b border-[#333] last:border-b-0`}>
                <td className="py-2.5 px-3">
                  <div className="flex items-center gap-1.5">
                    {meta.label ? (
                      <Medal className={`w-3.5 h-3.5 ${meta.medalColor}`} />
                    ) : (
                      <Hash className="w-3 h-3 text-gray-600" />
                    )}
                    <span className="text-xs font-bold text-gray-300 font-data tabular-nums">
                      {c.rank}
                    </span>
                  </div>
                </td>
                <td className="py-2.5 px-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <TeamAvatar name={corpsName} size="xs" />
                    <div className="min-w-0">
                      <span className={`text-sm font-bold block truncate ${c.rank === 1 ? 'text-yellow-500' : 'text-white'}`}>
                        {corpsName}
                      </span>
                      {meta.label && (
                        <span className={`text-[10px] uppercase tracking-wider ${meta.accent}`}>
                          {meta.label}
                        </span>
                      )}
                    </div>
                  </div>
                </td>
                <td className="py-2.5 px-2 hidden sm:table-cell">
                  {c.uid ? (
                    <Link
                      to={`/profile/${c.uid}`}
                      className="text-xs text-gray-400 hover:text-[#0057B8] transition-colors truncate block"
                    >
                      {c.username || '—'}
                    </Link>
                  ) : (
                    <span className="text-xs text-gray-400 truncate block">{c.username || '—'}</span>
                  )}
                </td>
                <td className="py-2.5 px-3 text-right">
                  <span className={`text-sm font-bold font-data tabular-nums ${c.rank === 1 ? 'text-yellow-500' : 'text-white'}`}>
                    {formatScore(c.score)}
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};

const NoChampionsPanel = ({ classKey }) => (
  <div className="bg-[#1a1a1a] border border-[#333] p-10 text-center max-w-md mx-auto my-8">
    <div className="w-14 h-14 mx-auto mb-4 border border-[#333] flex items-center justify-center">
      <Trophy className="w-7 h-7 text-gray-600" />
    </div>
    <h3 className="text-base font-bold text-white uppercase tracking-wider mb-2">
      No {CLASS_CONFIG[classKey]?.name} Champions Yet
    </h3>
    <p className="text-sm text-gray-400 leading-relaxed">
      Once a season concludes, its champions will be inducted here.
    </p>
  </div>
);

// =============================================================================
// MAIN COMPONENT
// =============================================================================

const HallOfChampions = () => {
  const [loading, setLoading] = useState(true);
  const [seasons, setSeasons] = useState([]);
  const [selectedClass, setSelectedClass] = useState('worldClass');
  const [selectedSeason, setSelectedSeason] = useState(null);

  useEffect(() => {
    let cancelled = false;
    const fetchSeasonChampions = async () => {
      try {
        setLoading(true);
        const championsRef = collection(db, 'season_champions');
        const championsSnapshot = await getDocs(championsRef);

        const seasonsData = [];
        championsSnapshot.forEach((doc) => {
          const data = doc.data();
          seasonsData.push({
            id: doc.id,
            seasonName: data.seasonName,
            seasonType: data.seasonType,
            archivedAt: data.archivedAt?.toDate?.() || (data.archivedAt ? new Date(data.archivedAt) : null),
            classes: data.classes || {},
          });
        });

        seasonsData.sort((a, b) => (b.archivedAt?.getTime?.() || 0) - (a.archivedAt?.getTime?.() || 0));

        if (cancelled) return;
        setSeasons(seasonsData);
      } catch (error) {
        console.error('Error fetching season champions:', error);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    fetchSeasonChampions();
    return () => { cancelled = true; };
  }, []);

  // Only seasons that actually have a crowned champion in the active class
  const crownedSeasons = useMemo(() => {
    return seasons.filter((s) => (s.classes?.[selectedClass]?.length || 0) > 0);
  }, [seasons, selectedClass]);

  // Default to the most recent crowned season for the active class.
  // When the class changes (or a stale season is selected), snap to the newest crowned one.
  useEffect(() => {
    if (crownedSeasons.length === 0) {
      if (selectedSeason) setSelectedSeason(null);
      return;
    }
    const stillValid = selectedSeason && crownedSeasons.some((s) => s.id === selectedSeason.id);
    if (!stillValid) {
      setSelectedSeason(crownedSeasons[0]);
    }
  }, [crownedSeasons, selectedSeason]);

  const currentChampions = useMemo(() => {
    if (!selectedSeason) return [];
    return selectedSeason.classes?.[selectedClass] || [];
  }, [selectedSeason, selectedClass]);

  const totalCrowns = crownedSeasons.length;

  // Margin / spread stats for the champion plaque
  const fieldStats = useMemo(() => {
    if (currentChampions.length === 0) return { margin: null, gap: null };
    const top = currentChampions[0]?.score;
    const second = currentChampions[1]?.score;
    const last = currentChampions[currentChampions.length - 1]?.score;
    return {
      margin: typeof top === 'number' && typeof last === 'number' ? top - last : null,
      gap: typeof top === 'number' && typeof second === 'number' ? top - second : null,
    };
  }, [currentChampions]);

  if (loading) return <LoadingScreen fullScreen={false} />;

  const showSidebarOnly = !selectedSeason;
  const champion = currentChampions[0];

  return (
    <div className="flex flex-col h-full min-h-0 bg-[#0a0a0a]">
      <div className="flex-1 flex min-h-0">

        {/* ========================================================
            SIDEBAR — Season list
            ======================================================== */}
        <div className={`flex flex-col min-h-0 border-r border-[#333] bg-[#111] ${
          selectedSeason ? 'hidden lg:flex lg:w-72 xl:w-80' : 'w-full lg:w-72 xl:w-80'
        }`}>
          {/* Header */}
          <div className="flex-shrink-0 px-4 py-3 border-b border-[#333] bg-[#1a1a1a]">
            <div className="flex items-center gap-2 mb-3">
              <Trophy className="w-4 h-4 text-yellow-500" />
              <h1 className="text-sm font-bold text-white uppercase tracking-widest">
                Hall of Champions
              </h1>
            </div>
            <div className="flex items-center gap-3 text-[10px] uppercase tracking-wider">
              <span className="flex items-center gap-1 text-gray-500">
                <Crown className="w-3 h-3 text-yellow-500" />
                <span className="font-data tabular-nums text-gray-300">{totalCrowns}</span>
                {' '}Crowned {totalCrowns === 1 ? 'Season' : 'Seasons'}
              </span>
            </div>
          </div>

          {/* Division switcher */}
          <div className="flex-shrink-0 border-b border-[#333] bg-[#0a0a0a]">
            <div className="px-4 py-2 text-[10px] font-bold uppercase tracking-widest text-gray-500">
              Division
            </div>
            <div className="flex border-t border-[#333]">
              {Object.entries(CLASS_CONFIG).map(([classKey, config]) => {
                const isSelected = selectedClass === classKey;
                return (
                  <button
                    key={classKey}
                    onClick={() => setSelectedClass(classKey)}
                    className={`flex-1 px-2 py-2.5 text-[10px] font-bold uppercase tracking-wider transition-colors border-r border-[#333] last:border-r-0 ${
                      isSelected
                        ? 'bg-[#0057B8] text-white'
                        : 'text-gray-400 hover:bg-[#1a1a1a] hover:text-white'
                    }`}
                  >
                    {config.short}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Section label */}
          <div className="flex-shrink-0 bg-[#0a0a0a] border-b border-[#333] px-4 py-1.5">
            <span className="text-[10px] font-bold uppercase tracking-widest text-gray-500">
              Champions · Most Recent First
            </span>
          </div>

          {/* Season list */}
          <div className="flex-1 min-h-0 overflow-y-auto scroll-momentum">
            {crownedSeasons.length === 0 ? (
              <div className="px-4 py-12 text-center">
                <Trophy className="w-8 h-8 text-gray-700 mx-auto mb-2" />
                <p className="text-xs text-gray-500 uppercase tracking-wider">No champions recorded</p>
              </div>
            ) : (
              crownedSeasons.map((season) => (
                <SeasonRow
                  key={season.id}
                  season={season}
                  isSelected={selectedSeason?.id === season.id}
                  classKey={selectedClass}
                  onSelect={setSelectedSeason}
                />
              ))
            )}
          </div>
        </div>

        {/* ========================================================
            MAIN STAGE — Champion plaque + finalists table
            ======================================================== */}
        <div className={`flex-1 flex flex-col min-h-0 ${showSidebarOnly ? 'hidden lg:flex' : 'flex'}`}>
          {!selectedSeason ? (
            <div className="flex-1 flex items-center justify-center px-4">
              <NoChampionsPanel classKey={selectedClass} />
            </div>
          ) : (
            <>
              {/* Mobile back bar */}
              <div className="lg:hidden flex-shrink-0 px-4 py-2.5 border-b border-[#333] bg-[#1a1a1a]">
                <button
                  onClick={() => setSelectedSeason(null)}
                  className="flex items-center gap-2 text-gray-300 hover:text-white transition-colors"
                >
                  <ArrowLeft className="w-4 h-4" />
                  <span className="text-xs font-bold uppercase tracking-wider">Seasons</span>
                </button>
              </div>

              {/* Season header strip */}
              <div className="flex-shrink-0 bg-[#1a1a1a] border-b border-[#333]">
                <div className="px-4 sm:px-6 py-3 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 text-[10px] uppercase tracking-widest text-gray-500 mb-0.5">
                      <span>Championship Record</span>
                    </div>
                    <h2 className="text-base sm:text-lg font-bold text-white uppercase tracking-wider truncate">
                      {parseSeasonName(selectedSeason.seasonName).type}{' '}
                      <span className="text-gray-400 font-data tabular-nums">
                        {parseSeasonName(selectedSeason.seasonName).year}
                      </span>
                    </h2>
                  </div>
                  <div className="flex-shrink-0 flex items-center gap-2 text-[10px] uppercase tracking-wider">
                    <span className="hidden sm:inline-flex items-center gap-1 px-2 py-1 bg-[#0a0a0a] border border-[#333] text-gray-300">
                      <Users className="w-3 h-3" />
                      {currentChampions.length} Finalists
                    </span>
                    <span className="inline-flex items-center gap-1 px-2 py-1 bg-yellow-500 text-black font-bold">
                      {CLASS_CONFIG[selectedClass]?.name}
                    </span>
                  </div>
                </div>
              </div>

              {/* Body */}
              <div className="flex-1 min-h-0 overflow-y-auto scroll-momentum">
                <div className="max-w-3xl mx-auto px-4 sm:px-6 py-5">
                  {champion && (
                    <ChampionPlaque
                      champion={champion}
                      season={selectedSeason}
                      classKey={selectedClass}
                      fieldStats={fieldStats}
                    />
                  )}
                  <FinalistsTable champions={currentChampions} />
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default HallOfChampions;
