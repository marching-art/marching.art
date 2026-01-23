// =============================================================================
// LANDING PAGE - NEWS & DATA HUB
// =============================================================================
// Three-column layout: News Feed | Live Data | Auth Widget
// Laws: No marketing fluff, no parallax, no testimonials

import React, { useState, useMemo, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  Trophy, Lock, Mail, AlertCircle, ChevronRight,
  LayoutDashboard, Award, User, LogOut, Flame, Activity,
  Settings, Zap, UserPlus, MessageCircle, Coins
} from 'lucide-react';
import YouTubeIcon from '../components/YouTubeIcon';
import { useAuth } from '../App';
import toast from 'react-hot-toast';
import { useProfileStore } from '../store/profileStore';
import NewsFeed from '../components/Landing/NewsFeed';
import { LiveScoresBox, FantasyTrendingBox, StandingsModal, YouTubeModal } from '../components/Sidebar';
import { useBodyScroll } from '../hooks/useBodyScroll';
import { useTickerData } from '../hooks/useTickerData';
import { useLandingScores } from '../hooks/useLandingScores';
import { useYoutubeSearch } from '../hooks/useYoutubeSearch';
import { useFirstVisit } from '../hooks/useFirstVisit';


// =============================================================================
// LANDING PAGE COMPONENT
// =============================================================================

