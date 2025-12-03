// =============================================================================
// GAMING HEADER COMPONENT (TypeScript)
// =============================================================================
// Global top navigation bar with sports gaming aesthetic
// Replaces the sidebar navigation with a persistent header

import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  Home, Calendar, ShoppingCart, Users, Crown,
  User, Menu, ChevronDown, Coins, Zap,
  Trophy, Settings, LogOut, Sun, Moon, HelpCircle,
  Award, Shield, X, Star
} from 'lucide-react';
import { useAuth } from '../App';
import { useTheme } from '../context/ThemeContext';
import { db, adminHelpers } from '../firebase';
import { doc, onSnapshot } from 'firebase/firestore';
import { useSeasonStore } from '../store/seasonStore';
import { motion, AnimatePresence } from 'framer-motion';

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
// CONSTANTS
// =============================================================================

const mainNavItems: NavItem[] = [
  { path: '/dashboard', label: 'Dashboard', icon: Home },
  { path: '/schedule', label: 'Schedule', icon: Calendar },
  { path: '/staff', label: 'Market', icon: ShoppingCart },
  { path: '/leagues', label: 'Leagues', icon: Users },
  { path: '/battlepass', label: 'Season Pass', icon: Crown },
];

const moreNavItems: NavItem[] = [
  { path: '/scores', label: 'Scores', icon: Trophy },
  { path: '/hall-of-champions', label: 'Hall of Champions', icon: Award },
  { path: '/how-to-play', label: 'How to Play', icon: HelpCircle },
];

const accountNavItems: NavItem[] = [
  { path: '/profile', label: 'Profile', icon: User },
  { path: '/settings', label: 'Settings', icon: Settings },
];

// =============================================================================
// COMPONENT
// =============================================================================

