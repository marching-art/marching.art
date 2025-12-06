// src/components/Scores/AnalyticsTicker.jsx
// Slim stock-ticker style stats bar for the Competitive Analytics Terminal

import React from 'react';
import { motion } from 'framer-motion';
import { TrendingUp, Calendar, Users, Award, Activity, Zap } from 'lucide-react';

// Single ticker item component
const TickerItem = ({ icon: Icon, label, value, highlight = false, pulse = false }) => (
  <div className={`
    flex items-center gap-2 px-4 py-2 border-r border-cream-500/10
    ${highlight ? 'bg-gold-500/10' : 'bg-transparent'}
  `}>
    <Icon className={`w-4 h-4 ${highlight ? 'text-gold-400' : 'text-cream-500/60'}`} />
    <span className="text-[10px] text-cream-500/60 uppercase tracking-wide whitespace-nowrap">
      {label}
    </span>
    <span className={`
      font-mono text-sm font-bold whitespace-nowrap
      ${highlight ? 'text-gold-400' : 'text-cream-100'}
      ${pulse ? 'animate-pulse' : ''}
    `}>
      {value}
    </span>
  </div>
);

// Separator component
const TickerSeparator = () => (
  <div className="flex items-center px-2">
    <span className="text-gold-500/30">|</span>
  </div>
);

const AnalyticsTicker = ({
  stats = {},
  isArchived = false,
  seasonName = 'Current Season'
}) => {
  return (
    <div className={`
      flex-shrink-0 w-full border-b-2 border-gold-500/30 bg-charcoal-950
      ${isArchived ? 'sepia-[.3] grayscale-[.2]' : ''}
    `}>
      {/* Desktop: Full ticker display */}
      <div className="hidden lg:flex items-center justify-between overflow-hidden">
        {/* Left: Stats */}
        <div className="flex items-center">
          <TickerItem
            icon={Calendar}
            label="Shows"
            value={stats.recentShows || 0}
          />
          <TickerItem
            icon={TrendingUp}
            label="Top Score"
            value={stats.topScore || '-'}
            highlight
          />
          <TickerItem
            icon={Users}
            label="Active"
            value={stats.corpsActive || 0}
          />
          <TickerItem
            icon={Activity}
            label="Avg Score"
            value={stats.avgScore || '-'}
          />
        </div>

        {/* Right: Season indicator */}
        <div className="flex items-center px-4">
          <div className="flex items-center gap-2">
            {isArchived ? (
              <motion.div
                animate={{ opacity: [0.5, 1, 0.5] }}
                transition={{ duration: 2, repeat: Infinity }}
                className="flex items-center gap-2 px-3 py-1.5 bg-amber-500/10 border border-amber-500/30 rounded"
              >
                <Award className="w-4 h-4 text-amber-400" />
                <span className="font-mono text-xs text-amber-400 uppercase tracking-wide">
                  Archive: {seasonName}
                </span>
              </motion.div>
            ) : (
              <motion.div
                animate={{ opacity: [0.7, 1, 0.7] }}
                transition={{ duration: 1.5, repeat: Infinity }}
                className="flex items-center gap-2 px-3 py-1.5 bg-green-500/10 border border-green-500/30 rounded"
              >
                <Zap className="w-4 h-4 text-green-400" />
                <span className="font-mono text-xs text-green-400 uppercase tracking-wide">
                  Live: {seasonName}
                </span>
              </motion.div>
            )}
          </div>
        </div>
      </div>

      {/* Mobile: Condensed ticker */}
      <div className="lg:hidden flex items-center justify-between px-3 py-2">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5">
            <TrendingUp className="w-4 h-4 text-gold-400" />
            <span className="font-mono text-sm font-bold text-gold-400">
              {stats.topScore || '-'}
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <Users className="w-4 h-4 text-cream-500/60" />
            <span className="font-mono text-sm text-cream-300">
              {stats.corpsActive || 0}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          {isArchived ? (
            <Award className="w-4 h-4 text-amber-400" />
          ) : (
            <Zap className="w-4 h-4 text-green-400" />
          )}
          <span className={`font-mono text-[10px] uppercase tracking-wide ${isArchived ? 'text-amber-400' : 'text-green-400'}`}>
            {isArchived ? 'Archive' : 'Live'}
          </span>
        </div>
      </div>
    </div>
  );
};

export default AnalyticsTicker;