const Landing = () => {
  useBodyScroll();
  const { user, signIn, signOut } = useAuth();
  const profile = useProfileStore((state) => state.profile);

  // First-visit detection for progressive disclosure
  // New visitors see educational content; returning visitors get data-focused view
  const { isFirstVisit, isLoading: isFirstVisitLoading, markAsReturning } = useFirstVisit();

  // Stagger secondary data loading to prioritize news feed on initial paint
  // Ticker and scores data loads after a brief delay to reduce bandwidth contention
  const [secondaryDataEnabled, setSecondaryDataEnabled] = useState(false);

  useEffect(() => {
    // Use requestIdleCallback if available, otherwise setTimeout
    // This ensures news feed renders first before loading sidebar data
    const enableSecondaryData = () => setSecondaryDataEnabled(true);

    if ('requestIdleCallback' in window) {
      const id = window.requestIdleCallback(enableSecondaryData, { timeout: 500 });
      return () => window.cancelIdleCallback(id);
    } else {
      const id = setTimeout(enableSecondaryData, 100);
      return () => clearTimeout(id);
    }
  }, []);

  const { tickerData, loading: tickerLoading, hasData: hasTickerData } = useTickerData({ enabled: secondaryDataEnabled });
  const { liveScores, displayDay, loading: scoresLoading, hasData: hasScoresData } = useLandingScores({ enabled: secondaryDataEnabled });

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showStandingsModal, setShowStandingsModal] = useState(false);

  // YouTube search hook
  const { videoModal, handleYoutubeSearch, handleRetrySearch, closeVideoModal } = useYoutubeSearch();

  // Compute trending players from movers across all classes
  const trendingPlayers = useMemo(() => {
    if (!tickerData?.byClass) return [];

    // Collect movers from all classes
    const allMovers = [];
    for (const classKey of ['worldClass', 'openClass', 'aClass']) {
      const classData = tickerData.byClass[classKey];
      if (classData?.movers) {
        classData.movers.forEach(mover => {
          // Calculate percentage change
          const prevScore = parseFloat(mover.previousScore);
          const changeValue = parseFloat(mover.change);
          const percentChange = prevScore > 0 ? (changeValue / prevScore) * 100 : 0;

          allMovers.push({
            name: mover.fullName,
            change: `${changeValue >= 0 ? '+' : ''}${percentChange.toFixed(1)}%`,
            direction: mover.direction,
            absChange: Math.abs(percentChange),
          });
        });
      }
    }

    // Sort by absolute percentage change and take top 4
    return allMovers
      .sort((a, b) => b.absChange - a.absChange)
      .slice(0, 4);
  }, [tickerData]);

  const handleSignOut = async () => {
    try {
      await signOut();
      toast.success('Signed out successfully');
    } catch (err) {
      toast.error('Failed to sign out');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await signIn(email, password);
      markAsReturning(); // User has engaged - mark as returning visitor
      toast.success('Welcome back!');
    } catch (err) {
      console.error('Login error:', err);
      switch (err.code) {
        case 'auth/user-not-found':
          setError('No account found with this email');
          break;
        case 'auth/wrong-password':
          setError('Incorrect password');
          break;
        case 'auth/invalid-email':
          setError('Invalid email address');
          break;
        case 'auth/too-many-requests':
          setError('Too many attempts. Try again later');
          break;
        default:
          setError('Failed to sign in. Please try again');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#0A0A0A]">
      {/* FIXED HEADER */}
      <header className="flex-shrink-0 h-14 bg-[#1a1a1a] border-b border-[#333]">
        <div className="max-w-[1920px] mx-auto h-full flex items-center px-4 lg:px-6">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-sm overflow-hidden">
              <img src="/logo192.svg" alt="marching.art" className="w-full h-full object-cover" />
            </div>
            <span className="text-base font-bold text-white tracking-wider">
              marching.art
            </span>
          </div>
          <div className="ml-auto flex items-center gap-2">
            {/* Mobile Auth Buttons - Only show for unauthenticated users on mobile */}
            {!user && (
              <div className="flex items-center gap-2 lg:hidden">
                <Link
                  to="/login"
                  className="min-h-[44px] px-5 bg-yellow-500 text-slate-900 font-display font-semibold text-sm uppercase tracking-wide flex items-center justify-center rounded-lg hover:bg-yellow-400 active:bg-yellow-600 active:scale-95 transition-all duration-150 press-feedback-strong"
                >
                  Sign In
                </Link>
                <Link
                  to="/register"
                  className="min-h-[44px] px-4 border border-yellow-500/50 text-yellow-500 font-display font-semibold text-sm uppercase tracking-wide flex items-center justify-center gap-1.5 rounded-lg hover:bg-yellow-500/10 hover:border-yellow-500 active:bg-yellow-500/20 active:scale-95 transition-all duration-150 press-feedback"
                >
                  <UserPlus className="w-4 h-4" />
                  <span className="hidden xs:inline">Register</span>
                </Link>
              </div>
            )}
            {/* Authenticated user - Show dashboard link on mobile */}
            {user && (
              <Link
                to="/dashboard"
                className="min-h-[44px] px-5 bg-yellow-500 text-slate-900 font-display font-semibold text-sm uppercase tracking-wide flex items-center justify-center rounded-lg hover:bg-yellow-400 active:bg-yellow-600 active:scale-95 transition-all duration-150 press-feedback-strong lg:hidden"
              >
                Dashboard
              </Link>
            )}
            {/* Desktop links */}
            <div className="hidden lg:flex items-center">
              <a
                href="https://discord.gg/YvFRJ97A5H"
                target="_blank"
                rel="noopener noreferrer"
                className="px-3 py-2.5 min-h-touch text-sm text-gray-500 hover:text-[#5865F2] active:text-white transition-colors press-feedback flex items-center gap-1.5"
              >
                <MessageCircle className="w-4 h-4" />
                Discord
              </a>
              <Link to="/privacy" className="px-3 py-2.5 min-h-touch text-sm text-gray-500 hover:text-gray-300 active:text-white transition-colors press-feedback flex items-center">
                Privacy
              </Link>
              <Link to="/terms" className="px-3 py-2.5 min-h-touch text-sm text-gray-500 hover:text-gray-300 active:text-white transition-colors press-feedback flex items-center">
                Terms
              </Link>
            </div>
          </div>
        </div>
      </header>

      {/* SCROLLABLE CONTENT */}
      <main className="flex-1 pb-24 md:pb-4">
        <div className="max-w-[1920px] mx-auto p-4 lg:p-6">

          {/* =============================================================
              HERO SECTION - First-time visitors only (Step 2)
              Shows value proposition and quick explanation for new users.
              Hidden for: authenticated users, returning visitors, or while loading.
              ============================================================= */}
          {!user && !isFirstVisitLoading && isFirstVisit && (
            <div className="mb-6">
              {/* Hero content will be added in Step 2 */}
              {/* For now, this placeholder ensures the detection logic works */}
              {/* The markAsReturning function will be called when user dismisses */}
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 lg:gap-6">

          {/* ============================================================= */}
          {/* SIDEBAR - Mobile First (shows before news on mobile) */}
          {/* On desktop: 4 cols on right, sticky */}
          {/* On mobile: Full width, appears FIRST */}
          {/* ============================================================= */}
          <div className="order-1 lg:order-2 lg:col-span-4">
            <div className="lg:sticky lg:top-4 space-y-4 lg:space-y-5">

              {/* ------------------------------------------------------- */}
              {/* AUTH WIDGET - Login or User Dashboard */}
              {/* ------------------------------------------------------- */}
              {user ? (
                /* AUTHENTICATED USER WIDGET */
                <div className="bg-[#1a1a1a] border border-[#333] rounded-sm">
                  {/* User Header */}
                  <div className="bg-[#222] px-4 py-3 border-b border-[#333]">
                    <h3 className="text-[10px] font-bold text-gray-400 uppercase tracking-wider flex items-center gap-2">
                      <User className="w-3.5 h-3.5 text-[#0057B8]" />
                      My Fantasy
                    </h3>
                  </div>

                  {/* User Info */}
                  <div className="p-4 border-b border-[#333]">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-[#0057B8] flex items-center justify-center text-white font-bold text-sm">
                        {profile?.displayName?.[0]?.toUpperCase() || user.email?.[0]?.toUpperCase() || 'D'}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-bold text-white truncate">
                          {profile?.displayName || 'Director'}
                        </div>
                        <div className="text-xs text-gray-500 truncate">
                          {user.email}
                        </div>
                      </div>
                    </div>

                    {/* Quick Stats */}
                    {profile && (
                      <div className="grid grid-cols-2 gap-x-4 gap-y-2 mt-3 pt-3 border-t border-[#333]/50">
                        <div className="flex items-center gap-1.5">
                          <Zap className="w-3.5 h-3.5 text-purple-500" />
                          <span className="text-xs text-gray-400">Level</span>
                          <span className="text-sm font-bold text-white">{profile.xpLevel || 1}</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <Trophy className="w-3.5 h-3.5 text-[#0057B8]" />
                          <span className="text-xs text-gray-400">XP</span>
                          <span className="text-sm font-bold text-white font-data tabular-nums">{profile.xp?.toLocaleString() || 0}</span>
                        </div>
                        {profile.engagement?.loginStreak > 0 && (
                          <div className="flex items-center gap-1.5">
                            <Flame className="w-3.5 h-3.5 text-orange-500" />
                            <span className="text-xs text-gray-400">Streak</span>
                            <span className="text-sm font-bold text-orange-500 font-data tabular-nums">{profile.engagement.loginStreak}</span>
                          </div>
                        )}
                        <div className="flex items-center gap-1.5">
                          <Coins className="w-3.5 h-3.5 text-yellow-500" />
                          <span className="text-xs text-gray-400">Coins</span>
                          <span className="text-sm font-bold text-yellow-500 font-data tabular-nums">{(profile.corpsCoin || 0).toLocaleString()}</span>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Quick Links - hidden on mobile to save space, show on desktop */}
                  <div className="hidden lg:block p-2 space-y-0.5">
                    <Link
                      to="/dashboard"
                      className="flex items-center gap-3 px-3 min-h-[44px] rounded-sm hover:bg-white/[0.05] active:bg-white/[0.08] transition-colors group press-feedback"
                    >
                      <LayoutDashboard className="w-5 h-5 text-[#0057B8]" />
                      <span className="text-sm text-white font-medium">Dashboard</span>
                      <ChevronRight className="w-4 h-4 text-gray-600 ml-auto group-hover:text-gray-400" />
                    </Link>
                    <Link
                      to="/leagues"
                      className="flex items-center gap-3 px-3 min-h-[44px] rounded-sm hover:bg-white/[0.05] active:bg-white/[0.08] transition-colors group press-feedback"
                    >
                      <Award className="w-5 h-5 text-orange-500" />
                      <span className="text-sm text-white font-medium">My Leagues</span>
                      <ChevronRight className="w-4 h-4 text-gray-600 ml-auto group-hover:text-gray-400" />
                    </Link>
                    <Link
                      to="/scores"
                      className="flex items-center gap-3 px-3 min-h-[44px] rounded-sm hover:bg-white/[0.05] active:bg-white/[0.08] transition-colors group press-feedback"
                    >
                      <Activity className="w-5 h-5 text-green-500" />
                      <span className="text-sm text-white font-medium">Live Scores</span>
                      <ChevronRight className="w-4 h-4 text-gray-600 ml-auto group-hover:text-gray-400" />
                    </Link>
                    <Link
                      to="/profile"
                      className="flex items-center gap-3 px-3 min-h-[44px] rounded-sm hover:bg-white/[0.05] active:bg-white/[0.08] transition-colors group press-feedback"
                    >
                      <Settings className="w-5 h-5 text-gray-400" />
                      <span className="text-sm text-white font-medium">Profile & Settings</span>
                      <ChevronRight className="w-4 h-4 text-gray-600 ml-auto group-hover:text-gray-400" />
                    </Link>
                  </div>

                  {/* Sign Out - hidden on mobile (accessible from Dashboard), show on desktop */}
                  <div className="hidden lg:block px-2 py-2 border-t border-[#333] bg-[#111]">
                    <button
                      onClick={handleSignOut}
                      className="flex items-center gap-2 px-2 min-h-[44px] w-full text-sm text-gray-500 hover:text-red-400 active:text-red-500 transition-colors press-feedback rounded-sm"
                    >
                      <LogOut className="w-4 h-4" />
                      Sign Out
                    </button>
                  </div>
                </div>
              ) : (
                /* LOGIN/REGISTER WIDGET */
                <div className="bg-[#1a1a1a] border border-[#333] rounded-sm">
                  {/* Card Header */}
                  <div className="bg-[#222] px-4 py-3 border-b border-[#333]">
                    <h3 className="text-[10px] font-bold text-gray-400 uppercase tracking-wider flex items-center gap-2">
                      <Lock className="w-3.5 h-3.5" />
                      Director Login
                    </h3>
                  </div>

                  {/* Card Body - Compact Form */}
                  <form onSubmit={handleSubmit} className="p-4 space-y-3">
                    {/* Error Message */}
                    {error && (
                      <div className="p-2.5 bg-red-500/10 border border-red-500/30 rounded-sm flex items-start gap-2">
                        <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
                        <p className="text-xs text-red-300">{error}</p>
                      </div>
                    )}

                    {/* Email Input - 44px+ height for touch targets */}
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                      <input
                        type="email"
                        placeholder="Email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                        disabled={loading}
                        className="w-full min-h-[44px] h-11 pl-10 pr-3 bg-[#111] border border-[#333] rounded-sm text-base text-white placeholder-gray-500 focus:outline-none focus:border-[#0057B8] disabled:opacity-50 transition-colors"
                      />
                    </div>

                    {/* Password Input - 44px+ height for touch targets */}
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                      <input
                        type="password"
                        placeholder="Password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                        disabled={loading}
                        className="w-full min-h-[44px] h-11 pl-10 pr-3 bg-[#111] border border-[#333] rounded-sm text-base text-white placeholder-gray-500 focus:outline-none focus:border-[#0057B8] disabled:opacity-50 transition-colors"
                      />
                    </div>

                    {/* Actions Row - 44px+ height for touch targets */}
                    <div className="flex gap-2">
                      <button
                        type="submit"
                        disabled={loading}
                        className="flex-1 min-h-[44px] h-11 bg-[#0057B8] text-white font-bold text-sm uppercase tracking-wider flex items-center justify-center hover:bg-[#0066d6] active:bg-[#004a9e] active:scale-[0.98] transition-all duration-150 press-feedback-strong disabled:opacity-50 disabled:cursor-not-allowed rounded-sm"
                      >
                        {loading ? '...' : 'Sign In'}
                      </button>
                      <Link
                        to="/register"
                        className="flex-1 min-h-[44px] h-11 border border-[#333] text-gray-400 font-bold text-sm uppercase tracking-wider flex items-center justify-center hover:border-[#444] hover:text-white active:scale-[0.98] transition-all duration-150 press-feedback rounded-sm"
                      >
                        Register
                      </Link>
                    </div>

                    {/* Footer Links */}
                    <div className="flex items-center justify-between text-xs text-gray-500 pt-1">
                      <Link to="/forgot-password" className="hover:text-[#0057B8] transition-colors">
                        Forgot password?
                      </Link>
                      <span>Free to play</span>
                    </div>
                  </form>
                </div>
              )}

              {/* FANTASY TRENDING MODULE */}
              <FantasyTrendingBox
                trendingPlayers={trendingPlayers}
                loading={tickerLoading}
                dayLabel={tickerData?.dayLabel}
              />

              {/* LIVE SCORE TICKER */}
              <LiveScoresBox
                liveScores={liveScores}
                displayDay={displayDay}
                loading={scoresLoading}
                hasData={hasScoresData}
                onYoutubeClick={handleYoutubeSearch}
                onShowStandings={() => setShowStandingsModal(true)}
              />

            </div>
          </div>

          {/* ============================================================= */}
          {/* MAIN COLUMN - News Feed */}
          {/* On desktop: 8 cols on left */}
          {/* On mobile: Full width, appears AFTER sidebar widgets */}
          {/* ============================================================= */}
          <div className="order-2 lg:order-1 lg:col-span-8">
            {/* Section header for mobile - helps users understand the content */}
            <div className="flex items-center gap-2 mb-3 lg:hidden">
              <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">Latest News</span>
              <div className="flex-1 h-px bg-[#333]" />
            </div>
            {/* Dynamic News Feed powered by Gemini AI */}
            <NewsFeed maxItems={5} />
          </div>

          </div>
        </div>
      </main>

      {/* FULL STANDINGS MODAL */}
      <StandingsModal
        show={showStandingsModal}
        liveScores={liveScores}
        displayDay={displayDay}
        onClose={() => setShowStandingsModal(false)}
        onYoutubeClick={handleYoutubeSearch}
      />

      {/* YOUTUBE VIDEO MODAL */}
      <YouTubeModal
        videoModal={videoModal}
        onClose={closeVideoModal}
        onRetry={handleRetrySearch}
      />
    </div>
  );
};

export default Landing;
