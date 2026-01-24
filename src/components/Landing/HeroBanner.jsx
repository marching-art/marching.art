/**
 * HeroBanner Component - First-Time Visitor Welcome
 *
 * Collapsible hero section that explains the value proposition to new visitors.
 * Hidden for authenticated users and returning visitors (via useFirstVisit hook).
 * Matches the ESPN-style dark theme without marketing fluff.
 */

import React from 'react';
import { Link } from 'react-router-dom';
import { m, AnimatePresence } from 'framer-motion';
import { Trophy, Users, Zap, ChevronRight, X, Play, Clock } from 'lucide-react';
import JargonTooltip from '../JargonTooltip';
import { useUrgencyTriggers } from '../../hooks/useUrgencyTriggers';

// =============================================================================
// HERO BANNER COMPONENT
// =============================================================================

const HeroBanner = ({ onDismiss }) => {
  const { primary, isLiveShowDay, weeksRemaining, seasonType } = useUrgencyTriggers();

  return (
    <AnimatePresence>
      <m.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -20, height: 0, marginBottom: 0 }}
        transition={{ duration: 0.3, ease: 'easeOut' }}
        className="relative bg-gradient-to-br from-[#1a1a1a] via-[#1a1a1a] to-[#0a0a0a] border border-[#333] rounded-sm overflow-hidden"
      >
        {/* Subtle accent line */}
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-[#0057B8] via-yellow-500 to-[#0057B8]" />

        {/* Dismiss button */}
        <button
          onClick={onDismiss}
          className="absolute top-3 right-3 p-2 text-gray-500 hover:text-white hover:bg-white/10 rounded-sm transition-colors z-10"
          aria-label="Dismiss welcome message"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="px-4 py-6 lg:px-8 lg:py-8">
          {/* Main content */}
          <div className="max-w-2xl">
            {/* Badge Row */}
            <div className="flex flex-wrap items-center gap-3 mb-4">
              <div className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-[#0057B8]/20 border border-[#0057B8]/30 rounded-sm">
                <Trophy className="w-3.5 h-3.5 text-[#0057B8]" />
                <span className="text-xs font-bold text-[#0057B8] uppercase tracking-wider">
                  Fantasy Drum Corps
                </span>
              </div>

              {/* Urgency Badge - Show live/countdown info */}
              {primary && (
                <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-sm border ${
                  primary.level === 'high'
                    ? 'bg-red-500/20 border-red-500/30'
                    : primary.level === 'medium'
                    ? 'bg-yellow-500/20 border-yellow-500/30'
                    : 'bg-gray-500/20 border-gray-500/30'
                }`}>
                  {primary.type === 'live' && (
                    <span className="relative flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
                    </span>
                  )}
                  {primary.type !== 'live' && <Clock className="w-3.5 h-3.5 text-yellow-500" />}
                  <span className={`text-xs font-bold uppercase tracking-wider ${
                    primary.level === 'high' ? 'text-red-500' : 'text-yellow-500'
                  }`}>
                    {primary.message}
                  </span>
                </div>
              )}
            </div>

            {/* Headline */}
            <h1 className="text-2xl lg:text-3xl font-bold text-white leading-tight mb-3">
              Draft legendary performers.
              <span className="text-gray-400"> Compete with fans worldwide.</span>
            </h1>

            {/* Subhead */}
            <p className="text-base lg:text-lg text-gray-400 mb-6 max-w-xl">
              Build your dream <JargonTooltip termKey="corps">corps</JargonTooltip> from 50 years of <JargonTooltip termKey="dci">DCI</JargonTooltip> history. Earn points from real show scores. Climb the leaderboard.
            </p>

            {/* Feature pills */}
            <div className="flex flex-wrap gap-3 mb-6">
              <div className="flex items-center gap-2 px-3 py-1.5 bg-[#111] border border-[#333] rounded-sm">
                <Zap className="w-4 h-4 text-yellow-500" />
                <span className="text-sm text-gray-300">Free to play</span>
              </div>
              <div className="flex items-center gap-2 px-3 py-1.5 bg-[#111] border border-[#333] rounded-sm">
                <Users className="w-4 h-4 text-[#0057B8]" />
                <span className="text-sm text-gray-300">Join leagues</span>
              </div>
              <div className="flex items-center gap-2 px-3 py-1.5 bg-[#111] border border-[#333] rounded-sm">
                <Trophy className="w-4 h-4 text-orange-500" />
                <span className="text-sm text-gray-300">Win bragging rights</span>
              </div>
            </div>

            {/* CTAs */}
            <div className="flex flex-wrap items-center gap-3">
              <Link
                to="/register"
                className="inline-flex items-center gap-2 min-h-[48px] px-6 bg-[#0057B8] text-white font-bold text-sm uppercase tracking-wider rounded-sm hover:bg-[#0066d6] active:bg-[#004a9e] active:scale-[0.98] transition-all duration-150 press-feedback-strong"
              >
                Create Your Corps
                <ChevronRight className="w-4 h-4" />
              </Link>
              <Link
                to="/preview"
                className="inline-flex items-center gap-2 min-h-[48px] px-5 border border-yellow-500/50 text-yellow-500 font-bold text-sm uppercase tracking-wider rounded-sm hover:bg-yellow-500/10 hover:border-yellow-500 active:scale-[0.98] transition-all duration-150 press-feedback"
              >
                <Play className="w-4 h-4" />
                Try Demo
              </Link>
              <button
                onClick={onDismiss}
                className="inline-flex items-center gap-1 min-h-[48px] px-4 text-gray-400 font-medium text-sm hover:text-white transition-colors press-feedback"
              >
                I know how to play
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </m.div>
    </AnimatePresence>
  );
};

export default HeroBanner;
