// =============================================================================
// DASHBOARD FOOTER - League Ticker & Score Summary
// =============================================================================
// A data-dense footer bar displaying:
// - Zone 1: Last show score
// - Zone 2: Projected/expected score
// - Zone 3: Scrolling ticker with match results or league news
//
// Handles empty state for pre-season with appropriate messaging.

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Trophy,
  TrendingUp,
  TrendingDown,
  Minus,
  Clock,
  Calendar,
  Star,
  Zap,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';

// =============================================================================
// SCORE ZONE - Compact score display
// =============================================================================

const ScoreZone = ({ label, value, sublabel, trend, icon: Icon, color = 'gold' }) => {
  const colorClasses = {
    gold: 'text-gold-400 border-gold-500/30',
    blue: 'text-blue-400 border-blue-500/30',
    green: 'text-green-400 border-green-500/30',
    purple: 'text-purple-400 border-purple-500/30',
  };

  const TrendIcon = trend === 'up' ? TrendingUp : trend === 'down' ? TrendingDown : Minus;

  return (
    <div className={`
      flex items-center gap-2 px-3 py-1.5 rounded-lg border bg-black/30
      ${colorClasses[color]}
    `}>
      {Icon && <Icon className="w-3.5 h-3.5 shrink-0 opacity-60" />}
      <div className="min-w-0">
        <div className="text-[9px] text-cream/40 uppercase tracking-wide truncate">
          {label}
        </div>
        <div className="flex items-center gap-1">
          <span className="text-sm font-data font-bold">{value}</span>
          {trend && (
            <TrendIcon className={`w-3 h-3 ${
              trend === 'up' ? 'text-green-400' : trend === 'down' ? 'text-red-400' : 'text-cream/40'
            }`} />
          )}
        </div>
        {sublabel && (
          <div className="text-[8px] text-cream/30 truncate">{sublabel}</div>
        )}
      </div>
    </div>
  );
};

// =============================================================================
// TICKER ITEM - Single news/result item
// =============================================================================

const TickerItem = ({ item, isActive }) => {
  const getIcon = () => {
    switch (item.type) {
      case 'result': return Trophy;
      case 'news': return Star;
      case 'schedule': return Calendar;
      default: return Zap;
    }
  };

  const Icon = getIcon();

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: isActive ? 1 : 0.5, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className={`
        flex items-center gap-2 px-3 py-1 rounded whitespace-nowrap
        ${isActive ? 'bg-white/5' : ''}
      `}
    >
      <Icon className="w-3 h-3 text-gold-400 shrink-0" />
      <span className="text-[10px] text-cream/70">
        {item.message}
      </span>
      {item.score && (
        <span className="text-[10px] font-data font-bold text-gold-400">
          {item.score}
        </span>
      )}
      {item.time && (
        <span className="text-[9px] text-cream/30">
          {item.time}
        </span>
      )}
    </motion.div>
  );
};

// =============================================================================
// SCROLLING TICKER - Auto-scrolling news ticker
// =============================================================================

const ScrollingTicker = ({ items }) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);

  useEffect(() => {
    if (items.length <= 1 || isPaused) return;

    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % items.length);
    }, 5000);

    return () => clearInterval(interval);
  }, [items.length, isPaused]);

  const goNext = () => {
    setCurrentIndex((prev) => (prev + 1) % items.length);
  };

  const goPrev = () => {
    setCurrentIndex((prev) => (prev - 1 + items.length) % items.length);
  };

  if (items.length === 0) {
    return (
      <div className="flex items-center gap-2 px-3 py-1 text-cream/40">
        <Clock className="w-3 h-3" />
        <span className="text-[10px]">Pre-season: No match data available</span>
      </div>
    );
  }

  return (
    <div
      className="flex items-center gap-1"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
    >
      {/* Navigation - Previous */}
      {items.length > 1 && (
        <button
          onClick={goPrev}
          className="p-1 rounded hover:bg-white/10 text-cream/40 hover:text-cream transition-colors"
        >
          <ChevronLeft className="w-3 h-3" />
        </button>
      )}

      {/* Ticker Content */}
      <div className="flex-1 overflow-hidden">
        <AnimatePresence mode="wait">
          <TickerItem
            key={currentIndex}
            item={items[currentIndex]}
            isActive={true}
          />
        </AnimatePresence>
      </div>

      {/* Navigation - Next */}
      {items.length > 1 && (
        <button
          onClick={goNext}
          className="p-1 rounded hover:bg-white/10 text-cream/40 hover:text-cream transition-colors"
        >
          <ChevronRight className="w-3 h-3" />
        </button>
      )}

      {/* Dots Indicator */}
      {items.length > 1 && (
        <div className="flex items-center gap-0.5 px-1">
          {items.map((_, idx) => (
            <button
              key={idx}
              onClick={() => setCurrentIndex(idx)}
              className={`w-1 h-1 rounded-full transition-all ${
                idx === currentIndex ? 'bg-gold-400 w-2' : 'bg-cream/20'
              }`}
            />
          ))}
        </div>
      )}
    </div>
  );
};

