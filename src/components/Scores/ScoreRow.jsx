// ScoreRow - Individual score row with expandable caption breakdown
import React, { useState } from 'react';
import { m } from 'framer-motion';
import { Eye, Music, ChevronDown } from 'lucide-react';
import { CAPTION_CATEGORIES } from '../../utils/captionPricing';

const ScoreRow = React.memo(({ score, rank }) => {
  const [expanded, setExpanded] = useState(false);

  // Check if we have detailed captions (historical data) or aggregate scores (fantasy data)
  const hasDetailedCaptions = score.captions && Object.keys(score.captions).length > 0;

  // Get scores - either from detailed captions or from aggregate scores
  const geScore = hasDetailedCaptions
    ? (score.captions.GE1 || 0) + (score.captions.GE2 || 0)
    : (score.geScore || 0);

  const visualScore = hasDetailedCaptions
    ? ((score.captions.VP || 0) + (score.captions.VA || 0) + (score.captions.CG || 0)) / 2
    : (score.visualScore || 0);

  const musicScore = hasDetailedCaptions
    ? ((score.captions.B || 0) + (score.captions.MA || 0) + (score.captions.P || 0)) / 2
    : (score.musicScore || 0);

  // Check if we have any caption data to show
  const hasCaptions = geScore > 0 || visualScore > 0 || musicScore > 0;

  // Rank styling: Use gold backgrounds with dark text for contrast (No Gold Text Rule)
  const getRankStyle = (rank) => {
    if (rank === 1) return 'bg-amber-100 dark:bg-yellow-500/20 text-amber-800 dark:text-yellow-400 px-2 py-0.5 rounded';
    if (rank === 2) return 'bg-slate-200 dark:bg-gray-500/20 text-slate-700 dark:text-gray-400 px-2 py-0.5 rounded';
    if (rank === 3) return 'bg-orange-100 dark:bg-orange-500/20 text-orange-700 dark:text-orange-400 px-2 py-0.5 rounded';
    return 'text-slate-500 dark:text-cream-500/60';
  };

  return (
    <div className="bg-white dark:bg-charcoal-900/30 border border-stone-200 dark:border-transparent rounded-sm overflow-hidden shadow-sm dark:shadow-none">
      <div
        className={`p-3 md:p-4 transition-colors ${
          hasDetailedCaptions ? 'cursor-pointer hover:bg-stone-50 dark:hover:bg-charcoal-900/50' : ''
        }`}
        onClick={() => hasDetailedCaptions && setExpanded(!expanded)}
      >
        {/* Main row */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 md:gap-4 min-w-0">
            <span className={`text-sm md:text-lg font-bold flex-shrink-0 ${getRankStyle(rank)}`}>
              #{rank}
            </span>
            <div className="min-w-0">
              <span className="text-slate-900 dark:text-cream-100 font-medium text-sm md:text-base truncate block">{score.corps}</span>
              {score.corpsClass && (
                <span className="text-xs text-slate-500 dark:text-cream-500/60">
                  {score.corpsClass}
                </span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-3 md:gap-4 flex-shrink-0">
            {/* Desktop caption display */}
            <div className="hidden md:flex items-center gap-4 text-sm">
              <div className="text-center">
                <div className="text-slate-500 dark:text-cream-500/60 text-xs">GE</div>
                <div className="text-slate-900 dark:text-cream-100 font-semibold">{geScore.toFixed(3)}</div>
              </div>
              <div className="text-center">
                <div className="text-slate-500 dark:text-cream-500/60 text-xs flex items-center gap-1">
                  <Eye className="w-3 h-3" />
                  Visual
                </div>
                <div className="text-slate-900 dark:text-cream-100 font-semibold">{visualScore.toFixed(3)}</div>
              </div>
              <div className="text-center">
                <div className="text-slate-500 dark:text-cream-500/60 text-xs flex items-center gap-1">
                  <Music className="w-3 h-3" />
                  Music
                </div>
                <div className="text-slate-900 dark:text-cream-100 font-semibold">{musicScore.toFixed(3)}</div>
              </div>
            </div>
            <div className="text-right">
              <div className="text-xl md:text-2xl font-bold text-slate-900 dark:text-gold-500">{score.score.toFixed(3)}</div>
            </div>
          </div>
        </div>

        {/* Mobile caption summary */}
        {hasCaptions && (
          <div className="md:hidden flex items-center justify-end gap-3 mt-2 text-xs text-slate-500 dark:text-cream-500/60">
            <span>GE: {geScore.toFixed(3)}</span>
            <span>V: {visualScore.toFixed(3)}</span>
            <span>M: {musicScore.toFixed(3)}</span>
            {hasDetailedCaptions && (
              <ChevronDown className={`w-4 h-4 transition-transform ${expanded ? 'rotate-180' : ''}`} />
            )}
          </div>
        )}
      </div>

      {/* Only show caption breakdown if we have detailed caption data */}
      {expanded && hasDetailedCaptions && (
        <m.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: 'auto', opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          className="px-3 pb-3 md:px-4 md:pb-4"
        >
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 md:gap-3 p-3 md:p-4 bg-stone-100 dark:bg-charcoal-900/50 rounded-sm">
            {Object.entries(CAPTION_CATEGORIES).map(([key, caption]) => {
              const value = score.captions[key] || 0;
              const maxValue = caption.weight;
              const percentage = (value / maxValue) * 100;

              return (
                <div key={key} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-500 dark:text-cream-500/60">{caption.shortName}</span>
                    <span className="text-slate-900 dark:text-cream-100 font-semibold">{value.toFixed(3)}</span>
                  </div>
                  <div className="h-1.5 md:h-2 bg-stone-200 dark:bg-charcoal-900 rounded-sm overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-gold-500 to-gold-400"
                      style={{ width: `${percentage}%` }}
                    />
                  </div>
                  <div className="text-xs text-slate-400 dark:text-cream-500/40">of {maxValue}</div>
                </div>
              );
            })}
          </div>
        </m.div>
      )}
    </div>
  );
});

ScoreRow.displayName = 'ScoreRow';

export default ScoreRow;
