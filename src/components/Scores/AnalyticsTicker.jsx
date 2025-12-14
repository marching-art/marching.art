// src/components/Scores/AnalyticsTicker.jsx
// Slim stock-ticker style stats bar for the Competitive Analytics Terminal

import React from 'react';
import { TrendingUp, Calendar, Users, Award, Activity, Zap } from 'lucide-react';
import { useShouldReduceMotion } from '../../hooks/useReducedMotion';

// Single ticker item component
const TickerItem = ({ icon: Icon, label, value, highlight = false, pulse = false, reducedMotion = false }) => (
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
      ${pulse && !reducedMotion ? 'animate-pulse' : ''}
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
  const shouldReduceMotion = useShouldReduceMotion();

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
            reducedMotion={shouldReduceMotion}
          />
          <TickerItem
            icon={TrendingUp}
            label="Top Score"
            value={stats.topScore || '-'}
            highlight
            reducedMotion={shouldReduceMotion}
          />
          <TickerItem
            icon={Users}
            label="Active"
            value={stats.corpsActive || 0}
            reducedMotion={shouldReduceMotion}
          />
          <TickerItem
            icon={Activity}
            label="Avg Score"
            value={stats.avgScore || '-'}
            reducedMotion={shouldReduceMotion}
          />
        </div>

        {/* Right: Season indicator - static on mobile to prevent infinite animations */}
        <div className="flex items-center px-4">
          <div className="flex items-center gap-2">
            {isArchived ? (
              <div
                className={`flex items-center gap-2 px-3 py-1.5 bg-amber-500/10 border border-amber-500/30 rounded ${shouldReduceMotion ? '' : 'animate-pulse'}`}
              >
                <Award className="w-4 h-4 text-amber-400" />
                <span className="font-mono text-xs text-amber-400 uppercase tracking-wide">
                  Archive: {seasonName}
                </span>
              </div>
            ) : (
              <div
                className={`flex items-center gap-2 px-3 py-1.5 bg-green-500/10 border border-green-500/30 rounded ${shouldReduceMotion ? '' : 'animate-pulse'}`}
              >
                <Zap className="w-4 h-4 text-green-400" />
                <span className="font-mono text-xs text-green-400 uppercase tracking-wide">
                  Live: {seasonName}
                </span>
              </div>
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
