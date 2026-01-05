// =============================================================================
// DASHBOARD - TEAM OVERVIEW (ESPN Fantasy Style)
// =============================================================================
// Hero: Active Lineup Roster Table. Sidebar: Season Scorecard + Recent Results.
// Laws: App Shell, 2/3 + 1/3 grid, data tables over cards, no glow

import React, { useState, useEffect, useMemo, useCallback, lazy, Suspense } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  Trophy, Edit, TrendingUp, TrendingDown, Minus,
  Calendar, Users, Lock, ChevronRight, Activity, MapPin,
  Flame, Coins, Medal, Palette
} from 'lucide-react';
import { useAuth } from '../App';
import { db } from '../firebase';
import { doc, updateDoc, getDoc } from 'firebase/firestore';
import toast from 'react-hot-toast';

// Lazy-load modals
const CaptionSelectionModal = lazy(() => import('../components/CaptionSelection/CaptionSelectionModal'));
const SeasonSetupWizard = lazy(() => import('../components/SeasonSetupWizard'));

import {
  ClassUnlockCongratsModal,
  CorpsRegistrationModal,
  EditCorpsModal,
  DeleteConfirmModal,
  RetireConfirmModal,
  MoveCorpsModal,
  AchievementModal,
  OnboardingTour,
  QuickStartGuide,
  UniformDesignModal,
} from '../components/Dashboard';

import { useDashboardData } from '../hooks/useDashboardData';
import { useScoresData } from '../hooks/useScoresData';
import { useMyLeagues } from '../hooks/useLeagues';
import { retireCorps } from '../firebase/functions';
import { registerCorps, unlockClassWithCorpsCoin } from '../api/functions';
import ClassPurchaseModal from '../components/modals/ClassPurchaseModal';
import { useHaptic } from '../hooks/useHaptic';
import { useModalQueue, MODAL_PRIORITY } from '../hooks/useModalQueue';
import { useSeasonStore } from '../store/seasonStore';
import { CORPS_CLASS_ORDER } from '../utils/corps';

// =============================================================================
// CONSTANTS
// =============================================================================

const CLASS_LABELS = {
  worldClass: 'World',
  openClass: 'Open',
  aClass: 'A Class',
  soundSport: 'SoundSport',
};

// Note: CORPS_CLASS_ORDER is imported from utils/corps for consistent ordering across the site

const CLASS_SHORT_LABELS = {
  worldClass: 'World',
  openClass: 'Open',
  aClass: 'Class A',
  soundSport: 'SoundSport',
};

const CAPTIONS = [
  { id: 'GE1', name: 'GE1', fullName: 'General Effect 1', category: 'ge' },
  { id: 'GE2', name: 'GE2', fullName: 'General Effect 2', category: 'ge' },
  { id: 'VP', name: 'VP', fullName: 'Visual Proficiency', category: 'vis' },
  { id: 'VA', name: 'VA', fullName: 'Visual Analysis', category: 'vis' },
  { id: 'CG', name: 'CG', fullName: 'Color Guard', category: 'vis' },
  { id: 'B', name: 'Brass', fullName: 'Brass', category: 'mus' },
  { id: 'MA', name: 'MA', fullName: 'Music Analysis', category: 'mus' },
  { id: 'P', name: 'Perc', fullName: 'Percussion', category: 'mus' },
];

const CLASS_UNLOCK_LEVELS = { aClass: 3, open: 5, world: 10 };
const CLASS_UNLOCK_COSTS = { aClass: 1000, open: 2500, world: 5000 };
const CLASS_DISPLAY_NAMES = { aClass: 'A Class', open: 'Open Class', world: 'World Class' };

// SoundSport medal rating thresholds
const SOUNDSPORT_RATING_THRESHOLDS = [
  { rating: 'Gold', min: 90, color: 'bg-yellow-500', textColor: 'text-black' },
  { rating: 'Silver', min: 75, color: 'bg-stone-300', textColor: 'text-black' },
  { rating: 'Bronze', min: 60, color: 'bg-orange-300', textColor: 'text-black' },
  { rating: 'Participation', min: 0, color: 'bg-white', textColor: 'text-black' },
];

const getSoundSportRating = (score) => {
  for (const threshold of SOUNDSPORT_RATING_THRESHOLDS) {
    if (score >= threshold.min) return threshold;
  }
  return SOUNDSPORT_RATING_THRESHOLDS[SOUNDSPORT_RATING_THRESHOLDS.length - 1];
};

// =============================================================================
// HISTORICAL SCORE HELPERS
// =============================================================================

/**
 * Get the effective current day for score filtering
 * Scores are processed at 2 AM, so between midnight and 2 AM
 * we should still show the previous day's cutoff
 */
const getEffectiveDay = (currentDay) => {
  const now = new Date();
  const hour = now.getHours();
  // Scores for day N are processed at 2 AM and become available after that.
  // After 2 AM: previous day's scores were just processed (currentDay - 1)
  // Before 2 AM: scores only available up to currentDay - 2 (yesterday's processing hasn't run)
  const effectiveDay = hour < 2 ? currentDay - 2 : currentDay - 1;

  // Return null if no scores should be available yet (e.g., day 1)
  return effectiveDay >= 1 ? effectiveDay : null;
};

/**
 * Process historical scores for a corps to get category totals (for SoundSport)
 * Returns: { geTotal, visTotal, musTotal } from the most recent score
 */
