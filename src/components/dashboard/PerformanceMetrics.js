// components/dashboard/PerformanceMetrics.js
// Performance metrics display widget for user dashboard

import React, { useState } from 'react';
import Icon from '../ui/Icon';

const PerformanceMetrics = ({ totalScore, corpsCount, dailyStreak, leaderboardPosition, userMetrics }) => {
  const [showDetails, setShowDetails] = useState(false);

  const primaryMetrics = [
    {
      label: 'Season Score',
      value: totalScore?.toFixed(2) || '0.00',
      icon: 'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z',
      color: 'text-blue-500',
      bg: 'bg-blue-500/10',
      description: 'Your total fantasy points this season'
    },
    {
      label: 'Active Corps',
      value: corpsCount || 0,
      icon: 'M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-3a1 1 0 00-.867.5 1 1 0 11-1.731-1A3 3 0 0113 8a3.001 3.001 0 01-2 2.83V11a1 1 0 11-2 0v-1a1 1 0 011-1 1 1 0 100-2zm0 8a1 1 0 100-2 1 1 0 000 2z',
      color: 'text-green-500',
      bg: 'bg-green-500/10',
      description: 'Number of corps in your roster'
    },
    {
      label: 'Daily Streak',
      value: dailyStreak || 0,
      icon: 'M13 10V3L4 14h7v7l9-11h-7z',
      color: 'text-yellow-500',
      bg: 'bg-yellow-500/10',
      description: 'Consecutive days logged in'
    }
  ];

  const secondaryMetrics = [
    {
      label: 'Global Rank',
      value: leaderboardPosition ? `#${leaderboardPosition}` : 'Unranked',
      icon: 'M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z',
      color: leaderboardPosition <= 10 ? 'text-purple-500' : 'text-gray-500'
    },
    {
      label: 'Avg Score',
      value: userMetrics?.averageScore?.toFixed(1) || '0.0',
      icon: 'M16 8v8m-4-5v5m-4-2v2m-2 4h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z',
      color: 'text-indigo-500'
    },
    {
      label: 'Games Played',
      value: userMetrics?.gamesPlayed || 0,
      icon: 'M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z',
      color: 'text-cyan-500'
    },
    {
      label: 'Achievements',
      value: userMetrics?.achievementsUnlocked || 0,
      icon: 'M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.562.562 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z',
      color: 'text-amber-500'
    }
  ];

  return (
    <div className="bg-surface dark:bg-surface-dark rounded-theme p-6 border border-accent dark:border-accent-dark shadow-theme">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-bold text-text-primary dark:text-text-primary-dark">
          Performance Metrics
        </h3>
        <button
          onClick={() => setShowDetails(!showDetails)}
          className="text-primary dark:text-primary-dark hover:text-primary/80 transition-colors"
        >
          <Icon 
            path={showDetails ? "M19 9l-7 7-7-7" : "M9 5l7 7-7 7"} 
            className="w-4 h-4" 
          />
        </button>
      </div>

      {/* Primary Metrics */}
      <div className="space-y-4 mb-4">
        {primaryMetrics.map((metric, index) => (
          <div key={index} className={`flex items-center justify-between p-3 rounded-theme ${metric.bg || 'bg-background dark:bg-background-dark'}`}>
            <div className="flex items-center gap-3">
              <Icon path={metric.icon} className={`w-5 h-5 ${metric.color}`} />
              <div>
                <span className="text-text-primary dark:text-text-primary-dark font-medium">
                  {metric.label}
                </span>
                {metric.description && (
                  <p className="text-xs text-text-secondary dark:text-text-secondary-dark">
                    {metric.description}
                  </p>
                )}
              </div>
            </div>
            <span className="text-lg font-bold text-text-primary dark:text-text-primary-dark">
              {metric.value}
            </span>
          </div>
        ))}
      </div>

      {/* Secondary Metrics - Expandable */}
      {showDetails && (
        <div className="border-t border-accent dark:border-accent-dark pt-4">
          <h4 className="text-sm font-semibold text-text-secondary dark:text-text-secondary-dark mb-3">
            Additional Stats
          </h4>
          <div className="grid grid-cols-2 gap-3">
            {secondaryMetrics.map((metric, index) => (
              <div key={index} className="flex items-center justify-between p-2 bg-background dark:bg-background-dark rounded-theme">
                <div className="flex items-center gap-2">
                  <Icon path={metric.icon} className={`w-4 h-4 ${metric.color}`} />
                  <span className="text-sm text-text-secondary dark:text-text-secondary-dark">
                    {metric.label}
                  </span>
                </div>
                <span className="text-sm font-semibold text-text-primary dark:text-text-primary-dark">
                  {metric.value}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Performance Insights */}
      <div className="mt-4 p-3 bg-primary/5 rounded-theme border border-primary/20">
        <div className="flex items-start gap-2">
          <Icon path="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" className="w-4 h-4 text-primary mt-0.5" />
          <div>
            <p className="text-sm font-medium text-text-primary dark:text-text-primary-dark">
              Performance Tip
            </p>
            <p className="text-xs text-text-secondary dark:text-text-secondary-dark">
              {totalScore > 100 
                ? "Great job! Consider hiring Hall of Fame staff to boost your scores even higher."
                : dailyStreak > 3
                  ? "Your consistency is paying off! Keep logging in daily for streak bonuses."
                  : "Create multiple corps and join leagues to maximize your fantasy points."
              }
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PerformanceMetrics;