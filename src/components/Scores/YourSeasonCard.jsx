// src/components/Scores/YourSeasonCard.jsx
// Shows user's season status at a glance: rank, score, trend

import React from 'react';
import { m } from 'framer-motion';
import { Trophy, TrendingUp, TrendingDown, Minus } from 'lucide-react';

// Simple trend indicator component
const TrendIndicator = ({ change, className = '' }) => {
  if (!change || change === 0) {
    return (
      <span className={`inline-flex items-center gap-1 text-cream-500/60 ${className}`}>
        <Minus className="w-4 h-4" />
        <span>-</span>
      </span>
    );
  }

  if (change > 0) {
    return (
      <span className={`inline-flex items-center gap-1 text-green-400 ${className}`}>
        <TrendingUp className="w-4 h-4" />
        <span>+{change}</span>
      </span>
    );
  }

  return (
    <span className={`inline-flex items-center gap-1 text-red-400 ${className}`}>
      <TrendingDown className="w-4 h-4" />
      <span>{change}</span>
    </span>
  );
};

const YourSeasonCard = ({
  rank = null,
  totalCorps = 0,
  score = 0,
  rankChange = 0,
  corpsClass = '',
  corpsName = '',
  isLoading = false
}) => {
  // If no corps data, show prompt to create
  if (!corpsName && !isLoading) {
    return (
      <div className="bg-charcoal-900/50 border border-cream-500/10 rounded-sm p-6">
        <h2 className="text-sm font-display font-bold text-cream-400 uppercase tracking-wide mb-3">
          Your Season
        </h2>
        <div className="text-center py-4">
          <Trophy className="w-10 h-10 text-cream-500/30 mx-auto mb-3" />
          <p className="text-cream-500/60 text-sm mb-2">
            No corps to track yet
          </p>
          <p className="text-cream-500/40 text-xs">
            Create a corps to see your standings
          </p>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="bg-charcoal-900/50 border border-cream-500/10 rounded-sm p-6 animate-pulse">
        <div className="h-4 bg-charcoal-800 rounded w-24 mb-4"></div>
        <div className="h-8 bg-charcoal-800 rounded w-full mb-3"></div>
        <div className="h-4 bg-charcoal-800 rounded w-32"></div>
      </div>
    );
  }

  return (
    <m.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-gradient-to-br from-charcoal-900/80 to-charcoal-950/80 border border-gold-500/20 rounded-sm p-6"
    >
      <h2 className="text-sm font-display font-bold text-cream-400 uppercase tracking-wide mb-4">
        Your Season
      </h2>

      {/* Main stats row */}
      <div className="flex items-center justify-between gap-4">
        {/* Rank display */}
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-sm bg-gold-500/20 border border-gold-500/30 flex items-center justify-center">
            <Trophy className="w-6 h-6 text-gold-400" />
          </div>
          <div>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-display font-black text-cream-100">
                #{rank || '-'}
              </span>
              <span className="text-cream-500/60 text-sm">
                of {totalCorps}
              </span>
            </div>
          </div>
        </div>

        {/* Score and trend */}
        <div className="text-right">
          <div className="flex items-center gap-3 justify-end">
            <span className="text-2xl font-mono font-bold text-gold-400">
              {score ? score.toFixed(1) : '0.0'}
            </span>
            <span className="text-cream-500/60 text-sm">pts</span>
            <TrendIndicator change={rankChange} className="text-sm font-medium" />
          </div>
        </div>
      </div>

      {/* Corps info */}
      <div className="mt-4 pt-4 border-t border-cream-500/10 flex items-center justify-between">
        <span className="text-cream-100 font-medium">{corpsName}</span>
        {corpsClass && (
          <span className="px-2 py-1 bg-charcoal-800 rounded text-xs text-cream-400 font-medium uppercase">
            {corpsClass.replace('Class', ' Class')}
          </span>
        )}
      </div>
    </m.div>
  );
};

export default YourSeasonCard;
