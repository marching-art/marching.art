// src/components/Scores/ScoreBreakdown.jsx
// Modal showing detailed score breakdown by caption with comparison to previous show
// Styled similar to the lineup editor with category headers and individual caption cards

import React, { useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X,
  Trophy,
  TrendingUp,
  TrendingDown,
  Minus,
  Calendar,
  MapPin,
  Check
} from 'lucide-react';
import { calculateCaptionAggregates } from '../../hooks/useScoresData';

// Caption definitions matching the lineup editor
const CAPTIONS = [
  { id: 'GE1', name: 'General Effect 1', category: 'General Effect', abbrev: 'GE1' },
  { id: 'GE2', name: 'General Effect 2', category: 'General Effect', abbrev: 'GE2' },
  { id: 'VP', name: 'Visual Proficiency', category: 'Visual', abbrev: 'VP' },
  { id: 'VA', name: 'Visual Analysis', category: 'Visual', abbrev: 'VA' },
  { id: 'CG', name: 'Color Guard', category: 'Visual', abbrev: 'CG' },
  { id: 'B', name: 'Brass', category: 'Music', abbrev: 'B' },
  { id: 'MA', name: 'Music Analysis', category: 'Music', abbrev: 'MA' },
  { id: 'P', name: 'Percussion', category: 'Music', abbrev: 'P' }
];

const CAPTION_CATEGORIES = ['General Effect', 'Visual', 'Music'];

// Category color mapping
const getCategoryColor = (category) => {
  switch (category) {
    case 'General Effect': return 'gold';
    case 'Visual': return 'blue';
    case 'Music': return 'purple';
    default: return 'gold';
  }
};

// Score change indicator
const ScoreChange = ({ current, previous }) => {
  if (previous === undefined || previous === null) return null;

  const change = current - previous;

  if (Math.abs(change) < 0.01) {
    return (
      <span className="text-cream-500/40 text-xs flex items-center gap-1">
        <Minus className="w-3 h-3" />
      </span>
    );
  }

  if (change > 0) {
    return (
      <span className="text-green-400 text-xs flex items-center gap-1">
        <TrendingUp className="w-3 h-3" />
        +{change.toFixed(3)}
      </span>
    );
  }

  return (
    <span className="text-red-400 text-xs flex items-center gap-1">
      <TrendingDown className="w-3 h-3" />
      {change.toFixed(3)}
    </span>
  );
};

// Individual caption score card
const CaptionCard = ({ caption, score, previousScore, categoryColor }) => {
  const hasPrevious = previousScore !== undefined && previousScore !== null;

  const colorClasses = {
    gold: 'border-gold-500/30 bg-gold-500/5',
    blue: 'border-blue-500/30 bg-blue-500/5',
    purple: 'border-purple-500/30 bg-purple-500/5'
  };

  const textColorClasses = {
    gold: 'text-gold-400',
    blue: 'text-blue-400',
    purple: 'text-purple-400'
  };

  return (
    <div className={`p-3 rounded-sm border transition-all ${colorClasses[categoryColor]}`}>
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <Check className={`w-4 h-4 flex-shrink-0 ${textColorClasses[categoryColor]}`} />
          <span className="font-medium text-cream-100 text-sm truncate">{caption.name}</span>
          <span className="text-xs text-cream-500/60 flex-shrink-0">({caption.abbrev})</span>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <span className={`font-bold text-sm tabular-nums ${textColorClasses[categoryColor]}`}>
            {score?.toFixed(3) || '0.000'}
          </span>
          {hasPrevious && (
            <ScoreChange current={score || 0} previous={previousScore} />
          )}
        </div>
      </div>
    </div>
  );
};

