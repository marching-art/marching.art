// =============================================================================
// MOBILE NAV COMPONENT (TypeScript)
// =============================================================================
// Mobile slide-out navigation menu

import React, { useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { motion, AnimatePresence, Variants } from 'framer-motion';
import {
  Home, Trophy, Calendar, User, Settings, LogOut,
  Users, Award, HelpCircle, X, Menu, Bell, Star,
  ShoppingCart, Crown, Sun, Moon, LucideIcon
} from 'lucide-react';
import { useAuth } from '../App';
import { useTheme } from '../context/ThemeContext';

// =============================================================================
// TYPES
// =============================================================================

export interface MobileNavProps {
  isOpen: boolean;
  setIsOpen: (isOpen: boolean) => void;
}

interface NavItem {
  path: string;
  label: string;
  icon: LucideIcon;
}

interface NavSection {
  title: string;
  items: NavItem[];
}

// =============================================================================
// CONSTANTS
// =============================================================================

const navSections: NavSection[] = [
  {
    title: 'Main',
    items: [
      { path: '/dashboard', label: 'Dashboard', icon: Home },
      { path: '/schedule', label: 'Schedule', icon: Calendar },
      { path: '/scores', label: 'Scores & Rankings', icon: Trophy },
    ],
  },
  {
    title: 'Manage',
    items: [
      { path: '/staff', label: 'Staff Market', icon: ShoppingCart },
      { path: '/battlepass', label: 'Battle Pass', icon: Crown },
    ],
  },
  {
    title: 'Community',
    items: [
      { path: '/leagues', label: 'Leagues', icon: Users },
      { path: '/hall-of-champions', label: 'Hall of Champions', icon: Award },
    ],
  },
  {
    title: 'Account',
    items: [
      { path: '/profile', label: 'Profile', icon: User },
      { path: '/settings', label: 'Settings', icon: Settings },
      { path: '/how-to-play', label: 'How to Play', icon: HelpCircle },
    ],
  },
];

const menuVariants: Variants = {
  closed: {
    x: '100%',
    transition: {
      type: 'tween',
      duration: 0.3,
    },
  },
  open: {
    x: 0,
    transition: {
      type: 'tween',
      duration: 0.3,
    },
  },
};

const overlayVariants: Variants = {
  closed: {
    opacity: 0,
  },
  open: {
    opacity: 1,
  },
};

// =============================================================================
// COMPONENT
// =============================================================================

const MobileNav: React.FC<MobileNavProps> = ({ isOpen, setIsOpen }) => {
  const location = useLocation();
  const { user, signOut } = useAuth();
  const { toggleTheme, isDark } = useTheme();

  // Close menu on route change
  useEffect(() => {
    setIsOpen(false);
  }, [location, setIsOpen]);

  // Prevent body scroll when menu is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }

    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  return (
    <>
      {/* Mobile Header */}
      <header
        className="fixed top-0 left-0 right-0 h-16 backdrop-blur-lg z-40 lg:hidden bg-brown-900 border-b border-gold-400/30"
      >
        <div className="flex items-center justify-between h-full px-4">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg overflow-hidden flex items-center justify-center bg-brown-800">
              <img src="/logo192.webp" alt="marching.art logo" className="w-full h-full object-cover" />
            </div>
            <h1 className="text-lg font-oswald font-bold text-gradient">
              marching.art
            </h1>
          </Link>

          {/* Right Actions */}
          <div className="flex items-center gap-2">
            {/* Notifications */}
            <button className="relative p-2 rounded-lg hover:bg-brown-800 transition-colors">
              <Bell className="w-5 h-5 text-cream-200" />
              <span className="absolute top-1 right-1 w-2 h-2 bg-gold-500 rounded-full animate-pulse" />
            </button>

            {/* Menu Toggle */}
            <button
              onClick={() => setIsOpen(!isOpen)}
              className="p-2 rounded-lg hover:bg-brown-800 transition-colors"
              aria-label="Toggle menu"
            >
              {isOpen ? (
                <X className="w-6 h-6 text-cream-200" />
              ) : (
                <Menu className="w-6 h-6 text-cream-200" />
              )}
            </button>
          </div>
        </div>
      </header>

      {/* Spacer for fixed header */}
      <div className="h-16 lg:hidden" />

      {/* Mobile Menu Overlay */}
      <AnimatePresence>
        {isOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              initial="closed"
              animate="open"
              exit="closed"
              variants={overlayVariants}
              transition={{ duration: 0.3 }}
              onClick={() => setIsOpen(false)}
              className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40 lg:hidden"
              style={{ pointerEvents: isOpen ? 'auto' : 'none' }}
            />

            {/* Menu Panel */}
            <motion.nav
              initial="closed"
              animate="open"
              exit="closed"
              variants={menuVariants}
              className="fixed right-0 top-0 bottom-0 w-80 max-w-[85vw] backdrop-blur-lg z-50 lg:hidden overflow-y-auto bg-brown-900 border-l border-gold-400"
            >
              <div className="flex flex-col h-full">
                {/* Menu Header */}
                <div className="p-6 border-b border-gold-400/30">
                  <div className="flex items-center justify-between">
                    <h2 className="text-xl font-oswald font-bold text-cream-100">
                      Menu
                    </h2>
                    <button
                      onClick={() => setIsOpen(false)}
                      className="p-2 rounded-lg hover:bg-brown-800 transition-colors"
                    >
                      <X className="w-5 h-5 text-cream-200" />
                    </button>
                  </div>
                </div>

                {/* User Info */}
                {user && (
                  <div className="p-6 border-b border-gold-400/30">
                    <div className="flex items-center gap-3">
                      <div className="relative">
                        <div className="w-12 h-12 bg-gold-500 rounded-full flex items-center justify-center">
                          <User className="w-6 h-6 text-brown-900" />
                        </div>
                        <div className="absolute -top-1 -right-1">
                          <Star className="w-4 h-4 text-gold-500" />
                        </div>
                      </div>
                      <div>
                        <p className="font-semibold text-cream-100">
                          Director
                        </p>
                        <p className="text-sm text-cream-200">
                          Level 5 • 2,450 XP
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Navigation Items */}
                <div className="flex-1 py-4">
                  {navSections.map((section) => (
                    <div key={section.title} className="mb-6">
                      <h3 className="px-6 mb-2 text-xs font-oswald font-semibold text-gold-400 uppercase tracking-wider">
                        {section.title}
                      </h3>
                      {section.items.map((item) => {
                        const Icon = item.icon;
                        const isActive = location.pathname === item.path;

                        return (
                          <Link
                            key={item.path}
                            to={item.path}
                            className={`
                              flex items-center gap-3 px-6 py-3 transition-all duration-300
                              ${isActive
                                ? 'bg-gold-500 text-brown-900 font-bold border-r-4 border-gold-600'
                                : 'text-cream-200 hover:bg-brown-800 hover:text-cream-100'
                              }
                            `}
                          >
                            <Icon className={`w-5 h-5 ${isActive ? 'text-brown-900' : ''}`} />
                            <span className="font-medium">{item.label}</span>
                          </Link>
                        );
                      })}
                    </div>
                  ))}
                </div>

                {/* Bottom Actions */}
                <div className="p-6 border-t border-gold-400/30 space-y-3">
                  {/* Theme Toggle */}
                  <button
                    onClick={toggleTheme}
                    className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-lg bg-brown-800 text-gold-400 hover:bg-brown-700 transition-all duration-300"
                  >
                    {isDark ? (
                      <Sun className="w-5 h-5" />
                    ) : (
                      <Moon className="w-5 h-5" />
                    )}
                    <span className="font-medium">
                      {isDark ? 'Light Mode' : 'Dark Mode'}
                    </span>
                  </button>

                  {user ? (
                    <button
                      onClick={signOut}
                      className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-all duration-300"
                    >
                      <LogOut className="w-5 h-5" />
                      <span className="font-medium">Sign Out</span>
                    </button>
                  ) : (
                    <div className="space-y-3">
                      <Link
                        to="/login"
                        className="block w-full text-center px-4 py-3 rounded-lg bg-gold-500 text-brown-900 font-semibold hover:bg-gold-400 transition-all duration-300"
                      >
                        Sign In
                      </Link>
                      <Link
                        to="/register"
                        className="block w-full text-center px-4 py-3 rounded-lg border border-gold-500 text-gold-400 font-semibold hover:bg-gold-500/10 transition-all duration-300"
                      >
                        Register
                      </Link>
                    </div>
                  )}
                </div>

                {/* Season Info */}
                <div className="p-6 border-t border-gold-400/30 bg-brown-800">
                  <div className="text-center">
                    <p className="text-xs text-gold-400 font-oswald uppercase tracking-wider">Current Season</p>
                    <p className="text-lg font-oswald font-bold text-cream-100 mt-1">
                      2025 Live Season
                    </p>
                    <p className="text-sm text-cream-200 mt-1">
                      Week 3 of 10
                    </p>
                  </div>
                </div>
              </div>
            </motion.nav>
          </>
        )}
      </AnimatePresence>
    </>
  );
};

export default MobileNav;
