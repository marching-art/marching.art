// src/components/Scores/LatestShowCard.jsx
// Shows the user's latest show result with option to view breakdown

import React from 'react';
import { motion } from 'framer-motion';
import { Calendar, MapPin, ChevronRight, Trophy } from 'lucide-react';

const LatestShowCard = ({
  showName = '',
  showDate = '',
  location = '',
  userScore = null,
  userRank = null,
  totalParticipants = 0,
  onViewBreakdown,
  isLoading = false
}) => {
  // No show data
  if (!showName && !isLoading) {
    return (
      <div className="bg-charcoal-900/50 border border-cream-500/10 rounded-xl p-6">
        <h2 className="text-sm font-display font-bold text-cream-400 uppercase tracking-wide mb-3">
          Latest Show
        </h2>
        <div className="text-center py-4">
          <Calendar className="w-10 h-10 text-cream-500/30 mx-auto mb-3" />
          <p className="text-cream-500/60 text-sm mb-2">
            No shows yet this season
          </p>
          <p className="text-cream-500/40 text-xs">
            Results will appear after your corps competes
          </p>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="bg-charcoal-900/50 border border-cream-500/10 rounded-xl p-6 animate-pulse">
        <div className="h-4 bg-charcoal-800 rounded w-24 mb-4"></div>
        <div className="h-6 bg-charcoal-800 rounded w-full mb-3"></div>
        <div className="h-4 bg-charcoal-800 rounded w-40 mb-4"></div>
        <div className="h-10 bg-charcoal-800 rounded w-full"></div>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.1 }}
      className="bg-charcoal-900/50 border border-cream-500/10 rounded-xl p-6"
    >
      <h2 className="text-sm font-display font-bold text-cream-400 uppercase tracking-wide mb-3">
        Latest Show
      </h2>

      {/* Show info */}
      <div className="mb-4">
        <h3 className="text-lg font-display font-bold text-cream-100 mb-1">
          {showName}
        </h3>
        <div className="flex items-center gap-4 text-sm text-cream-500/60">
          {showDate && (
            <span className="flex items-center gap-1">
              <Calendar className="w-4 h-4" />
              {showDate}
            </span>
          )}
          {location && (
            <span className="flex items-center gap-1">
              <MapPin className="w-4 h-4" />
              {location}
            </span>
          )}
        </div>
      </div>

      {/* User's result */}
      {userScore !== null && (
        <div className="bg-charcoal-800/50 border border-cream-500/5 rounded-lg p-4 mb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-gold-500/20 flex items-center justify-center">
                <Trophy className="w-5 h-5 text-gold-400" />
              </div>
              <div>
                <p className="text-xs text-cream-500/60 uppercase tracking-wide">Your Score</p>
                <p className="text-xl font-mono font-bold text-gold-400">
                  {userScore.toFixed(1)}
                </p>
              </div>
            </div>
            {userRank && (
              <div className="text-right">
                <p className="text-xs text-cream-500/60 uppercase tracking-wide">Show Rank</p>
                <p className="text-xl font-mono font-bold text-cream-100">
                  #{userRank}
                  {totalParticipants > 0 && (
                    <span className="text-sm text-cream-500/40 font-normal"> of {totalParticipants}</span>
                  )}
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* View breakdown button */}
      {onViewBreakdown && userScore !== null && (
        <button
          onClick={onViewBreakdown}
          className="w-full flex items-center justify-center gap-2 py-3 bg-charcoal-800 hover:bg-charcoal-700 border border-cream-500/10 rounded-lg text-cream-300 font-medium text-sm transition-colors"
        >
          View Score Breakdown
          <ChevronRight className="w-4 h-4" />
        </button>
      )}
    </motion.div>
  );
};

export default LatestShowCard;