const processCategoryTotals = (yearData, corpsName, effectiveDay) => {
  // If no effective day (e.g., day 1 before scores processed), return no scores
  if (effectiveDay === null) {
    return { geTotal: null, visTotal: null, musTotal: null };
  }

  const scores = [];

  for (const event of yearData) {
    // Only include scores from days up to and including the effective day
    // effectiveDay represents the day whose scores have been processed (at 2 AM)
    if (event.offSeasonDay > effectiveDay) continue;

    const scoreData = event.scores?.find(s => s.corps === corpsName);
    if (scoreData?.captions) {
      scores.push({
        day: event.offSeasonDay,
        captions: scoreData.captions
      });
    }
  }

  if (scores.length === 0) {
    return { geTotal: null, visTotal: null, musTotal: null };
  }

  // Sort by day descending (most recent first)
  scores.sort((a, b) => b.day - a.day);
  const latestCaptions = scores[0].captions;

  // Calculate category totals
  const geTotal = (latestCaptions.GE1 || 0) + (latestCaptions.GE2 || 0);
  const visTotal = (latestCaptions.VP || 0) + (latestCaptions.VA || 0) + (latestCaptions.CG || 0);
  const musTotal = (latestCaptions.B || 0) + (latestCaptions.MA || 0) + (latestCaptions.P || 0);

  // Calculate trends for each category by comparing to previous score
  let geTrend = null, visTrend = null, musTrend = null;

  if (scores.length > 1) {
    const previousCaptions = scores[1].captions;
    const prevGe = (previousCaptions.GE1 || 0) + (previousCaptions.GE2 || 0);
    const prevVis = (previousCaptions.VP || 0) + (previousCaptions.VA || 0) + (previousCaptions.CG || 0);
    const prevMus = (previousCaptions.B || 0) + (previousCaptions.MA || 0) + (previousCaptions.P || 0);

    const calcTrend = (current, previous) => {
      const delta = current - previous;
      if (delta > 0.001) return { direction: 'up', delta: `+${delta.toFixed(2)}` };
      if (delta < -0.001) return { direction: 'down', delta: delta.toFixed(2) };
      return { direction: 'same', delta: '0.00' };
    };

    geTrend = calcTrend(geTotal, prevGe);
    visTrend = calcTrend(visTotal, prevVis);
    musTrend = calcTrend(musTotal, prevMus);
  }

  return { geTotal, visTotal, musTotal, geTrend, visTrend, musTrend };
};

/**
 * Process historical scores for a corps to get caption-specific data
 * Returns: { score, trend, nextShow } for a given caption
 */
const processCaptionScores = (yearData, corpsName, captionId, effectiveDay) => {
  // If no effective day (e.g., day 1 before scores processed), return no scores
  // but still find the next upcoming show
  if (effectiveDay === null) {
    // Find the first show (day 1)
    const sortedEvents = [...yearData].sort((a, b) => (a.offSeasonDay || 0) - (b.offSeasonDay || 0));
    const firstShow = sortedEvents.find(e => e.scores?.find(s => s.corps === corpsName));
    return {
      score: null,
      trend: null,
      nextShow: firstShow ? { day: firstShow.offSeasonDay, location: firstShow.eventName || firstShow.name || 'TBD' } : null
    };
  }

  const scores = [];
  let nextShow = null;

  // Sort events by day
  const sortedEvents = [...yearData].sort((a, b) => (a.offSeasonDay || 0) - (b.offSeasonDay || 0));

  for (const event of sortedEvents) {
    const scoreData = event.scores?.find(s => s.corps === corpsName);

    // Find next upcoming show (first event with day > effectiveDay)
    if (event.offSeasonDay > effectiveDay && !nextShow && scoreData) {
      nextShow = {
        day: event.offSeasonDay,
        location: event.eventName || event.name || 'TBD'
      };
    }

    // Only include scores from days up to and including the effective day
    // effectiveDay represents the day whose scores have been processed (at 2 AM)
    if (event.offSeasonDay > effectiveDay) continue;

    if (scoreData?.captions) {
      const captionScore = scoreData.captions[captionId];
      // Skip zero scores
      if (captionScore && captionScore > 0) {
        scores.push({
          day: event.offSeasonDay,
          score: captionScore,
          eventName: event.eventName || event.name
        });
      }
    }
  }

  if (scores.length === 0) {
    return { score: null, trend: null, nextShow };
  }

  // Sort by day descending (most recent first)
  scores.sort((a, b) => b.day - a.day);

  const latestScore = scores[0].score;
  const latestDay = scores[0].day;

  // Find previous score from a different day
  let previousScore = null;
  for (let i = 1; i < scores.length; i++) {
    if (scores[i].day !== latestDay) {
      previousScore = scores[i].score;
      break;
    }
  }

  // Calculate trend
  let trend = null;
  if (previousScore !== null) {
    const delta = latestScore - previousScore;
    if (delta > 0.001) {
      trend = { direction: 'up', delta: `+${delta.toFixed(2)}` };
    } else if (delta < -0.001) {
      trend = { direction: 'down', delta: delta.toFixed(2) };
    } else {
      trend = { direction: 'same', delta: '0.00' };
    }
  }

  return { score: latestScore, trend, nextShow };
};

// =============================================================================
// SKELETON COMPONENTS
// =============================================================================

const SkeletonRow = () => (
  <tr className="border-b border-[#222]">
    <td className="py-2.5 px-3"><div className="w-10 h-6 bg-[#333] animate-pulse" /></td>
    <td className="py-2.5 px-3"><div className="w-32 h-4 bg-[#333] animate-pulse" /></td>
    <td className="py-2.5 px-2 text-right"><div className="w-14 h-4 bg-[#333] animate-pulse ml-auto" /></td>
    <td className="py-2.5 px-2 text-center"><div className="w-8 h-4 bg-[#333] animate-pulse mx-auto" /></td>
    <td className="py-2.5 px-3 text-right"><div className="w-20 h-4 bg-[#333] animate-pulse ml-auto" /></td>
  </tr>
);

// =============================================================================
// CONTROL BAR (Split: Class Tabs + Director HUD)
// =============================================================================

// Helper to get next class unlock info
// Note: unlockedClasses uses 'aClass', 'openClass', 'worldClass' format
// But CLASS_UNLOCK_* constants use 'aClass', 'open', 'world' format
const getNextClassUnlock = (unlockedClasses, xpLevel, corpsCoin) => {
  // Map from unlock key to profile key
  const classConfig = [
    { unlockKey: 'aClass', profileKey: 'aClass' },
    { unlockKey: 'open', profileKey: 'openClass' },
    { unlockKey: 'world', profileKey: 'worldClass' },
  ];

  for (const { unlockKey, profileKey } of classConfig) {
    if (!unlockedClasses?.includes(profileKey)) {
      const levelRequired = CLASS_UNLOCK_LEVELS[unlockKey];
      const coinCost = CLASS_UNLOCK_COSTS[unlockKey];
      const meetsLevel = xpLevel >= levelRequired;
      const canAfford = corpsCoin >= coinCost;
      return {
        className: CLASS_DISPLAY_NAMES[unlockKey],
        classKey: unlockKey,
        levelRequired,
        coinCost,
        meetsLevel,
        canAfford,
      };
    }
  }
  return null;
};

