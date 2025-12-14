// src/components/Scores/ScoreBreakdown.jsx
// Modal showing detailed score breakdown by caption with comparison to previous show

import React, { useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X,
  Trophy,
  TrendingUp,
  TrendingDown,
  Minus,
  Sparkles,
  Eye,
  Music,
  Calendar,
  MapPin,
  ArrowRight
} from 'lucide-react';
import { calculateCaptionAggregates } from '../../hooks/useScoresData';

// Score change indicator
const ScoreChange = ({ current, previous }) => {
  if (!previous || previous === 0) return null;

  const change = current - previous;
  const percentChange = ((change / previous) * 100).toFixed(1);

  if (Math.abs(change) < 0.01) {
    return (
      <span className="text-cream-500/40 text-xs flex items-center gap-1">
        <Minus className="w-3 h-3" />
        No change
      </span>
    );
  }

  if (change > 0) {
    return (
      <span className="text-green-400 text-xs flex items-center gap-1">
        <TrendingUp className="w-3 h-3" />
        +{change.toFixed(2)} ({percentChange}%)
      </span>
    );
  }

  return (
    <span className="text-red-400 text-xs flex items-center gap-1">
      <TrendingDown className="w-3 h-3" />
      {change.toFixed(2)} ({percentChange}%)
    </span>
  );
};