// =============================================================================
// DASHBOARD FOOTER COMPONENT
// =============================================================================

/**
 * DashboardFooter - League ticker and score summary bar
 *
 * @param {Array} recentScores - Array of recent show scores
 * @param {Object} activeCorps - Active corps data
 * @param {number} multiplier - Current performance multiplier
 * @param {Array} leagueNews - Optional array of league news items
 * @param {Object} seasonData - Season data for context
 * @param {number} currentWeek - Current week number
 */
const DashboardFooter = ({
  recentScores = [],
  activeCorps,
  multiplier = 1.0,
  leagueNews = [],
  seasonData,
  currentWeek,
}) => {
  // Calculate last show score
  const lastScore = recentScores?.[0];
  const previousScore = recentScores?.[1];
  const lastScoreValue = lastScore?.totalScore || lastScore?.score;
  const previousScoreValue = previousScore?.totalScore || previousScore?.score;

  const scoreTrend = lastScoreValue && previousScoreValue
    ? lastScoreValue > previousScoreValue ? 'up'
      : lastScoreValue < previousScoreValue ? 'down'
      : 'flat'
    : undefined;

  // Calculate projected score
  const baseScore = activeCorps?.averageScore || lastScoreValue || 0;
  const projectedScore = baseScore * multiplier;

  // Build ticker items from recent scores and league news
  const tickerItems = [];

  // Add recent match results
  if (recentScores && recentScores.length > 0) {
    recentScores.slice(0, 5).forEach((score, idx) => {
      const scoreValue = score.totalScore || score.score;
      const showName = score.showName || score.eventName || `Show ${idx + 1}`;
      const placement = score.placement;

      tickerItems.push({
        id: `score-${idx}`,
        type: 'result',
        message: placement
          ? `${showName}: ${placement}${getOrdinal(placement)} place`
          : showName,
        score: scoreValue ? scoreValue.toFixed(2) : undefined,
        time: score.date ? formatRelativeTime(score.date) : undefined,
      });
    });
  }

  // Add league news if provided
  if (leagueNews && leagueNews.length > 0) {
    leagueNews.forEach((news, idx) => {
      tickerItems.push({
        id: `news-${idx}`,
        type: 'news',
        message: news.message || news.title,
        time: news.timestamp ? formatRelativeTime(news.timestamp) : undefined,
      });
    });
  }

  // Add season context if no other items
  if (tickerItems.length === 0 && seasonData) {
    tickerItems.push({
      id: 'season-start',
      type: 'schedule',
      message: `Season ${seasonData.seasonNumber || 1} • Week ${currentWeek || 1}`,
    });
  }

  return (
    <footer className="
      w-full h-10 shrink-0
      bg-surface-secondary/80 backdrop-blur-md
      border-t border-white/10
      flex items-center
      px-2 gap-2
    ">
      {/* Zone 1: Last Show Score */}
      <ScoreZone
        label="Last Show"
        value={lastScoreValue ? lastScoreValue.toFixed(2) : '—'}
        sublabel={lastScore?.showName || lastScore?.eventName}
        trend={scoreTrend}
        icon={Trophy}
        color="gold"
      />

      {/* Zone 2: Projected Score */}
      <ScoreZone
        label="Projected"
        value={projectedScore > 0 ? projectedScore.toFixed(2) : '—'}
        sublabel={`${(multiplier * 100).toFixed(0)}% multiplier`}
        icon={TrendingUp}
        color="blue"
      />

      {/* Divider */}
      <div className="hidden sm:block w-px h-6 bg-white/10" />

      {/* Zone 3: Scrolling Ticker */}
      <div className="flex-1 min-w-0 hidden sm:block">
        <ScrollingTicker items={tickerItems} />
      </div>

      {/* Mobile: Simple indicator */}
      <div className="flex-1 sm:hidden flex items-center justify-end">
        <div className="flex items-center gap-1 text-[9px] text-cream/40">
          <Zap className="w-3 h-3" />
          <span>{tickerItems.length} updates</span>
        </div>
      </div>
    </footer>
  );
};

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

function getOrdinal(n) {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return s[(v - 20) % 10] || s[v] || s[0];
}

function formatRelativeTime(date) {
  if (!date) return '';

  const now = new Date();
  const then = date instanceof Date ? date : new Date(date);
  const diffMs = now - then;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return then.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export default DashboardFooter;
