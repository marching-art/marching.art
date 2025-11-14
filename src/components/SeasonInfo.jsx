// src/components/SeasonInfo.jsx
import React from 'react';
import { motion } from 'framer-motion';
import { Calendar, Clock, Trophy, AlertCircle } from 'lucide-react';
import { useSeason, getSeasonProgress, getSeasonTypeInfo } from '../hooks/useSeason';

const SeasonInfo = ({ className = '' }) => {
  const { seasonData, loading, error, weeksRemaining } = useSeason();

  if (loading) {
    return (
      <div className={`card ${className}`}>
        <div className="animate-pulse space-y-3">
          <div className="h-4 bg-cream-500/20 rounded w-1/3"></div>
          <div className="h-8 bg-cream-500/20 rounded"></div>
          <div className="h-4 bg-cream-500/20 rounded w-2/3"></div>
        </div>
      </div>
    );
  }

  if (error || !seasonData) {
    return (
      <div className={`card border-2 border-yellow-500/30 ${className}`}>
        <div className="flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-yellow-500 flex-shrink-0 mt-1" />
          <div>
            <h3 className="font-semibold text-cream-100 mb-1">No Active Season</h3>
            <p className="text-sm text-cream-500">
              The new season hasn't started yet. Check back soon or contact an administrator.
            </p>
          </div>
        </div>
      </div>
    );
  }

  const typeInfo = getSeasonTypeInfo(seasonData.status);
  const progress = getSeasonProgress(seasonData);
  const startDate = seasonData.schedule?.startDate?.toDate();
  const endDate = seasonData.schedule?.endDate?.toDate();

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className={`card ${className}`}
    >
      {/* Season Header */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-2">
            <Trophy className="w-5 h-5 text-gold-500" />
            <h3 className="text-lg font-bold text-cream-100">{seasonData.name}</h3>
          </div>
          <span className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium ${typeInfo.bgColor} ${typeInfo.color}`}>
            {typeInfo.label}
          </span>
        </div>
        <div className="text-right">
          <p className="text-sm text-cream-500">Weeks Remaining</p>
          <p className="text-2xl font-bold text-cream-100">{weeksRemaining}</p>
        </div>
      </div>

      {/* Progress Info */}
      <div className="grid grid-cols-2 gap-4 p-4 bg-charcoal-900/30 rounded-lg mb-4">
        <div>
          <p className="text-xs text-cream-500 mb-1">Current Week</p>
          <p className="text-lg font-bold text-cream-100">Week {progress.currentWeek}</p>
        </div>
        <div>
          <p className="text-xs text-cream-500 mb-1">Current Day</p>
          <p className="text-lg font-bold text-cream-100">Day {progress.currentDay}</p>
        </div>
      </div>

      {/* Dates */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-sm">
          <span className="text-cream-500 flex items-center gap-2">
            <Calendar className="w-4 h-4" />
            Started
          </span>
          <span className="text-cream-100 font-medium">
            {startDate?.toLocaleDateString()}
          </span>
        </div>
        <div className="flex items-center justify-between text-sm">
          <span className="text-cream-500 flex items-center gap-2">
            <Clock className="w-4 h-4" />
            Ends
          </span>
          <span className="text-cream-100 font-medium">
            {endDate?.toLocaleDateString()}
          </span>
        </div>
      </div>

      {/* Status Message */}
      <div className="mt-4 p-3 bg-charcoal-900/50 rounded-lg">
        <p className="text-xs text-cream-500">{typeInfo.description}</p>
      </div>

      {/* Point Cap Display */}
      <div className="mt-4 flex items-center justify-between p-3 bg-gold-500/10 border border-gold-500/20 rounded-lg">
        <span className="text-sm font-medium text-cream-300">World Class Point Cap</span>
        <span className="text-xl font-bold text-gold-500">{seasonData.currentPointCap}</span>
      </div>
    </motion.div>
  );
};

export default SeasonInfo;
