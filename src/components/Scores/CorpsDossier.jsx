// src/components/Scores/CorpsDossier.jsx
// Slide-over panel showing detailed corps analytics, score history, and head-to-head comparison

import React, { useMemo, memo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X,
  TrendingUp,
  TrendingDown,
  BarChart3,
  Calendar,
  Target,
  Award,
  Swords,
  MapPin,
  Trophy
} from 'lucide-react';
import { Line, Bar } from '../charts';
import { calculateCaptionAggregates } from '../../hooks/useScoresData';

// Chart configuration
const chartOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: { display: false },
    tooltip: {
      backgroundColor: 'rgba(10, 10, 10, 0.95)',
      titleColor: '#F5F5DC',
      bodyColor: '#F5F5DC',
      borderColor: 'rgb(250, 204, 21)',
      borderWidth: 1,
      padding: 12,
      cornerRadius: 4,
      titleFont: { family: 'JetBrains Mono', size: 11 },
      bodyFont: { family: 'JetBrains Mono', size: 10 }
    }
  },
  scales: {
    y: {
      beginAtZero: false,
      grid: { color: 'rgba(245, 245, 220, 0.05)' },
      ticks: { color: 'rgba(245, 245, 220, 0.4)', font: { family: 'JetBrains Mono', size: 9 } }
    },
    x: {
      grid: { display: false },
      ticks: { color: 'rgba(245, 245, 220, 0.4)', maxRotation: 45, font: { family: 'JetBrains Mono', size: 8 } }
    }
  }
};

const barChartOptions = {
  ...chartOptions,
  indexAxis: 'y',
  plugins: {
    ...chartOptions.plugins,
    legend: { display: true, position: 'top', labels: { color: '#F5F5DC', font: { family: 'JetBrains Mono', size: 10 } } }
  },
  scales: {
    x: {
      beginAtZero: true,
      grid: { color: 'rgba(245, 245, 220, 0.05)' },
      ticks: { color: 'rgba(245, 245, 220, 0.4)', font: { family: 'JetBrains Mono', size: 9 } }
    },
    y: {
      grid: { display: false },
      ticks: { color: 'rgba(245, 245, 220, 0.6)', font: { family: 'JetBrains Mono', size: 10 } }
    }
  }
};

// Stat card component
const StatCard = ({ label, value, icon: Icon, highlight = false }) => (
  <div className={`p-3 rounded-sm border ${highlight ? 'bg-gold-500/10 border-gold-500/30' : 'bg-charcoal-900/50 border-cream-500/10'}`}>
    <div className="flex items-center gap-2 mb-1">
      {Icon && <Icon className={`w-3.5 h-3.5 ${highlight ? 'text-gold-400' : 'text-cream-500/60'}`} />}
      <span className="text-[10px] text-cream-500/60 uppercase tracking-wide">{label}</span>
    </div>
    <p className={`font-mono text-lg font-bold ${highlight ? 'text-gold-400' : 'text-cream-100'}`}>
      {value}
    </p>
  </div>
);

