// QuickStats - Sidebar widget showing rotating fun facts about the user's performance
// Auto-cycles through stats every 5 seconds to keep the dashboard feeling alive

import React, { memo, useState, useEffect, useMemo } from 'react';
import { BarChart3, TrendingUp, Calendar, Award, Star, Zap } from 'lucide-react';

const QuickStats = memo(({ profile, corpsClass, recentResults, lineupScoreData, lineupCount }) => {
  const [activeIndex, setActiveIndex] = useState(0);

  // Build stats array from available data
  const stats = useMemo(() => {
    const items = [];

    // Stat: Lineup completion
    if (lineupCount !== undefined) {
      const pct = Math.round((lineupCount / 8) * 100);
      items.push({
        icon: <BarChart3 className="w-4 h-4 text-blue-500" />,
        label: 'Lineup Strength',
        value: `${lineupCount}/8 captions`,
        detail: pct === 100 ? 'Full roster' : `${8 - lineupCount} slot${8 - lineupCount !== 1 ? 's' : ''} open`,
        color: pct === 100 ? 'text-green-400' : 'text-yellow-400',
      });
    }

    // Stat: Best recent result
    if (recentResults?.length > 0) {
      const best = recentResults.reduce((a, b) => (a.score > b.score ? a : b), recentResults[0]);
      items.push({
        icon: <Star className="w-4 h-4 text-yellow-500" />,
        label: 'Best Recent Score',
        value: best.score?.toFixed(2) || 'N/A',
        detail: best.eventName || 'Recent show',
        color: 'text-yellow-400',
      });
    }

    // Stat: Shows competed
    if (recentResults?.length > 0) {
      items.push({
        icon: <Calendar className="w-4 h-4 text-purple-500" />,
        label: 'Shows Competed',
        value: `${recentResults.length}`,
        detail: 'this season',
        color: 'text-purple-400',
      });
    }

    // Stat: Trending captions
    if (lineupScoreData && Object.keys(lineupScoreData).length > 0) {
      const trending = Object.entries(lineupScoreData)
        .filter(([, data]) => data.trend?.direction === 'up')
        .length;
      if (trending > 0) {
        items.push({
          icon: <TrendingUp className="w-4 h-4 text-green-500" />,
          label: 'Captions Trending Up',
          value: `${trending}`,
          detail: `of ${Object.keys(lineupScoreData).filter(([, d]) => d?.score).length || 8} active`,
          color: 'text-green-400',
        });
      }
    }

    // Stat: XP level progress
    if (profile) {
      const xp = profile.xp || 0;
      const level = profile.xpLevel || 1;
      items.push({
        icon: <Zap className="w-4 h-4 text-purple-500" />,
        label: 'Director Level',
        value: `Level ${level}`,
        detail: `${xp.toLocaleString()} total XP`,
        color: 'text-purple-400',
      });
    }

    // Stat: Achievements
    if (profile?.achievements?.length > 0) {
      items.push({
        icon: <Award className="w-4 h-4 text-yellow-500" />,
        label: 'Achievements',
        value: `${profile.achievements.length}`,
        detail: 'unlocked',
        color: 'text-yellow-400',
      });
    }

    return items;
  }, [profile, lineupCount, recentResults, lineupScoreData]);

  // Auto-cycle every 5 seconds
  useEffect(() => {
    if (stats.length <= 1) return;
    const interval = setInterval(() => {
      setActiveIndex(prev => (prev + 1) % stats.length);
    }, 5000);
    return () => clearInterval(interval);
  }, [stats.length]);

  if (stats.length === 0) return null;

  const current = stats[activeIndex % stats.length];

  return (
    <div className="bg-[#1a1a1a] border border-[#333] overflow-hidden">
      <div className="bg-[#222] px-4 py-3 border-b border-[#333] flex items-center justify-between">
        <h3 className="text-[10px] font-bold uppercase tracking-wider text-gray-400 flex items-center gap-2">
          <BarChart3 className="w-3.5 h-3.5 text-blue-500" />
          Quick Stats
        </h3>
        {/* Dot indicators */}
        {stats.length > 1 && (
          <div className="flex items-center gap-1">
            {stats.map((_, i) => (
              <button
                key={i}
                onClick={() => setActiveIndex(i)}
                className={`w-1.5 h-1.5 rounded-full transition-colors ${
                  i === activeIndex % stats.length ? 'bg-blue-500' : 'bg-[#444]'
                }`}
              />
            ))}
          </div>
        )}
      </div>

      <div className="p-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-sm bg-[#222] flex items-center justify-center flex-shrink-0">
            {current.icon}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[10px] text-gray-500 uppercase tracking-wider">{current.label}</p>
            <p className={`text-lg font-bold font-data tabular-nums ${current.color}`}>
              {current.value}
            </p>
            <p className="text-[10px] text-gray-600">{current.detail}</p>
          </div>
        </div>
      </div>
    </div>
  );
});

export default QuickStats;