const GamingHeader: React.FC = () => {
  const location = useLocation();
  const { user, signOut } = useAuth();
  const { toggleTheme, isDark } = useTheme();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [moreDropdownOpen, setMoreDropdownOpen] = useState(false);
  const [profileDropdownOpen, setProfileDropdownOpen] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);

  // Use global season store
  const seasonData = useSeasonStore((state) => state.seasonData);

  useEffect(() => {
    if (user) {
      // Subscribe to profile updates
      const profileRef = doc(db, 'artifacts/marching-art/users', user.uid, 'profile/data');
      const unsubscribe = onSnapshot(profileRef, (docSnap) => {
        if (docSnap.exists()) {
          setProfile(docSnap.data() as UserProfile);
        }
      });

      // Check admin status
      adminHelpers.isAdmin().then(setIsAdmin);

      return () => unsubscribe();
    }
  }, [user]);

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('.dropdown-container')) {
        setMoreDropdownOpen(false);
        setProfileDropdownOpen(false);
      }
    };

    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, []);

  // Close mobile menu on route change
  useEffect(() => {
    setMobileMenuOpen(false);
    setMoreDropdownOpen(false);
    setProfileDropdownOpen(false);
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

  const isActive = (path: string) => location.pathname === path;

  // Calculate XP progress percentage
  const xpProgress = profile?.xp ? ((profile.xp % 1000) / 1000) * 100 : 0;

  return (
    <>
      {/* Main Header */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-charcoal-950 border-b-2 border-gold-500/30">
        {/* Hazard stripe accent at very top */}
        <div className="h-1 w-full bg-hazard-stripe animate-hazard" />

        <div className="h-16 px-4 lg:px-6">
          <div className="flex items-center justify-between h-full max-w-[1920px] mx-auto">
            {/* Left Section - Logo */}
            <Link to="/dashboard" className="flex items-center gap-3 group">
              <div className="relative">
                <div className="w-10 h-10 rounded overflow-hidden border-2 border-gold-500/50 group-hover:border-gold-500 transition-colors">
                  <img
                    src="/logo192.webp"
                    alt="marching.art"
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="absolute -top-1 -right-1 w-3 h-3 bg-gold-500 rounded-full animate-pulse" />
              </div>
              <div className="hidden sm:block">
                <h1 className="text-xl font-display font-bold tracking-tight">
                  <span className="text-gold-500">marching</span>
                  <span className="text-cream-100">.art</span>
                </h1>
                {seasonData && (
                  <p className="text-[10px] text-cream-500/60 uppercase tracking-wider -mt-1">
                    {seasonData.name?.replace(/_/g, ' ') || 'Fantasy Drum Corps'}
                  </p>
                )}
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
                    className={`
                      relative flex items-center gap-2 px-4 py-2 rounded font-display font-semibold text-sm uppercase tracking-wide
                      transition-all duration-200 group
                      ${active
                        ? 'text-gold-500 bg-gold-500/10'
                        : 'text-cream-300 hover:text-cream-100 hover:bg-cream-500/5'
                      }
                    `}
                  >
                    <Icon className={`w-4 h-4 ${active ? 'text-gold-500' : 'text-cream-500 group-hover:text-cream-300'}`} />
                    <span>{item.label}</span>
                    {active && (
                      <motion.div
                        layoutId="activeNav"
                        className="absolute bottom-0 left-2 right-2 h-0.5 bg-gold-500"
                        transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                      />
                    )}
                    {item.label === 'Season Pass' && (
                      <span className="absolute -top-1 -right-1 w-2 h-2 bg-gold-500 rounded-full animate-pulse" />
                    )}
                  </Link>
                );
              })}

              {/* More Dropdown */}
              <div className="relative dropdown-container">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setMoreDropdownOpen(!moreDropdownOpen);
                    setProfileDropdownOpen(false);
                  }}
                  className={`
                    flex items-center gap-1 px-3 py-2 rounded font-display font-semibold text-sm uppercase tracking-wide
                    transition-all duration-200
                    ${moreDropdownOpen ? 'text-gold-500 bg-gold-500/10' : 'text-cream-400 hover:text-cream-100'}
                  `}
                >
                  <span>More</span>
                  <ChevronDown className={`w-4 h-4 transition-transform ${moreDropdownOpen ? 'rotate-180' : ''}`} />
                </button>

                <AnimatePresence>
                  {moreDropdownOpen && (
                    <motion.div
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      transition={{ duration: 0.15 }}
                      className="absolute top-full right-0 mt-2 w-56 py-2 bg-charcoal-900 border-2 border-gold-500/30 rounded shadow-brutal-gold"
                    >
                      {moreNavItems.map((item) => {
                        const Icon = item.icon;
                        return (
                          <Link
                            key={item.path}
                            to={item.path}
                            className={`
                              flex items-center gap-3 px-4 py-2.5 text-sm font-medium
                              transition-colors
                              ${isActive(item.path)
                                ? 'text-gold-500 bg-gold-500/10'
                                : 'text-cream-300 hover:text-cream-100 hover:bg-cream-500/5'
                              }
                            `}
                          >
                            <Icon className="w-4 h-4" />
                            <span>{item.label}</span>
                          </Link>
                        );
                      })}
                      {isAdmin && (
                        <>
                          <div className="my-2 border-t border-cream-500/10" />
                          <Link
                            to="/admin"
                            className={`
                              flex items-center gap-3 px-4 py-2.5 text-sm font-medium
                              transition-colors
                              ${isActive('/admin')
                                ? 'text-gold-500 bg-gold-500/10'
                                : 'text-cream-300 hover:text-cream-100 hover:bg-cream-500/5'
                              }
                            `}
                          >
                            <Shield className="w-4 h-4" />
                            <span>Admin Panel</span>
                          </Link>
                        </>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </nav>

            {/* Right Section - Player Status */}
            <div className="flex items-center gap-2 sm:gap-4">
              {/* CorpsCoin Balance */}
              {profile && (
                <Link
                  to="/profile"
                  className="hidden sm:flex items-center gap-2 px-3 py-1.5 bg-charcoal-900 border border-gold-500/30 rounded hover:border-gold-500/50 transition-colors group"
                >
                  <Coins className="w-4 h-4 text-gold-500" />
                  <span className="font-data font-bold text-gold-500 text-sm">
                    {(profile.corpsCoin || 0).toLocaleString()}
                  </span>
                </Link>
              )}

              {/* XP Level Badge */}
              {profile && (
                <div className="hidden md:flex items-center gap-2 px-3 py-1.5 bg-charcoal-900 border border-cream-500/20 rounded">
                  <Zap className="w-4 h-4 text-cream-400" />
                  <div className="flex flex-col">
                    <span className="font-data font-bold text-cream-100 text-xs leading-none">
                      LVL {profile.xpLevel || 1}
                    </span>
                    <div className="w-16 h-1 bg-charcoal-700 rounded-full overflow-hidden mt-0.5">
                      <div
                        className="h-full bg-gradient-to-r from-gold-500 to-gold-400 transition-all duration-500"
                        style={{ width: `${xpProgress}%` }}
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Profile Dropdown (Desktop) */}
              <div className="relative dropdown-container hidden lg:block">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setProfileDropdownOpen(!profileDropdownOpen);
                    setMoreDropdownOpen(false);
                  }}
                  className="flex items-center gap-2 p-1 rounded hover:bg-cream-500/5 transition-colors"
                >
                  <div className="relative">
                    <div className="w-9 h-9 bg-gradient-to-br from-gold-500 to-gold-600 rounded flex items-center justify-center border-2 border-gold-500/50">
                      <User className="w-5 h-5 text-charcoal-900" />
                    </div>
                    {(profile?.xpLevel ?? 0) >= 10 && (
                      <Star className="absolute -top-1 -right-1 w-4 h-4 text-gold-500 fill-gold-500" />
                    )}
                  </div>
                  <ChevronDown className={`w-4 h-4 text-cream-400 transition-transform ${profileDropdownOpen ? 'rotate-180' : ''}`} />
                </button>

                <AnimatePresence>
                  {profileDropdownOpen && (
                    <motion.div
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      transition={{ duration: 0.15 }}
                      className="absolute top-full right-0 mt-2 w-64 py-2 bg-charcoal-900 border-2 border-gold-500/30 rounded shadow-brutal-gold"
                    >
                      {/* User Info */}
                      <div className="px-4 py-3 border-b border-cream-500/10">
                        <p className="font-semibold text-cream-100 truncate">
                          {profile?.displayName || 'Director'}
                        </p>
                        <div className="flex items-center gap-4 mt-2 text-xs text-cream-500">
                          <span className="flex items-center gap-1">
                            <Zap className="w-3 h-3 text-gold-500" />
                            Level {profile?.xpLevel || 1}
                          </span>
                          <span className="flex items-center gap-1">
                            <Coins className="w-3 h-3 text-gold-500" />
                            {(profile?.corpsCoin || 0).toLocaleString()}
                          </span>
                        </div>
                      </div>

                      {/* Account Links */}
                      {accountNavItems.map((item) => {
                        const Icon = item.icon;
                        return (
                          <Link
                            key={item.path}
                            to={item.path}
                            className={`
                              flex items-center gap-3 px-4 py-2.5 text-sm font-medium
                              transition-colors
                              ${isActive(item.path)
                                ? 'text-gold-500 bg-gold-500/10'
                                : 'text-cream-300 hover:text-cream-100 hover:bg-cream-500/5'
                              }
                            `}
                          >
                            <Icon className="w-4 h-4" />
                            <span>{item.label}</span>
                          </Link>
                        );
                      })}

                      <div className="my-2 border-t border-cream-500/10" />

                      {/* Theme Toggle */}
                      <button
                        onClick={toggleTheme}
                        className="w-full flex items-center gap-3 px-4 py-2.5 text-sm font-medium text-cream-300 hover:text-cream-100 hover:bg-cream-500/5 transition-colors"
                      >
                        {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
                        <span>{isDark ? 'Light Mode' : 'Dark Mode'}</span>
                      </button>

                      {/* Sign Out */}
                      <button
                        onClick={handleSignOut}
                        className="w-full flex items-center gap-3 px-4 py-2.5 text-sm font-medium text-red-400 hover:text-red-300 hover:bg-red-500/5 transition-colors"
                      >
                        <LogOut className="w-4 h-4" />
                        <span>Sign Out</span>
                      </button>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Mobile Menu Toggle */}
              <button
                onClick={() => setMobileMenuOpen(true)}
                className="lg:hidden p-2 rounded hover:bg-cream-500/10 transition-colors"
                aria-label="Open menu"
              >
                <Menu className="w-6 h-6 text-cream-300" />
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
              className="fixed inset-0 bg-black/60 z-50 lg:hidden"
            />

            {/* Menu Panel */}
            <motion.nav
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'tween', duration: 0.3 }}
              className="fixed right-0 top-0 bottom-0 w-80 max-w-[85vw] bg-charcoal-950 z-50 lg:hidden overflow-y-auto"
            >
              {/* Header */}
              <div className="flex items-center justify-between p-4 border-b border-cream-500/10">
                <h2 className="text-xl font-display font-bold text-cream-100">Menu</h2>
                <button
                  onClick={() => setMobileMenuOpen(false)}
                  className="p-2 rounded hover:bg-cream-500/10 transition-colors"
                >
                  <X className="w-5 h-5 text-cream-300" />
                </button>
              </div>

              {/* User Info */}
              {profile && (
                <div className="p-4 border-b border-cream-500/10">
                  <div className="flex items-center gap-3">
                    <div className="relative">
                      <div className="w-12 h-12 bg-gradient-to-br from-gold-500 to-gold-600 rounded flex items-center justify-center">
                        <User className="w-6 h-6 text-charcoal-900" />
                      </div>
                      {(profile.xpLevel ?? 0) >= 10 && (
                        <Star className="absolute -top-1 -right-1 w-4 h-4 text-gold-500 fill-gold-500" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-cream-100 truncate">
                        {profile.displayName || 'Director'}
                      </p>
                      <div className="flex items-center gap-3 mt-1 text-xs">
                        <span className="flex items-center gap-1 text-cream-500">
                          <Zap className="w-3 h-3 text-gold-500" />
                          Level {profile.xpLevel || 1}
                        </span>
                        <span className="flex items-center gap-1 text-gold-500 font-data font-bold">
                          <Coins className="w-3 h-3" />
                          {(profile.corpsCoin || 0).toLocaleString()}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* XP Progress Bar */}
                  <div className="mt-3">
                    <div className="flex justify-between text-xs text-cream-500 mb-1">
                      <span>XP Progress</span>
                      <span className="font-data">{Math.round(xpProgress)}%</span>
                    </div>
                    <div className="h-2 bg-charcoal-800 rounded overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-gold-500 to-gold-400 transition-all duration-500"
                        style={{ width: `${xpProgress}%` }}
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Navigation Sections */}
              <div className="py-4">
                {/* Main Nav */}
                <div className="mb-4">
                  <h3 className="px-4 mb-2 text-xs font-semibold text-cream-500/40 uppercase tracking-wider">
                    Main
                  </h3>
                  {mainNavItems.map((item) => {
                    const Icon = item.icon;
                    const active = isActive(item.path);
                    return (
                      <Link
                        key={item.path}
                        to={item.path}
                        className={`
                          flex items-center gap-3 px-4 py-3 transition-colors
                          ${active
                            ? 'text-gold-500 bg-gold-500/10 border-l-4 border-gold-500'
                            : 'text-cream-300 hover:text-cream-100 hover:bg-cream-500/5 border-l-4 border-transparent'
                          }
                        `}
                      >
                        <Icon className="w-5 h-5" />
                        <span className="font-medium">{item.label}</span>
                      </Link>
                    );
                  })}
                </div>

                {/* More Nav */}
                <div className="mb-4">
                  <h3 className="px-4 mb-2 text-xs font-semibold text-cream-500/40 uppercase tracking-wider">
                    More
                  </h3>
                  {moreNavItems.map((item) => {
                    const Icon = item.icon;
                    const active = isActive(item.path);
                    return (
                      <Link
                        key={item.path}
                        to={item.path}
                        className={`
                          flex items-center gap-3 px-4 py-3 transition-colors
                          ${active
                            ? 'text-gold-500 bg-gold-500/10 border-l-4 border-gold-500'
                            : 'text-cream-300 hover:text-cream-100 hover:bg-cream-500/5 border-l-4 border-transparent'
                          }
                        `}
                      >
                        <Icon className="w-5 h-5" />
                        <span className="font-medium">{item.label}</span>
                      </Link>
                    );
                  })}
                  {isAdmin && (
                    <Link
                      to="/admin"
                      className={`
                        flex items-center gap-3 px-4 py-3 transition-colors
                        ${isActive('/admin')
                          ? 'text-gold-500 bg-gold-500/10 border-l-4 border-gold-500'
                          : 'text-cream-300 hover:text-cream-100 hover:bg-cream-500/5 border-l-4 border-transparent'
                        }
                      `}
                    >
                      <Shield className="w-5 h-5" />
                      <span className="font-medium">Admin Panel</span>
                    </Link>
                  )}
                </div>

                {/* Account Nav */}
                <div className="mb-4">
                  <h3 className="px-4 mb-2 text-xs font-semibold text-cream-500/40 uppercase tracking-wider">
                    Account
                  </h3>
                  {accountNavItems.map((item) => {
                    const Icon = item.icon;
                    const active = isActive(item.path);
                    return (
                      <Link
                        key={item.path}
                        to={item.path}
                        className={`
                          flex items-center gap-3 px-4 py-3 transition-colors
                          ${active
                            ? 'text-gold-500 bg-gold-500/10 border-l-4 border-gold-500'
                            : 'text-cream-300 hover:text-cream-100 hover:bg-cream-500/5 border-l-4 border-transparent'
                          }
                        `}
                      >
                        <Icon className="w-5 h-5" />
                        <span className="font-medium">{item.label}</span>
                      </Link>
                    );
                  })}
                </div>
              </div>

              {/* Bottom Actions */}
              <div className="p-4 border-t border-cream-500/10 space-y-3">
                {/* Theme Toggle */}
                <button
                  onClick={toggleTheme}
                  className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded bg-cream-500/10 text-cream-300 hover:text-cream-100 transition-colors"
                >
                  {isDark ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
                  <span className="font-medium">{isDark ? 'Light Mode' : 'Dark Mode'}</span>
                </button>

                {/* Sign Out */}
                <button
                  onClick={handleSignOut}
                  className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded bg-red-500/10 text-red-400 hover:text-red-300 transition-colors"
                >
                  <LogOut className="w-5 h-5" />
                  <span className="font-medium">Sign Out</span>
                </button>
              </div>

              {/* Season Info */}
              {seasonData && (
                <div className="p-4 border-t border-cream-500/10 bg-gradient-to-r from-gold-500/10 to-transparent">
                  <div className="text-center">
                    <p className="text-xs text-cream-500/60 uppercase tracking-wider">Current Season</p>
                    <p className="text-lg font-display font-bold text-gold-500 mt-1 capitalize">
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
