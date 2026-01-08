// =============================================================================
// LANDING PAGE - NEWS & DATA HUB
// =============================================================================
// Three-column layout: News Feed | Live Data | Auth Widget
// Laws: No marketing fluff, no parallax, no testimonials

import React, { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  Trophy, Lock, Mail, AlertCircle, TrendingUp,
  TrendingDown, Flame, ChevronRight, X,
  Activity, LayoutDashboard, Award, User, LogOut,
  Settings, Zap, UserPlus, MessageCircle, Coins, Youtube, Loader2
} from 'lucide-react';
import { useAuth } from '../App';
import toast from 'react-hot-toast';
import { useProfileStore } from '../store/profileStore';
import NewsFeed from '../components/Landing/NewsFeed';
import { useBodyScroll } from '../hooks/useBodyScroll';
import { useTickerData } from '../hooks/useTickerData';
import { useLandingScores } from '../hooks/useLandingScores';

// YouTube Data API key (public, read-only)
const YOUTUBE_API_KEY = import.meta.env.VITE_YOUTUBE_API_KEY;


// =============================================================================
// LANDING PAGE COMPONENT
// =============================================================================

const Landing = () => {
  useBodyScroll();
  const { user, signIn, signOut } = useAuth();
  const profile = useProfileStore((state) => state.profile);
  const { tickerData, loading: tickerLoading, hasData: hasTickerData } = useTickerData();
  const { liveScores, displayDay, loading: scoresLoading, hasData: hasScoresData } = useLandingScores();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showStandingsModal, setShowStandingsModal] = useState(false);
  const [videoModal, setVideoModal] = useState({
    show: false,
    loading: false,
    videoId: null,
    title: '',
    searchQuery: '',
    error: null
  });

  // Search YouTube and show video in modal
  const handleYoutubeSearch = async (year, corpsName) => {
    const searchQuery = `${year} ${corpsName}`;
    setVideoModal({
      show: true,
      loading: true,
      videoId: null,
      title: searchQuery,
      searchQuery,
      error: null
    });

    // If no API key, show modal with link to YouTube
    if (!YOUTUBE_API_KEY) {
      setVideoModal(prev => ({
        ...prev,
        loading: false,
        error: 'YouTube API not configured'
      }));
      return;
    }

    try {
      // Call YouTube Data API v3 directly
      const searchUrl = new URL('https://www.googleapis.com/youtube/v3/search');
      searchUrl.searchParams.set('part', 'snippet');
      searchUrl.searchParams.set('q', searchQuery);
      searchUrl.searchParams.set('type', 'video');
      searchUrl.searchParams.set('maxResults', '1');
      searchUrl.searchParams.set('videoEmbeddable', 'true');
      searchUrl.searchParams.set('key', YOUTUBE_API_KEY);

      const response = await fetch(searchUrl.toString());

      if (!response.ok) {
        throw new Error('YouTube API error');
      }

      const data = await response.json();

      if (data.items && data.items.length > 0) {
        const video = data.items[0];
        setVideoModal(prev => ({
          ...prev,
          loading: false,
          videoId: video.id.videoId,
          title: video.snippet.title || searchQuery
        }));
      } else {
        setVideoModal(prev => ({
          ...prev,
          loading: false,
          error: 'No videos found'
        }));
      }
    } catch (err) {
      console.error('YouTube search error:', err);
      setVideoModal(prev => ({
        ...prev,
        loading: false,
        error: 'Failed to search YouTube'
      }));
    }
  };

  const closeVideoModal = () => {
    setVideoModal({
      show: false,
      loading: false,
      videoId: null,
      title: '',
      searchQuery: '',
      error: null
    });
  };

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
    <div className="h-full flex flex-col overflow-hidden bg-[#0A0A0A]">
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
                  className="h-9 px-4 bg-yellow-500 text-slate-900 font-display font-semibold text-sm uppercase tracking-wide flex items-center justify-center rounded-lg hover:bg-yellow-400 active:bg-yellow-600 transition-all duration-200"
                >
                  Sign In
                </Link>
                <Link
                  to="/register"
                  className="h-9 px-3 border border-yellow-500/50 text-yellow-500 font-display font-semibold text-sm uppercase tracking-wide flex items-center justify-center gap-1.5 rounded-lg hover:bg-yellow-500/10 hover:border-yellow-500 active:bg-yellow-500/20 transition-all duration-200"
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
                className="h-9 px-4 bg-yellow-500 text-slate-900 font-display font-semibold text-sm uppercase tracking-wide flex items-center justify-center rounded-lg hover:bg-yellow-400 active:bg-yellow-600 transition-all duration-200 lg:hidden"
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
      <main className="flex-1 overflow-y-auto min-h-0 pb-20 md:pb-4">
        <div className="max-w-[1920px] mx-auto p-4 lg:p-6">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

          {/* ============================================================= */}
          {/* MAIN COLUMN - News Feed (8 cols) */}
          {/* ============================================================= */}
          <div className="lg:col-span-8">
            {/* Dynamic News Feed powered by Gemini AI */}
            <NewsFeed maxItems={5} />
          </div>

          {/* ============================================================= */}
          {/* SIDEBAR - Right Column (4 cols, sticky) */}
          {/* ============================================================= */}
          <div className="lg:col-span-4">
            <div className="lg:sticky lg:top-4 space-y-5">

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

                  {/* Quick Links */}
                  <div className="p-2">
                    <Link
                      to="/dashboard"
                      className="flex items-center gap-3 px-3 py-2.5 rounded-sm hover:bg-white/[0.05] transition-colors group"
                    >
                      <LayoutDashboard className="w-4 h-4 text-[#0057B8]" />
                      <span className="text-sm text-white font-medium">Dashboard</span>
                      <ChevronRight className="w-4 h-4 text-gray-600 ml-auto group-hover:text-gray-400" />
                    </Link>
                    <Link
                      to="/leagues"
                      className="flex items-center gap-3 px-3 py-2.5 rounded-sm hover:bg-white/[0.05] transition-colors group"
                    >
                      <Award className="w-4 h-4 text-orange-500" />
                      <span className="text-sm text-white font-medium">My Leagues</span>
                      <ChevronRight className="w-4 h-4 text-gray-600 ml-auto group-hover:text-gray-400" />
                    </Link>
                    <Link
                      to="/scores"
                      className="flex items-center gap-3 px-3 py-2.5 rounded-sm hover:bg-white/[0.05] transition-colors group"
                    >
                      <Activity className="w-4 h-4 text-green-500" />
                      <span className="text-sm text-white font-medium">Live Scores</span>
                      <ChevronRight className="w-4 h-4 text-gray-600 ml-auto group-hover:text-gray-400" />
                    </Link>
                    <Link
                      to="/profile"
                      className="flex items-center gap-3 px-3 py-2.5 rounded-sm hover:bg-white/[0.05] transition-colors group"
                    >
                      <Settings className="w-4 h-4 text-gray-400" />
                      <span className="text-sm text-white font-medium">Profile & Settings</span>
                      <ChevronRight className="w-4 h-4 text-gray-600 ml-auto group-hover:text-gray-400" />
                    </Link>
                  </div>

                  {/* Sign Out */}
                  <div className="px-4 py-3 border-t border-[#333] bg-[#111]">
                    <button
                      onClick={handleSignOut}
                      className="flex items-center gap-2 text-xs text-gray-500 hover:text-red-400 transition-colors"
                    >
                      <LogOut className="w-3.5 h-3.5" />
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

                    {/* Email Input */}
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                      <input
                        type="email"
                        placeholder="Email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                        disabled={loading}
                        className="w-full h-9 pl-9 pr-3 bg-[#111] border border-[#333] rounded-sm text-sm text-white placeholder-gray-600 focus:outline-none focus:border-[#0057B8] disabled:opacity-50"
                      />
                    </div>

                    {/* Password Input */}
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                      <input
                        type="password"
                        placeholder="Password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                        disabled={loading}
                        className="w-full h-9 pl-9 pr-3 bg-[#111] border border-[#333] rounded-sm text-sm text-white placeholder-gray-600 focus:outline-none focus:border-[#0057B8] disabled:opacity-50"
                      />
                    </div>

                    {/* Actions Row */}
                    <div className="flex gap-2">
                      <button
                        type="submit"
                        disabled={loading}
                        className="flex-1 h-10 bg-[#0057B8] text-white font-bold text-sm uppercase tracking-wider flex items-center justify-center hover:bg-[#0066d6] active:bg-[#004a9e] transition-all duration-150 press-feedback-strong disabled:opacity-50 disabled:cursor-not-allowed rounded-sm"
                      >
                        {loading ? '...' : 'Sign In'}
                      </button>
                      <Link
                        to="/register"
                        className="flex-1 h-10 border border-[#333] text-gray-400 font-bold text-sm uppercase tracking-wider flex items-center justify-center hover:border-[#444] hover:text-white transition-all rounded-sm"
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

              {/* ------------------------------------------------------- */}
              {/* FANTASY TRENDING MODULE */}
              {/* ------------------------------------------------------- */}
              <div className="bg-[#1a1a1a] border border-[#333] rounded-sm">
                {/* Header */}
                <div className="bg-[#222] px-4 py-3 border-b border-[#333] flex items-center justify-between">
                  <h3 className="text-[10px] font-bold text-orange-400 uppercase tracking-wider flex items-center gap-2">
                    <Flame className="w-3.5 h-3.5" />
                    Fantasy Trending
                  </h3>
                  <span className="text-[10px] font-data text-gray-500">{tickerData?.dayLabel || '24h'}</span>
                </div>

                {/* Trending List */}
                <div className="divide-y divide-[#333]/50">
                  {tickerLoading ? (
                    // Loading state
                    <div className="px-3 py-6 text-center">
                      <div className="inline-block w-5 h-5 border-2 border-orange-400/30 border-t-orange-400 rounded-full animate-spin" />
                    </div>
                  ) : trendingPlayers.length > 0 ? (
                    // Data available - show trending players
                    trendingPlayers.map((player, idx) => (
                      <div key={idx} className="flex items-center justify-between px-4 py-2.5 hover:bg-white/[0.02] transition-colors">
                        <div className="flex items-center gap-2">
                          <span className="w-5 h-5 flex items-center justify-center text-xs font-bold font-data text-gray-500 tabular-nums">
                            {idx + 1}
                          </span>
                          <span className="text-sm text-white truncate max-w-[160px]">{player.name}</span>
                        </div>
                        <div className={`flex items-center gap-1 text-sm font-bold font-data tabular-nums ${
                          player.direction === 'up' ? 'text-green-500' : 'text-red-500'
                        }`}>
                          {player.direction === 'up' ? (
                            <TrendingUp className="w-3.5 h-3.5" />
                          ) : (
                            <TrendingDown className="w-3.5 h-3.5" />
                          )}
                          {player.change}
                        </div>
                      </div>
                    ))
                  ) : (
                    // No data available
                    <div className="px-3 py-4 text-center">
                      <p className="text-xs text-gray-500">No trending data available</p>
                    </div>
                  )}
                </div>

                {/* Footer */}
                <div className="px-4 py-3 border-t border-[#333] bg-[#111]">
                  <Link
                    to="/scores"
                    className="text-[10px] text-orange-400 hover:text-orange-300 font-bold uppercase tracking-wider transition-colors flex items-center gap-1"
                  >
                    View All Trends
                    <ChevronRight className="w-3 h-3" />
                  </Link>
                </div>
              </div>

              {/* ------------------------------------------------------- */}
              {/* LIVE SCORE TICKER */}
              {/* ------------------------------------------------------- */}
              <div className="bg-[#1a1a1a] border border-[#333] rounded-sm">
                {/* Header */}
                <div className="bg-[#222] px-4 py-3 border-b border-[#333] flex items-center justify-between">
                  <h3 className="text-[10px] font-bold text-gray-400 uppercase tracking-wider flex items-center gap-2">
                    <Activity className="w-3.5 h-3.5 text-[#0057B8]" />
                    Live Scores
                  </h3>
                  <div className="flex items-center gap-1.5">
                    {hasScoresData && (
                      <>
                        <div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
                        <span className="text-[10px] font-data text-gray-500">Day {displayDay}</span>
                      </>
                    )}
                  </div>
                </div>

                {/* Score List - Shows all 12 corps */}
                <div className="divide-y divide-[#333]/50">
                  {scoresLoading ? (
                    <div className="px-3 py-6 text-center">
                      <div className="inline-block w-5 h-5 border-2 border-[#0057B8]/30 border-t-[#0057B8] rounded-full animate-spin" />
                    </div>
                  ) : hasScoresData ? (
                    liveScores.slice(0, 12).map((row) => {
                      const changeValue = row.change;
                      const hasChange = changeValue !== null;
                      const changeDisplay = hasChange
                        ? `${changeValue >= 0 ? '+' : ''}${changeValue.toFixed(1)}`
                        : '—';

                      return (
                        <div
                          key={`${row.sourceYear}-${row.corpsName}`}
                          className="flex items-center justify-between px-4 py-2 hover:bg-white/[0.02] transition-colors"
                        >
                          <div className="flex items-center gap-2.5">
                            <span className="w-5 h-5 flex items-center justify-center bg-[#222] text-xs font-bold font-data text-gray-500 tabular-nums rounded-sm">
                              {row.rank}
                            </span>
                            <span className="text-sm text-white truncate max-w-[140px]" title={`${row.sourceYear} ${row.corpsName}`}>
                              <span className="text-gray-400 font-data">{row.sourceYear}</span> {row.corpsName}
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-bold font-data text-white tabular-nums">
                              {row.score.toFixed(3)}
                            </span>
                            <span className={`flex items-center gap-0.5 text-xs font-bold font-data tabular-nums w-12 justify-end ${
                              row.direction === 'up' ? 'text-green-500' :
                              row.direction === 'down' ? 'text-red-500' : 'text-gray-500'
                            }`}>
                              {row.direction === 'up' && <TrendingUp className="w-3 h-3" />}
                              {row.direction === 'down' && <TrendingDown className="w-3 h-3" />}
                              {changeDisplay}
                            </span>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleYoutubeSearch(row.sourceYear, row.corpsName);
                              }}
                              className="p-1 text-gray-500 hover:text-red-500 transition-colors"
                              title={`Watch ${row.sourceYear} ${row.corpsName} on YouTube`}
                            >
                              <Youtube className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <div className="px-3 py-4 text-center">
                      <p className="text-xs text-gray-500">No scores available yet</p>
                    </div>
                  )}
                </div>

                {/* Footer */}
                <div className="px-4 py-3 border-t border-[#333] bg-[#111]">
                  <button
                    onClick={() => setShowStandingsModal(true)}
                    className="text-[10px] text-[#0057B8] hover:text-[#0066d6] font-bold uppercase tracking-wider transition-colors flex items-center gap-1"
                  >
                    Full Standings
                    <ChevronRight className="w-3 h-3" />
                  </button>
                </div>
              </div>

            </div>
          </div>
          </div>
        </div>
      </main>

      {/* ============================================================= */}
      {/* FULL STANDINGS MODAL */}
      {/* ============================================================= */}
      {showStandingsModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/80"
            onClick={() => setShowStandingsModal(false)}
          />

          {/* Modal Content */}
          <div className="relative w-full max-w-md bg-[#1a1a1a] border border-[#333] rounded-sm max-h-[85vh] flex flex-col">
            {/* Header */}
            <div className="bg-[#222] px-4 py-3 border-b border-[#333] flex items-center justify-between flex-shrink-0">
              <div>
                <h2 className="text-xs font-bold text-gray-300 uppercase tracking-wider flex items-center gap-2">
                  <Activity className="w-4 h-4 text-[#0057B8]" />
                  Full Standings
                </h2>
                {displayDay && (
                  <p className="text-[10px] font-data text-gray-500 mt-0.5">Season Day {displayDay}</p>
                )}
              </div>
              <button
                onClick={() => setShowStandingsModal(false)}
                className="p-1.5 text-gray-400 hover:text-white hover:bg-white/10 rounded transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Standings List */}
            <div className="flex-1 overflow-y-auto">
              <div className="divide-y divide-[#333]/50">
                {liveScores.map((row) => {
                  const changeValue = row.change;
                  const hasChange = changeValue !== null;
                  const changeDisplay = hasChange
                    ? `${changeValue >= 0 ? '+' : ''}${changeValue.toFixed(1)}`
                    : '—';

                  return (
                    <div
                      key={`modal-${row.sourceYear}-${row.corpsName}`}
                      className="flex items-center justify-between px-4 py-2.5 hover:bg-white/[0.02] transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <span className={`w-6 h-6 flex items-center justify-center text-xs font-bold font-data tabular-nums rounded-sm ${
                          row.rank <= 3 ? 'bg-[#0057B8] text-white' : 'bg-[#222] text-gray-500'
                        }`}>
                          {row.rank}
                        </span>
                        <div className="min-w-0">
                          <span className="text-sm text-white block truncate max-w-[180px]" title={`${row.sourceYear} ${row.corpsName}`}>
                            <span className="text-gray-400 font-data">{row.sourceYear}</span> {row.corpsName}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-sm font-bold font-data text-white tabular-nums">
                          {row.score.toFixed(3)}
                        </span>
                        <span className={`flex items-center gap-0.5 text-xs font-bold font-data tabular-nums w-12 justify-end ${
                          row.direction === 'up' ? 'text-green-500' :
                          row.direction === 'down' ? 'text-red-500' : 'text-gray-500'
                        }`}>
                          {row.direction === 'up' && <TrendingUp className="w-3 h-3" />}
                          {row.direction === 'down' && <TrendingDown className="w-3 h-3" />}
                          {changeDisplay}
                        </span>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleYoutubeSearch(row.sourceYear, row.corpsName);
                          }}
                          className="p-1 text-gray-500 hover:text-red-500 transition-colors"
                          title={`Watch ${row.sourceYear} ${row.corpsName} on YouTube`}
                        >
                          <Youtube className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Footer */}
            <div className="px-4 py-3 border-t border-[#333] bg-[#111] flex-shrink-0">
              <p className="text-[10px] font-data text-gray-500 text-center">
                {liveScores.length} of 25 corps with scores
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================= */}
      {/* YOUTUBE VIDEO MODAL */}
      {/* ============================================================= */}
      {videoModal.show && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/90"
            onClick={closeVideoModal}
          />

          {/* Modal Content - 720p aspect ratio (1280x720) */}
          <div className="relative w-full max-w-4xl bg-[#0A0A0A] border border-[#333] rounded-sm">
            {/* Header */}
            <div className="bg-[#1a1a1a] px-4 py-3 border-b border-[#333] flex items-center justify-between">
              <div className="flex items-center gap-2 min-w-0 flex-1">
                <Youtube className="w-5 h-5 text-red-500 flex-shrink-0" />
                <h2 className="text-sm font-bold text-white truncate">
                  {videoModal.title}
                </h2>
              </div>
              <button
                onClick={closeVideoModal}
                className="p-1.5 text-gray-400 hover:text-white hover:bg-white/10 rounded transition-colors flex-shrink-0 ml-2"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Video Container - 16:9 aspect ratio for 720p */}
            <div className="relative w-full bg-black" style={{ paddingBottom: '56.25%' }}>
              {videoModal.loading ? (
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <Loader2 className="w-12 h-12 text-red-500 animate-spin mb-4" />
                  <p className="text-gray-400 text-sm">Searching YouTube...</p>
                </div>
              ) : videoModal.error ? (
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <Youtube className="w-16 h-16 text-gray-600 mb-4" />
                  <p className="text-gray-400 text-sm mb-4">{videoModal.error}</p>
                  <a
                    href={`https://www.youtube.com/results?search_query=${encodeURIComponent(videoModal.searchQuery)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-500 text-white text-xs font-bold uppercase tracking-wider rounded transition-colors"
                  >
                    <Youtube className="w-4 h-4" />
                    Search on YouTube
                  </a>
                </div>
              ) : videoModal.videoId ? (
                <iframe
                  className="absolute inset-0 w-full h-full"
                  src={`https://www.youtube-nocookie.com/embed/${videoModal.videoId}?autoplay=1&vq=hd720&rel=0`}
                  title={videoModal.title}
                  frameBorder="0"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                  allowFullScreen
                />
              ) : null}
            </div>

            {/* Footer with YouTube link */}
            <div className="px-4 py-3 border-t border-[#333] bg-[#111] flex items-center justify-between">
              <p className="text-[10px] text-gray-500 truncate flex-1 mr-2">
                Search: "{videoModal.searchQuery}"
              </p>
              <a
                href={`https://www.youtube.com/results?search_query=${encodeURIComponent(videoModal.searchQuery)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[10px] text-red-500 hover:text-red-400 font-bold uppercase tracking-wider transition-colors flex items-center gap-1 flex-shrink-0"
              >
                More Results
                <ChevronRight className="w-3 h-3" />
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Landing;