// Category subtotal card
const CategorySubtotal = ({ category, total, previousTotal, maxScore }) => {
  const color = getCategoryColor(category);
  const hasPrevious = previousTotal !== undefined && previousTotal !== null;

  const bgClasses = {
    gold: 'bg-gold-500/10 border-gold-500/20',
    blue: 'bg-blue-500/10 border-blue-500/20',
    purple: 'bg-purple-500/10 border-purple-500/20'
  };

  const textClasses = {
    gold: 'text-gold-400',
    blue: 'text-blue-400',
    purple: 'text-purple-400'
  };

  return (
    <div className={`mt-2 p-2 rounded-sm border ${bgClasses[color]} flex items-center justify-between`}>
      <span className="text-xs text-cream-500/60 uppercase tracking-wide">Subtotal</span>
      <div className="flex items-center gap-2">
        <span className={`font-bold text-sm tabular-nums ${textClasses[color]}`}>
          {total.toFixed(3)}
        </span>
        <span className="text-cream-500/40 text-xs">/ {maxScore}</span>
        {hasPrevious && (
          <ScoreChange current={total} previous={previousTotal} />
        )}
      </div>
    </div>
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
  // Get individual caption scores from the score object
  const captionScores = useMemo(() => {
    if (!score) return {};
    return score.captions || {};
  }, [score]);

  const previousCaptionScores = useMemo(() => {
    if (!previousScore) return {};
    return previousScore.captions || {};
  }, [previousScore]);

  // Calculate aggregates for current and previous scores
  const currentAggregates = useMemo(() => {
    return calculateCaptionAggregates(score);
  }, [score]);

  const previousAggregates = useMemo(() => {
    if (!previousScore) return null;
    return calculateCaptionAggregates(previousScore);
  }, [previousScore]);

  const displayScore = score?.score || score?.totalScore || currentAggregates.Total_Score;
  const previousDisplayScore = previousScore?.score || previousScore?.totalScore || 0;

  // Get category max scores
  const getCategoryMaxScore = (category) => {
    switch (category) {
      case 'General Effect': return 40;
      case 'Visual': return 30;
      case 'Music': return 30;
      default: return 0;
    }
  };

  // Get category total
  const getCategoryTotal = (category, aggregates) => {
    if (!aggregates) return 0;
    switch (category) {
      case 'General Effect': return aggregates.GE_Total;
      case 'Visual': return aggregates.VIS_Total;
      case 'Music': return aggregates.MUS_Total;
      default: return 0;
    }
  };

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
            className="fixed inset-x-4 top-[5%] md:inset-auto md:top-1/2 md:left-1/2 md:-translate-x-1/2 md:-translate-y-1/2 md:w-full md:max-w-lg bg-charcoal-950 border border-cream-500/10 rounded-sm z-50 max-h-[90vh] overflow-hidden flex flex-col"
          >
            {/* Header */}
            <div className="flex-shrink-0 p-4 border-b border-cream-500/10 bg-charcoal-900/50">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-sm bg-gold-500/20 border border-gold-500/30 flex items-center justify-center">
                    <Trophy className="w-5 h-5 text-gold-400" />
                  </div>
                  <div>
                    <h2 className="font-display font-bold text-lg text-cream-100">
                      Score Breakdown
                    </h2>
                    {score?.corpsName && (
                      <p className="text-sm text-cream-500/60">
                        {score.corpsName}
                      </p>
                    )}
                  </div>
                </div>
                <button
                  onClick={onClose}
                  className="p-2 rounded-sm hover:bg-charcoal-800 transition-colors text-cream-500/60 hover:text-cream-100"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {/* Show info */}
              {(showInfo.eventName || showInfo.date || showInfo.location) && (
                <div className="flex flex-wrap items-center gap-3 text-sm text-cream-500/60 pb-2 border-b border-cream-500/10">
                  {showInfo.eventName && (
                    <span className="font-medium text-cream-300">{showInfo.eventName}</span>
                  )}
                  {showInfo.date && (
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      {showInfo.date}
                    </span>
                  )}
                  {showInfo.location && (
                    <span className="flex items-center gap-1">
                      <MapPin className="w-3 h-3" />
                      {showInfo.location}
                    </span>
                  )}
                </div>
              )}

              {/* Total Score Card */}
              <div className="bg-gradient-to-br from-gold-500/10 to-gold-500/5 border border-gold-500/20 rounded-sm p-4">
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
                    {displayScore.toFixed(3)}
                  </span>
                  {previousScore && (
                    <ScoreChange
                      current={displayScore}
                      previous={previousDisplayScore}
                    />
                  )}
                </div>
              </div>

              {/* Caption Breakdown - Lineup Editor Style */}
              <div className="space-y-4">
                {CAPTION_CATEGORIES.map((category) => {
                  const categoryCaptions = CAPTIONS.filter(c => c.category === category);
                  const categoryColor = getCategoryColor(category);
                  const categoryTotal = getCategoryTotal(category, currentAggregates);
                  const previousCategoryTotal = previousAggregates ? getCategoryTotal(category, previousAggregates) : null;
                  const maxScore = getCategoryMaxScore(category);

                  const borderColorClass = {
                    gold: 'bg-gold-500',
                    blue: 'bg-blue-500',
                    purple: 'bg-purple-500'
                  }[categoryColor];

                  return (
                    <div key={category} className="space-y-2">
                      {/* Category Header */}
                      <div className="flex items-center gap-2 sticky top-0 bg-charcoal-950 z-10 py-1">
                        <div className={`w-1 h-5 rounded flex-shrink-0 ${borderColorClass}`} />
                        <h3 className="font-semibold text-cream-100 text-sm">{category}</h3>
                      </div>

                      {/* Individual Caption Cards */}
                      {categoryCaptions.map((caption) => (
                        <CaptionCard
                          key={caption.id}
                          caption={caption}
                          score={captionScores[caption.id]}
                          previousScore={previousCaptionScores[caption.id]}
                          categoryColor={categoryColor}
                        />
                      ))}

                      {/* Category Subtotal */}
                      <CategorySubtotal
                        category={category}
                        total={categoryTotal}
                        previousTotal={previousCategoryTotal}
                        maxScore={maxScore}
                      />
                    </div>
                  );
                })}
              </div>

              {/* Previous show comparison */}
              {previousShowInfo && (
                <div className="bg-charcoal-900/50 border border-cream-500/10 rounded-sm p-3 mt-4">
                  <p className="text-xs text-cream-500/40 mb-1">
                    Compared to previous: <span className="text-cream-500/60">{previousShowInfo.eventName || 'Previous Show'}</span>
                  </p>
                  {previousShowInfo.date && (
                    <p className="text-xs text-cream-500/40">
                      {previousShowInfo.date}
                    </p>
                  )}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="flex-shrink-0 p-4 border-t border-cream-500/10 bg-charcoal-950">
              <button
                onClick={onClose}
                className="w-full py-2.5 bg-charcoal-800 hover:bg-charcoal-700 border border-cream-500/10 rounded-sm text-cream-300 font-medium text-sm transition-colors"
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
