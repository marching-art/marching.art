/**
 * GuestDashboard - Read-Only Dashboard for Guest Preview Mode
 *
 * Allows unauthenticated users to experience the dashboard with demo data.
 * All edit actions are gated with registration prompts.
 * Designed to give visitors a taste of the game before committing.
 */

import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { m } from 'framer-motion';
import {
  Trophy, Star, Calendar, TrendingUp, ChevronRight, Users,
  Award, Zap, MapPin, User, LogIn, UserPlus, ArrowLeft,
  Info, Flame, Target, Clock, Lock
} from 'lucide-react';
import { useGuestPreview } from '../hooks/useGuestPreview';
import { RegistrationGate } from '../components/GuestPreview';
import { useBodyScroll } from '../hooks/useBodyScroll';

// =============================================================================
// CAPTION DISPLAY DATA
// =============================================================================

const CAPTIONS = [
  { id: 'GE1', name: 'GE1', category: 'ge', fullName: 'General Effect 1' },
  { id: 'GE2', name: 'GE2', category: 'ge', fullName: 'General Effect 2' },
  { id: 'VP', name: 'VP', category: 'vis', fullName: 'Visual Proficiency' },
  { id: 'VA', name: 'VA', category: 'vis', fullName: 'Visual Analysis' },
  { id: 'CG', name: 'CG', category: 'vis', fullName: 'Color Guard' },
  { id: 'B', name: 'B', category: 'mus', fullName: 'Brass' },
  { id: 'MA', name: 'MA', category: 'mus', fullName: 'Music Analysis' },
  { id: 'P', name: 'P', category: 'mus', fullName: 'Percussion' },
];

const CLASS_LABELS = {
  world: 'World Class',
  open: 'Open Class',
  aClass: 'A Class',
  soundSport: 'SoundSport',
};

// =============================================================================
// GUEST HEADER COMPONENT
// =============================================================================

const GuestHeader = () => {
  return (
    <header className="flex-shrink-0 h-14 bg-[#1a1a1a] border-b border-[#333]">
      <div className="max-w-[1920px] mx-auto h-full flex items-center px-4 lg:px-6">
        {/* Back to Landing */}
        <Link
          to="/"
          className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors mr-4"
        >
          <ArrowLeft className="w-4 h-4" />
          <span className="text-sm font-medium hidden sm:inline">Back</span>
        </Link>

        {/* Logo */}
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-sm overflow-hidden">
            <img src="/logo192.svg" alt="marching.art" className="w-full h-full object-cover" />
          </div>
          <span className="text-base font-bold text-white tracking-wider">
            marching.art
          </span>
        </div>

        {/* Preview Badge */}
        <div className="ml-3 px-2.5 py-1 bg-yellow-500/20 border border-yellow-500/30 rounded-sm">
          <span className="text-xs font-bold text-yellow-500 uppercase tracking-wider">
            Preview Mode
          </span>
        </div>

        {/* Auth Links */}
        <div className="ml-auto flex items-center gap-2">
          <Link
            to="/login"
            className="flex items-center gap-1.5 px-3 h-9 text-sm text-gray-400 hover:text-white transition-colors"
          >
            <LogIn className="w-4 h-4" />
            <span className="hidden sm:inline">Sign In</span>
          </Link>
          <Link
            to="/register"
            className="flex items-center gap-1.5 px-4 h-9 bg-[#0057B8] text-white text-sm font-bold rounded-sm hover:bg-[#0066d6] transition-colors"
          >
            <UserPlus className="w-4 h-4" />
            <span>Sign Up Free</span>
          </Link>
        </div>
      </div>
    </header>
  );
};

// =============================================================================
// LINEUP ROW COMPONENT (Read-Only)
// =============================================================================

