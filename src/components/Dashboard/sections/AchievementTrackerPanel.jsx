// AchievementTrackerPanel - Compact sidebar widget showing achievement progress
// Surfaces the 3 achievements closest to being unlocked to drive goal-oriented
// play, plus a link to the full Achievements page for the complete list.
//
// Catalog + progress come from the shared client mirror in
// src/data/achievementsCatalog.js, so this panel, the /achievements page, and
// the server award logic all agree on the same set of achievements and the
// same total count. Earned state is server-authoritative (profile.achievements).

import React, { memo, useMemo } from 'react';
import { Award, Crown } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useProfileStore } from '../../../store/profileStore';
import { evaluateAchievements, ACHIEVEMENTS } from '../../../data/achievementsCatalog';

const AchievementTrackerPanel = memo(({ profile }) => {
  const corps = useProfileStore((state) => state.corps);
  // Depend on the achievements array reference so a fresh server award triggers
  // a recompute even if the rest of the profile snapshot is referentially equal.
  const earnedAchievements = profile?.achievements;

  const { completed, nextUp, totalEarned } = useMemo(() => {
    const evaluated = evaluateAchievements(profile, corps);
    const done = evaluated.filter((a) => a.earned);
    // Incomplete sorted by pct desc (closest first), then goal asc (easier first)
    const incomplete = evaluated
      .filter((a) => !a.earned)
      .sort((a, b) => b.pct - a.pct || a.goal - b.goal);

    return {
      completed: done,
      nextUp: incomplete.slice(0, 3),
      totalEarned: done.length,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile, corps, earnedAchievements]);

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
        <span className="text-[10px] font-bold text-muted font-data tabular-nums">
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
          {nextUp.map((a) => {
            const Icon = a.icon;
            return (
              <div key={a.id} className="px-4 py-3">
                <div className="flex items-center gap-3 mb-1.5">
                  <div className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 bg-[#222] border border-[#333]">
                    <Icon className="w-3 h-3 text-yellow-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <span className="text-sm text-white">{a.title}</span>
                    <span className="text-[10px] text-muted ml-2">
                      {a.current}/{a.goal}
                    </span>
                  </div>
                  <span className="text-[10px] font-bold text-yellow-600 font-data">{a.pct}%</span>
                </div>
                <div className="ml-8 h-1 bg-[#222] rounded-full overflow-hidden">
                  <div
                    className="h-full bg-yellow-600 transition-all duration-500 rounded-full"
                    style={{ width: `${a.pct}%` }}
                  />
                </div>
                <p className="ml-8 text-[10px] text-muted mt-1">{a.description}</p>
              </div>
            );
          })}
        </div>
      )}

      {/* Recently earned (last 2) */}
      {completed.length > 0 && (
        <div className="border-t border-[#333] divide-y divide-[#222]">
          {completed
            .slice(-2)
            .reverse()
            .map((a) => {
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

      {/* Footer link to the full Achievements page (all earned + locked) */}
      <div className="px-3 py-1.5 border-t border-[#333] bg-[#111]">
        <Link
          to="/achievements"
          className="text-[10px] text-muted hover:text-gray-300 transition-colors"
        >
          View all achievements →
        </Link>
      </div>
    </div>
  );
});

AchievementTrackerPanel.displayName = 'AchievementTrackerPanel';

export default AchievementTrackerPanel;
