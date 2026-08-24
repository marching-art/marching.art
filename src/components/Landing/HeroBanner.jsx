/**
 * HeroBanner Component - First-Time Visitor Welcome
 *
 * Collapsible hero section that explains the value proposition to new visitors.
 * Hidden for authenticated users and returning visitors (via useFirstVisit hook).
 * Matches the data-terminal dark theme without marketing fluff.
 */

import React from 'react';
import { Link } from 'react-router-dom';
import { m, AnimatePresence } from 'framer-motion';
import { Trophy, Users, Zap, ChevronRight, X, Play, Clock, Medal, Target } from 'lucide-react';
import JargonTooltip from '../JargonTooltip';
import { Heading } from '../ui';
import { useUrgencyTriggers } from '../../hooks/useUrgencyTriggers';

// =============================================================================
// HERO BANNER COMPONENT
// =============================================================================

/**
 * @param {{ onDismiss?: () => void }} props
 */
const HeroBanner = ({ onDismiss }) => {
  const { primary } = useUrgencyTriggers();

  return (
    <AnimatePresence>
      <m.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -20, height: 0, marginBottom: 0 }}
        transition={{ duration: 0.3, ease: 'easeOut' }}
        className="relative bg-surface-card border border-line rounded-none overflow-hidden"
      >
        {/* Subtle accent line */}
        <div className="absolute top-0 left-0 right-0 h-1 bg-interactive" />

        {/* Dismiss button */}
        <button
          onClick={onDismiss}
          className="absolute top-3 right-3 p-2 text-muted hover:text-white hover:bg-white/10 rounded-none transition-colors z-10"
          aria-label="Dismiss welcome message"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="px-4 py-6 lg:px-8 lg:py-8">
          {/* Main content */}
          <div className="max-w-2xl">
            {/* Badge Row */}
            <div className="flex flex-wrap items-center gap-3 mb-4">
              <div className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-interactive/20 border border-interactive/30 rounded-none">
                <Trophy className="w-3.5 h-3.5 text-interactive" />
                <span className="text-xs font-bold text-interactive uppercase tracking-wider">
                  Fantasy Drum Corps
                </span>
              </div>

              {/* Urgency Badge - Show live/countdown info */}
              {primary && (
                <div
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-none border ${
                    primary.level === 'high'
                      ? 'bg-red-500/20 border-red-500/30'
                      : primary.level === 'medium'
                        ? 'bg-warning/20 border-warning/30'
                        : 'bg-charcoal-500/20 border-charcoal-500/30'
                  }`}
                >
                  {primary.type === 'live' && (
                    <span className="relative flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
                    </span>
                  )}
                  {primary.type !== 'live' && <Clock className="w-3.5 h-3.5 text-warning" />}
                  <span
                    className={`text-xs font-bold uppercase tracking-wider ${
                      primary.level === 'high' ? 'text-red-500' : 'text-warning'
                    }`}
                  >
                    {primary.message}
                  </span>
                </div>
              )}
            </div>

            {/* Headline */}
            <Heading level="display" className="leading-tight mb-3">
              Two drum corps games, one account.
              <span className="text-muted"> Run your own corps, or draft a fantasy lineup.</span>
            </Heading>

            {/* Subhead — the draft pool is the season's dci-data corpsValues:
                the touring corps during a live season, and a pool drawn from
                the historical final_rankings corpus (2000–present) off-season.
                Keep this copy matched to that; it must not promise a span the
                data doesn't cover. */}
            <p className="text-base lg:text-lg text-muted mb-6 max-w-xl">
              Build your dream <JargonTooltip termKey="corps">corps</JargonTooltip> from real{' '}
              <JargonTooltip termKey="dci">DCI</JargonTooltip> seasons — the corps on tour each
              summer, 25+ years of history the rest of the year. Earn points from real show scores.
              Climb the leaderboard.
            </p>

            {/* Two ways to play — the site is genuinely two games, so name both
                up front and let a new visitor start with either. */}
            <div className="grid sm:grid-cols-2 gap-3 mb-6">
              <Link
                to="/podium-guide"
                className="group flex items-start gap-3 p-3 bg-surface-sunken border border-line rounded-none hover:border-line-strong transition-colors press-feedback"
              >
                <div
                  className="flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-none"
                  style={{ backgroundColor: 'rgba(201,162,39,0.13)' }}
                >
                  <Medal className="w-4 h-4" style={{ color: '#c9a227' }} />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-1 text-sm font-bold text-white">
                    Podium Division
                    <ChevronRight className="w-3.5 h-3.5 text-muted group-hover:translate-x-0.5 transition-transform" />
                  </div>
                  <p className="text-xs text-muted mt-0.5">
                    Found and run your own corps — a full season simulation.
                  </p>
                </div>
              </Link>
              <Link
                to="/how-to-play"
                className="group flex items-start gap-3 p-3 bg-surface-sunken border border-line rounded-none hover:border-line-strong transition-colors press-feedback"
              >
                <div className="flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-none bg-interactive/15">
                  <Target className="w-4 h-4 text-interactive" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-1 text-sm font-bold text-white">
                    Fantasy Division
                    <ChevronRight className="w-3.5 h-3.5 text-muted group-hover:translate-x-0.5 transition-transform" />
                  </div>
                  <p className="text-xs text-muted mt-0.5">
                    Draft a fantasy lineup from real DCI history.
                  </p>
                </div>
              </Link>
            </div>

            {/* Feature pills */}
            <div className="flex flex-wrap gap-3 mb-6">
              <div className="flex items-center gap-2 px-3 py-1.5 bg-surface-sunken border border-line rounded-none">
                <Zap className="w-4 h-4 text-interactive" />
                <span className="text-sm text-secondary">Free to play</span>
              </div>
              <div className="flex items-center gap-2 px-3 py-1.5 bg-surface-sunken border border-line rounded-none">
                <Users className="w-4 h-4 text-interactive" />
                <span className="text-sm text-secondary">Join leagues</span>
              </div>
              <div className="flex items-center gap-2 px-3 py-1.5 bg-surface-sunken border border-line rounded-none">
                <Trophy className="w-4 h-4 text-interactive" />
                <span className="text-sm text-secondary">Win bragging rights</span>
              </div>
            </div>

            {/* CTAs */}
            <div className="flex flex-wrap items-center gap-3">
              <Link
                to="/register"
                className="inline-flex items-center gap-2 min-h-[48px] px-6 bg-interactive text-white font-bold text-sm uppercase tracking-wider rounded-none hover:bg-interactive-hover active:bg-interactive-subtle active:scale-[0.98] transition-all duration-150 press-feedback-strong"
              >
                Create Your Corps
                <ChevronRight className="w-4 h-4" />
              </Link>
              <Link
                to="/preview"
                className="inline-flex items-center gap-2 min-h-[48px] px-5 border border-interactive/50 text-interactive font-bold text-sm uppercase tracking-wider rounded-none hover:bg-interactive/10 hover:border-interactive active:scale-[0.98] transition-all duration-150 press-feedback"
              >
                <Play className="w-4 h-4" />
                Try Demo
              </Link>
              <Link
                to="/how-to-play"
                className="inline-flex items-center gap-1 min-h-[48px] px-4 text-muted font-medium text-sm hover:text-white transition-colors press-feedback"
              >
                How to play
                <ChevronRight className="w-4 h-4" />
              </Link>
              <button
                onClick={onDismiss}
                className="inline-flex items-center gap-1 min-h-[48px] px-4 text-muted font-medium text-sm hover:text-white transition-colors press-feedback"
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