const ControlBar = ({
  corps,
  activeCorpsClass,
  unlockedClasses,
  profile,
  onSwitch,
  onCreateCorps,
  onUnlockClass
}) => {
  // Director stats from profile
  const streak = profile?.engagement?.loginStreak || 0;
  const corpsCoin = profile?.corpsCoin || 0;
  const level = profile?.xpLevel || 1;

  // Calculate next class unlock
  const nextUnlock = getNextClassUnlock(unlockedClasses, level, corpsCoin);

  return (
    <div className="sticky top-0 z-10 bg-[#1a1a1a] border-b border-[#333]">
      <div className="flex items-center justify-between px-4 py-2">
        {/* LEFT: Class Switcher (Fixed 4 Tabs) */}
        <div className="flex items-center gap-1">
          {CORPS_CLASS_ORDER.map((classId) => {
            const isUnlocked = unlockedClasses?.includes(classId);
            const hasCorps = corps && corps[classId];
            const isActive = classId === activeCorpsClass && hasCorps;

            // Locked class - don't show
            if (!isUnlocked) return null;

            // Empty slot (unlocked but no corps)
            if (!hasCorps) {
              return (
                <button
                  key={classId}
                  onClick={() => onCreateCorps?.(classId)}
                  className="text-[10px] font-bold uppercase px-3 py-1.5 rounded-sm text-gray-600 hover:text-gray-400 border border-dashed border-[#444] transition-colors"
                >
                  {CLASS_SHORT_LABELS[classId]}
                </button>
              );
            }

            // Has corps - clickable tab
            return (
              <button
                key={classId}
                onClick={() => onSwitch(classId)}
                className={`text-[10px] font-bold uppercase px-3 py-1.5 rounded-sm transition-colors ${
                  isActive
                    ? 'bg-[#0057B8] text-white'
                    : 'text-gray-500 hover:text-white hover:bg-white/5'
                }`}
              >
                {CLASS_SHORT_LABELS[classId]}
              </button>
            );
          })}
        </div>

        {/* RIGHT: Director HUD - Order: Streak, Level, Coins, Buy */}
        <div className="flex items-center gap-3">
          {/* Streak */}
          {streak > 0 && (
            <div className="flex items-center gap-1">
              <Flame className="w-3.5 h-3.5 text-orange-500" />
              <span className="text-xs font-bold text-orange-500 font-data tabular-nums">
                {streak}
              </span>
            </div>
          )}

          {/* Level */}
          <div className="flex items-center">
            <span className="text-[10px] font-bold uppercase px-2 py-0.5 bg-purple-500/20 text-purple-400 rounded-sm">
              Lvl {level}
            </span>
          </div>

          {/* CorpsCoin Wallet */}
          <div className="flex items-center gap-1">
            <Coins className="w-3.5 h-3.5 text-yellow-500" />
            <span className="text-xs font-bold text-yellow-500 font-data tabular-nums">
              {corpsCoin.toLocaleString()}
            </span>
          </div>

          {/* Buy Button - show when user can afford next class */}
          {nextUnlock ? (
            nextUnlock.canAfford && onUnlockClass ? (
              <button
                onClick={() => onUnlockClass(nextUnlock.classKey)}
                className={`h-7 px-2.5 text-[10px] font-bold uppercase tracking-wider flex items-center gap-1 transition-colors ${
                  nextUnlock.meetsLevel
                    ? 'bg-green-600 hover:bg-green-500 text-white'
                    : 'bg-yellow-600 hover:bg-yellow-500 text-white'
                }`}
                title={`${nextUnlock.meetsLevel ? 'Unlock' : 'Buy'} ${nextUnlock.className} (${nextUnlock.coinCost.toLocaleString()} CC)`}
              >
                <Coins className="w-3 h-3" />
                {nextUnlock.meetsLevel ? 'Unlock' : 'Buy'}
              </button>
            ) : (
              <span className="text-[10px] text-gray-500">
                {nextUnlock.className}: {nextUnlock.coinCost}CC needed
              </span>
            )
          ) : (
            <span className="text-[10px] text-green-500">All unlocked</span>
          )}
        </div>
      </div>
    </div>
  );
};

// =============================================================================
// ACTIVE LINEUP TABLE (HERO)
// =============================================================================

