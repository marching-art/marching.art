// TrendBadge - Shows trend direction and momentum indicators
import React from 'react';
import { TrendingUp, TrendingDown, Minus, Flame, Snowflake } from 'lucide-react';

const TrendBadge = ({ trend, momentum }) => {
  if (!trend) return null;

  const getTrendIcon = () => {
    switch (trend.direction) {
      case 'up': return <TrendingUp className="w-3 h-3 text-green-500" />;
      case 'down': return <TrendingDown className="w-3 h-3 text-red-500" />;
      default: return <Minus className="w-3 h-3 text-cream-500/60" />;
    }
  };

  return (
    <div className="flex items-center gap-0.5">
      {getTrendIcon()}
      {momentum?.status === 'hot' && <Flame className="w-3 h-3 text-orange-500" />}
      {momentum?.status === 'cold' && <Snowflake className="w-3 h-3 text-blue-400" />}
    </div>
  );
};

export default TrendBadge;
