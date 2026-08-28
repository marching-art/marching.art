// =============================================================================
// RECOMMENDATION CARDS - BUY/HOLD/SELL fantasy recommendations display
// =============================================================================
// Displays structured fantasy recommendations from fantasy_recap articles
// Visual cards with color coding for buy (green), hold (yellow), sell (red)

import React from 'react';
import { TrendingUp, Pause, TrendingDown, ShoppingCart } from 'lucide-react';

/**
 * A single fantasy pick, optionally enriched with Fantasy Market Report metrics.
 * @typedef {Object} Recommendation
 * @property {string} corps
 * @property {string} [caption]
 * @property {number} [score]
 * @property {number} [cost]
 * @property {number} [value]
 * @property {number} [tenDayGain]
 * @property {string} [reason]
 */

/**
 * Visual configuration for a BUY/HOLD/SELL section.
 * @typedef {Object} RecConfig
 * @property {string} title
 * @property {string} subtitle
 * @property {import('lucide-react').LucideIcon} icon
 * @property {string} bgClass
 * @property {string} borderClass
 * @property {string} iconBgClass
 * @property {string} iconClass
 * @property {string} titleClass
 * @property {string} cardBg
 * @property {string} cardBorder
 * @property {string} scoreClass
 */

// Caption abbreviation map
/** @type {Record<string, string>} */
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
/** @type {Record<string, RecConfig>} */
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
    bgClass: 'bg-warning/10',
    borderClass: 'border-warning/30',
    iconBgClass: 'bg-warning/20',
    iconClass: 'text-warning',
    titleClass: 'text-warning',
    cardBg: 'bg-warning/5',
    cardBorder: 'border-warning/20',
    scoreClass: 'text-warning',
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

// Compact metric chip shown under a pick: cost, value (score/point), or 10-day gain.
/**
 * @param {{ label: string, value: string, tone?: string }} props
 */
function MetricChip({ label, value, tone = 'text-secondary' }) {
  return (
    <span className="inline-flex items-baseline gap-1 px-1.5 py-0.5 bg-white/5 rounded-none">
      <span className="text-[9px] uppercase tracking-wider text-muted">{label}</span>
      <span className={`text-[11px] font-data font-bold tabular-nums ${tone}`}>{value}</span>
    </span>
  );
}

// Individual recommendation item
/**
 * @param {{ rec: Recommendation, config: RecConfig }} props
 */
function RecommendationItem({ rec, config }) {
  const captionLabel = rec.caption ? CAPTION_NAMES[rec.caption] || rec.caption : '';

  // Value/cost/gain are optional enrichments from the Fantasy Market Report:
  // cost = the corps' purchase price in points, value = caption score per point,
  // gain = 10-day average daily gain. Show whichever the article provided.
  // Destructure into locals so the `has*` flags narrow the optional numbers.
  const { cost, value, tenDayGain, score } = rec;
  const hasCost = typeof cost === 'number' && cost > 0;
  const hasValue = typeof value === 'number' && value > 0;
  const hasGain = typeof tenDayGain === 'number' && Number.isFinite(tenDayGain);
  const showMetrics = hasCost || hasValue || hasGain;

  return (
    <div className={`${config.cardBg} border ${config.cardBorder} p-3 rounded-none`}>
      <div className="flex items-start justify-between gap-2 mb-1">
        <div className="flex-1 min-w-0">
          <span className="text-sm font-bold text-white block truncate">{rec.corps}</span>
          {rec.caption && <span className="text-xs text-muted">{captionLabel}</span>}
        </div>
        {typeof score === 'number' && score > 0 && (
          <span
            className={`text-sm font-data font-bold ${config.scoreClass} tabular-nums whitespace-nowrap`}
          >
            {score.toFixed(2)}
          </span>
        )}
      </div>
      {showMetrics && (
        <div className="flex flex-wrap gap-1.5 mt-1.5">
          {hasCost && <MetricChip label="Cost" value={`${cost} pt`} />}
          {hasValue && <MetricChip label="Value" value={`${value.toFixed(2)}/pt`} />}
          {hasGain && (
            <MetricChip
              label="10-Day"
              value={`${tenDayGain >= 0 ? '+' : ''}${tenDayGain.toFixed(2)}/d`}
              tone={tenDayGain >= 0 ? 'text-green-400' : 'text-red-400'}
            />
          )}
        </div>
      )}
      {rec.reason && <p className="text-xs text-muted mt-1.5 leading-relaxed">{rec.reason}</p>}
    </div>
  );
}

// Recommendation section (BUY, HOLD, or SELL)
/**
 * @param {{ type: string, items: Recommendation[] }} props
 */
function RecommendationSection({ type, items }) {
  const config = REC_CONFIG[type];
  if (!config || !items || items.length === 0) return null;

  const Icon = config.icon;

  return (
    <div className={`${config.bgClass} border ${config.borderClass} p-4 rounded-none`}>
      <div className="flex items-center gap-2 mb-3">
        <div className={`p-1.5 ${config.iconBgClass} rounded-none`}>
          <Icon className={`w-4 h-4 ${config.iconClass}`} />
        </div>
        <div>
          <span className={`text-sm font-bold ${config.titleClass}`}>{config.title}</span>
          <span className="text-xs text-muted ml-2">{config.subtitle}</span>
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
 * @param {{ recommendations?: { buy?: Recommendation[], hold?: Recommendation[], sell?: Recommendation[] } | null }} props
 */
export default function RecommendationCards({ recommendations }) {
  if (!recommendations) return null;

  const { buy = [], hold = [], sell = [] } = recommendations;

  // Check if we have any recommendations
  if (buy.length === 0 && hold.length === 0 && sell.length === 0) return null;

  return (
    <div className="mb-8">
      <h3 className="text-sm font-bold text-muted uppercase tracking-wider mb-4 flex items-center gap-2">
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
