// src/components/Scores/ScoreLedger.jsx
// High-density "spreadsheet" style score table with heatmap coloring and sparklines

import React, { useMemo, memo } from 'react';
import { m } from 'framer-motion';
import { TrendingUp, TrendingDown, Minus, Users } from 'lucide-react';
import {
  calculateCaptionAggregates,
  getHeatmapColor,
  generateSparklinePath
} from '../../hooks/useScoresData';

// Sparkline component for trend visualization
// Memoized to prevent re-renders when parent updates with same props
const Sparkline = memo(({ values, trend, width = 60, height = 20 }) => {
  // Memoize all calculations to avoid redundant work on re-renders
  const { path, endPointY, color } = useMemo(() => {
    if (!values || values.length < 2) {
      return { path: '', endPointY: 0, color: '#94a3b8' };
    }

    const pathData = generateSparklinePath(values, width, height);
    const min = Math.min(...values);
    const max = Math.max(...values);
    const range = max - min || 1;
    const lastValue = values[values.length - 1];
    const endY = height - ((lastValue - min) / range) * height;
    const trendColor = trend === 'up' ? '#4ade80' : trend === 'down' ? '#f87171' : '#94a3b8';

    return { path: pathData, endPointY: endY, color: trendColor };
  }, [values, trend, width, height]);

  if (!values || values.length < 2) {
    return <div className="w-[60px] h-[20px] flex items-center justify-center text-cream-500/30">--</div>;
  }

  return (
    <svg width={width} height={height} className="overflow-visible">
      <path
        d={path}
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* End point indicator */}
      <circle
        cx={width}
        cy={endPointY}
        r="3"
        fill={color}
      />
    </svg>
  );
});

Sparkline.displayName = 'Sparkline';

// Trend icon component - memoized to prevent unnecessary re-renders
const TrendIcon = memo(({ trend }) => {
  if (trend === 'up') {
    return <TrendingUp className="w-3 h-3 text-green-400" />;
  } else if (trend === 'down') {
    return <TrendingDown className="w-3 h-3 text-red-400" />;
  }
  return <Minus className="w-3 h-3 text-cream-500/40" />;
});

TrendIcon.displayName = 'TrendIcon';

// Format rank ordinal (1st, 2nd, 3rd, etc.)
const formatRankOrdinal = (rank) => {
  if (!rank) return '-';
  const suffixes = ['th', 'st', 'nd', 'rd'];
  const v = rank % 100;
  return rank + (suffixes[(v - 20) % 10] || suffixes[v] || suffixes[0]);
};

