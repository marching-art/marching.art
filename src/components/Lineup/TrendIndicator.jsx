import React from 'react';
import { TrendingUp, TrendingDown, Minus, Flame, Snowflake, Activity, Target } from 'lucide-react';

/**
 * TrendIndicator - Displays trend analytics for a caption
 * Shows trend direction, momentum, consistency, and relative strength
 */
const TrendIndicator = ({ analytics, compact = false }) => {
  if (!analytics || analytics.dataPoints === 0) {
    return compact ? null : (
      <div className="text-xs text-cream-500/40">No trend data</div>
    );
  }

  const { trend, momentum, consistency, strength } = analytics;

  // Trend arrow icon and color
  const getTrendIcon = () => {
    switch (trend.direction) {
      case 'up':
        return <TrendingUp className="w-3.5 h-3.5 text-green-500" />;
      case 'down':
        return <TrendingDown className="w-3.5 h-3.5 text-red-500" />;
      default:
        return <Minus className="w-3.5 h-3.5 text-cream-500/60" />;
    }
  };

  // Momentum icon
  const getMomentumIcon = () => {
    switch (momentum.status) {
      case 'hot':
        return <Flame className="w-3 h-3 text-orange-500" />;
      case 'cold':
        return <Snowflake className="w-3 h-3 text-blue-400" />;
      default:
        return null;
    }
  };

  // Consistency color
  const getConsistencyColor = () => {
    switch (consistency.rating) {
      case 'reliable':
        return 'text-green-500';
      case 'steady':
        return 'text-emerald-400';
      case 'variable':
        return 'text-yellow-500';
      case 'volatile':
        return 'text-red-500';
      default:
        return 'text-cream-500/60';
    }
  };

  // Strength indicator color
  const getStrengthColor = () => {
    if (strength.percentile >= 75) return 'text-green-500';
    if (strength.percentile >= 50) return 'text-emerald-400';
    if (strength.percentile >= 25) return 'text-yellow-500';
    return 'text-red-500';
  };

  // Compact view - just icons
  if (compact) {
    return (
      <div className="flex items-center gap-1">
        {getTrendIcon()}
        {getMomentumIcon()}
      </div>
    );
  }

  // Full view with labels
  return (
    <div className="space-y-1.5 text-xs">
      {/* Trend */}
      <div className="flex items-center justify-between">
        <span className="text-cream-500/60">Trend</span>
        <div className="flex items-center gap-1">
          {getTrendIcon()}
          <span className={trend.direction === 'up' ? 'text-green-500' :
                          trend.direction === 'down' ? 'text-red-500' : 'text-cream-500/60'}>
            {trend.label}
          </span>
        </div>
      </div>

      {/* Momentum */}
      <div className="flex items-center justify-between">
        <span className="text-cream-500/60">Momentum</span>
        <div className="flex items-center gap-1">
          {getMomentumIcon()}
          <span className={momentum.status === 'hot' ? 'text-orange-500' :
                          momentum.status === 'cold' ? 'text-blue-400' : 'text-cream-500'}>
            {momentum.label}
          </span>
        </div>
      </div>

      {/* Consistency */}
      <div className="flex items-center justify-between">
        <span className="text-cream-500/60">Consistency</span>
        <div className="flex items-center gap-1">
          <Activity className={`w-3 h-3 ${getConsistencyColor()}`} />
          <span className={getConsistencyColor()}>
            {consistency.label}
          </span>
        </div>
      </div>

      {/* Relative Strength */}
      <div className="flex items-center justify-between">
        <span className="text-cream-500/60">Strength</span>
        <div className="flex items-center gap-1">
          <Target className={`w-3 h-3 ${getStrengthColor()}`} />
          <span className={getStrengthColor()}>
            {strength.label}
          </span>
        </div>
      </div>
    </div>
  );
};

/**
 * TrendBadge - Compact badge showing overall trend status
 */
export const TrendBadge = ({ analytics }) => {
  if (!analytics || analytics.dataPoints === 0) return null;

  const { trend, momentum } = analytics;

  // Determine overall sentiment
  let bgColor = 'bg-cream-800/50';
  let textColor = 'text-cream-500';

  if (trend.direction === 'up' && momentum.status === 'hot') {
    bgColor = 'bg-green-500/20';
    textColor = 'text-green-400';
  } else if (trend.direction === 'up') {
    bgColor = 'bg-emerald-500/20';
    textColor = 'text-emerald-400';
  } else if (trend.direction === 'down' && momentum.status === 'cold') {
    bgColor = 'bg-red-500/20';
    textColor = 'text-red-400';
  } else if (trend.direction === 'down') {
    bgColor = 'bg-orange-500/20';
    textColor = 'text-orange-400';
  }

  return (
    <div className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs ${bgColor} ${textColor}`}>
      {trend.direction === 'up' ? (
        <TrendingUp className="w-3 h-3" />
      ) : trend.direction === 'down' ? (
        <TrendingDown className="w-3 h-3" />
      ) : (
        <Minus className="w-3 h-3" />
      )}
      {momentum.status === 'hot' && <Flame className="w-3 h-3" />}
      {momentum.status === 'cold' && <Snowflake className="w-3 h-3" />}
    </div>
  );
};

export default TrendIndicator;
