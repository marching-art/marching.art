// src/components/EmptyStates.tsx
// Pre-configured empty state components for common scenarios
import React from 'react';
import { Link } from 'react-router-dom';
import { m } from 'framer-motion';
import {
  Trophy, Users, Calendar, Music, Star, Target,
  Flag, Sparkles, Clock, TrendingUp, Award, Play
} from 'lucide-react';
import { useShouldReduceMotion } from '../hooks/useReducedMotion';

// OPTIMIZATION #10: Extract inline styles to constants to prevent object recreation on every render
const ANIMATION_SLOW: React.CSSProperties = { animationDuration: '2s' };

interface EmptyStateBaseProps {
  className?: string;
  onAction?: () => void;
}

// =============================================================================
// NO LEAGUES JOINED
// =============================================================================
export const NoLeaguesEmpty: React.FC<EmptyStateBaseProps & { onCreateLeague?: () => void }> = ({
  className = '',
  onCreateLeague
}) => (
  <m.div
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    className={`text-center py-12 px-6 ${className}`}
  >
    <div className="relative w-20 h-20 mx-auto mb-6">
      <div className="absolute inset-0 rounded-sm bg-gold-500/20 animate-ping" style={ANIMATION_SLOW} />
      <div className="relative w-20 h-20 rounded-sm bg-gradient-to-br from-gold-500/20 to-blue-500/20 flex items-center justify-center border-2 border-gold-500/30">
        <Users className="w-10 h-10 text-gold-400" />
      </div>
    </div>
    <h3 className="text-xl font-display font-bold text-cream mb-2">Join the Competition</h3>
    <p className="text-sm text-cream/60 mb-6 max-w-sm mx-auto">
      Leagues let you compete against other directors. Track rankings and prove you're the best!
    </p>
    <div className="flex flex-col sm:flex-row gap-3 justify-center">
      {onCreateLeague && (
        <button
          onClick={onCreateLeague}
          className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-gold-500 text-charcoal-900 rounded-sm font-display font-bold uppercase text-sm hover:bg-gold-400 transition-colors shadow-[0_0_15px_rgba(234,179,8,0.3)]"
        >
          <Trophy className="w-4 h-4" />
          Create a League
        </button>
      )}
      <Link
        to="/leagues"
        className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-blue-500/10 border border-blue-500/20 rounded-sm text-blue-400 font-display font-semibold text-sm hover:bg-blue-500/20 transition-colors"
      >
        <Users className="w-4 h-4" />
        Browse Public Leagues
      </Link>
    </div>
  </m.div>
);

// =============================================================================
// NO SHOWS REGISTERED
// =============================================================================
export const NoShowsRegisteredEmpty: React.FC<EmptyStateBaseProps & { weekNumber?: number }> = ({
  className = '',
  weekNumber,
  onAction
}) => (
  <m.div
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    className={`text-center py-12 px-6 ${className}`}
  >
    <div className="relative w-20 h-20 mx-auto mb-6">
      <div className="w-20 h-20 rounded-sm bg-gradient-to-br from-purple-500/20 to-blue-500/20 flex items-center justify-center border-2 border-dashed border-purple-500/30">
        <Calendar className="w-10 h-10 text-purple-400" />
      </div>
    </div>
    <h3 className="text-xl font-display font-bold text-cream mb-2">
      {weekNumber ? `No Shows Registered for Week ${weekNumber}` : 'No Shows Registered'}
    </h3>
    <p className="text-sm text-cream/60 mb-6 max-w-sm mx-auto">
      Register your corps for upcoming shows to compete and earn points. More shows = more chances to score!
    </p>
    {onAction ? (
      <button
        onClick={onAction}
        className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-purple-500 text-white rounded-sm font-display font-bold uppercase text-sm hover:bg-purple-400 transition-colors"
      >
        <Calendar className="w-4 h-4" />
        View Schedule
      </button>
    ) : (
      <Link
        to="/schedule"
        className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-purple-500 text-white rounded-sm font-display font-bold uppercase text-sm hover:bg-purple-400 transition-colors"
      >
        <Calendar className="w-4 h-4" />
        View Schedule
      </Link>
    )}
  </m.div>
);

