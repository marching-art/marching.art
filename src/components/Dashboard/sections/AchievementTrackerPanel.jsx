// AchievementTrackerPanel - Compact sidebar widget showing achievement progress
// Surfaces the 3 achievements closest to being unlocked to drive goal-oriented play

import React, { memo, useMemo } from 'react';
import { Award, Trophy, Target, Users, Flame, Zap, Star, Crown } from 'lucide-react';
import { Link } from 'react-router-dom';
import { REQUIRED_CAPTIONS } from '../../../utils/captionPricing';

const ROSTER_SIZE = REQUIRED_CAPTIONS.length;

// ---------------------------------------------------------------------------
// Achievement definitions — evaluated client-side from available dashboard data
// ---------------------------------------------------------------------------

const ACHIEVEMENTS = [
  // Lineup
  { id: 'full-roster', title: 'Full Roster', desc: `Fill all ${ROSTER_SIZE} lineup slots`, icon: Target, category: 'lineup',
    eval: (d) => ({ current: d.lineupCount, goal: ROSTER_SIZE }) },
  { id: 'scorer', title: 'First Blood', desc: 'Receive your first score', icon: Zap, category: 'scoring',
    eval: (d) => ({ current: d.resultCount > 0 ? 1 : 0, goal: 1 }) },
  { id: 'five-shows', title: 'Road Warrior', desc: 'Compete in 5 scored shows', icon: Star, category: 'scoring',
    eval: (d) => ({ current: Math.min(d.resultCount, 5), goal: 5 }) },

  // Streaks (matches backend STREAK_MILESTONES: 3, 7, 14, 30, 60, 100)
  { id: 'streak-3', title: '3-Day Streak', desc: 'Log in 3 days in a row', icon: Flame, category: 'streak',
    eval: (d) => ({ current: Math.min(d.streak, 3), goal: 3 }) },
  { id: 'streak-7', title: 'Week Warrior', desc: '7-day login streak', icon: Flame, category: 'streak',
    eval: (d) => ({ current: Math.min(d.streak, 7), goal: 7 }) },
  { id: 'streak-14', title: 'Two Week Terror', desc: '14-day login streak', icon: Flame, category: 'streak',
    eval: (d) => ({ current: Math.min(d.streak, 14), goal: 14 }) },
  { id: 'streak-30', title: 'Monthly Master', desc: '30-day login streak', icon: Flame, category: 'streak',
    eval: (d) => ({ current: Math.min(d.streak, 30), goal: 30 }) },
  { id: 'streak-60', title: 'Streak Legend', desc: '60-day login streak', icon: Flame, category: 'streak',
    eval: (d) => ({ current: Math.min(d.streak, 60), goal: 60 }) },
  { id: 'streak-100', title: 'Century Club', desc: '100-day login streak', icon: Crown, category: 'streak',
    eval: (d) => ({ current: Math.min(d.streak, 100), goal: 100 }) },

  // Progression
  { id: 'level-3', title: 'Rank Up', desc: 'Reach XP Level 3', icon: Award, category: 'progression',
    eval: (d) => ({ current: Math.min(d.level, 3), goal: 3 }) },
  { id: 'level-5', title: 'Veteran', desc: 'Reach XP Level 5', icon: Award, category: 'progression',
    eval: (d) => ({ current: Math.min(d.level, 5), goal: 5 }) },
  { id: 'level-10', title: 'Elite Director', desc: 'Reach XP Level 10', icon: Crown, category: 'progression',
    eval: (d) => ({ current: Math.min(d.level, 10), goal: 10 }) },

  // Class unlocks
  { id: 'unlock-a', title: 'A Class Access', desc: 'Unlock A Class', icon: Trophy, category: 'unlock',
    eval: (d) => ({ current: d.unlockedClasses.includes('aClass') ? 1 : 0, goal: 1 }) },
  { id: 'unlock-open', title: 'Open Class Access', desc: 'Unlock Open Class', icon: Trophy, category: 'unlock',
    eval: (d) => ({ current: d.unlockedClasses.includes('open') ? 1 : 0, goal: 1 }) },
  { id: 'unlock-world', title: 'World Class Access', desc: 'Unlock World Class', icon: Trophy, category: 'unlock',
    eval: (d) => ({ current: d.unlockedClasses.includes('world') ? 1 : 0, goal: 1 }) },

  // League / Social
  { id: 'league-join', title: 'League Player', desc: 'Join a league', icon: Users, category: 'social',
    eval: (d) => ({ current: d.leagueCount > 0 ? 1 : 0, goal: 1 }) },
  { id: 'league-win', title: 'Matchup Victor', desc: 'Win a league matchup', icon: Users, category: 'social',
    eval: (d) => ({ current: Math.min(d.leagueWins, 1), goal: 1 }) },
];

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