// Progress bar for caption scores
const CaptionBar = ({ label, icon: Icon, score, maxScore, previousScore, color = 'gold' }) => {
  const percentage = maxScore > 0 ? (score / maxScore) * 100 : 0;

  const colorClasses = {
    gold: 'from-gold-600 to-gold-400',
    purple: 'from-purple-600 to-purple-400',
    blue: 'from-blue-600 to-blue-400'
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Icon className="w-4 h-4 text-cream-500/60" />
          <span className="text-sm text-cream-300">{label}</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="font-mono font-bold text-cream-100">
            {score.toFixed(2)}
          </span>
          <span className="text-cream-500/40 text-xs">/ {maxScore}</span>
        </div>
      </div>
      <div className="h-3 bg-charcoal-800 rounded-full overflow-hidden">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${percentage}%` }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
          className={`h-full bg-gradient-to-r ${colorClasses[color]} rounded-full`}
        />
      </div>
      {previousScore !== undefined && (
        <div className="flex justify-end">
          <ScoreChange current={score} previous={previousScore} />
        </div>
      )}
    </div>
  );
};

// Rank change display
const RankChange = ({ current, previous }) => {
  if (!previous) {
    return (
      <span className="text-cream-500/60">First show</span>
    );
  }

  const change = previous - current; // Positive means improved (lower rank number is better)

  if (change === 0) {
    return (
      <span className="text-cream-500/60 flex items-center gap-1">
        <Minus className="w-4 h-4" />
        No change
      </span>
    );
  }

  if (change > 0) {
    return (
      <span className="text-green-400 flex items-center gap-1">
        <TrendingUp className="w-4 h-4" />
        Up {change} spot{change > 1 ? 's' : ''}
      </span>
    );
  }

  return (
    <span className="text-red-400 flex items-center gap-1">
      <TrendingDown className="w-4 h-4" />
      Down {Math.abs(change)} spot{Math.abs(change) > 1 ? 's' : ''}
    </span>
  );
};

const ScoreBreakdown = ({
  isOpen,
  onClose,
  score,
  previousScore = null,
  showInfo = {},
  previousShowInfo = null
}) => {
  // Calculate aggregates for current and previous scores
  const currentAggregates = useMemo(() => {
    return calculateCaptionAggregates(score);
  }, [score]);

  const previousAggregates = useMemo(() => {
    if (!previousScore) return null;
    return calculateCaptionAggregates(previousScore);
  }, [previousScore]);

  const displayScore = score?.score || score?.totalScore || currentAggregates.Total_Score;

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50"
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="fixed inset-x-4 top-[10%] md:inset-auto md:top-1/2 md:left-1/2 md:-translate-x-1/2 md:-translate-y-1/2 md:w-full md:max-w-lg bg-charcoal-950 border border-cream-500/10 rounded-xl shadow-2xl z-50 max-h-[80vh] overflow-hidden flex flex-col"
          >
            {/* Header */}
            <div className="flex-shrink-0 p-4 border-b border-cream-500/10 bg-charcoal-900/50">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-gold-500/20 border border-gold-500/30 flex items-center justify-center">
                    <Trophy className="w-5 h-5 text-gold-400" />
                  </div>
                  <div>
                    <h2 className="font-display font-bold text-lg text-cream-100">
                      Score Breakdown
                    </h2>
                    {showInfo.eventName && (
                      <p className="text-sm text-cream-500/60">
                        {showInfo.eventName}
                      </p>
                    )}
                  </div>
                </div>
                <button
                  onClick={onClose}
                  className="p-2 rounded-lg hover:bg-charcoal-800 transition-colors text-cream-500/60 hover:text-cream-100"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-4 space-y-6">
              {/* Show info */}
              {(showInfo.date || showInfo.location) && (
                <div className="flex items-center gap-4 text-sm text-cream-500/60">
                  {showInfo.date && (
                    <span className="flex items-center gap-1">
                      <Calendar className="w-4 h-4" />
                      {showInfo.date}
                    </span>
                  )}
                  {showInfo.location && (
                    <span className="flex items-center gap-1">
                      <MapPin className="w-4 h-4" />
                      {showInfo.location}
                    </span>
                  )}
                </div>
              )}

              {/* Total Score */}
              <div className="bg-gradient-to-br from-gold-500/10 to-gold-500/5 border border-gold-500/20 rounded-xl p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-cream-500/60 uppercase tracking-wide">Total Score</span>
                  {score?.rank && (
                    <span className="px-2 py-1 bg-charcoal-800 rounded text-xs text-cream-400">
                      Rank #{score.rank}
                    </span>
                  )}
                </div>
                <div className="flex items-baseline gap-3">
                  <span className="text-4xl font-mono font-black text-gold-400">
                    {displayScore.toFixed(1)}
                  </span>
                  {previousScore && (
                    <ScoreChange
                      current={displayScore}
                      previous={previousScore.score || previousScore.totalScore || 0}
                    />
                  )}
                </div>
                {previousScore?.rank && score?.rank && (
                  <div className="mt-3 pt-3 border-t border-gold-500/20">
                    <RankChange current={score.rank} previous={previousScore.rank} />
                  </div>
                )}
              </div>

              {/* Caption Breakdown */}
              <div>
                <h3 className="text-sm font-display font-bold text-cream-400 uppercase tracking-wide mb-4">
                  Caption Scores
                </h3>
                <div className="space-y-5">
                  <CaptionBar
                    label="General Effect"
                    icon={Sparkles}
                    score={currentAggregates.GE_Total}
                    maxScore={40}
                    previousScore={previousAggregates?.GE_Total}
                    color="gold"
                  />
                  <CaptionBar
                    label="Visual"
                    icon={Eye}
                    score={currentAggregates.VIS_Total}
                    maxScore={30}
                    previousScore={previousAggregates?.VIS_Total}
                    color="purple"
                  />
                  <CaptionBar
                    label="Music"
                    icon={Music}
                    score={currentAggregates.MUS_Total}
                    maxScore={30}
                    previousScore={previousAggregates?.MUS_Total}
                    color="blue"
                  />
                </div>
              </div>

              {/* Previous show comparison */}
              {previousShowInfo && (
                <div className="bg-charcoal-900/50 border border-cream-500/10 rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-3 text-xs text-cream-500/40 uppercase tracking-wide">
                    <span>Compared to</span>
                    <ArrowRight className="w-3 h-3" />
                    <span className="text-cream-500/60">{previousShowInfo.eventName || 'Previous Show'}</span>
                  </div>
                  <div className="grid grid-cols-3 gap-4 text-center">
                    <div>
                      <p className="text-xs text-cream-500/40 mb-1">GE</p>
                      <ScoreChange
                        current={currentAggregates.GE_Total}
                        previous={previousAggregates?.GE_Total}
                      />
                    </div>
                    <div>
                      <p className="text-xs text-cream-500/40 mb-1">Visual</p>
                      <ScoreChange
                        current={currentAggregates.VIS_Total}
                        previous={previousAggregates?.VIS_Total}
                      />
                    </div>
                    <div>
                      <p className="text-xs text-cream-500/40 mb-1">Music</p>
                      <ScoreChange
                        current={currentAggregates.MUS_Total}
                        previous={previousAggregates?.MUS_Total}
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="flex-shrink-0 p-4 border-t border-cream-500/10 bg-charcoal-950">
              <button
                onClick={onClose}
                className="w-full py-2.5 bg-charcoal-800 hover:bg-charcoal-700 border border-cream-500/10 rounded-lg text-cream-300 font-medium text-sm transition-colors"
              >
                Close
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

export default ScoreBreakdown;
