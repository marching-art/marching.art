// =============================================================================
// GAMING HEADER COMPONENT (TypeScript)
// =============================================================================
// Simplified global top navigation bar
// 5 main items: Dashboard, Schedule, Scores, Leagues, Profile

import React, { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  Home, Calendar, Trophy, Users, User,
  Menu, Coins, Zap, Settings, LogOut,
  Shield, X, Star
} from 'lucide-react';
import { useAuth } from '../App';
import { adminHelpers } from '../firebase';
import { useSeasonStore } from '../store/seasonStore';
import { useProfileStore } from '../store/profileStore';
import { motion, AnimatePresence } from 'framer-motion';
import { prefetchRoute } from '../lib/prefetch';

// Class unlock configuration (shared with DirectorCard)
const CLASS_UNLOCK_LEVELS = {
  aClass: 3,
  open: 5,
  world: 10,
};

const CLASS_UNLOCK_COSTS = {
  aClass: 1000,
  open: 2500,
  world: 5000,
};

const CLASS_NAMES: Record<string, string> = {
  aClass: 'A Class',
  open: 'Open Class',
  world: 'World Class',
};

interface NextClassUnlock {
  className: string;
  classKey: string;
  levelRequired: number;
  coinCost: number;
  meetsLevel: boolean;
  canAfford: boolean;
}

function getNextClassUnlock(
  unlockedClasses: string[],
  xpLevel: number,
  corpsCoin: number
): NextClassUnlock | null {
  const classOrder = ['aClass', 'open', 'world'];

  for (const classKey of classOrder) {
    if (!unlockedClasses.includes(classKey)) {
      const levelRequired = CLASS_UNLOCK_LEVELS[classKey as keyof typeof CLASS_UNLOCK_LEVELS];
      const coinCost = CLASS_UNLOCK_COSTS[classKey as keyof typeof CLASS_UNLOCK_COSTS];
      const meetsLevel = xpLevel >= levelRequired;
      const canAfford = corpsCoin >= coinCost;

      return {
        className: CLASS_NAMES[classKey],
        classKey,
        levelRequired,
        coinCost,
        meetsLevel,
        canAfford,
      };
    }
  }

  return null;
}

// =============================================================================
// TYPES
// =============================================================================

interface NavItem {
  path: string;
  label: string;
  icon: React.ElementType;
}

interface UserProfile {
  displayName?: string;
  xpLevel?: number;
  xp?: number;
  corpsCoin?: number;
  avatar?: string;
}

// =============================================================================
// CONSTANTS - Simplified to 5 main items
// =============================================================================

const mainNavItems: NavItem[] = [
  { path: '/dashboard', label: 'Dashboard', icon: Home },
  { path: '/schedule', label: 'Schedule', icon: Calendar },
  { path: '/scores', label: 'Scores', icon: Trophy },
  { path: '/leagues', label: 'Leagues', icon: Users },
  { path: '/profile', label: 'Profile', icon: User },
];

// =============================================================================
// COMPONENT
// =============================================================================