const AchievementTrackerPanel = memo(({ profile, lineupCount, resultCount, leagueCount }) => {
  // Extract scalar fields so useMemo depends on primitives, not the full profile object
  const streak = profile?.engagement?.loginStreak || 0;
  const level = profile?.xpLevel || 1;
  const unlockedClasses = profile?.unlockedClasses;
  const leagueWins = profile?.stats?.leagueWins || profile?.lifetimeStats?.leagueChampionships || 0;

  // Evaluate all achievements in a single memo with primitive deps
  const { completed, nextUp, totalEarned } = useMemo(() => {
    const evalData = {
      lineupCount: lineupCount || 0,
      resultCount: resultCount || 0,
      streak,
      level,
      unlockedClasses: unlockedClasses || ['soundSport'],
      leagueCount: leagueCount || 0,
      leagueWins,
    };

    const evaluated = ACHIEVEMENTS.map(a => {
      const { current, goal } = a.eval(evalData);
      const pct = goal === 0 ? 100 : Math.min(Math.round((current / goal) * 100), 100);
      return { ...a, current, goal, pct, done: pct >= 100 };
    });

    const done = evaluated.filter(a => a.done);
    // Incomplete sorted by pct descending (closest to done first), then by goal ascending (easier first)
    const incomplete = evaluated
      .filter(a => !a.done)
      .sort((a, b) => b.pct - a.pct || a.goal - b.goal);

    return {
      completed: done,
      nextUp: incomplete.slice(0, 3),
      totalEarned: done.length,
    };
  }, [lineupCount, resultCount, streak, level, unlockedClasses, leagueCount, leagueWins]);

  // Don't render if profile hasn't loaded
  if (!profile) return null;

  const totalCount = ACHIEVEMENTS.length;

  return (
    <div className="bg-[#1a1a1a] border border-[#333] overflow-hidden">
      {/* Header */}
      <div className="bg-[#222] px-4 py-3 border-b border-[#333] flex items-center justify-between">
        <h3 className="text-[10px] font-bold uppercase tracking-wider text-gray-400 flex items-center gap-2">
          <Award className="w-3.5 h-3.5 text-yellow-500" />
          Achievements
        </h3>
        <span className="text-[10px] font-bold text-gray-500 font-data tabular-nums">
          {totalEarned}/{totalCount}
        </span>
      </div>

      {/* Overall progress bar */}
      <div className="h-1 bg-[#222]">
        <div
          className="h-full bg-yellow-500 transition-all duration-500"
          style={{ width: `${(totalEarned / totalCount) * 100}%` }}
        />
      </div>

      {/* Next Up — achievements closest to unlocking */}
      {nextUp.length > 0 && (
        <div className="divide-y divide-[#222]">
          {nextUp.map(a => {
            const Icon = a.icon;
            return (
              <div key={a.id} className="px-4 py-3">
                <div className="flex items-center gap-3 mb-1.5">
                  <div className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 bg-[#222] border border-[#333]">
                    <Icon className="w-3 h-3 text-yellow-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <span className="text-sm text-white">{a.title}</span>
                    <span className="text-[10px] text-gray-600 ml-2">{a.current}/{a.goal}</span>
                  </div>
                  <span className="text-[10px] font-bold text-yellow-600 font-data">{a.pct}%</span>
                </div>
                <div className="ml-8 h-1 bg-[#222] rounded-full overflow-hidden">
                  <div
                    className="h-full bg-yellow-600 transition-all duration-500 rounded-full"
                    style={{ width: `${a.pct}%` }}
                  />
                </div>
                <p className="ml-8 text-[10px] text-gray-600 mt-1">{a.desc}</p>
              </div>
            );
          })}
        </div>
      )}

      {/* Recently earned (last 2) */}
      {completed.length > 0 && (
        <div className="border-t border-[#333] divide-y divide-[#222]">
          {completed.slice(-2).reverse().map(a => {
            const Icon = a.icon;
            return (
              <div key={a.id} className="px-4 py-2.5 flex items-center gap-3">
                <div className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 bg-yellow-500/20">
                  <Icon className="w-3 h-3 text-yellow-500" />
                </div>
                <span className="text-sm text-yellow-400 flex-1">{a.title}</span>
                <span className="text-[10px] font-bold text-green-500 font-data">EARNED</span>
              </div>
            );
          })}
        </div>
      )}

      {/* All complete banner */}
      {nextUp.length === 0 && (
        <div className="px-4 py-3 border-t border-[#222] bg-yellow-500/5">
          <div className="flex items-center gap-2 justify-center">
            <Crown className="w-4 h-4 text-yellow-500" />
            <span className="text-xs font-bold text-yellow-400">All achievements unlocked!</span>
          </div>
        </div>
      )}

      {/* Footer link to full profile achievements tab */}
      {totalEarned > 0 && nextUp.length > 0 && (
        <div className="px-3 py-1.5 border-t border-[#333] bg-[#111]">
          <Link to="/profile?tab=achievements" className="text-[10px] text-gray-600 hover:text-gray-400 transition-colors">
            View all achievements →
          </Link>
        </div>
      )}
    </div>
  );
});

AchievementTrackerPanel.displayName = 'AchievementTrackerPanel';

export default AchievementTrackerPanel;