// =============================================================================
// NO SCORES YET
// =============================================================================
export const NoScoresYetEmpty: React.FC<EmptyStateBaseProps> = ({
  className = ''
}) => (
  <m.div
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    className={`text-center py-12 px-6 ${className}`}
  >
    <div className="relative w-20 h-20 mx-auto mb-6">
      <div className="w-20 h-20 rounded-sm bg-gradient-to-br from-gold-500/20 to-amber-500/20 flex items-center justify-center border-2 border-gold-500/30">
        <Trophy className="w-10 h-10 text-gold-400" />
      </div>
    </div>
    <h3 className="text-xl font-display font-bold text-cream mb-2">No Scores Yet</h3>
    <p className="text-sm text-cream/60 mb-6 max-w-sm mx-auto">
      Your corps hasn't competed in any shows yet. Register for upcoming shows to start earning scores!
    </p>
    <div className="flex flex-col sm:flex-row gap-3 justify-center">
      <Link
        to="/schedule"
        className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-gold-500 text-charcoal-900 rounded-sm font-display font-bold uppercase text-sm hover:bg-gold-400 transition-colors"
      >
        <Calendar className="w-4 h-4" />
        Register for Shows
      </Link>
      <Link
        to="/scores"
        className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-charcoal-800 border border-cream/20 rounded-sm text-cream font-display font-semibold text-sm hover:bg-charcoal-700 transition-colors"
      >
        <TrendingUp className="w-4 h-4" />
        View Leaderboard
      </Link>
    </div>
  </m.div>
);

// =============================================================================
// NEW SEASON STARTING
// =============================================================================
export const NewSeasonStartingEmpty: React.FC<EmptyStateBaseProps & { seasonName?: string, startDate?: string }> = ({
  className = '',
  seasonName = 'New Season',
  startDate,
  onAction
}) => {
  const shouldReduceMotion = useShouldReduceMotion();

  return (
    <m.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className={`text-center py-12 px-6 bg-gradient-to-br from-gold-500/10 via-charcoal-900/50 to-purple-500/10 border border-gold-500/20 rounded-sm ${className}`}
    >
      <div className="relative w-24 h-24 mx-auto mb-6">
        {/* Rotating border - only animate on desktop */}
        {shouldReduceMotion ? (
          <div className="absolute inset-0 rounded-sm border-2 border-dashed border-gold-500/30" />
        ) : (
          <m.div
            animate={{ rotate: 360 }}
            transition={{ duration: 20, repeat: Infinity, ease: 'linear' }}
            className="absolute inset-0 rounded-sm border-2 border-dashed border-gold-500/30"
          />
        )}
        <div className="absolute inset-2 rounded-sm bg-gradient-to-br from-gold-500/20 to-purple-500/20 flex items-center justify-center">
          <Star className="w-10 h-10 text-gold-400 fill-gold-400/20" />
        </div>
      </div>
      <div className="inline-flex items-center gap-2 px-3 py-1 bg-gold-500/20 border border-gold-500/30 rounded-sm mb-4">
        <Sparkles className="w-3 h-3 text-gold-400" />
        <span className="text-xs font-bold text-gold-400 uppercase tracking-wide">New Season</span>
      </div>
      <h3 className="text-2xl font-display font-bold text-cream mb-2">{seasonName}</h3>
      <p className="text-sm text-cream/60 mb-2">A new season of competition begins!</p>
      {startDate && (
        <p className="text-xs text-gold-400 mb-6 flex items-center justify-center gap-2">
          <Clock className="w-3 h-3" />
          Starts {startDate}
        </p>
      )}
      {onAction && (
        <button
          onClick={onAction}
          className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-gold-500 text-charcoal-900 rounded-sm font-display font-bold uppercase text-sm hover:bg-gold-400 transition-colors shadow-[0_0_20px_rgba(234,179,8,0.3)]"
        >
          <Play className="w-4 h-4" />
          Get Started
        </button>
      )}
    </m.div>
  );
};