// ScoreLedger Table Component
const ScoreLedger = ({
  scores = [],
  columnStats = {},
  enabledCaptions = { ge: true, vis: true, mus: true },
  onRowClick,
  selectedCorps = null,
  highlightedCorps = [],
  isArchived = false
}) => {
  // Calculate visible columns
  const visibleColumns = useMemo(() => {
    const cols = ['rank', 'corps'];
    if (enabledCaptions.ge) cols.push('ge');
    if (enabledCaptions.vis) cols.push('vis');
    if (enabledCaptions.mus) cols.push('mus');
    cols.push('total', 'trend');
    return cols;
  }, [enabledCaptions]);

  if (!scores || scores.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-cream-500/40">
        <div className="text-center">
          <Users className="w-12 h-12 mx-auto mb-3 opacity-50" />
          <p className="font-mono text-sm uppercase tracking-wide">No score data available</p>
        </div>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse">
        {/* Header */}
        <thead>
          <tr className="border-b-2 border-gold-500/30 bg-charcoal-950/50">
            <th className="px-2 py-2 text-left font-mono text-[10px] text-gold-400 uppercase tracking-widest w-12">
              #
            </th>
            <th className="px-2 py-2 text-left font-mono text-[10px] text-gold-400 uppercase tracking-widest min-w-[150px]">
              Corps / Director
            </th>
            {enabledCaptions.ge && (
              <th className="px-2 py-2 text-right font-mono text-[10px] text-gold-400 uppercase tracking-widest w-24">
                GE
              </th>
            )}
            {enabledCaptions.vis && (
              <th className="px-2 py-2 text-right font-mono text-[10px] text-gold-400 uppercase tracking-widest w-24">
                VIS
              </th>
            )}
            {enabledCaptions.mus && (
              <th className="px-2 py-2 text-right font-mono text-[10px] text-gold-400 uppercase tracking-widest w-24">
                MUS
              </th>
            )}
            <th className="px-2 py-2 text-right font-mono text-[10px] text-gold-400 uppercase tracking-widest w-28">
              TOTAL
            </th>
            <th className="px-2 py-2 text-center font-mono text-[10px] text-gold-400 uppercase tracking-widest w-20">
              TREND
            </th>
          </tr>
        </thead>

        {/* Body */}
        <tbody>
          {scores.map((score, index) => {
            const aggregates = calculateCaptionAggregates(score);
            const isHighlighted = highlightedCorps.includes(score.corps || score.corpsName);
            const isSelected = selectedCorps === (score.corps || score.corpsName);
            const trendData = score.trend || { trend: 'stable', values: [] };

            // Get heatmap colors
            const geColor = getHeatmapColor(aggregates.GE_Total, columnStats.GE_Total);
            const visColor = getHeatmapColor(aggregates.VIS_Total, columnStats.VIS_Total);
            const musColor = getHeatmapColor(aggregates.MUS_Total, columnStats.MUS_Total);

            return (
              <m.tr
                key={`${score.corps || score.corpsName}-${index}`}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.02 }}
                onClick={() => onRowClick?.(score)}
                className={`
                  h-10 border-b border-cream-500/5 transition-colors cursor-pointer
                  ${isSelected
                    ? 'bg-gold-500/20 border-gold-500/30'
                    : isHighlighted
                    ? 'bg-gold-500/10'
                    : index % 2 === 0
                    ? 'bg-charcoal-900/20 hover:bg-charcoal-800/40'
                    : 'bg-transparent hover:bg-charcoal-800/40'
                  }
                `}
              >
                {/* Rank */}
                <td className="px-2 py-1">
                  <span className={`
                    font-mono text-sm font-bold
                    ${score.rank === 1 ? 'text-gold-400' :
                      score.rank === 2 ? 'text-gray-400' :
                      score.rank === 3 ? 'text-amber-600' :
                      'text-cream-500/60'}
                  `}>
                    {score.rank}
                  </span>
                </td>

                {/* Corps Name */}
                <td className="px-2 py-1">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded bg-charcoal-800 flex items-center justify-center flex-shrink-0">
                      <span className="text-[10px] font-bold text-cream-400">
                        {(score.corps || score.corpsName || '?').charAt(0)}
                      </span>
                    </div>
                    <div className="min-w-0">
                      <p className={`text-sm font-medium truncate ${isHighlighted ? 'text-gold-400' : 'text-cream-100'}`}>
                        {score.corps || score.corpsName}
                      </p>
                      {score.corpsClass && (
                        <p className="text-[10px] text-cream-500/40 uppercase tracking-wide">
                          {score.corpsClass.replace('Class', '')}
                        </p>
                      )}
                    </div>
                  </div>
                </td>

                {/* GE Score + Rank */}
                {enabledCaptions.ge && (
                  <td className="px-2 py-1 text-right">
                    <span className={`font-mono text-sm font-bold ${geColor || 'text-gold-400'}`}>
                      {aggregates.GE_Total.toFixed(3)}
                    </span>
                    {score.GE_Rank && (
                      <span className="ml-1 text-[10px] text-cream-500/40">
                        ({formatRankOrdinal(score.GE_Rank)})
                      </span>
                    )}
                  </td>
                )}

                {/* VIS Score + Rank */}
                {enabledCaptions.vis && (
                  <td className="px-2 py-1 text-right">
                    <span className={`font-mono text-sm font-bold ${visColor || 'text-gold-400'}`}>
                      {aggregates.VIS_Total.toFixed(3)}
                    </span>
                    {score.VIS_Rank && (
                      <span className="ml-1 text-[10px] text-cream-500/40">
                        ({formatRankOrdinal(score.VIS_Rank)})
                      </span>
                    )}
                  </td>
                )}

                {/* MUS Score + Rank */}
                {enabledCaptions.mus && (
                  <td className="px-2 py-1 text-right">
                    <span className={`font-mono text-sm font-bold ${musColor || 'text-gold-400'}`}>
                      {aggregates.MUS_Total.toFixed(3)}
                    </span>
                    {score.MUS_Rank && (
                      <span className="ml-1 text-[10px] text-cream-500/40">
                        ({formatRankOrdinal(score.MUS_Rank)})
                      </span>
                    )}
                  </td>
                )}

                {/* Total Score - Highlighted */}
                <td className="px-2 py-1 text-right">
                  <span className="font-mono text-base font-black text-gold-400">
                    {aggregates.Total_Score.toFixed(3)}
                  </span>
                </td>

                {/* Trend Sparkline */}
                <td className="px-2 py-1">
                  <div className="flex items-center justify-center gap-1">
                    <Sparkline
                      values={trendData.values}
                      trend={trendData.trend}
                    />
                    <TrendIcon trend={trendData.trend} />
                  </div>
                </td>
              </m.tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};

export default ScoreLedger;
