// =============================================================================
// RECOMMENDATION CARDS - BUY/HOLD/SELL fantasy recommendations display
// =============================================================================
// Displays structured fantasy recommendations from fantasy_recap articles
// Visual cards with color coding for buy (green), hold (yellow), sell (red)

import React from 'react';
import { TrendingUp, Pause, TrendingDown, ShoppingCart } from 'lucide-react';

// Caption abbreviation map
const CAPTION_NAMES = {
  GE1: 'General Effect 1',
  GE2: 'General Effect 2',
  VP: 'Visual Proficiency',
  VA: 'Visual Analysis',
  CG: 'Color Guard',
  B: 'Brass',
  MA: 'Music Analysis',
  P: 'Percussion',
};

// Recommendation type configuration
const REC_CONFIG = {
  buy: {
    title: 'BUY',
    subtitle: 'Add to your lineup',
    icon: TrendingUp,
    bgClass: 'bg-green-500/10',
    borderClass: 'border-green-500/30',
    iconBgClass: 'bg-green-500/20',
    iconClass: 'text-green-500',
    titleClass: 'text-green-500',
    cardBg: 'bg-green-500/5',
    cardBorder: 'border-green-500/20',
    scoreClass: 'text-green-400',
  },
  hold: {
    title: 'HOLD',
    subtitle: 'Keep if you have them',
    icon: Pause,
    bgClass: 'bg-yellow-500/10',
    borderClass: 'border-yellow-500/30',
    iconBgClass: 'bg-yellow-500/20',
    iconClass: 'text-yellow-500',
    titleClass: 'text-yellow-500',
    cardBg: 'bg-yellow-500/5',
    cardBorder: 'border-yellow-500/20',
    scoreClass: 'text-yellow-400',
  },
  sell: {
    title: 'SELL',
    subtitle: 'Consider dropping',
    icon: TrendingDown,
    bgClass: 'bg-red-500/10',
    borderClass: 'border-red-500/30',
    iconBgClass: 'bg-red-500/20',
    iconClass: 'text-red-500',
    titleClass: 'text-red-500',
    cardBg: 'bg-red-500/5',
    cardBorder: 'border-red-500/20',
    scoreClass: 'text-red-400',
  },
};

// Individual recommendation item
function RecommendationItem({ rec, config }) {
  const captionLabel = CAPTION_NAMES[rec.caption] || rec.caption;

  return (
    <div className={`${config.cardBg} border ${config.cardBorder} p-3 rounded-sm`}>
      <div className="flex items-start justify-between gap-2 mb-1">
        <div className="flex-1 min-w-0">
          <span className="text-sm font-bold text-white block truncate">
            {rec.corps}
          </span>
          {rec.caption && (
            <span className="text-xs text-gray-500">
              {captionLabel}
            </span>
          )}
        </div>
        {rec.score > 0 && (
          <span className={`text-sm font-data font-bold ${config.scoreClass} tabular-nums whitespace-nowrap`}>
            {rec.score.toFixed(2)}
          </span>
        )}
      </div>
      {rec.reason && (
        <p className="text-xs text-gray-400 mt-1.5 leading-relaxed">
          {rec.reason}
        </p>
      )}
    </div>
  );
}

// Recommendation section (BUY, HOLD, or SELL)
function RecommendationSection({ type, items }) {
  const config = REC_CONFIG[type];
  if (!config || !items || items.length === 0) return null;

  const Icon = config.icon;

  return (
    <div className={`${config.bgClass} border ${config.borderClass} p-4 rounded-sm`}>
      <div className="flex items-center gap-2 mb-3">
        <div className={`p-1.5 ${config.iconBgClass} rounded-sm`}>
          <Icon className={`w-4 h-4 ${config.iconClass}`} />
        </div>
        <div>
          <span className={`text-sm font-bold ${config.titleClass}`}>
            {config.title}
          </span>
          <span className="text-xs text-gray-500 ml-2">
            {config.subtitle}
          </span>
        </div>
      </div>
      <div className="space-y-2">
        {items.map((rec, idx) => (
          <RecommendationItem key={idx} rec={rec} config={config} />
        ))}
      </div>
    </div>
  );
}

/**
 * RecommendationCards - Displays BUY/HOLD/SELL recommendations
 * @param {Object} recommendations - Object with buy, hold, sell arrays
 */
export default function RecommendationCards({ recommendations }) {
  if (!recommendations) return null;

  const { buy = [], hold = [], sell = [] } = recommendations;

  // Check if we have any recommendations
  if (buy.length === 0 && hold.length === 0 && sell.length === 0) return null;

  return (
    <div className="mb-8">
      <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-4 flex items-center gap-2">
        <ShoppingCart className="w-4 h-4 text-green-400" />
        Fantasy Picks
      </h3>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <RecommendationSection type="buy" items={buy} />
        <RecommendationSection type="hold" items={hold} />
        <RecommendationSection type="sell" items={sell} />
      </div>
    </div>
  );
}