const LineupRow = ({ caption, value, captionScore, isLast, onGatedClick }) => {
  const hasValue = !!value;
  const [corpsName, sourceYear] = hasValue ? value.split('|') : [null, null];

  return (
    <button
      onClick={onGatedClick}
      className={`w-full flex items-center gap-3 px-3 py-3.5 transition-all cursor-pointer group ${
        !isLast ? 'border-b border-[#333]/50' : ''
      } bg-[#1a1a1a] hover:bg-[#222] active:bg-[#252525]`}
    >
      {/* Position Badge */}
      <div className={`w-10 h-8 flex items-center justify-center rounded text-xs font-bold ${
        hasValue ? 'bg-[#0057B8]/20 text-[#0057B8]' : 'bg-[#333] text-gray-500'
      }`}>
        {caption.name}
      </div>

      {/* Corps Name + Year */}
      <div className="flex-1 text-left min-w-0">
        {hasValue ? (
          <div className="flex items-center gap-1.5">
            <span className="text-sm text-white truncate">{corpsName}</span>
            {sourceYear && (
              <span className="text-[10px] text-gray-500">'{sourceYear?.slice(-2)}</span>
            )}
          </div>
        ) : (
          <span className="text-sm text-gray-500 italic">Empty slot</span>
        )}
      </div>

      {/* Caption Score */}
      <div className="flex items-center gap-2">
        {hasValue ? (
          <span className="text-xs font-data text-gray-400 tabular-nums">
            {captionScore !== null ? captionScore.toFixed(1) : '—'}
          </span>
        ) : (
          <span className="text-xs font-bold text-[#F5A623] group-hover:text-[#FFB84D]">+ Draft</span>
        )}
        <Lock className="w-3.5 h-3.5 text-gray-600 group-hover:text-gray-400" />
      </div>
    </button>
  );
};

// =============================================================================
// STATS CARD COMPONENT
// =============================================================================

const StatsCard = ({ icon: Icon, iconColor, label, value, sublabel }) => (
  <div className="bg-[#1a1a1a] border border-[#333] rounded-sm p-3">
    <div className="flex items-center gap-2 mb-1">
      <Icon className={`w-4 h-4 ${iconColor}`} />
      <span className="text-xs text-gray-500 uppercase tracking-wider">{label}</span>
    </div>
    <div className="text-xl font-bold text-white font-data tabular-nums">{value}</div>
    {sublabel && <div className="text-xs text-gray-500 mt-0.5">{sublabel}</div>}
  </div>
);

// =============================================================================
// GUEST DASHBOARD COMPONENT
// =============================================================================