const GamingHeader: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);

  // Use global stores to prevent duplicate Firestore listeners
  const seasonData = useSeasonStore((state) => state.seasonData);
  const profile = useProfileStore((state) => state.profile) as UserProfile | null;
  const getUnlockedClasses = useProfileStore((state) => state.getUnlockedClasses);

  // Calculate next class unlock
  const unlockedClasses = getUnlockedClasses();
  const nextUnlock = profile ? getNextClassUnlock(
    unlockedClasses,
    profile.xpLevel || 1,
    profile.corpsCoin || 0
  ) : null;

  // Handle Buy button click - navigate to dashboard with class to purchase
  const handleBuyClick = () => {
    if (nextUnlock) {
      navigate('/dashboard', { state: { purchaseClass: nextUnlock.classKey } });
    }
  };

  useEffect(() => {
    if (user) {
      // Check admin status
      adminHelpers.isAdmin().then(setIsAdmin);
    }
  }, [user]);

  // Close mobile menu on route change
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [location]);

  // Prevent body scroll when mobile menu is open
  useEffect(() => {
    if (mobileMenuOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [mobileMenuOpen]);

  const handleSignOut = async () => {
    try {
      await signOut();
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  const isActive = (path: string) => {
    if (path === '/profile') {
      return location.pathname.startsWith('/profile');
    }
    if (path === '/scores') {
      return location.pathname.startsWith('/scores');
    }
    return location.pathname === path;
  };

  // Calculate XP progress percentage
  const xpProgress = profile?.xp ? ((profile.xp % 1000) / 1000) * 100 : 0;

  return (
    <>
      {/* Main Header */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-slate-950/80 backdrop-blur-xl border-b border-white/5">
        {/* Subtle golden gradient line at top */}
        <div className="h-px w-full bg-gradient-to-r from-transparent via-yellow-500/30 to-transparent" />

        <div className="h-16 px-4 lg:px-6">
          <div className="flex items-center justify-between h-full max-w-[1920px] mx-auto">
            {/* Left Section - Logo + Brand */}
            <Link to="/dashboard" className="flex items-center gap-2 group">
              <div className="relative flex-shrink-0">
                <div className="w-9 h-9 rounded-sm overflow-hidden transition-all duration-300">
                  <img
                    src="/logo192.svg"
                    alt="marching.art"
                    className="w-full h-full object-cover"
                  />
                </div>
              </div>
              {/* Brand text - visible on all screens */}
              <div className="flex flex-col">
                <h1 className="text-base sm:text-lg font-display font-bold tracking-tight leading-tight">
                  <span className="text-yellow-400">marching</span>
                  <span className="text-yellow-50/90">.art</span>
                </h1>
                {/* Season subtitle - desktop only */}
                <p className="hidden sm:block text-[9px] text-yellow-50/40 uppercase tracking-wider -mt-0.5">
                  {seasonData?.name?.replace(/_/g, ' ') || 'Fantasy Drum Corps'}
                </p>
              </div>
            </Link>

            {/* Center Section - Main Navigation (Desktop) */}
            <nav className="hidden lg:flex items-center gap-1">
              {mainNavItems.map((item) => {
                const Icon = item.icon;
                const active = isActive(item.path);

                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    onMouseEnter={() => prefetchRoute(item.path)}
                    onFocus={() => prefetchRoute(item.path)}
                    className={`
                      relative flex items-center gap-2 px-4 py-2.5 rounded-sm font-display font-semibold text-sm uppercase tracking-wide
                      transition-all duration-300 group
                      ${active
                        ? 'text-yellow-400'
                        : 'text-yellow-50/80 hover:text-yellow-50'
                      }
                    `}
                  >
                    <Icon className={`w-4 h-4 transition-all duration-300 ${active ? 'text-yellow-400 drop-shadow-[0_0_6px_rgba(234,179,8,0.5)]' : 'text-yellow-50/60 group-hover:text-yellow-50/80'}`} />
                    <span className={active ? 'drop-shadow-[0_0_8px_rgba(234,179,8,0.4)]' : ''}>{item.label}</span>
                    {/* Active indicator */}
                    {active && (
                      <motion.div
                        layoutId="activeNav"
                        className="absolute -bottom-1 left-3 right-3 h-[3px] rounded-sm bg-gradient-to-r from-yellow-500/80 via-yellow-400 to-yellow-500/80 shadow-[0_0_12px_rgba(234,179,8,0.6)]"
                        transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                      />
                    )}
                  </Link>
                );
              })}

              {/* Admin Link (Desktop) */}
              {isAdmin && (
                <Link
                  to="/admin"
                  className={`
                    relative flex items-center gap-2 px-4 py-2.5 rounded-sm font-display font-semibold text-sm uppercase tracking-wide
                    transition-all duration-300
                    ${isActive('/admin')
                      ? 'text-yellow-400'
                      : 'text-yellow-50/60 hover:text-yellow-50'
                    }
                  `}
                >
                  <Shield className="w-4 h-4" />
                  <span>Admin</span>
                </Link>
              )}
            </nav>

            {/* Right Section - User Stats */}
            <div className="flex items-center gap-2">
              {/* Stats & Buy Button (Desktop) - Order: Streak, Level, Coins, Buy */}
              {profile && (
                <div className="hidden sm:flex items-center gap-2">
                  <Link
                    to="/profile"
                    className="flex items-center gap-3 px-3 py-1.5 bg-black/50 backdrop-blur-md border border-white/10 rounded-sm hover:border-yellow-500/30 transition-all duration-300"
                  >
                    {/* Streak (if any) */}
                    {(profile as any).engagement?.loginStreak > 0 && (
                      <>
                        <div className="flex items-center gap-1.5">
                          <span className="font-data font-bold text-orange-400 text-sm">
                            {(profile as any).engagement.loginStreak}
                          </span>
                        </div>
                        <div className="w-px h-4 bg-white/20" />
                      </>
                    )}
                    {/* Level */}
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] font-bold uppercase px-2 py-0.5 bg-purple-500/20 text-purple-400 rounded-sm">
                        Lvl {profile.xpLevel || 1}
                      </span>
                    </div>
                    <div className="w-px h-4 bg-white/20" />
                    {/* CorpsCoin */}
                    <div className="flex items-center gap-1.5">
                      <Coins className="w-4 h-4 text-yellow-400" />
                      <span className="font-data font-bold text-yellow-400 text-sm">
                        {(profile.corpsCoin || 0).toLocaleString()}
                      </span>
                    </div>
                  </Link>
                  {/* Buy Button - show when user can afford next class */}
                  {nextUnlock && nextUnlock.canAfford && (
                    <button
                      onClick={handleBuyClick}
                      className={`h-8 px-3 text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 transition-colors ${
                        nextUnlock.meetsLevel
                          ? 'bg-green-600 hover:bg-green-500 text-white'
                          : 'bg-yellow-600 hover:bg-yellow-500 text-white'
                      }`}
                      title={`${nextUnlock.meetsLevel ? 'Unlock' : 'Buy'} ${nextUnlock.className} (${nextUnlock.coinCost.toLocaleString()} CC)`}
                    >
                      <Coins className="w-3 h-3" />
                      {nextUnlock.meetsLevel ? 'Unlock' : 'Buy'}
                    </button>
                  )}
                </div>
              )}

              {/* Mobile Menu Toggle */}
              <button
                onClick={() => setMobileMenuOpen(true)}
                className="lg:hidden p-2 rounded-sm hover:bg-white/10 transition-all duration-300"
                aria-label="Open menu"
              >
                <Menu className="w-6 h-6 text-yellow-50/80" />
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Mobile Menu Overlay */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              onClick={() => setMobileMenuOpen(false)}
              className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 lg:hidden"
            />

            {/* Menu Panel */}
            <motion.nav
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'tween', duration: 0.3 }}
              className="fixed right-0 top-0 bottom-0 w-80 max-w-[85vw] bg-slate-950/95 backdrop-blur-xl border-l border-white/10 z-50 lg:hidden overflow-y-auto"
            >
              {/* Header */}
              <div className="flex items-center justify-between p-4 border-b border-white/10">
                <h2 className="text-xl font-display font-bold text-yellow-50">Menu</h2>
                <button
                  onClick={() => setMobileMenuOpen(false)}
                  className="p-2 rounded-sm hover:bg-white/10 transition-all duration-300"
                >
                  <X className="w-5 h-5 text-yellow-50/80" />
                </button>
              </div>

              {/* User Info - Order: Level, Coins, Buy */}
              {profile && (
                <div className="p-4 border-b border-white/10">
                  <div className="flex items-center gap-3">
                    <div className="relative">
                      <div className="w-12 h-12 bg-gradient-to-br from-yellow-400 to-yellow-600 rounded-sm flex items-center justify-center shadow-[0_0_15px_rgba(234,179,8,0.3)]">
                        <User className="w-6 h-6 text-slate-900" />
                      </div>
                      {(profile.xpLevel ?? 0) >= 10 && (
                        <Star className="absolute -top-1 -right-1 w-4 h-4 text-yellow-400 fill-yellow-400" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-yellow-50 truncate">
                        {profile.displayName || 'Director'}
                      </p>
                      <div className="flex items-center gap-3 mt-1 text-xs">
                        {/* Level first */}
                        <span className="text-[10px] font-bold uppercase px-2 py-0.5 bg-purple-500/20 text-purple-400 rounded-sm">
                          Lvl {profile.xpLevel || 1}
                        </span>
                        {/* CorpsCoin second */}
                        <span className="flex items-center gap-1 text-yellow-400 font-data font-bold">
                          <Coins className="w-3 h-3" />
                          {(profile.corpsCoin || 0).toLocaleString()}
                        </span>
                      </div>
                    </div>
                  </div>
                  {/* Buy Button for mobile */}
                  {nextUnlock && nextUnlock.canAfford && (
                    <button
                      onClick={() => {
                        setMobileMenuOpen(false);
                        handleBuyClick();
                      }}
                      className={`mt-3 w-full h-9 text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-1.5 transition-colors ${
                        nextUnlock.meetsLevel
                          ? 'bg-green-600 hover:bg-green-500 text-white'
                          : 'bg-yellow-600 hover:bg-yellow-500 text-white'
                      }`}
                    >
                      <Coins className="w-3 h-3" />
                      {nextUnlock.meetsLevel ? 'Unlock' : 'Buy'} {nextUnlock.className}
                    </button>
                  )}
                </div>
              )}

              {/* Navigation */}
              <div className="py-4">
                {mainNavItems.map((item) => {
                  const Icon = item.icon;
                  const active = isActive(item.path);
                  return (
                    <Link
                      key={item.path}
                      to={item.path}
                      onMouseEnter={() => prefetchRoute(item.path)}
                      onFocus={() => prefetchRoute(item.path)}
                      className={`
                        flex items-center gap-3 px-4 py-3 transition-all duration-200
                        ${active
                          ? 'text-yellow-400 bg-yellow-500/10 border-l-2 border-yellow-500'
                          : 'text-yellow-50/70 hover:text-yellow-50 hover:bg-white/5 border-l-2 border-transparent'
                        }
                      `}
                    >
                      <Icon className="w-5 h-5" />
                      <span className="font-medium">{item.label}</span>
                    </Link>
                  );
                })}

                {/* Settings is now integrated into Profile page */}

                {/* Admin (if applicable) */}
                {isAdmin && (
                  <Link
                    to="/admin"
                    onMouseEnter={() => prefetchRoute('/admin')}
                    onFocus={() => prefetchRoute('/admin')}
                    className={`
                      flex items-center gap-3 px-4 py-3 transition-all duration-200
                      ${isActive('/admin')
                        ? 'text-yellow-400 bg-yellow-500/10 border-l-2 border-yellow-500'
                        : 'text-yellow-50/70 hover:text-yellow-50 hover:bg-white/5 border-l-2 border-transparent'
                      }
                    `}
                  >
                    <Shield className="w-5 h-5" />
                    <span className="font-medium">Admin Panel</span>
                  </Link>
                )}
              </div>

              {/* Sign Out */}
              <div className="p-4 border-t border-white/10">
                <button
                  onClick={handleSignOut}
                  className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-sm bg-red-500/10 text-red-400 hover:text-red-300 hover:bg-red-500/15 transition-all duration-300"
                >
                  <LogOut className="w-5 h-5" />
                  <span className="font-medium">Sign Out</span>
                </button>
              </div>

              {/* Season Info */}
              {seasonData && (
                <div className="p-4 border-t border-white/10 bg-gradient-to-r from-yellow-500/10 to-transparent">
                  <div className="text-center">
                    <p className="text-xs text-yellow-50/70 uppercase tracking-wider">Current Season</p>
                    <p className="text-lg font-display font-bold text-yellow-400 mt-1 capitalize">
                      {seasonData.name?.replace(/_/g, ' ') || 'No Active Season'}
                    </p>
                  </div>
                </div>
              )}
            </motion.nav>
          </>
        )}
      </AnimatePresence>

      {/* Spacer for fixed header */}
      <div className="h-[68px]" />
    </>
  );
};

export default GamingHeader;
