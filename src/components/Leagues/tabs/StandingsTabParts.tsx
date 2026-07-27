// Small presentational pieces of the standings table, split out to keep
// StandingsTab under the ~700-line guidance in ARCHITECTURE.md. Pure render,
// no state — memoized because the table redraws on every standings push.

import React from 'react';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

interface RankBadgeProps {
  rank: number;
  isPlayoffSpot?: boolean;
}

/** Medal colours for the podium, a Finals-spot tint below it. */
export const RankBadge = React.memo(({ rank, isPlayoffSpot }: RankBadgeProps) => {
  if (rank === 1) {
    return (
      <div className="inline-flex items-center justify-center w-6 h-6 bg-brand/20 text-brand text-xs font-bold">
        1
      </div>
    );
  }
  if (rank === 2) {
    return (
      <div className="inline-flex items-center justify-center w-6 h-6 bg-charcoal-500/20 text-muted text-xs font-bold">
        2
      </div>
    );
  }
  if (rank === 3) {
    return (
      <div className="inline-flex items-center justify-center w-6 h-6 bg-orange-500/20 text-orange-500 text-xs font-bold">
        3
      </div>
    );
  }

  return (
    <div
      className={`inline-flex items-center justify-center w-6 h-6 text-xs font-bold ${
        isPlayoffSpot
          ? 'bg-green-500/10 text-green-500 border border-green-500/30'
          : 'bg-surface-raised text-muted'
      }`}
    >
      {rank}
    </div>
  );
});
RankBadge.displayName = 'RankBadge';

/** Form over the member's three most recent scored weeks. */
export const TrendIndicator = React.memo(({ trend }: { trend?: 'up' | 'down' | 'same' }) => {
  if (trend === 'up') {
    return <TrendingUp className="w-3.5 h-3.5 text-green-500 mx-auto" />;
  }
  if (trend === 'down') {
    return <TrendingDown className="w-3.5 h-3.5 text-red-500 mx-auto" />;
  }
  return <Minus className="w-3.5 h-3.5 text-muted mx-auto" />;
});
TrendIndicator.displayName = 'TrendIndicator';
