// =============================================================================
// SOUNDSPORT TAB - Enhanced Results Display with Class Winners
// =============================================================================
// Interactive ratings display with Best in Show, class winners, and rule highlights

import React, { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Music, Medal, Trophy, Award, ChevronRight, ChevronDown,
  Info, Star, Users, Zap, Clock, BookOpen
} from 'lucide-react';
import LoadingScreen from '../../LoadingScreen';
import EmptyState from '../../EmptyState';

// =============================================================================
// CONSTANTS
// =============================================================================

const RATING_THRESHOLDS = [
  { rating: 'Gold', min: 90, color: 'bg-yellow-500', textColor: 'text-black', borderColor: 'border-black' },
  { rating: 'Silver', min: 75, color: 'bg-stone-300', textColor: 'text-black', borderColor: 'border-black' },
  { rating: 'Bronze', min: 60, color: 'bg-orange-300', textColor: 'text-black', borderColor: 'border-black' },
  { rating: 'Participation', min: 0, color: 'bg-white', textColor: 'text-black', borderColor: 'border-black' },
];

const QUICK_FACTS = [
  { icon: Clock, label: '5-7 min', description: 'Performance time' },
  { icon: Users, label: '5+', description: 'Minimum members' },
  { icon: Star, label: '3 Judges', description: 'Rate your show' },
];

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

const getSoundSportRating = (score) => {
  for (const threshold of RATING_THRESHOLDS) {
    if (score >= threshold.min) return threshold;
  }
  return RATING_THRESHOLDS[RATING_THRESHOLDS.length - 1];
};

const getRatingOrder = (score) => {
  if (score >= 90) return 0;
  if (score >= 75) return 1;
  if (score >= 60) return 2;
  return 3;
};

// Group scores by rating for display
const groupByRating = (scores) => {
  const groups = {
    Gold: [],
    Silver: [],
    Bronze: [],
    Participation: [],
  };

  scores.forEach(score => {
    const rating = getSoundSportRating(score.score);
    groups[rating.rating].push(score);
  });

  // Sort alphabetically within each group
  Object.keys(groups).forEach(key => {
    groups[key].sort((a, b) => a.corps.localeCompare(b.corps));
  });

  return groups;
};

// =============================================================================
// RATING BADGE COMPONENT - Interactive with tooltip
// =============================================================================

const RatingBadge = ({ rating, showTooltip = false }) => {
  const [isHovered, setIsHovered] = useState(false);
  const ratingInfo = RATING_THRESHOLDS.find(r => r.rating === rating);

  if (!ratingInfo) return null;

  return (
    <div
      className="relative inline-block"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div className={`flex items-center gap-1.5 px-3 py-1.5 ${ratingInfo.color} border-2 ${ratingInfo.borderColor} rounded-sm cursor-help`}>
        <Medal className={`w-4 h-4 ${ratingInfo.textColor}`} />
        <span className={`font-bold text-xs md:text-sm ${ratingInfo.textColor}`}>{rating}</span>
      </div>
      {showTooltip && isHovered && (
        <motion.div
          initial={{ opacity: 0, y: 5 }}
          animate={{ opacity: 1, y: 0 }}
          className="absolute z-10 left-0 top-full mt-2 w-48 p-2 bg-[#1a1a1a] border border-[#333] rounded shadow-lg"
        >
          <p className="text-xs text-gray-300">
            {rating === 'Gold' && 'Score of 90+ points'}
            {rating === 'Silver' && 'Score of 75-89 points'}
            {rating === 'Bronze' && 'Score of 60-74 points'}
            {rating === 'Participation' && 'Completed performance'}
          </p>
        </motion.div>
      )}
    </div>
  );
};

// =============================================================================
// ENSEMBLE RESULT CARD
// =============================================================================

const EnsembleCard = ({ score, isBestInShow = false, isClassWinner = false }) => {
  const ratingInfo = getSoundSportRating(score.score);

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      whileHover={{ scale: 1.02 }}
      transition={{ duration: 0.15 }}
      className={`relative p-3 md:p-4 rounded-sm border-2 ${ratingInfo.color} ${ratingInfo.borderColor} overflow-hidden`}
    >
      {/* Award badges */}
      {isBestInShow && (
        <div className="absolute top-0 right-0 bg-black text-primary px-2 py-1 text-[10px] font-bold flex items-center gap-1">
          <Trophy className="w-3 h-3" />
          BEST IN SHOW
        </div>
      )}
      {isClassWinner && !isBestInShow && (
        <div className="absolute top-0 right-0 bg-black text-white px-2 py-1 text-[10px] font-bold flex items-center gap-1">
          <Award className="w-3 h-3" />
          CLASS WINNER
        </div>
      )}

      <div className="flex items-center gap-2 md:gap-3">
        <Medal className={`w-5 h-5 md:w-6 md:h-6 flex-shrink-0 ${ratingInfo.textColor}`} />
        <div className="min-w-0 flex-1">
          <p className={`font-bold text-sm md:text-base truncate uppercase ${ratingInfo.textColor}`}>
            {score.corps}
          </p>
          <p className={`text-xs md:text-sm font-bold ${ratingInfo.textColor}`}>
            {ratingInfo.rating}
          </p>
        </div>
      </div>
    </motion.div>
  );
};

