// =============================================================================
// ARTICLE SIDEBAR AUTH - Login or User Dashboard widget for the Article page
// =============================================================================
// Shows the authenticated user's fantasy quick stats and links, or a compact
// login/register form for signed-out visitors. Same widget as Landing sidebar.

import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Trophy,
  Flame,
  AlertCircle,
  ChevronRight,
  Lock,
  Mail,
  User,
  LogOut,
  Settings,
  Zap,
  LayoutDashboard,
  Award,
  Activity,
  Coins,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '../../context/AuthContext';
import { useProfileStore } from '../../store/profileStore';

const ArticleSidebarAuth = () => {
  const { user, signIn, signOut } = useAuth();
  const profile = useProfileStore((state) => state.profile);

  // Auth form state
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState('');

  const handleSignOut = async () => {
    try {
      await signOut();
      toast.success('Signed out successfully');
    } catch {
      toast.error('Failed to sign out');
    }
  };

  const handleAuthSubmit = async (e) => {
    e.preventDefault();
    setAuthError('');
    setAuthLoading(true);

    try {
      await signIn(email, password);
      toast.success('Welcome back!');
    } catch (err) {
      console.error('Login error:', err);
      switch (err.code) {
        case 'auth/user-not-found':
          setAuthError('No account found with this email');
          break;
        case 'auth/wrong-password':
          setAuthError('Incorrect password');
          break;
        case 'auth/invalid-email':
          setAuthError('Invalid email address');
          break;
        case 'auth/too-many-requests':
          setAuthError('Too many attempts. Try again later');
          break;
        default:
          setAuthError('Failed to sign in. Please try again');
      }
    } finally {
      setAuthLoading(false);
    }
  };

  return user ? (
    /* AUTHENTICATED USER WIDGET */
    <div className="bg-[#1a1a1a] border border-[#333] rounded-none">
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
            <div className="text-xs text-muted truncate">{user.email}</div>
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
              <span className="text-sm font-bold text-white font-data tabular-nums">
                {profile.xp?.toLocaleString() || 0}
              </span>
            </div>
            {profile.engagement?.loginStreak > 0 && (
              <div className="flex items-center gap-1.5">
                <Flame className="w-3.5 h-3.5 text-orange-500" />
                <span className="text-xs text-gray-400">Streak</span>
                <span className="text-sm font-bold text-orange-500 font-data tabular-nums">
                  {profile.engagement.loginStreak}
                </span>
              </div>
            )}
            <div className="flex items-center gap-1.5">
              <Coins className="w-3.5 h-3.5 text-yellow-500" />
              <span className="text-xs text-gray-400">Coins</span>
              <span className="text-sm font-bold text-yellow-500 font-data tabular-nums">
                {(profile.corpsCoin || 0).toLocaleString()}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Quick Links */}
      <div className="p-2">
        <Link
          to="/dashboard"
          className="flex items-center gap-3 px-3 py-2.5 rounded-none hover:bg-white/[0.05] transition-colors group"
        >
          <LayoutDashboard className="w-4 h-4 text-[#0057B8]" />
          <span className="text-sm text-white font-medium">Dashboard</span>
          <ChevronRight className="w-4 h-4 text-muted ml-auto group-hover:text-gray-400" />
        </Link>
        <Link
          to="/leagues"
          className="flex items-center gap-3 px-3 py-2.5 rounded-none hover:bg-white/[0.05] transition-colors group"
        >
          <Award className="w-4 h-4 text-orange-500" />
          <span className="text-sm text-white font-medium">My Leagues</span>
          <ChevronRight className="w-4 h-4 text-muted ml-auto group-hover:text-gray-400" />
        </Link>
        <Link
          to="/scores"
          className="flex items-center gap-3 px-3 py-2.5 rounded-none hover:bg-white/[0.05] transition-colors group"
        >
          <Activity className="w-4 h-4 text-green-500" />
          <span className="text-sm text-white font-medium">Live Scores</span>
          <ChevronRight className="w-4 h-4 text-muted ml-auto group-hover:text-gray-400" />
        </Link>
        <Link
          to="/profile"
          className="flex items-center gap-3 px-3 py-2.5 rounded-none hover:bg-white/[0.05] transition-colors group"
        >
          <Settings className="w-4 h-4 text-gray-400" />
          <span className="text-sm text-white font-medium">Profile & Settings</span>
          <ChevronRight className="w-4 h-4 text-muted ml-auto group-hover:text-gray-400" />
        </Link>
      </div>

      {/* Sign Out */}
      <div className="px-4 py-3 border-t border-[#333] bg-[#111]">
        <button
          onClick={handleSignOut}
          className="flex items-center gap-2 text-xs text-muted hover:text-red-400 transition-colors"
        >
          <LogOut className="w-3.5 h-3.5" />
          Sign Out
        </button>
      </div>
    </div>
  ) : (
    /* LOGIN/REGISTER WIDGET */
    <div className="bg-[#1a1a1a] border border-[#333] rounded-none">
      {/* Card Header */}
      <div className="bg-[#222] px-4 py-3 border-b border-[#333]">
        <h3 className="text-[10px] font-bold text-gray-400 uppercase tracking-wider flex items-center gap-2">
          <Lock className="w-3.5 h-3.5" />
          Director Login
        </h3>
      </div>

      {/* Card Body - Compact Form */}
      <form onSubmit={handleAuthSubmit} className="p-4 space-y-3">
        {/* Error Message */}
        {authError && (
          <div className="p-2.5 bg-red-500/10 border border-red-500/30 rounded-none flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-red-300">{authError}</p>
          </div>
        )}

        {/* Email Input */}
        <div className="relative">
          <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" />
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            disabled={authLoading}
            className="w-full h-9 pl-9 pr-3 bg-[#111] border border-[#333] rounded-none text-sm text-white placeholder-gray-600 focus:outline-none focus:border-[#0057B8] disabled:opacity-50"
          />
        </div>

        {/* Password Input */}
        <div className="relative">
          <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            disabled={authLoading}
            className="w-full h-9 pl-9 pr-3 bg-[#111] border border-[#333] rounded-none text-sm text-white placeholder-gray-600 focus:outline-none focus:border-[#0057B8] disabled:opacity-50"
          />
        </div>

        {/* Actions Row */}
        <div className="flex gap-2">
          <button
            type="submit"
            disabled={authLoading}
            className="flex-1 h-10 bg-[#0057B8] text-white font-bold text-sm uppercase tracking-wider flex items-center justify-center hover:bg-[#0066d6] active:bg-[#004a9e] transition-all duration-150 press-feedback-strong disabled:opacity-50 disabled:cursor-not-allowed rounded-none"
          >
            {authLoading ? '...' : 'Sign In'}
          </button>
          <Link
            to="/register"
            className="flex-1 h-10 border border-[#333] text-gray-400 font-bold text-sm uppercase tracking-wider flex items-center justify-center hover:border-[#444] hover:text-white transition-all rounded-none"
          >
            Register
          </Link>
        </div>

        {/* Footer Links */}
        <div className="flex items-center justify-between text-xs text-muted pt-1">
          <Link to="/forgot-password" className="hover:text-[#0057B8] transition-colors">
            Forgot password?
          </Link>
          <span>Free to play</span>
        </div>
      </form>
    </div>
  );
};

export default ArticleSidebarAuth;