// =============================================================================
// NO CORPS CREATED
// =============================================================================
export const NoCorpsCreatedEmpty: React.FC<EmptyStateBaseProps> = ({
  className = '',
  onAction
}) => (
  <m.div
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    className={`text-center py-12 px-6 ${className}`}
  >
    <div className="relative w-20 h-20 mx-auto mb-6">
      <div className="absolute inset-0 rounded-sm bg-green-500/20 animate-pulse" />
      <div className="relative w-20 h-20 rounded-sm bg-gradient-to-br from-green-500/20 to-emerald-500/20 flex items-center justify-center border-2 border-green-500/30">
        <Flag className="w-10 h-10 text-green-400" />
      </div>
    </div>
    <h3 className="text-xl font-display font-bold text-cream mb-2">Create Your First Corps</h3>
    <p className="text-sm text-cream/60 mb-6 max-w-sm mx-auto">
      Start your journey as a drum corps director. Build your lineup, register for shows, and compete!
    </p>
    {onAction && (
      <button
        onClick={onAction}
        className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-green-500 text-white rounded-sm font-display font-bold uppercase text-sm hover:bg-green-400 transition-colors"
      >
        <Flag className="w-4 h-4" />
        Register Corps
      </button>
    )}
  </m.div>
);

// =============================================================================
// NO LINEUP SET
// =============================================================================
export const NoLineupEmpty: React.FC<EmptyStateBaseProps> = ({
  className = '',
  onAction
}) => (
  <m.div
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    className={`text-center py-10 px-6 ${className}`}
  >
    <div className="w-16 h-16 rounded-sm bg-gradient-to-br from-gold-500/20 to-amber-500/20 flex items-center justify-center mx-auto mb-4 border border-gold-500/30">
      <Music className="w-8 h-8 text-gold-400" />
    </div>
    <h3 className="text-lg font-display font-bold text-cream mb-2">Build Your Lineup</h3>
    <p className="text-sm text-cream/60 mb-4 max-w-xs mx-auto">
      Select staff members for each caption to complete your lineup and start competing.
    </p>
    {onAction && (
      <button
        onClick={onAction}
        className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-gold-500 text-charcoal-900 rounded-sm font-display font-bold uppercase text-sm hover:bg-gold-400 transition-colors"
      >
        <Target className="w-4 h-4" />
        Build Lineup
      </button>
    )}
  </m.div>
);

// =============================================================================
// NO ACHIEVEMENTS
// =============================================================================
export const NoAchievementsEmpty: React.FC<EmptyStateBaseProps> = ({
  className = ''
}) => (
  <m.div
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    className={`text-center py-10 px-6 ${className}`}
  >
    <div className="w-16 h-16 rounded-sm bg-gradient-to-br from-purple-500/20 to-pink-500/20 flex items-center justify-center mx-auto mb-4 border border-purple-500/30">
      <Award className="w-8 h-8 text-purple-400" />
    </div>
    <h3 className="text-lg font-display font-bold text-cream mb-2">No Achievements Yet</h3>
    <p className="text-sm text-cream/60 max-w-xs mx-auto">
      Complete challenges and milestones to earn achievements. Keep playing to unlock them all!
    </p>
  </m.div>
);

// =============================================================================
// GENERIC EMPTY STATE
// =============================================================================
export const GenericEmpty: React.FC<EmptyStateBaseProps & {
  icon?: React.ReactNode;
  title: string;
  description: string;
  actionLabel?: string;
  actionTo?: string;
}> = ({
  className = '',
  icon,
  title,
  description,
  actionLabel,
  actionTo,
  onAction
}) => (
  <m.div
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    className={`text-center py-10 px-6 ${className}`}
  >
    {icon && (
      <div className="w-16 h-16 rounded-sm bg-charcoal-800 flex items-center justify-center mx-auto mb-4 border border-cream/10">
        {icon}
      </div>
    )}
    <h3 className="text-lg font-display font-bold text-cream mb-2">{title}</h3>
    <p className="text-sm text-cream/60 max-w-xs mx-auto mb-4">{description}</p>
    {actionLabel && (actionTo || onAction) && (
      actionTo ? (
        <Link
          to={actionTo}
          className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-gold-500 text-charcoal-900 rounded-sm font-display font-bold uppercase text-sm hover:bg-gold-400 transition-colors"
        >
          {actionLabel}
        </Link>
      ) : (
        <button
          onClick={onAction}
          className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-gold-500 text-charcoal-900 rounded-sm font-display font-bold uppercase text-sm hover:bg-gold-400 transition-colors"
        >
          {actionLabel}
        </button>
      )
    )}
  </m.div>
);

export default {
  NoLeaguesEmpty,
  NoShowsRegisteredEmpty,
  NoScoresYetEmpty,
  NewSeasonStartingEmpty,
  NoCorpsCreatedEmpty,
  NoLineupEmpty,
  NoAchievementsEmpty,
  GenericEmpty,
};