const CorpsDossier = ({
  isOpen,
  onClose,
  corps,
  myCorps = null,
  isArchived = false
}) => {
  // Calculate corps statistics
  const corpsStats = useMemo(() => {
    if (!corps) return null;

    const scores = corps.scores || [];
    const totalShows = scores.length;

    if (totalShows === 0) {
      return {
        totalShows: 0,
        bestScore: 0,
        avgScore: 0,
        trend: 'stable',
        scores: []
      };
    }

    const scoreValues = scores.map(s => s.score || s.totalScore || 0);
    const bestScore = Math.max(...scoreValues);
    const avgScore = scoreValues.reduce((sum, s) => sum + s, 0) / totalShows;

    // Calculate trend
    const firstHalf = scoreValues.slice(0, Math.ceil(totalShows / 2));
    const secondHalf = scoreValues.slice(Math.ceil(totalShows / 2));
    const firstAvg = firstHalf.reduce((sum, s) => sum + s, 0) / firstHalf.length || 0;
    const secondAvg = secondHalf.reduce((sum, s) => sum + s, 0) / secondHalf.length || 0;
    const trend = secondAvg > firstAvg ? 'up' : secondAvg < firstAvg ? 'down' : 'stable';

    return {
      totalShows,
      bestScore,
      avgScore,
      trend,
      scores
    };
  }, [corps]);

  // Prepare score history chart data
  const historyChartData = useMemo(() => {
    if (!corpsStats?.scores?.length) return null;

    const scores = [...corpsStats.scores].reverse(); // Chronological order

    return {
      labels: scores.map((s, i) => s.eventName?.substring(0, 15) || `Show ${i + 1}`),
      datasets: [{
        label: 'Score',
        data: scores.map(s => s.score || s.totalScore || 0),
        borderColor: 'rgb(250, 204, 21)',
        backgroundColor: 'rgba(250, 204, 21, 0.1)',
        fill: true,
        tension: 0.4,
        pointBackgroundColor: 'rgb(250, 204, 21)',
        pointBorderColor: '#0A0A0A',
        pointBorderWidth: 2,
        pointRadius: 4,
        pointHoverRadius: 6
      }]
    };
  }, [corpsStats]);

  // Prepare head-to-head comparison data
  const h2hChartData = useMemo(() => {
    if (!corps || !myCorps || isArchived) return null;

    const corpsAggregates = calculateCaptionAggregates(corps);
    const myAggregates = calculateCaptionAggregates(myCorps);

    return {
      labels: ['GE', 'Visual', 'Music'],
      datasets: [
        {
          label: corps.corps || corps.corpsName,
          data: [corpsAggregates.GE_Total, corpsAggregates.VIS_Total, corpsAggregates.MUS_Total],
          backgroundColor: 'rgba(250, 204, 21, 0.7)',
          borderColor: 'rgb(250, 204, 21)',
          borderWidth: 1
        },
        {
          label: 'My Corps',
          data: [myAggregates.GE_Total, myAggregates.VIS_Total, myAggregates.MUS_Total],
          backgroundColor: 'rgba(168, 85, 247, 0.7)',
          borderColor: 'rgb(168, 85, 247)',
          borderWidth: 1
        }
      ]
    };
  }, [corps, myCorps, isArchived]);

  return (
    <AnimatePresence>
      {isOpen && corps && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40"
          />

          {/* Panel */}
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 300 }}
            className={`
              fixed top-0 right-0 h-full w-full sm:w-[420px] md:w-[480px]
              bg-charcoal-950 border-l-2 border-gold-500/30
              flex flex-col z-50 overflow-hidden
              ${isArchived ? 'sepia-[.3] grayscale-[.2]' : ''}
            `}
          >
            {/* Header */}
            <div className="flex-shrink-0 p-4 border-b border-cream-500/10 bg-charcoal-950">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-sm bg-gold-500/20 border border-gold-500/30 flex items-center justify-center">
                    <span className="font-display font-black text-xl text-gold-400">
                      {(corps.corps || corps.corpsName || '?').charAt(0)}
                    </span>
                  </div>
                  <div>
                    <h2 className="font-display font-bold text-lg text-cream-100 uppercase tracking-wide">
                      {corps.corps || corps.corpsName}
                    </h2>
                    <div className="flex items-center gap-2 text-xs text-cream-500/60">
                      {corps.corpsClass && (
                        <span className="px-2 py-0.5 rounded bg-charcoal-800 text-cream-400">
                          {corps.corpsClass.replace('Class', '')}
                        </span>
                      )}
                      {corps.rank && (
                        <span className="flex items-center gap-1">
                          <Trophy className="w-3 h-3 text-gold-400" />
                          Rank #{corps.rank}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <button
                  onClick={onClose}
                  className="p-2 rounded-sm hover:bg-charcoal-800 transition-colors text-cream-500/60 hover:text-cream-100"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Archive Badge */}
              {isArchived && (
                <div className="mt-3 flex items-center gap-2 px-3 py-2 bg-amber-500/10 border border-amber-500/30 rounded-sm">
                  <Calendar className="w-4 h-4 text-amber-400" />
                  <span className="text-xs text-amber-400 font-mono uppercase tracking-wide">
                    Historical Archive - View Only
                  </span>
                </div>
              )}
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto hud-scroll">
              <div className="p-4 space-y-6">
                {/* Stats Grid */}
                <div className="grid grid-cols-2 gap-3">
                  <StatCard
                    label="Best Score"
                    value={corpsStats?.bestScore?.toFixed(3) || '-'}
                    icon={Trophy}
                    highlight
                  />
                  <StatCard
                    label="Avg Score"
                    value={corpsStats?.avgScore?.toFixed(3) || '-'}
                    icon={Target}
                  />
                  <StatCard
                    label="Shows"
                    value={corpsStats?.totalShows || 0}
                    icon={MapPin}
                  />
                  <StatCard
                    label="Trend"
                    value={corpsStats?.trend === 'up' ? 'Improving' : corpsStats?.trend === 'down' ? 'Declining' : 'Stable'}
                    icon={corpsStats?.trend === 'up' ? TrendingUp : corpsStats?.trend === 'down' ? TrendingDown : BarChart3}
                  />
                </div>

                {/* Current Aggregates */}
                <div>
                  <h3 className="flex items-center gap-2 text-xs font-display font-bold text-cream-400 uppercase tracking-wide mb-3">
                    <BarChart3 className="w-4 h-4 text-gold-400" />
                    Caption Breakdown
                  </h3>
                  <div className="bg-charcoal-900/50 border border-cream-500/10 rounded-sm p-4">
                    {(() => {
                      const aggregates = calculateCaptionAggregates(corps);
                      return (
                        <div className="space-y-3">
                          <div className="flex items-center justify-between">
                            <span className="text-sm text-cream-500/60">General Effect</span>
                            <span className="font-mono font-bold text-gold-400">{aggregates.GE_Total.toFixed(3)}</span>
                          </div>
                          <div className="h-2 bg-charcoal-800 rounded-sm overflow-hidden">
                            <div
                              className="h-full bg-gradient-to-r from-gold-600 to-gold-400"
                              style={{ width: `${(aggregates.GE_Total / 40) * 100}%` }}
                            />
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-sm text-cream-500/60">Visual</span>
                            <span className="font-mono font-bold text-gold-400">{aggregates.VIS_Total.toFixed(3)}</span>
                          </div>
                          <div className="h-2 bg-charcoal-800 rounded-sm overflow-hidden">
                            <div
                              className="h-full bg-gradient-to-r from-purple-600 to-purple-400"
                              style={{ width: `${(aggregates.VIS_Total / 30) * 100}%` }}
                            />
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-sm text-cream-500/60">Music</span>
                            <span className="font-mono font-bold text-gold-400">{aggregates.MUS_Total.toFixed(3)}</span>
                          </div>
                          <div className="h-2 bg-charcoal-800 rounded-sm overflow-hidden">
                            <div
                              className="h-full bg-gradient-to-r from-blue-600 to-blue-400"
                              style={{ width: `${(aggregates.MUS_Total / 30) * 100}%` }}
                            />
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                </div>

                {/* Score History Chart */}
                {historyChartData && (
                  <div>
                    <h3 className="flex items-center gap-2 text-xs font-display font-bold text-cream-400 uppercase tracking-wide mb-3">
                      <TrendingUp className="w-4 h-4 text-gold-400" />
                      Score History
                    </h3>
                    <div className="bg-charcoal-900/50 border border-cream-500/10 rounded-sm p-4 h-[200px]">
                      <Line data={historyChartData} options={chartOptions} />
                    </div>
                  </div>
                )}

                {/* Head-to-Head Comparison */}
                {h2hChartData && !isArchived && (
                  <div>
                    <h3 className="flex items-center gap-2 text-xs font-display font-bold text-cream-400 uppercase tracking-wide mb-3">
                      <Swords className="w-4 h-4 text-purple-400" />
                      Head-to-Head
                    </h3>
                    <div className="bg-charcoal-900/50 border border-cream-500/10 rounded-sm p-4 h-[180px]">
                      <Bar data={h2hChartData} options={barChartOptions} />
                    </div>
                  </div>
                )}

                {/* H2H Disabled Message for Archives */}
                {isArchived && myCorps && (
                  <div className="bg-amber-500/10 border border-amber-500/20 rounded-sm p-4 text-center">
                    <Swords className="w-8 h-8 text-amber-400/50 mx-auto mb-2" />
                    <p className="text-xs text-amber-400/80 font-mono uppercase tracking-wide">
                      Head-to-Head comparison disabled for historical data
                    </p>
                  </div>
                )}

                {/* Recent Shows List */}
                {corpsStats?.scores && corpsStats.scores.length > 0 && (
                  <div>
                    <h3 className="flex items-center gap-2 text-xs font-display font-bold text-cream-400 uppercase tracking-wide mb-3">
                      <Award className="w-4 h-4 text-gold-400" />
                      Recent Performances
                    </h3>
                    <div className="space-y-2">
                      {corpsStats.scores.slice(0, 5).map((score, index) => (
                        <div
                          key={index}
                          className="flex items-center justify-between p-3 bg-charcoal-900/30 border border-cream-500/5 rounded-sm"
                        >
                          <div className="min-w-0 flex-1">
                            <p className="text-sm text-cream-100 truncate">
                              {score.eventName || `Show ${index + 1}`}
                            </p>
                            <p className="text-[10px] text-cream-500/40">
                              Day {score.offSeasonDay || '-'} • {score.date || 'TBD'}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="font-mono font-bold text-gold-400">
                              {(score.score || score.totalScore || 0).toFixed(3)}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Footer */}
            <div className="flex-shrink-0 p-4 border-t border-cream-500/10 bg-charcoal-950">
              <button
                onClick={onClose}
                className="w-full py-2.5 bg-charcoal-800 hover:bg-charcoal-700 border border-cream-500/10 rounded-sm text-cream-300 font-display font-bold uppercase tracking-wide text-sm transition-colors"
              >
                Close Dossier
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

// OPTIMIZATION #6: Wrap with React.memo to prevent unnecessary re-renders
export default memo(CorpsDossier);
