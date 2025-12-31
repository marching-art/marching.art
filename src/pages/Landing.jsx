// =============================================================================
// LANDING PAGE - NEWS & DATA HUB
// =============================================================================
// Three-column layout: News Feed | Live Data | Auth Widget
// Laws: No marketing fluff, no parallax, no testimonials

import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Trophy, Lock, Mail, AlertCircle, TrendingUp,
  TrendingDown, Flame, ChevronRight, Users,
  Calendar, Activity, LayoutDashboard, Award, User, LogOut,
  Settings, Zap
} from 'lucide-react';
import { useAuth } from '../App';
import toast from 'react-hot-toast';
import { useProfileStore } from '../store/profileStore';
import NewsFeed from '../components/Landing/NewsFeed';
import { useBodyScroll } from '../hooks/useBodyScroll';

// =============================================================================
// SIDEBAR DATA (Live Scores & Trending)
// =============================================================================

const LIVE_SCORES = [
  { rank: 1, corps: 'Blue Devils', score: 97.850, change: '+0.2' },
  { rank: 2, corps: 'Bluecoats', score: 96.425, change: '+0.4' },
  { rank: 3, corps: 'Carolina Crown', score: 95.900, change: '-0.1' },
  { rank: 4, corps: 'Santa Clara Vanguard', score: 95.275, change: '+0.3' },
  { rank: 5, corps: 'The Cadets', score: 94.650, change: '—' },
  { rank: 6, corps: 'Boston Crusaders', score: 93.800, change: '+0.5' },
  { rank: 7, corps: 'Phantom Regiment', score: 92.150, change: '-0.2' },
  { rank: 8, corps: 'Blue Knights', score: 91.425, change: '+0.1' },
];

const TRENDING_PLAYERS = [
  { name: 'Blue Devils Hornline', change: '+15%', direction: 'up' },
  { name: 'Crown Brass', change: '+12%', direction: 'up' },
  { name: 'Bluecoats Percussion', change: '+8%', direction: 'up' },
  { name: 'SCV Guard', change: '-3%', direction: 'down' },
];

// =============================================================================
// LANDING PAGE COMPONENT
// =============================================================================

const Landing = () => {
  useBodyScroll();
  const { user, signIn, signOut } = useAuth();
  const profile = useProfileStore((state) => state.profile);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

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
      {/* TOP BAR */}
      <header className="h-14 bg-[#1a1a1a] border-b border-[#333] flex items-center px-4 lg:px-6">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-sm overflow-hidden">
            <img src="/logo192.webp" alt="marching.art" className="w-full h-full object-cover" />
          </div>
          <span className="text-base font-bold text-white uppercase tracking-wider">
            marching.art
          </span>
        </div>
        <div className="ml-auto flex items-center">
          <Link to="/privacy" className="px-3 py-2.5 min-h-touch text-sm text-gray-500 hover:text-gray-300 active:text-white transition-colors press-feedback flex items-center">
            Privacy
          </Link>
          <Link to="/terms" className="px-3 py-2.5 min-h-touch text-sm text-gray-500 hover:text-gray-300 active:text-white transition-colors press-feedback flex items-center">
            Terms
          </Link>
        </div>
      </header>

      {/* MAIN CONTENT - Three Column Layout */}
      <main className="flex-1">
        <div className="min-h-full grid grid-cols-1 lg:grid-cols-12 gap-0">

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
                  <span className="text-xs text-gray-500">24h</span>
                </div>

                {/* Trending List */}
                <div className="divide-y divide-[#333]/50">
                  {TRENDING_PLAYERS.map((player, idx) => (
                    <div key={idx} className="flex items-center justify-between px-3 py-2.5 hover:bg-white/[0.02] transition-colors">
                      <div className="flex items-center gap-2">
                        <span className="w-5 h-5 flex items-center justify-center text-xs font-bold text-gray-500 tabular-nums">
                          {idx + 1}
                        </span>
                        <span className="text-sm text-white">{player.name}</span>
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
                  ))}
                </div>

                {/* Footer */}
                <div className="px-3 py-2 border-t border-[#333] bg-[#1a1a1a]/50">
                  <button className="text-xs text-orange-400 hover:text-orange-300 font-bold transition-colors flex items-center gap-1">
                    View All Trends
                    <ChevronRight className="w-3 h-3" />
                  </button>
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
                    <div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
                    <span className="text-xs text-green-500 font-bold uppercase">Live</span>
                  </div>
                </div>

                {/* Score List */}
                <div className="divide-y divide-[#333]/50 max-h-80 overflow-y-auto scroll-momentum">
                  {LIVE_SCORES.map((row) => (
                    <div
                      key={row.rank}
                      className="flex items-center justify-between px-3 py-2 hover:bg-white/[0.02] transition-colors"
                    >
                      <div className="flex items-center gap-2.5">
                        <span className="w-5 h-5 flex items-center justify-center bg-[#222] text-xs font-bold text-gray-500 tabular-nums rounded-sm">
                          {row.rank}
                        </span>
                        <span className="text-sm text-white truncate max-w-[140px]">{row.corps}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-white tabular-nums">
                          {row.score.toFixed(3)}
                        </span>
                        <span className={`text-xs font-bold tabular-nums w-10 text-right ${
                          row.change.startsWith('+') ? 'text-green-500' :
                          row.change.startsWith('-') ? 'text-red-500' : 'text-gray-500'
                        }`}>
                          {row.change}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Footer */}
                <div className="px-3 py-2 border-t border-[#333] bg-[#1a1a1a]/50">
                  <button className="text-xs text-[#0057B8] hover:text-[#0066d6] font-bold transition-colors flex items-center gap-1">
                    Full Standings
                    <ChevronRight className="w-3 h-3" />
                  </button>
                </div>
              </div>

            </div>
          </div>
        </div>
      </main>

      {/* ============================================================= */}
      {/* GLOBAL FOOTER - Stats Bar */}
      {/* ============================================================= */}
      <footer className="bg-[#1a1a1a] border-t border-[#333]">
        {/* Stats Strip */}
        <div className="flex items-center justify-center gap-8 lg:gap-12 py-3 px-4 border-b border-[#333]">
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-[#0057B8]" />
            <span className="text-sm font-bold text-white tabular-nums">2,847</span>
            <span className="text-xs text-gray-500 uppercase">Directors</span>
          </div>
          <div className="flex items-center gap-2">
            <Trophy className="w-4 h-4 text-[#0057B8]" />
            <span className="text-sm font-bold text-white tabular-nums">156</span>
            <span className="text-xs text-gray-500 uppercase">Leagues</span>
          </div>
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-[#0057B8]" />
            <span className="text-sm font-bold text-white tabular-nums">Week 4</span>
            <span className="text-xs text-gray-500 uppercase">Current</span>
          </div>
        </div>

        {/* Copyright */}
        <div className="flex items-center justify-center py-2.5 px-4">
          <span className="text-xs text-gray-600 text-center">
            © 2025 marching.art — Fantasy Sports for the Marching Arts
          </span>
        </div>
      </footer>
    </div>
  );
};

export default Landing;
