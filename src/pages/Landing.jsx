// =============================================================================
// LANDING PAGE - NEWS & DATA HUB
// =============================================================================
// Three-column layout: News Feed | Live Data | Auth Widget
// Laws: No marketing fluff, no parallax, no testimonials

import React, { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  Trophy, Lock, Mail, AlertCircle, TrendingUp,
  TrendingDown, Flame, ChevronRight,
  Activity, LayoutDashboard, Award, User, LogOut,
  Settings, Zap, UserPlus, MessageCircle
} from 'lucide-react';
import { useAuth } from '../App';
import toast from 'react-hot-toast';
import { useProfileStore } from '../store/profileStore';
import NewsFeed from '../components/Landing/NewsFeed';
import { useBodyScroll } from '../hooks/useBodyScroll';
import { useTickerData } from '../hooks/useTickerData';
import { useLandingScores } from '../hooks/useLandingScores';


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
    <div className="min-h-screen bg-[#0a0a0a] flex flex-col">
      {/* TOP BAR - Full width with centered content */}
      <header className="h-14 bg-[#1a1a1a] border-b border-[#333]">
        <div className="max-w-7xl mx-auto h-full flex items-center px-4 lg:px-6 xl:px-8">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-sm overflow-hidden">
              <img src="/logo192.svg" alt="marching.art" className="w-full h-full object-cover" />
            </div>
            <span className="text-base font-bold text-white uppercase tracking-wider">
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

      {/* MAIN CONTENT - Centered container with white space on sides */}
      <main className="flex-1 overflow-visible">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-0 bg-[#111] lg:bg-transparent">

          {/* ============================================================= */}
          {/* MAIN COLUMN - News Feed (Left/Center) */}
          {/* ============================================================= */}
          <div className="lg:col-span-7 xl:col-span-8 lg:border-r border-[#333]">
            <div className="p-4 lg:p-6 xl:p-8">
              {/* Dynamic News Feed powered by Gemini AI */}
              <NewsFeed maxItems={5} />
            </div>
          </div>

          {/* ============================================================= */}
          {/* SIDEBAR - Right Column */}
          {/* ============================================================= */}
          <div className="lg:col-span-5 xl:col-span-4 bg-[#111]">
            <div className="p-4 lg:p-5 space-y-5">

              {/* ------------------------------------------------------- */}
              {/* AUTH WIDGET - Login or User Dashboard */}
              {/* ------------------------------------------------------- */}
              {user ? (
                /* AUTHENTICATED USER WIDGET */
                <div className="bg-[#1a1a1a] border border-[#333] rounded-sm">
                  {/* User Header */}
                  <div className="bg-[#222] px-3 py-2.5 border-b border-[#333]">
                    <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider flex items-center gap-2">
                      <User className="w-3.5 h-3.5 text-[#0057B8]" />
                      My Fantasy
                    </h3>
                  </div>

                  {/* User Info */}
                  <div className="p-3 border-b border-[#333]">
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
                      <div className="flex items-center gap-4 mt-3 pt-3 border-t border-[#333]/50">
                        <div className="flex items-center gap-1.5">
                          <Zap className="w-3.5 h-3.5 text-yellow-500" />
                          <span className="text-xs text-gray-400">Level</span>
                          <span className="text-sm font-bold text-white">{profile.level || 1}</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <Trophy className="w-3.5 h-3.5 text-[#0057B8]" />
                          <span className="text-xs text-gray-400">XP</span>
                          <span className="text-sm font-bold text-white tabular-nums">{profile.xp?.toLocaleString() || 0}</span>
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
                  <div className="px-3 py-2 border-t border-[#333]">
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
                  <div className="bg-[#222] px-3 py-2.5 border-b border-[#333]">
                    <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider flex items-center gap-2">
                      <Lock className="w-3.5 h-3.5" />
                      Director Login
                    </h3>
                  </div>

                  {/* Card Body - Compact Form */}
                  <form onSubmit={handleSubmit} className="p-3 space-y-3">
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
                        className="w-full h-10 pl-9 pr-3 bg-[#0a0a0a] border border-[#333] rounded-sm text-sm text-white placeholder-gray-600 focus:outline-none focus:border-[#0057B8] disabled:opacity-50"
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
                        className="w-full h-10 pl-9 pr-3 bg-[#0a0a0a] border border-[#333] rounded-sm text-sm text-white placeholder-gray-600 focus:outline-none focus:border-[#0057B8] disabled:opacity-50"
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
                <div className="bg-[#222] px-3 py-2.5 border-b border-[#333] flex items-center justify-between">
                  <h3 className="text-xs font-bold text-orange-400 uppercase tracking-wider flex items-center gap-2">
                    <Flame className="w-3.5 h-3.5" />
                    Fantasy Trending
                  </h3>
                  <span className="text-xs text-gray-500">{tickerData?.dayLabel || '24h'}</span>
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
                      <div key={idx} className="flex items-center justify-between px-3 py-2.5 hover:bg-white/[0.02] transition-colors">
                        <div className="flex items-center gap-2">
                          <span className="w-5 h-5 flex items-center justify-center text-xs font-bold text-gray-500 tabular-nums">
                            {idx + 1}
                          </span>
                          <span className="text-sm text-white truncate max-w-[160px]">{player.name}</span>
                        </div>
                        <div className={`flex items-center gap-1 text-sm font-bold tabular-nums ${
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
                <div className="px-3 py-2 border-t border-[#333] bg-[#1a1a1a]/50">
                  <Link
                    to="/scores"
                    className="text-xs text-orange-400 hover:text-orange-300 font-bold transition-colors flex items-center gap-1"
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
                <div className="bg-[#222] px-3 py-2.5 border-b border-[#333] flex items-center justify-between">
                  <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider flex items-center gap-2">
                    <Activity className="w-3.5 h-3.5 text-[#0057B8]" />
                    Live Scores
                  </h3>
                  <div className="flex items-center gap-1.5">
                    {hasScoresData && (
                      <>
                        <div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
                        <span className="text-xs text-gray-500">Day {displayDay}</span>
                      </>
                    )}
                  </div>
                </div>

                {/* Score List */}
                <div className="divide-y divide-[#333]/50 max-h-80 overflow-y-auto scroll-momentum">
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
                          className="flex items-center justify-between px-3 py-2 hover:bg-white/[0.02] transition-colors"
                        >
                          <div className="flex items-center gap-2.5">
                            <span className="w-5 h-5 flex items-center justify-center bg-[#222] text-xs font-bold text-gray-500 tabular-nums rounded-sm">
                              {row.rank}
                            </span>
                            <span className="text-sm text-white truncate max-w-[140px]" title={`${row.sourceYear} ${row.corpsName}`}>
                              <span className="text-gray-400">{row.sourceYear}</span> {row.corpsName}
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-bold text-white tabular-nums">
                              {row.score.toFixed(3)}
                            </span>
                            <span className={`flex items-center gap-0.5 text-xs font-bold tabular-nums w-12 justify-end ${
                              row.direction === 'up' ? 'text-green-500' :
                              row.direction === 'down' ? 'text-red-500' : 'text-gray-500'
                            }`}>
                              {row.direction === 'up' && <TrendingUp className="w-3 h-3" />}
                              {row.direction === 'down' && <TrendingDown className="w-3 h-3" />}
                              {changeDisplay}
                            </span>
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
                <div className="px-3 py-2 border-t border-[#333] bg-[#1a1a1a]/50">
                  <Link
                    to="/scores"
                    className="text-xs text-[#0057B8] hover:text-[#0066d6] font-bold transition-colors flex items-center gap-1"
                  >
                    Full Standings
                    <ChevronRight className="w-3 h-3" />
                  </Link>
                </div>
              </div>

            </div>
          </div>
          </div>
        </div>
      </main>

      {/* ============================================================= */}
      {/* GLOBAL FOOTER - Full width with centered content */}
      {/* ============================================================= */}
      <footer className="bg-[#1a1a1a] border-t border-[#333]">
        <div className="max-w-7xl mx-auto flex items-center justify-center py-2.5 px-4">
          <span className="text-xs text-gray-600 text-center">
            © 2025 marching.art — Fantasy Sports for the Marching Arts
          </span>
        </div>
      </footer>
    </div>
  );
};

export default Landing;