const GuestDashboard = () => {
  useBodyScroll();
  const navigate = useNavigate();

  const {
    isLoading,
    demoCorps,
    demoProfile,
    demoStats,
    demoRecentScores,
    demoUpcomingShows,
    demoLeaderboardPosition,
    trackInteraction,
    hasEngaged,
    startPreview,
  } = useGuestPreview();

  // Gate modal state
  const [gateModal, setGateModal] = useState({ isOpen: false, type: 'default' });

  // Mark preview as started on mount
  useEffect(() => {
    startPreview();
  }, [startPreview]);

  // Handle gated action clicks
  const handleGatedClick = (gateType) => {
    trackInteraction(gateType);
    setGateModal({ isOpen: true, type: gateType });
  };

  const closeGate = () => {
    setGateModal({ isOpen: false, type: 'default' });
  };

  // Caption score helper
  const getCaptionScore = (captionId) => {
    if (['GE1', 'GE2'].includes(captionId)) return demoStats?.geScore ?? null;
    if (['VP', 'VA', 'CG'].includes(captionId)) return demoStats?.visualScore ?? null;
    if (['B', 'MA', 'P'].includes(captionId)) return demoStats?.musicScore ?? null;
    return null;
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-[#0057B8] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-[#0A0A0A]">
      {/* Header */}
      <GuestHeader />

      {/* Main Content */}
      <main className="flex-1 pb-24 md:pb-4">
        <div className="max-w-[1920px] mx-auto p-4 lg:p-6">

          {/* Preview Notice Banner */}
          <m.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-4 p-4 bg-gradient-to-r from-[#0057B8]/20 to-yellow-500/10 border border-[#0057B8]/30 rounded-sm"
          >
            <div className="flex flex-col sm:flex-row sm:items-center gap-3">
              <div className="flex items-center gap-3 flex-1">
                <Info className="w-5 h-5 text-[#0057B8] flex-shrink-0" />
                <div>
                  <p className="text-sm text-white font-medium">
                    You're viewing a demo dashboard
                  </p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    Create a free account to build your own corps and compete
                  </p>
                </div>
              </div>
              <Link
                to="/register"
                className="flex items-center justify-center gap-2 px-4 h-10 bg-[#0057B8] text-white text-sm font-bold rounded-sm hover:bg-[#0066d6] transition-colors whitespace-nowrap"
              >
                Create Your Corps
                <ChevronRight className="w-4 h-4" />
              </Link>
            </div>
          </m.div>

          {/* Grid Layout */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 lg:gap-6">

            {/* LEFT COLUMN - Corps Info & Lineup */}
            <div className="lg:col-span-8 space-y-4">

              {/* Corps Header Card */}
              <div className="bg-[#1a1a1a] border border-[#333] rounded-sm overflow-hidden">
                {/* Accent Line */}
                <div className="h-1 bg-gradient-to-r from-[#0057B8] via-yellow-500 to-[#0057B8]" />

                <div className="p-4">
                  <div className="flex items-start gap-4">
                    {/* Corps Avatar */}
                    <div className="w-16 h-16 rounded-sm bg-[#0057B8]/20 border border-[#0057B8]/30 flex items-center justify-center flex-shrink-0">
                      <Trophy className="w-8 h-8 text-[#0057B8]" />
                    </div>

                    {/* Corps Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-bold text-yellow-500 uppercase tracking-wider">
                          {CLASS_LABELS[demoCorps.corpsClass]}
                        </span>
                      </div>
                      <h1 className="text-xl font-bold text-white truncate">
                        {demoCorps.corpsName}
                      </h1>
                      <div className="flex items-center gap-1.5 text-sm text-gray-500 mt-1">
                        <MapPin className="w-3.5 h-3.5" />
                        <span>{demoCorps.location}</span>
                      </div>
                    </div>

                    {/* Season Score */}
                    <div className="text-right flex-shrink-0">
                      <div className="text-3xl font-bold text-white font-data tabular-nums">
                        {demoCorps.totalSeasonScore.toFixed(1)}
                      </div>
                      <div className="text-xs text-gray-500 uppercase tracking-wider">
                        Season Score
                      </div>
                    </div>
                  </div>

                  {/* Quick Stats Row */}
                  <div className="grid grid-cols-4 gap-3 mt-4 pt-4 border-t border-[#333]/50">
                    <div className="text-center">
                      <div className="text-lg font-bold text-white font-data">{demoCorps.showsAttended}</div>
                      <div className="text-xs text-gray-500">Shows</div>
                    </div>
                    <div className="text-center">
                      <div className="text-lg font-bold text-green-500 font-data">{demoCorps.seasonHighScore}</div>
                      <div className="text-xs text-gray-500">High Score</div>
                    </div>
                    <div className="text-center">
                      <div className="text-lg font-bold text-yellow-500 font-data">#{demoLeaderboardPosition.rank}</div>
                      <div className="text-xs text-gray-500">Global Rank</div>
                    </div>
                    <div className="text-center">
                      <div className="text-lg font-bold text-[#0057B8] font-data">{demoLeaderboardPosition.percentile}%</div>
                      <div className="text-xs text-gray-500">Percentile</div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Lineup Panel */}
              <div className="bg-[#1a1a1a] border border-[#333] rounded-sm overflow-hidden">
                <div className="bg-[#222] px-4 py-3 border-b border-[#333] flex items-center justify-between">
                  <h2 className="text-[10px] font-bold text-gray-400 uppercase tracking-wider flex items-center gap-2">
                    <Target className="w-3.5 h-3.5 text-[#0057B8]" />
                    Active Lineup
                  </h2>
                  <button
                    onClick={() => handleGatedClick('edit')}
                    className="text-xs font-medium text-[#0057B8] hover:text-white transition-colors flex items-center gap-1"
                  >
                    <Lock className="w-3 h-3" />
                    Edit Lineup
                  </button>
                </div>

                <div>
                  {CAPTIONS.map((caption, index) => (
                    <LineupRow
                      key={caption.id}
                      caption={caption}
                      value={demoCorps.lineup?.[caption.id]}
                      captionScore={getCaptionScore(caption.id)}
                      isLast={index === CAPTIONS.length - 1}
                      onGatedClick={() => handleGatedClick('edit')}
                    />
                  ))}
                </div>
              </div>

              {/* Recent Scores */}
              <div className="bg-[#1a1a1a] border border-[#333] rounded-sm overflow-hidden">
                <div className="bg-[#222] px-4 py-3 border-b border-[#333]">
                  <h2 className="text-[10px] font-bold text-gray-400 uppercase tracking-wider flex items-center gap-2">
                    <TrendingUp className="w-3.5 h-3.5 text-green-500" />
                    Recent Results
                  </h2>
                </div>

                <div className="divide-y divide-[#333]/50">
                  {demoRecentScores.map((show) => (
                    <div key={show.showId} className="p-4 flex items-center gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-white truncate">
                          {show.showName}
                        </div>
                        <div className="text-xs text-gray-500">
                          {new Date(show.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-lg font-bold text-white font-data tabular-nums">
                          {show.score.toFixed(2)}
                        </div>
                        <div className="text-xs text-gray-500">
                          {show.placement === 1 ? '1st' : show.placement === 2 ? '2nd' : show.placement === 3 ? '3rd' : `${show.placement}th`} place
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* RIGHT COLUMN - Stats & Actions */}
            <div className="lg:col-span-4 space-y-4">

              {/* Director Card */}
              <div className="bg-[#1a1a1a] border border-[#333] rounded-sm overflow-hidden">
                <div className="bg-[#222] px-4 py-3 border-b border-[#333]">
                  <h2 className="text-[10px] font-bold text-gray-400 uppercase tracking-wider flex items-center gap-2">
                    <User className="w-3.5 h-3.5 text-[#0057B8]" />
                    Demo Director
                  </h2>
                </div>

                <div className="p-4">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-12 h-12 rounded-full bg-[#0057B8] flex items-center justify-center text-white font-bold text-lg">
                      D
                    </div>
                    <div>
                      <div className="text-sm font-bold text-white">{demoProfile.displayName}</div>
                      <div className="text-xs text-gray-500">{demoProfile.userTitle}</div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="text-center p-2 bg-[#111] rounded-sm">
                      <div className="flex items-center justify-center gap-1 mb-1">
                        <Zap className="w-3.5 h-3.5 text-purple-500" />
                      </div>
                      <div className="text-lg font-bold text-white">{demoProfile.xpLevel}</div>
                      <div className="text-xs text-gray-500">Level</div>
                    </div>
                    <div className="text-center p-2 bg-[#111] rounded-sm">
                      <div className="flex items-center justify-center gap-1 mb-1">
                        <Flame className="w-3.5 h-3.5 text-orange-500" />
                      </div>
                      <div className="text-lg font-bold text-orange-500">{demoProfile.engagement.loginStreak}</div>
                      <div className="text-xs text-gray-500">Streak</div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Season Stats */}
              <div className="grid grid-cols-2 gap-3">
                <StatsCard
                  icon={Calendar}
                  iconColor="text-[#0057B8]"
                  label="Shows"
                  value={demoCorps.showsAttended}
                  sublabel="this season"
                />
                <StatsCard
                  icon={Award}
                  iconColor="text-yellow-500"
                  label="High Score"
                  value={demoCorps.seasonHighScore}
                  sublabel="season best"
                />
              </div>

              {/* Upcoming Shows */}
              <div className="bg-[#1a1a1a] border border-[#333] rounded-sm overflow-hidden">
                <div className="bg-[#222] px-4 py-3 border-b border-[#333] flex items-center justify-between">
                  <h2 className="text-[10px] font-bold text-gray-400 uppercase tracking-wider flex items-center gap-2">
                    <Calendar className="w-3.5 h-3.5 text-green-500" />
                    Upcoming Shows
                  </h2>
                  <button
                    onClick={() => handleGatedClick('shows')}
                    className="text-xs font-medium text-[#0057B8] hover:text-white transition-colors flex items-center gap-1"
                  >
                    <Lock className="w-3 h-3" />
                    Select
                  </button>
                </div>

                <div className="divide-y divide-[#333]/50">
                  {demoUpcomingShows.slice(0, 3).map((show) => (
                    <button
                      key={show.showId}
                      onClick={() => handleGatedClick('shows')}
                      className="w-full p-3 flex items-center gap-3 hover:bg-[#222] transition-colors text-left"
                    >
                      <div className="w-10 h-10 rounded-sm bg-[#111] flex flex-col items-center justify-center flex-shrink-0">
                        <span className="text-xs text-gray-500">
                          {new Date(show.date).toLocaleDateString('en-US', { month: 'short' }).toUpperCase()}
                        </span>
                        <span className="text-sm font-bold text-white">
                          {new Date(show.date).getDate()}
                        </span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm text-white truncate">{show.eventName}</div>
                        <div className="text-xs text-gray-500 truncate">{show.location}</div>
                      </div>
                      {show.isSelected && (
                        <div className="px-2 py-0.5 bg-green-500/20 rounded-sm">
                          <span className="text-xs font-medium text-green-500">Selected</span>
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              </div>

              {/* Join League CTA */}
              <button
                onClick={() => handleGatedClick('league')}
                className="w-full bg-gradient-to-r from-yellow-500/20 to-orange-500/20 border border-yellow-500/30 rounded-sm p-4 text-left hover:border-yellow-500/50 transition-colors group"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-sm bg-yellow-500/20 flex items-center justify-center">
                    <Users className="w-5 h-5 text-yellow-500" />
                  </div>
                  <div className="flex-1">
                    <div className="text-sm font-bold text-white group-hover:text-yellow-500 transition-colors">
                      Join a League
                    </div>
                    <div className="text-xs text-gray-500">
                      Compete against friends
                    </div>
                  </div>
                  <Lock className="w-4 h-4 text-gray-500 group-hover:text-yellow-500 transition-colors" />
                </div>
              </button>

              {/* Register CTA */}
              <div className="bg-gradient-to-br from-[#0057B8]/20 to-[#0057B8]/5 border border-[#0057B8]/30 rounded-sm p-4">
                <h3 className="text-sm font-bold text-white mb-2">Ready to compete?</h3>
                <p className="text-xs text-gray-400 mb-4">
                  Create your free account to build your own corps, join leagues, and climb the leaderboard.
                </p>
                <Link
                  to="/register"
                  className="flex items-center justify-center gap-2 w-full h-11 bg-[#0057B8] text-white font-bold text-sm rounded-sm hover:bg-[#0066d6] transition-colors"
                >
                  <UserPlus className="w-4 h-4" />
                  Create Free Account
                </Link>
                <div className="flex items-center justify-center gap-2 mt-3 text-gray-500">
                  <Zap className="w-3.5 h-3.5 text-green-500" />
                  <span className="text-xs">Takes less than 30 seconds</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Registration Gate Modal */}
      <RegistrationGate
        isOpen={gateModal.isOpen}
        onClose={closeGate}
        gateType={gateModal.type}
        hasEngaged={hasEngaged}
      />
    </div>
  );
};

export default GuestDashboard;