// =============================================================================
// RATING GROUP SECTION
// =============================================================================

const RatingGroup = ({ rating, scores, bestInShowCorps, classWinnerCorps = [] }) => {
  const [isExpanded, setIsExpanded] = useState(true);
  const ratingInfo = RATING_THRESHOLDS.find(r => r.rating === rating);

  if (scores.length === 0) return null;

  return (
    <div className="mb-4">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between p-2 mb-2 bg-[#222] rounded hover:bg-[#2a2a2a] transition-colors"
      >
        <div className="flex items-center gap-2">
          <div className={`w-3 h-3 rounded-full ${ratingInfo.color} border ${ratingInfo.borderColor}`} />
          <span className="font-bold text-white text-sm">{rating}</span>
          <span className="text-gray-500 text-xs">({scores.length})</span>
        </div>
        <motion.div
          animate={{ rotate: isExpanded ? 180 : 0 }}
          transition={{ duration: 0.2 }}
        >
          <ChevronDown className="w-4 h-4 text-gray-400" />
        </motion.div>
      </button>

      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="grid grid-cols-1 md:grid-cols-2 gap-2 md:gap-3"
          >
            {scores.map((score, idx) => (
              <EnsembleCard
                key={idx}
                score={score}
                isBestInShow={score.corps === bestInShowCorps}
                isClassWinner={classWinnerCorps.includes(score.corps)}
              />
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

// =============================================================================
// BEST IN SHOW HIGHLIGHT
// =============================================================================

const BestInShowCard = ({ score }) => {
  if (!score) return null;

  return (
    <div className="bg-gradient-to-r from-yellow-500/20 to-yellow-600/10 border-2 border-yellow-500/50 rounded-lg p-4 md:p-6 mb-4">
      <div className="flex items-center gap-2 mb-3">
        <Trophy className="w-5 h-5 md:w-6 md:h-6 text-yellow-500" />
        <span className="text-yellow-500 font-bold uppercase text-xs md:text-sm">Best in Show</span>
      </div>
      <div className="flex items-center gap-3 md:gap-4">
        <div className="p-2 md:p-3 bg-primary border-2 border-black rounded-sm">
          <Medal className="w-6 h-6 md:w-8 md:h-8 text-black" />
        </div>
        <div>
          <p className="text-lg md:text-xl font-bold text-white uppercase">{score.corps}</p>
          <p className="text-yellow-400 font-bold text-sm">Gold</p>
        </div>
      </div>
    </div>
  );
};

// =============================================================================
// MAIN SOUNDSPORT TAB COMPONENT
// =============================================================================

const SoundSportTab = ({ loading, allShows }) => {
  const [showInfo, setShowInfo] = useState(true);

  // Process SoundSport shows
  const soundSportData = useMemo(() => {
    const shows = allShows.filter(show =>
      show.scores?.some(s => s.corpsClass === 'soundSport')
    ).map(show => {
      const scores = show.scores
        .filter(s => s.corpsClass === 'soundSport')
        .sort((a, b) => {
          const ratingOrderA = getRatingOrder(a.score);
          const ratingOrderB = getRatingOrder(b.score);
          if (ratingOrderA !== ratingOrderB) {
            return ratingOrderA - ratingOrderB;
          }
          return a.corps.localeCompare(b.corps);
        });

      // Find best in show (highest score)
      const bestInShow = scores.reduce((best, current) =>
        !best || current.score > best.score ? current : best
      , null);

      return {
        ...show,
        scores,
        bestInShow,
        groupedScores: groupByRating(scores),
      };
    });

    return shows;
  }, [allShows]);

  return (
    <div className="space-y-4 md:space-y-6">
      {/* SoundSport Header with Quick Access */}
      <div className="card p-4 md:p-6 border border-green-500/20 bg-gradient-to-br from-green-900/10 to-transparent">
        <div className="flex flex-col md:flex-row md:items-start gap-3 md:gap-4">
          <div className="flex items-center gap-3 md:block">
            <div className="p-2 bg-green-500/20 rounded-lg border border-green-500/30">
              <Music className="w-6 h-6 md:w-8 md:h-8 text-green-500 flex-shrink-0" />
            </div>
            <h3 className="text-base md:text-lg font-semibold text-cream-100 md:hidden">
              SoundSport
            </h3>
          </div>
          <div className="flex-1">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-lg font-semibold text-cream-100 hidden md:block">
                SoundSport Results
              </h3>
              <Link
                to="/soundsport"
                className="flex items-center gap-1 text-green-400 hover:text-green-300 text-xs font-medium transition-colors"
              >
                <BookOpen className="w-3.5 h-3.5" />
                Full Guide
                <ChevronRight className="w-3.5 h-3.5" />
              </Link>
            </div>

            <p className="text-cream-300 text-sm mb-4">
              SoundSport ensembles receive ratings based on their performance. Scores are not ranked -
              every ensemble earns recognition for their achievement.
            </p>

            {/* Quick Facts */}
            <div className="flex flex-wrap gap-3 mb-4">
              {QUICK_FACTS.map((fact, idx) => {
                const Icon = fact.icon;
                return (
                  <div key={idx} className="flex items-center gap-2 text-xs">
                    <div className="p-1.5 bg-green-500/10 rounded">
                      <Icon className="w-3.5 h-3.5 text-green-500" />
                    </div>
                    <div>
                      <span className="font-bold text-white">{fact.label}</span>
                      <span className="text-gray-500 ml-1">{fact.description}</span>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Rating Legend - Collapsible */}
            <button
              onClick={() => setShowInfo(!showInfo)}
              className="flex items-center gap-2 text-xs text-gray-400 hover:text-white transition-colors mb-2"
            >
              <Info className="w-3.5 h-3.5" />
              {showInfo ? 'Hide' : 'Show'} Rating Guide
              <motion.div
                animate={{ rotate: showInfo ? 180 : 0 }}
                transition={{ duration: 0.2 }}
              >
                <ChevronDown className="w-3.5 h-3.5" />
              </motion.div>
            </button>

            <AnimatePresence>
              {showInfo && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="overflow-hidden"
                >
                  <div className="flex flex-wrap gap-2 pt-2">
                    {RATING_THRESHOLDS.map((threshold) => (
                      <RatingBadge key={threshold.rating} rating={threshold.rating} showTooltip={true} />
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>

      {/* SoundSport Results */}
      {loading ? (
        <LoadingScreen fullScreen={false} />
      ) : soundSportData.length > 0 ? (
        <div className="space-y-6">
          {soundSportData.map((show, showIdx) => (
            <div key={showIdx} className="card p-4 md:p-6">
              {/* Event Header */}
              <div className="mb-4 md:mb-5 pb-3 border-b border-[#333]">
                <h3 className="text-lg md:text-xl font-semibold text-cream-100">{show.eventName}</h3>
                <p className="text-xs md:text-sm text-cream-500/60">{show.location} • {show.date}</p>
              </div>

              {/* Best in Show (only if there are Gold ratings) */}
              {show.groupedScores.Gold.length > 0 && (
                <BestInShowCard score={show.bestInShow} />
              )}

              {/* Results by Rating Group */}
              <div className="space-y-2">
                {['Gold', 'Silver', 'Bronze', 'Participation'].map((rating) => (
                  <RatingGroup
                    key={rating}
                    rating={rating}
                    scores={show.groupedScores[rating]}
                    bestInShowCorps={show.bestInShow?.corps}
                    classWinnerCorps={[]}
                  />
                ))}
              </div>

              {/* Summary Stats */}
              <div className="mt-4 pt-4 border-t border-[#333] flex flex-wrap gap-4 text-xs text-gray-500">
                <span className="flex items-center gap-1">
                  <Users className="w-3.5 h-3.5" />
                  {show.scores.length} Ensembles
                </span>
                {show.groupedScores.Gold.length > 0 && (
                  <span className="flex items-center gap-1 text-yellow-500">
                    <Medal className="w-3.5 h-3.5" />
                    {show.groupedScores.Gold.length} Gold
                  </span>
                )}
                {show.groupedScores.Silver.length > 0 && (
                  <span className="flex items-center gap-1 text-gray-300">
                    <Medal className="w-3.5 h-3.5" />
                    {show.groupedScores.Silver.length} Silver
                  </span>
                )}
                {show.groupedScores.Bronze.length > 0 && (
                  <span className="flex items-center gap-1 text-orange-400">
                    <Medal className="w-3.5 h-3.5" />
                    {show.groupedScores.Bronze.length} Bronze
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <EmptyState
          title="NO SOUNDSPORT EVENTS"
          subtitle="SoundSport event results will appear here when available..."
        />
      )}

      {/* CTA to learn more */}
      <div className="card p-4 md:p-6 border border-green-500/30 bg-gradient-to-r from-green-900/20 to-transparent">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Zap className="w-6 h-6 text-green-500" />
            <div>
              <h4 className="font-bold text-white">New to SoundSport?</h4>
              <p className="text-gray-400 text-sm">Learn the rules, scoring system, and how to get started.</p>
            </div>
          </div>
          <Link
            to="/soundsport"
            className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-green-500 text-black font-bold rounded-sm hover:bg-green-400 transition-colors text-sm"
          >
            Learn More
            <ChevronRight className="w-4 h-4" />
          </Link>
        </div>
      </div>
    </div>
  );
};

export default SoundSportTab;