const ActiveLineupTable = ({
  lineup,
  lineupScoreData,
  loading,
  onManageLineup,
  onSlotClick
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
              <th className="text-right py-2 px-2 text-[10px] font-bold uppercase tracking-wider text-gray-500 w-20">
                Last Score
              </th>
              <th className="text-center py-2 px-2 text-[10px] font-bold uppercase tracking-wider text-gray-500 w-20">
                Trend
              </th>
              <th className="text-right py-2 px-3 text-[10px] font-bold uppercase tracking-wider text-gray-500 w-32">
                Next Show
              </th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              Array.from({ length: 8 }).map((_, i) => <SkeletonRow key={i} />)
            ) : (
              CAPTIONS.map((caption) => {
                const value = lineup[caption.id];
                const hasValue = !!value;
                const [corpsName, sourceYear] = hasValue ? value.split('|') : [null, null];
                const captionData = lineupScoreData?.[caption.id] || {};
                const { score, trend, nextShow } = captionData;

                return (
                  <tr
                    key={caption.id}
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
                    <td className="py-2.5 px-2 text-right">
                      {score !== null && score !== undefined ? (
                        <span className="text-sm font-bold text-white font-data tabular-nums">
                          {score.toFixed(2)}
                        </span>
                      ) : (
                        <span className="text-sm text-gray-600">—</span>
                      )}
                    </td>

                    {/* Trend */}
                    <td className="py-2.5 px-2 text-center">
                      {trend ? (
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
              })
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
};

// =============================================================================
// SEASON SCORECARD (SIDEBAR)
// =============================================================================

const SeasonScorecard = ({ score, rank, rankChange, corpsName, corpsClass, loading, avatarUrl, onDesignUniform }) => {
  const isSoundSport = corpsClass === 'soundSport';
  const rating = isSoundSport && score ? getSoundSportRating(score) : null;

  return (
    <div className="bg-[#1a1a1a] border border-[#333] overflow-hidden">
      <div className="bg-[#222] px-4 py-3 border-b border-[#333]">
        <h3 className="text-[10px] font-bold uppercase tracking-wider text-gray-400 flex items-center gap-2">
          <Trophy className="w-3.5 h-3.5 text-yellow-500" />
          Season Scorecard
        </h3>
      </div>

      <div className="p-4">
        {/* Corps Identity */}
        <div className="flex items-center gap-3 mb-4 pb-4 border-b border-[#333]">
          <button
            onClick={onDesignUniform}
            className="relative w-12 h-12 bg-[#333] border border-[#444] flex items-center justify-center hover:border-[#0057B8] transition-colors group"
            title="Design Uniform"
          >
            {avatarUrl ? (
              <img src={avatarUrl} alt={corpsName} className="w-full h-full object-cover" />
            ) : (
              <Trophy className="w-6 h-6 text-yellow-500" />
            )}
            <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
              <Palette className="w-4 h-4 text-white" />
            </div>
          </button>
          <div className="flex-1 min-w-0">
            <p className="text-base font-bold text-white truncate">{corpsName || 'My Corps'}</p>
            <p className="text-[10px] uppercase tracking-wider text-gray-500">
              {CLASS_LABELS[corpsClass] || corpsClass}
            </p>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 gap-3">
          {/* Total Score / Medal Rating */}
          <div className="bg-[#222] p-3">
            <p className="text-[10px] uppercase tracking-wider text-gray-500 mb-1">
              {isSoundSport ? 'Medal Rating' : 'Season Score'}
            </p>
            {loading ? (
              <div className="h-8 w-20 bg-[#333] animate-pulse" />
            ) : isSoundSport && rating ? (
              // SoundSport: Display medal badge
              <div className={`inline-flex items-center gap-1.5 px-2 py-1 ${rating.color} rounded-sm`}>
                <Medal className={`w-4 h-4 ${rating.textColor}`} />
                <span className={`text-lg font-bold ${rating.textColor}`}>
                  {rating.rating}
                </span>
              </div>
            ) : isSoundSport ? (
              <p className="text-2xl font-bold text-gray-500 font-data tabular-nums">
                —
              </p>
            ) : (
              <p className="text-2xl font-bold text-white font-data tabular-nums">
                {score?.toFixed(2) || '0.00'}
              </p>
            )}
          </div>

          {/* Rank */}
          <div className="bg-[#222] p-3">
            <p className="text-[10px] uppercase tracking-wider text-gray-500 mb-1">Rank</p>
            {loading ? (
              <div className="h-8 w-16 bg-[#333] animate-pulse" />
            ) : isSoundSport ? (
              // SoundSport doesn't have rankings
              <p className="text-2xl font-bold text-gray-500 font-data tabular-nums">
                #-
              </p>
            ) : (
              <div className="flex items-center gap-2">
                <p className="text-2xl font-bold text-white font-data tabular-nums">
                  #{rank || '-'}
                </p>
                {rankChange !== null && rankChange !== 0 && (
                  <span className={`text-xs font-bold flex items-center gap-0.5 ${
                    rankChange > 0 ? 'text-green-500' : 'text-red-500'
                  }`}>
                    {rankChange > 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                    {Math.abs(rankChange)}
                  </span>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

// =============================================================================
// RECENT RESULTS FEED (SIDEBAR)
// =============================================================================

const RecentResultsFeed = ({ results, loading, corpsClass }) => {
  const isSoundSport = corpsClass === 'soundSport';

  return (
    <div className="bg-[#1a1a1a] border border-[#333] overflow-hidden">
      <div className="bg-[#222] px-4 py-3 border-b border-[#333]">
        <h3 className="text-[10px] font-bold uppercase tracking-wider text-gray-400 flex items-center gap-2">
          <Activity className="w-3.5 h-3.5 text-purple-500" />
          Recent Results
        </h3>
      </div>

      {loading ? (
        <div className="p-4 space-y-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="flex items-center justify-between">
              <div className="w-32 h-4 bg-[#333] animate-pulse" />
              <div className="w-16 h-4 bg-[#333] animate-pulse" />
            </div>
          ))}
        </div>
      ) : results && results.length > 0 ? (
        <div className="divide-y divide-[#222]">
          {results.slice(0, 5).map((result, idx) => {
            // For SoundSport, get the medal rating
            const rating = isSoundSport && result.score ? getSoundSportRating(result.score) : null;

            return (
              <div key={idx} className="px-4 py-3 flex items-center justify-between">
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-white truncate">{result.eventName}</p>
                  <p className="text-[10px] text-gray-500">{result.date || 'Recent'}</p>
                </div>
                <div className="text-right ml-3">
                  {isSoundSport && rating ? (
                    // SoundSport: Display medal badge
                    <div className={`inline-flex items-center gap-1 px-2 py-1 ${rating.color} rounded-sm`}>
                      <Medal className={`w-3 h-3 ${rating.textColor}`} />
                      <span className={`text-xs font-bold ${rating.textColor}`}>
                        {rating.rating}
                      </span>
                    </div>
                  ) : (
                    // Other classes: Display numeric score
                    <>
                      <p className="text-sm font-bold text-yellow-500 font-data tabular-nums">
                        {result.score?.toFixed(2)}
                      </p>
                      {result.placement && (
                        <p className="text-[10px] text-gray-500">#{result.placement}</p>
                      )}
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="p-6 text-center">
          <Activity className="w-6 h-6 text-gray-600 mx-auto mb-2" />
          <p className="text-xs text-gray-500">No results yet</p>
          <p className="text-[10px] text-gray-600 mt-1">Compete in shows to see results</p>
        </div>
      )}
    </div>
  );
};

// =============================================================================
// LEAGUE STATUS (SIDEBAR - COMPACT)
// =============================================================================

const LeagueStatus = ({ leagues }) => {
  if (!leagues || leagues.length === 0) return null;

  return (
    <div className="bg-[#1a1a1a] border border-[#333] overflow-hidden">
      <div className="bg-[#222] px-4 py-3 border-b border-[#333] flex items-center justify-between">
        <h3 className="text-[10px] font-bold uppercase tracking-wider text-gray-400 flex items-center gap-2">
          <Users className="w-3.5 h-3.5 text-blue-500" />
          Leagues
        </h3>
        <Link to="/leagues" className="text-[10px] text-gray-500 hover:text-white">
          View All →
        </Link>
      </div>

      <div className="divide-y divide-[#222]">
        {leagues.slice(0, 2).map((league, idx) => (
          <Link
            key={league.id || idx}
            to="/leagues"
            className="flex items-center justify-between px-4 py-2.5 hover:bg-[#222] transition-colors"
          >
            <span className="text-sm text-white truncate">{league.name}</span>
            <span className="text-sm font-bold text-white font-data">#{league.userRank || '-'}</span>
          </Link>
        ))}
      </div>
    </div>
  );
};

// =============================================================================
// DASHBOARD COMPONENT
// =============================================================================

const Dashboard = () => {
  const { user } = useAuth();
  const location = useLocation();
  const dashboardData = useDashboardData();
  const { aggregatedScores, loading: scoresLoading } = useScoresData({
    // Dashboard should only show current season data, not fall back to archived seasons
    disableArchiveFallback: true
  });
  const { data: myLeagues } = useMyLeagues(user?.uid);
  const { trigger: haptic } = useHaptic();
  const { weeksRemaining, isRegistrationLocked, currentDay } = useSeasonStore();

  // Modal states
  const modalQueue = useModalQueue();
  const [showRegistration, setShowRegistration] = useState(false);
  const [showCaptionSelection, setShowCaptionSelection] = useState(false);
  const [selectedCaption, setSelectedCaption] = useState(null);
  const [showEditCorps, setShowEditCorps] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showMoveCorps, setShowMoveCorps] = useState(false);
  const [showRetireConfirm, setShowRetireConfirm] = useState(false);
  const [retiring, setRetiring] = useState(false);
  const [showQuickStartGuide, setShowQuickStartGuide] = useState(false);
  const [classToPurchase, setClassToPurchase] = useState(null);
  const [lineupScoreData, setLineupScoreData] = useState({});
  const [lineupScoresLoading, setLineupScoresLoading] = useState(true);
  const [recentResults, setRecentResults] = useState([]);
  const [showUniformDesign, setShowUniformDesign] = useState(false);

  // Destructure dashboard data
  const {
    profile,
    corps,
    activeCorps,
    activeCorpsClass,
    seasonData,
    currentWeek,
    showSeasonSetupWizard,
    setShowSeasonSetupWizard,
    corpsNeedingSetup,
    handleSeasonSetupComplete,
    newlyUnlockedClass,
    clearNewlyUnlockedClass,
    newAchievement,
    clearNewAchievement,
    getCorpsClassName,
    refreshProfile,
    handleCorpsSwitch,
    unlockedClasses  // Includes admin override - admins have all classes
  } = dashboardData;

  // Computed values
  const lineup = useMemo(() => activeCorps?.lineup || {}, [activeCorps?.lineup]);
  const lineupCount = useMemo(() => Object.keys(lineup).length, [lineup]);

  const userCorpsScore = useMemo(() => {
    if (!activeCorps) return null;
    const corpsName = activeCorps.corpsName || activeCorps.name;
    const entry = aggregatedScores.find(s => s.corpsName === corpsName);
    return entry?.score ?? null;
  }, [aggregatedScores, activeCorps]);

  const userCorpsRank = useMemo(() => {
    if (!activeCorps) return null;
    const corpsName = activeCorps.corpsName || activeCorps.name;
    const entry = aggregatedScores.find(s => s.corpsName === corpsName);
    return entry?.rank ?? null;
  }, [aggregatedScores, activeCorps]);

  const thisWeekShows = useMemo(() => {
    if (!activeCorps?.selectedShows) return [];
    return (activeCorps.selectedShows[`week${currentWeek}`] || []).slice(0, 3);
  }, [activeCorps?.selectedShows, currentWeek]);

  // Fetch caption scores from historical_scores
  useEffect(() => {
    const fetchLineupScores = async () => {
      if (!lineup || Object.keys(lineup).length === 0 || !currentDay) {
        setLineupScoresLoading(false);
        return;
      }

      setLineupScoresLoading(true);
      const isSoundSport = activeCorpsClass === 'soundSport';

      try {
        // Calculate effective day (accounting for 2AM score processing)
        const effectiveDay = getEffectiveDay(currentDay);

        // Get unique years from lineup
        const yearsNeeded = new Set();
        Object.values(lineup).forEach(value => {
          if (value) {
            const [, sourceYear] = value.split('|');
            if (sourceYear) yearsNeeded.add(sourceYear);
          }
        });

        // Fetch historical_scores for each year
        const historicalData = {};
        const yearPromises = [...yearsNeeded].map(async (year) => {
          const docSnap = await getDoc(doc(db, `historical_scores/${year}`));
          if (docSnap.exists()) {
            historicalData[year] = docSnap.data().data || [];
          }
        });
        await Promise.all(yearPromises);

        // For SoundSport, pre-compute category totals for each corps/year combo
        const categoryTotalsCache = {};
        if (isSoundSport) {
          Object.values(lineup).forEach(value => {
            if (value) {
              const [corpsName, sourceYear] = value.split('|');
              const yearData = historicalData[sourceYear];
              if (yearData) {
                const cacheKey = `${corpsName}|${sourceYear}`;
                categoryTotalsCache[cacheKey] = processCategoryTotals(yearData, corpsName, effectiveDay);
              }
            }
          });
        }

        // Process scores for each caption slot
        const scoreData = {};
        CAPTIONS.forEach(caption => {
          const value = lineup[caption.id];
          if (!value) {
            scoreData[caption.id] = { score: null, trend: null, nextShow: null };
            return;
          }

          const [corpsName, sourceYear] = value.split('|');
          const yearData = historicalData[sourceYear];

          if (!yearData) {
            scoreData[caption.id] = { score: null, trend: null, nextShow: null };
            return;
          }

          // For SoundSport, show category totals instead of individual caption scores
          if (isSoundSport) {
            const cacheKey = `${corpsName}|${sourceYear}`;
            const categoryData = categoryTotalsCache[cacheKey] || {};
            const baseData = processCaptionScores(yearData, corpsName, caption.id, effectiveDay);

            // Map caption category to the appropriate total
            let categoryScore = null;
            let categoryTrend = null;
            if (caption.category === 'ge') {
              categoryScore = categoryData.geTotal;
              categoryTrend = categoryData.geTrend;
            } else if (caption.category === 'vis') {
              categoryScore = categoryData.visTotal;
              categoryTrend = categoryData.visTrend;
            } else if (caption.category === 'mus') {
              categoryScore = categoryData.musTotal;
              categoryTrend = categoryData.musTrend;
            }

            scoreData[caption.id] = {
              score: categoryScore,
              trend: categoryTrend,
              nextShow: baseData.nextShow
            };
          } else {
            // Process scores for this caption (non-SoundSport)
            scoreData[caption.id] = processCaptionScores(yearData, corpsName, caption.id, effectiveDay);
          }
        });

        setLineupScoreData(scoreData);
      } catch (error) {
        console.error('Error fetching lineup scores:', error);
      } finally {
        setLineupScoresLoading(false);
      }
    };

    fetchLineupScores();
  }, [lineup, currentDay, activeCorpsClass]);

  // Fetch recent results from fantasy_recaps (for sidebar)
  useEffect(() => {
    const fetchRecentResults = async () => {
      if (!user?.uid || !seasonData?.seasonUid || !activeCorpsClass) return;

      try {
        const recapRef = doc(db, 'fantasy_recaps', seasonData.seasonUid);
        const recapSnap = await getDoc(recapRef);

        if (recapSnap.exists()) {
          const data = recapSnap.data();
          const recaps = data.recaps || [];
          const results = [];

          // Sort by day descending
          const sortedRecaps = [...recaps].sort((a, b) => (b.offSeasonDay || 0) - (a.offSeasonDay || 0));

          for (const recap of sortedRecaps) {
            for (const show of (recap.shows || [])) {
              const userResult = (show.results || []).find(
                r => r.uid === user.uid && r.corpsClass === activeCorpsClass
              );

              if (userResult && results.length < 5) {
                results.push({
                  eventName: show.eventName || show.name || 'Show',
                  score: userResult.totalScore,
                  placement: userResult.placement,
                  date: recap.date ? new Date(recap.date.seconds * 1000).toLocaleDateString() : null
                });
              }
            }
          }

          setRecentResults(results);
        }
      } catch (error) {
        console.error('Error fetching recent results:', error);
      }
    };

    fetchRecentResults();
  }, [user?.uid, seasonData?.seasonUid, activeCorpsClass]);

  // Handle navigation state for class purchase (from header Buy button)
  useEffect(() => {
    if (location.state?.purchaseClass) {
      setClassToPurchase(location.state.purchaseClass);
      // Clear the state to prevent re-triggering on subsequent renders
      window.history.replaceState({}, document.title);
    }
  }, [location.state?.purchaseClass]);

  // Queue auto-triggered modals
  useEffect(() => {
    if (showSeasonSetupWizard && seasonData) {
      modalQueue.enqueue('seasonSetup', MODAL_PRIORITY.SEASON_SETUP, { seasonData });
    }
  }, [showSeasonSetupWizard, seasonData, modalQueue.enqueue]);

  useEffect(() => {
    if (profile?.isFirstVisit && activeCorps) {
      const timer = setTimeout(() => {
        modalQueue.enqueue('onboarding', MODAL_PRIORITY.ONBOARDING);
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [profile?.isFirstVisit, activeCorps, modalQueue.enqueue]);

  useEffect(() => {
    if (newlyUnlockedClass) {
      modalQueue.enqueue('classUnlock', MODAL_PRIORITY.CLASS_UNLOCK, { unlockedClass: newlyUnlockedClass });
    }
  }, [newlyUnlockedClass, modalQueue.enqueue]);

  useEffect(() => {
    if (newAchievement) {
      modalQueue.enqueue('achievement', MODAL_PRIORITY.ACHIEVEMENT, { achievement: newAchievement });
    }
  }, [newAchievement, modalQueue.enqueue]);

  useEffect(() => {
    const userModalOpen = showRegistration || showCaptionSelection || showEditCorps ||
                          showDeleteConfirm || showMoveCorps || showRetireConfirm;
    if (userModalOpen) {
      modalQueue.pauseQueue();
    } else {
      modalQueue.resumeQueue();
    }
  }, [showRegistration, showCaptionSelection, showEditCorps, showDeleteConfirm, showMoveCorps, showRetireConfirm, modalQueue]);

  // Handlers
  const handleTourComplete = useCallback(async () => {
    modalQueue.dequeue();
    if (profile?.isFirstVisit && user) {
      try {
        const profileRef = doc(db, 'artifacts/marching-art/users', user.uid, 'profile/data');
        await updateDoc(profileRef, { isFirstVisit: false });
      } catch (error) {
        console.error('Error updating first visit flag:', error);
      }
    }
  }, [modalQueue, profile?.isFirstVisit, user]);

  const handleSetupNewClass = useCallback(() => {
    modalQueue.dequeue();
    setShowRegistration(true);
  }, [modalQueue]);

  const handleDeclineSetup = useCallback(() => {
    modalQueue.dequeue();
    clearNewlyUnlockedClass();
    toast.success('You can register your new corps anytime!');
  }, [modalQueue, clearNewlyUnlockedClass]);

  const handleAchievementClose = useCallback(() => {
    modalQueue.dequeue();
    clearNewAchievement();
  }, [modalQueue, clearNewAchievement]);

  const handleSeasonSetupClose = useCallback(() => {
    modalQueue.dequeue();
    setShowSeasonSetupWizard(false);
  }, [modalQueue, setShowSeasonSetupWizard]);

  // Save initialSetupComplete flag when wizard is completed
  // This prevents the wizard from showing again on subsequent page loads
  const handleSeasonSetupFinish = useCallback(async () => {
    handleSeasonSetupComplete();
    handleSeasonSetupClose();

    // Save flag to prevent wizard from showing again this season
    if (user?.uid && seasonData?.seasonUid) {
      try {
        const profileRef = doc(db, 'artifacts/marching-art/users', user.uid, 'profile/data');
        await updateDoc(profileRef, {
          initialSetupComplete: seasonData.seasonUid
        });
      } catch (error) {
        console.error('Failed to save initial setup flag:', error);
        // Don't show error to user - the wizard closed successfully
      }
    }
  }, [handleSeasonSetupComplete, handleSeasonSetupClose, user?.uid, seasonData?.seasonUid]);

  const handleEditCorps = useCallback(async (formData) => {
    try {
      const profileRef = doc(db, 'artifacts/marching-art/users', user.uid, 'profile/data');
      await updateDoc(profileRef, {
        [`corps.${activeCorpsClass}.corpsName`]: formData.name,
        [`corps.${activeCorpsClass}.location`]: formData.location,
        [`corps.${activeCorpsClass}.showConcept`]: formData.showConcept,
      });
      toast.success('Corps updated!');
      setShowEditCorps(false);
    } catch (error) {
      toast.error('Failed to update corps');
    }
  }, [user, activeCorpsClass]);

  const handleDeleteCorps = useCallback(async () => {
    try {
      const profileRef = doc(db, 'artifacts/marching-art/users', user.uid, 'profile/data');
      await updateDoc(profileRef, { [`corps.${activeCorpsClass}`]: null });
      toast.success('Corps deleted');
      setShowDeleteConfirm(false);
    } catch (error) {
      toast.error('Failed to delete corps');
    }
  }, [user, activeCorpsClass]);

  const handleRetireCorps = useCallback(async () => {
    setRetiring(true);
    try {
      const result = await retireCorps({ corpsClass: activeCorpsClass });
      if (result.data.success) {
        toast.success(result.data.message);
        setShowRetireConfirm(false);
      }
    } catch (error) {
      toast.error(error.message || 'Failed to retire corps');
    } finally {
      setRetiring(false);
    }
  }, [activeCorpsClass]);

  const handleMoveCorps = useCallback(async (targetClass) => {
    try {
      if (corps[targetClass]) {
        toast.error(`Already have a corps in ${getCorpsClassName(targetClass)}`);
        return;
      }
      const profileRef = doc(db, 'artifacts/marching-art/users', user.uid, 'profile/data');
      await updateDoc(profileRef, {
        [`corps.${targetClass}`]: { ...activeCorps, class: targetClass },
        [`corps.${activeCorpsClass}`]: null
      });
      toast.success('Corps moved!');
      setShowMoveCorps(false);
    } catch (error) {
      toast.error('Failed to move corps');
    }
  }, [corps, getCorpsClassName, user, activeCorps, activeCorpsClass]);

  const handleCorpsRegistration = useCallback(async (formData) => {
    try {
      if (!seasonData?.seasonUid) {
        toast.error('Season data not loaded');
        return;
      }
      const result = await registerCorps({
        corpsName: formData.name,
        location: formData.location,
        showConcept: formData.showConcept || '',
        class: formData.class
      });
      if (result.data.success) {
        toast.success(`${formData.name} registered!`);
        setShowRegistration(false);
        clearNewlyUnlockedClass();
        refreshProfile?.();
      }
    } catch (error) {
      toast.error(error.message || 'Failed to register corps');
    }
  }, [seasonData?.seasonUid, clearNewlyUnlockedClass, refreshProfile]);

  const handleClassUnlock = useCallback((classKey) => {
    setClassToPurchase(classKey);
  }, []);

  const handleConfirmClassPurchase = useCallback(async () => {
    if (!classToPurchase) return;
    try {
      const result = await unlockClassWithCorpsCoin({ classToUnlock: classToPurchase });
      if (result.data.success) {
        toast.success(`${CLASS_DISPLAY_NAMES[classToPurchase]} unlocked!`);
        setClassToPurchase(null);
        refreshProfile?.();
      }
    } catch (error) {
      throw new Error(error.message || 'Failed to unlock class');
    }
  }, [classToPurchase, refreshProfile]);

  const openCaptionSelection = useCallback((captionId = null) => {
    setSelectedCaption(captionId);
    setShowCaptionSelection(true);
  }, []);

  const handleUniformDesign = useCallback(async (design) => {
    try {
      const profileRef = doc(db, 'artifacts/marching-art/users', user.uid, 'profile/data');
      await updateDoc(profileRef, {
        [`corps.${activeCorpsClass}.uniformDesign`]: design,
      });
      toast.success('Uniform design saved! Avatar will be generated soon.');
      setShowUniformDesign(false);
      refreshProfile?.();
    } catch (error) {
      toast.error('Failed to save uniform design');
      throw error;
    }
  }, [user, activeCorpsClass, refreshProfile]);

  // =============================================================================
  // RENDER
  // =============================================================================

  return (
    <div className="h-full flex flex-col overflow-hidden bg-[#0a0a0a]">
      {/* Season Setup Wizard */}
      {modalQueue.isActive('seasonSetup') && seasonData && (
        <Suspense fallback={null}>
          <SeasonSetupWizard
            onComplete={handleSeasonSetupFinish}
            profile={profile}
            seasonData={seasonData}
            corpsNeedingSetup={corpsNeedingSetup}
            existingCorps={corps || {}}
            retiredCorps={profile?.retiredCorps || []}
            unlockedClasses={unlockedClasses}
          />
        </Suspense>
      )}

      {/* SCROLLABLE CONTENT */}
      <div className="flex-1 overflow-y-auto min-h-0 pb-20 md:pb-4">
        {/* Control Bar - Class Tabs + Director HUD */}
        <ControlBar
          corps={corps}
          activeCorpsClass={activeCorpsClass}
          unlockedClasses={unlockedClasses}
          profile={profile}
          onSwitch={handleCorpsSwitch}
          onCreateCorps={(classId) => {
            clearNewlyUnlockedClass();
            setShowRegistration(true);
          }}
          onUnlockClass={handleClassUnlock}
        />

        {activeCorps ? (
          <div className="p-3 md:p-4">
            {/* 2/3 + 1/3 Grid Layout */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              {/* MAIN CONTENT (2/3) - Active Lineup */}
              <div className="lg:col-span-2">
                <ActiveLineupTable
                  lineup={lineup}
                  lineupScoreData={lineupScoreData}
                  loading={lineupScoresLoading}
                  onManageLineup={() => openCaptionSelection()}
                  onSlotClick={(captionId) => openCaptionSelection(captionId)}
                />
              </div>

              {/* SIDEBAR (1/3) - Season Stats */}
              <div className="space-y-4">
                <SeasonScorecard
                  score={userCorpsScore}
                  rank={userCorpsRank}
                  rankChange={null}
                  corpsName={activeCorps.corpsName || activeCorps.name}
                  corpsClass={activeCorpsClass}
                  loading={scoresLoading}
                  avatarUrl={activeCorps.avatarUrl}
                  onDesignUniform={() => setShowUniformDesign(true)}
                />

                <RecentResultsFeed
                  results={recentResults}
                  loading={scoresLoading}
                  corpsClass={activeCorpsClass}
                />

                <LeagueStatus leagues={myLeagues} />
              </div>
            </div>
          </div>
        ) : (
          /* No Corps State */
          <div className="flex items-center justify-center min-h-[60vh] p-4">
            <div className="bg-[#1a1a1a] border border-[#333] max-w-sm w-full">
              <div className="bg-[#222] px-4 py-3 border-b border-[#333]">
                <h3 className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
                  Start Your Season
                </h3>
              </div>
              <div className="p-6 text-center">
                <Trophy className="w-12 h-12 text-gray-600 mx-auto mb-4" />
                <p className="text-sm text-gray-400 mb-4">
                  Create your first fantasy corps to begin competing.
                </p>
                <button
                  onClick={() => setShowRegistration(true)}
                  className="w-full py-3 bg-[#0057B8] text-white text-sm font-bold hover:bg-[#0066d6]"
                >
                  Register Corps
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* MODALS */}
      {modalQueue.isActive('classUnlock') && newlyUnlockedClass && (
        <ClassUnlockCongratsModal
          unlockedClass={newlyUnlockedClass}
          onSetup={handleSetupNewClass}
          onDecline={handleDeclineSetup}
        />
      )}

      {showRegistration && (
        <CorpsRegistrationModal
          onClose={() => { setShowRegistration(false); clearNewlyUnlockedClass(); }}
          onSubmit={handleCorpsRegistration}
          unlockedClasses={unlockedClasses}
          defaultClass={newlyUnlockedClass}
        />
      )}

      {showCaptionSelection && activeCorps && seasonData && (
        <Suspense fallback={null}>
          <CaptionSelectionModal
            onClose={() => { setShowCaptionSelection(false); setSelectedCaption(null); }}
            onSubmit={() => { setShowCaptionSelection(false); setSelectedCaption(null); }}
            corpsClass={activeCorpsClass}
            currentLineup={activeCorps.lineup || {}}
            seasonId={seasonData.seasonUid}
            initialCaption={selectedCaption}
          />
        </Suspense>
      )}

      {showEditCorps && activeCorps && (
        <EditCorpsModal
          onClose={() => setShowEditCorps(false)}
          onSubmit={handleEditCorps}
          currentData={{
            name: activeCorps.corpsName || activeCorps.name,
            location: activeCorps.location,
            showConcept: activeCorps.showConcept
          }}
        />
      )}

      {showDeleteConfirm && activeCorps && (
        <DeleteConfirmModal
          onClose={() => setShowDeleteConfirm(false)}
          onConfirm={handleDeleteCorps}
          corpsName={activeCorps.corpsName || activeCorps.name}
          corpsClass={activeCorpsClass}
        />
      )}

      {showRetireConfirm && activeCorps && (
        <RetireConfirmModal
          onClose={() => setShowRetireConfirm(false)}
          onConfirm={handleRetireCorps}
          corpsName={activeCorps.corpsName || activeCorps.name}
          corpsClass={activeCorpsClass}
          retiring={retiring}
          inLeague={false}
        />
      )}

      {showMoveCorps && activeCorps && (
        <MoveCorpsModal
          onClose={() => setShowMoveCorps(false)}
          onMove={handleMoveCorps}
          currentClass={activeCorpsClass}
          corpsName={activeCorps.corpsName || activeCorps.name}
          unlockedClasses={unlockedClasses}
          existingCorps={corps}
        />
      )}

      {showUniformDesign && activeCorps && (
        <UniformDesignModal
          onClose={() => setShowUniformDesign(false)}
          onSubmit={handleUniformDesign}
          currentDesign={activeCorps.uniformDesign}
          corpsName={activeCorps.corpsName || activeCorps.name}
        />
      )}

      {modalQueue.isActive('achievement') && newAchievement && (
        <AchievementModal
          onClose={handleAchievementClose}
          achievements={profile?.achievements || []}
          newAchievement={newAchievement}
        />
      )}

      <OnboardingTour
        isOpen={modalQueue.isActive('onboarding')}
        onClose={() => modalQueue.dequeue()}
        onComplete={handleTourComplete}
      />

      <QuickStartGuide
        isOpen={showQuickStartGuide}
        onClose={() => setShowQuickStartGuide(false)}
        onAction={(action) => {
          if (action === 'lineup') setShowCaptionSelection(true);
        }}
        completedSteps={[
          ...(lineupCount === 8 ? ['lineup'] : []),
          ...(thisWeekShows.length > 0 ? ['schedule'] : []),
          ...(myLeagues?.length > 0 ? ['league'] : []),
        ]}
      />

      {classToPurchase && profile && (
        <ClassPurchaseModal
          classKey={classToPurchase}
          className={CLASS_DISPLAY_NAMES[classToPurchase]}
          coinCost={CLASS_UNLOCK_COSTS[classToPurchase]}
          currentBalance={profile.corpsCoin || 0}
          levelRequired={CLASS_UNLOCK_LEVELS[classToPurchase]}
          currentLevel={profile.xpLevel || 1}
          weeksRemaining={weeksRemaining}
          isRegistrationLocked={isRegistrationLocked(classToPurchase)}
          onConfirm={handleConfirmClassPurchase}
          onClose={() => setClassToPurchase(null)}
        />
      )}
    </div>
  );
};

export default Dashboard;
