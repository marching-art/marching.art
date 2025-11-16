// src/components/PerformanceChart.jsx
import React, { useMemo } from 'react';
import { motion } from 'framer-motion';
import { TrendingUp, TrendingDown, Minus, Award, Calendar } from 'lucide-react';

const PerformanceChart = ({ scores = [], corpsClass }) => {
  const isSoundSport = corpsClass === 'soundSport';

  // Calculate statistics
  const stats = useMemo(() => {
    if (scores.length === 0) {
      return {
        total: 0,
        average: 0,
        best: 0,
        worst: 0,
        trend: 0,
        improvement: 0
      };
    }

    const validScores = scores.filter(s => typeof s.totalScore === 'number');
    if (validScores.length === 0) {
      return { total: scores.length, average: 0, best: 0, worst: 0, trend: 0, improvement: 0 };
    }

    const scoreValues = validScores.map(s => s.totalScore);
    const total = validScores.length;
    const average = scoreValues.reduce((sum, score) => sum + score, 0) / total;
    const best = Math.max(...scoreValues);
    const worst = Math.min(...scoreValues);

    // Calculate trend (positive = improving)
    const midpoint = Math.floor(total / 2);
    const firstHalf = scoreValues.slice(0, midpoint);
    const secondHalf = scoreValues.slice(midpoint);

    const firstAvg = firstHalf.length > 0
      ? firstHalf.reduce((sum, s) => sum + s, 0) / firstHalf.length
      : 0;
    const secondAvg = secondHalf.length > 0
      ? secondHalf.reduce((sum, s) => sum + s, 0) / secondHalf.length
      : 0;
    const trend = secondAvg - firstAvg;

    // Calculate improvement from first to last
    const improvement = total > 1 ? scoreValues[scoreValues.length - 1] - scoreValues[0] : 0;

    return { total, average, best, worst, trend, improvement };
  }, [scores]);

  // Find min and max for scaling
  const scoreValues = scores.filter(s => typeof s.totalScore === 'number').map(s => s.totalScore);
  const minScore = scoreValues.length > 0 ? Math.min(...scoreValues) : 0;
  const maxScore = scoreValues.length > 0 ? Math.max(...scoreValues) : 100;
  const scoreRange = maxScore - minScore || 1;

  // Generate points for the line chart
  const chartPoints = useMemo(() => {
    if (scoreValues.length === 0) return [];

    const width = 100; // percentage
    const height = 100; // percentage
    const padding = 5; // percentage

    return scoreValues.map((score, index) => {
      const x = (index / (scoreValues.length - 1 || 1)) * (width - 2 * padding) + padding;
      const y = height - padding - ((score - minScore) / scoreRange) * (height - 2 * padding);
      return { x, y, score, index };
    });
  }, [scoreValues, minScore, scoreRange]);

  // Create SVG path
  const pathD = chartPoints.length > 0
    ? chartPoints.map((point, i) =>
        `${i === 0 ? 'M' : 'L'} ${point.x} ${point.y}`
      ).join(' ')
    : '';

  // Create area path (for gradient fill)
  const areaPathD = chartPoints.length > 0
    ? `${pathD} L ${chartPoints[chartPoints.length - 1].x} 100 L ${chartPoints[0].x} 100 Z`
    : '';

  const getTrendIcon = () => {
    if (stats.trend > 1) return <TrendingUp className="w-4 h-4 text-green-500" />;
    if (stats.trend < -1) return <TrendingDown className="w-4 h-4 text-red-500" />;
    return <Minus className="w-4 h-4 text-yellow-500" />;
  };

  const getTrendColor = () => {
    if (stats.trend > 1) return 'text-green-500';
    if (stats.trend < -1) return 'text-red-500';
    return 'text-yellow-500';
  };

  if (scores.length === 0) {
    return (
      <div className="card">
        <h3 className="text-lg font-semibold text-cream-100 mb-4">
          {isSoundSport ? 'Season Journey' : 'Performance Trend'}
        </h3>
        <div className="h-64 flex flex-col items-center justify-center text-cream-500/60">
          <Calendar className="w-12 h-12 mb-3" />
          <p className="text-center">
            {isSoundSport
              ? 'Complete performances to see your season journey'
              : 'No performances yet. Select shows to start your season!'}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-semibold text-cream-100">
          {isSoundSport ? 'Season Journey' : 'Performance Trend'}
        </h3>
        <div className="flex items-center gap-2">
          {getTrendIcon()}
          <span className={`text-sm font-semibold ${getTrendColor()}`}>
            {stats.trend > 0 ? '+' : ''}{stats.trend.toFixed(2)}
          </span>
        </div>
      </div>

      {/* Statistics Grid */}
      {!isSoundSport && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          <div className="p-3 bg-charcoal-900/50 rounded-lg">
            <p className="text-xs text-cream-500/60 mb-1">Shows</p>
            <p className="text-xl font-bold text-cream-100">{stats.total}</p>
          </div>
          <div className="p-3 bg-charcoal-900/50 rounded-lg">
            <p className="text-xs text-cream-500/60 mb-1">Average</p>
            <p className="text-xl font-bold text-blue-400">{stats.average.toFixed(2)}</p>
          </div>
          <div className="p-3 bg-charcoal-900/50 rounded-lg">
            <p className="text-xs text-cream-500/60 mb-1">Best</p>
            <p className="text-xl font-bold text-green-400">{stats.best.toFixed(2)}</p>
          </div>
          <div className="p-3 bg-charcoal-900/50 rounded-lg">
            <p className="text-xs text-cream-500/60 mb-1">Improvement</p>
            <p className={`text-xl font-bold ${stats.improvement >= 0 ? 'text-green-400' : 'text-red-400'}`}>
              {stats.improvement >= 0 ? '+' : ''}{stats.improvement.toFixed(2)}
            </p>
          </div>
        </div>
      )}

      {/* Chart */}
      <div className="relative h-48 bg-charcoal-900/30 rounded-lg p-4">
        {isSoundSport ? (
          // SoundSport - Show participation journey
          <div className="flex items-center justify-between h-full">
            {scores.slice(0, 10).map((score, index) => (
              <motion.div
                key={index}
                initial={{ scaleY: 0 }}
                animate={{ scaleY: 1 }}
                transition={{ delay: index * 0.1, duration: 0.3 }}
                className="flex flex-col items-center gap-2"
              >
                <div
                  className="w-8 bg-gradient-to-t from-green-500 to-green-400 rounded-t"
                  style={{ height: `${60 + Math.random() * 40}%` }}
                />
                <span className="text-xs text-cream-500/60 rotate-45">{index + 1}</span>
              </motion.div>
            ))}
          </div>
        ) : (
          // Competitive - Show score trend
          <svg viewBox="0 0 100 100" className="w-full h-full" preserveAspectRatio="none">
            {/* Grid lines */}
            <defs>
              <linearGradient id="chartGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" style={{ stopColor: '#FFD44D', stopOpacity: 0.3 }} />
                <stop offset="100%" style={{ stopColor: '#FFD44D', stopOpacity: 0 }} />
              </linearGradient>
            </defs>

            {/* Horizontal grid lines */}
            {[0, 25, 50, 75, 100].map((y) => (
              <line
                key={y}
                x1="0"
                y1={y}
                x2="100"
                y2={y}
                stroke="rgba(229, 211, 150, 0.1)"
                strokeWidth="0.2"
              />
            ))}

            {/* Area under the line */}
            {areaPathD && (
              <motion.path
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.8 }}
                d={areaPathD}
                fill="url(#chartGradient)"
              />
            )}

            {/* Line */}
            {pathD && (
              <motion.path
                initial={{ pathLength: 0 }}
                animate={{ pathLength: 1 }}
                transition={{ duration: 1.5, ease: 'easeOut' }}
                d={pathD}
                fill="none"
                stroke="#FFD44D"
                strokeWidth="0.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            )}

            {/* Data points */}
            {chartPoints.map((point, index) => (
              <motion.g key={index}>
                <motion.circle
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ delay: 0.1 * index, duration: 0.3 }}
                  cx={point.x}
                  cy={point.y}
                  r="1.5"
                  fill="#FFD44D"
                  className="drop-shadow-lg"
                />
                {/* Hover effect would go here in a more advanced implementation */}
              </motion.g>
            ))}
          </svg>
        )}

        {/* Y-axis labels */}
        {!isSoundSport && (
          <div className="absolute left-0 top-0 bottom-0 flex flex-col justify-between text-xs text-cream-500/40 pointer-events-none">
            <span>{maxScore.toFixed(0)}</span>
            <span>{((maxScore + minScore) / 2).toFixed(0)}</span>
            <span>{minScore.toFixed(0)}</span>
          </div>
        )}
      </div>

      {/* Recent Performances */}
      {scores.length > 0 && (
        <div className="mt-6">
          <h4 className="text-sm font-semibold text-cream-100 mb-3">Recent Performances</h4>
          <div className="space-y-2 max-h-32 overflow-y-auto">
            {scores.slice(-5).reverse().map((score, index) => (
              <div
                key={index}
                className="flex items-center justify-between p-2 bg-charcoal-900/30 rounded text-sm hover:bg-charcoal-900/50 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <span className="text-cream-500/60">{score.showName || `Show ${index + 1}`}</span>
                  {score.rank && score.rank <= 3 && !isSoundSport && (
                    <Award className={`w-4 h-4 ${
                      score.rank === 1 ? 'text-yellow-500' :
                      score.rank === 2 ? 'text-gray-400' :
                      'text-orange-600'
                    }`} />
                  )}
                </div>
                <div className="flex items-center gap-3">
                  {score.date && (
                    <span className="text-xs text-cream-500/40">{score.date}</span>
                  )}
                  {isSoundSport ? (
                    <span className="text-green-400 font-semibold">✓ Complete</span>
                  ) : (
                    <span className="font-semibold text-gold-500">{score.totalScore}</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default PerformanceChart;
