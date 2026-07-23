// @ts-nocheck -- grandfathered before checkJs; remove when this file is typed or cleaned up
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
    <div className="bg-surface-card border border-line rounded-none">
      {/* User Header */}
      <div className="bg-surface-raised px-4 py-3 border-b border-line">
        <h3 className="text-[10px] font-bold text-muted uppercase tracking-wider flex items-center gap-2">
          <User className="w-3.5 h-3.5 text-interactive" />
          My Fantasy
        </h3>
      </div>

      {/* User Info */}
      <div className="p-4 border-b border-line">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-interactive flex items-center justify-center text-white font-bold text-sm">
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
          <div className="grid grid-cols-2 gap-x-4 gap-y-2 mt-3 pt-3 border-t border-line/50">
            <div className="flex items-center gap-1.5">
              <Zap className="w-3.5 h-3.5 text-purple-500" />
              <span className="text-xs text-muted">Level</span>
              <span className="text-sm font-bold text-white">{profile.xpLevel || 1}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Trophy className="w-3.5 h-3.5 text-interactive" />
              <span className="text-xs text-muted">XP</span>
              <span className="text-sm font-bold text-white font-data tabular-nums">
                {profile.xp?.toLocaleString() || 0}
              </span>
            </div>
            {profile.engagement?.loginStreak > 0 && (
              <div className="flex items-center gap-1.5">
                <Flame className="w-3.5 h-3.5 text-orange-500" />
                <span className="text-xs text-muted">Streak</span>
                <span className="text-sm font-bold text-orange-500 font-data tabular-nums">
                  {profile.engagement.loginStreak}
                </span>
              </div>
            )}
            <div className="flex items-center gap-1.5">
              <Coins className="w-3.5 h-3.5 text-brand" />
              <span className="text-xs text-muted">Coins</span>
              <span className="text-sm font-bold text-brand font-data tabular-nums">
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
          <LayoutDashboard className="w-4 h-4 text-interactive" />
          <span className="text-sm text-white font-medium">Dashboard</span>
          <ChevronRight className="w-4 h-4 text-muted ml-auto group-hover:text-muted" />
        </Link>
        <Link
          to="/leagues"
          className="flex items-center gap-3 px-3 py-2.5 rounded-none hover:bg-white/[0.05] transition-colors group"
        >
          <Award className="w-4 h-4 text-orange-500" />
          <span className="text-sm text-white font-medium">My Leagues</span>
          <ChevronRight className="w-4 h-4 text-muted ml-auto group-hover:text-muted" />
        </Link>
        <Link
          to="/scores"
          className="flex items-center gap-3 px-3 py-2.5 rounded-none hover:bg-white/[0.05] transition-colors group"
        >
          <Activity className="w-4 h-4 text-green-500" />
          <span className="text-sm text-white font-medium">Live Scores</span>
          <ChevronRight className="w-4 h-4 text-muted ml-auto group-hover:text-muted" />
        </Link>
        <Link
          to="/profile"
          className="flex items-center gap-3 px-3 py-2.5 rounded-none hover:bg-white/[0.05] transition-colors group"
        >
          <Settings className="w-4 h-4 text-muted" />
          <span className="text-sm text-white font-medium">Profile & Settings</span>
          <ChevronRight className="w-4 h-4 text-muted ml-auto group-hover:text-muted" />
        </Link>
      </div>

      {/* Sign Out */}
      <div className="px-4 py-3 border-t border-line bg-surface-sunken">
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
    <div className="bg-surface-card border border-line rounded-none">
      {/* Card Header */}
      <div className="bg-surface-raised px-4 py-3 border-b border-line">
        <h3 className="text-[10px] font-bold text-muted uppercase tracking-wider flex items-center gap-2">
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
            className="w-full h-9 pl-9 pr-3 bg-surface-sunken border border-line rounded-none text-sm text-white placeholder-muted focus:outline-none focus:border-interactive disabled:opacity-50"
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
            className="w-full h-9 pl-9 pr-3 bg-surface-sunken border border-line rounded-none text-sm text-white placeholder-muted focus:outline-none focus:border-interactive disabled:opacity-50"
          />
        </div>

        {/* Actions Row */}
        <div className="flex gap-2">
          <button
            type="submit"
            disabled={authLoading}
            className="flex-1 h-10 bg-interactive text-white font-bold text-sm uppercase tracking-wider flex items-center justify-center hover:bg-interactive-hover active:bg-interactive-subtle transition-all duration-150 press-feedback-strong disabled:opacity-50 disabled:cursor-not-allowed rounded-none"
          >
            {authLoading ? '...' : 'Sign In'}
          </button>
          <Link
            to="/register"
            className="flex-1 h-10 border border-line text-muted font-bold text-sm uppercase tracking-wider flex items-center justify-center hover:border-line-strong hover:text-white transition-all rounded-none"
          >
            Register
          </Link>
        </div>

        {/* Footer Links */}
        <div className="flex items-center justify-between text-xs text-muted pt-1">
          <Link to="/forgot-password" className="hover:text-interactive transition-colors">
            Forgot password?
          </Link>
          <span>Free to play</span>
        </div>
      </form>
    </div>
  );
};

export default ArticleSidebarAuth;
