// =============================================================================
// COMMAND RAIL COMPONENT
// =============================================================================
// Persistent desktop sidebar navigation with gamified "Night Mode Stadium" aesthetic
// Features: Dark glass, gold accents, distinct active states, tooltips on hover

import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Home,
  Calendar,
  ShoppingCart,
  Trophy,
  Users,
  Crown,
  User,
  Settings,
  Shield,
  ChevronUp,
  ChevronDown,
  Zap
} from 'lucide-react';
import { useAuth } from '../App';
import { adminHelpers } from '../firebase';

// =============================================================================
// TYPES & CONSTANTS
// =============================================================================

const primaryNavItems = [
  {
    path: '/dashboard',
    label: 'Command Center',
    shortLabel: 'Home',
    icon: Home,
    description: 'Your HQ dashboard'
  },
  {
    path: '/schedule',
    label: 'Tour Schedule',
    shortLabel: 'Schedule',
    icon: Calendar,
    description: 'Manage shows & events'
  },
  {
    path: '/staff',
    label: 'Staff Market',
    shortLabel: 'Market',
    icon: ShoppingCart,
    description: 'Recruit & trade staff'
  },
  {
    path: '/scores',
    label: 'Leaderboards',
    shortLabel: 'Scores',
    icon: Trophy,
    description: 'Global rankings'
  },
  {
    path: '/leagues',
    label: 'Leagues',
    shortLabel: 'Leagues',
    icon: Users,
    description: 'Multiplayer competitions'
  },
  {
    path: '/battlepass',
    label: 'Season Pass',
    shortLabel: 'Pass',
    icon: Crown,
    description: 'Unlock rewards'
  },
];

const secondaryNavItems = [
  {
    path: '/profile',
    label: 'Profile',
    shortLabel: 'Profile',
    icon: User,
    description: 'Your achievements'
  },
  {
    path: '/settings',
    label: 'Settings',
    shortLabel: 'Settings',
    icon: Settings,
    description: 'Preferences'
  },
];

// =============================================================================
// TOOLTIP COMPONENT
// =============================================================================

const Tooltip = ({ children, label, description }) => {
  const [isVisible, setIsVisible] = useState(false);

  return (
    <div
      className="relative"
      onMouseEnter={() => setIsVisible(true)}
      onMouseLeave={() => setIsVisible(false)}
    >
      {children}
      <AnimatePresence>
        {isVisible && (
          <motion.div
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -8 }}
            transition={{ duration: 0.15 }}
            className="absolute left-full ml-3 top-1/2 -translate-y-1/2 z-50 pointer-events-none"
          >
            <div className="bg-charcoal-800/95 backdrop-blur-sm border border-gold-500/30 rounded-lg px-3 py-2 shadow-lg shadow-black/50 whitespace-nowrap">
              <div className="text-sm font-display font-bold text-cream">{label}</div>
              {description && (
                <div className="text-xs text-cream-muted mt-0.5">{description}</div>
              )}
              {/* Arrow */}
              <div className="absolute right-full top-1/2 -translate-y-1/2 border-8 border-transparent border-r-charcoal-800/95" />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

// =============================================================================
// NAV ITEM COMPONENT
// =============================================================================

const NavItem = ({ item, isActive }) => {
  const Icon = item.icon;

  return (
    <Tooltip label={item.label} description={item.description}>
      <Link
        to={item.path}
        className={`
          relative flex items-center justify-center w-12 h-12 rounded-xl
          transition-all duration-300 group
          ${isActive
            ? 'bg-gold-500/20 shadow-[0_0_20px_rgba(234,179,8,0.3)]'
            : 'hover:bg-white/5'
          }
        `}
      >
        {/* Active indicator - Left edge glow */}
        {isActive && (
          <motion.div
            layoutId="railActive"
            className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-8 bg-gold-500 rounded-r-full shadow-[0_0_10px_rgba(234,179,8,0.6)]"
            transition={{ type: 'spring', stiffness: 500, damping: 30 }}
          />
        )}

        {/* Icon */}
        <Icon
          className={`
            w-5 h-5 transition-all duration-300
            ${isActive
              ? 'text-gold-400 drop-shadow-[0_0_6px_rgba(234,179,8,0.5)]'
              : 'text-cream-muted group-hover:text-cream'
            }
          `}
        />

        {/* Active glow background */}
        {isActive && (
          <div className="absolute inset-0 rounded-xl bg-gold-500/10 animate-pulse" style={{ animationDuration: '3s' }} />
        )}
      </Link>
    </Tooltip>
  );
};

// =============================================================================
// COMMAND RAIL COMPONENT
// =============================================================================

const CommandRail = () => {
  const location = useLocation();
  const { user } = useAuth();
  const [isAdmin, setIsAdmin] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);

  // Check admin status
  useEffect(() => {
    const checkAdmin = async () => {
      if (user) {
        const adminStatus = await adminHelpers.isAdmin();
        setIsAdmin(adminStatus);
      }
    };
    checkAdmin();
  }, [user]);

  const isActiveRoute = (path) => {
    if (path === '/dashboard') {
      return location.pathname === '/dashboard' || location.pathname === '/';
    }
    if (path === '/profile') {
      return location.pathname.startsWith('/profile');
    }
    if (path === '/scores') {
      return location.pathname.startsWith('/scores');
    }
    return location.pathname === path;
  };

  return (
    <nav
      className="h-full flex flex-col bg-charcoal-950/80 backdrop-blur-xl border-r border-white/5"
      aria-label="Main navigation"
    >
      {/* Logo/Brand Area */}
      <div className="flex items-center justify-center h-16 border-b border-white/5">
        <Link
          to="/dashboard"
          className="flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-br from-gold-400 to-gold-600 shadow-gold-glow-sm hover:shadow-gold-glow-md transition-shadow"
        >
          <Zap className="w-5 h-5 text-charcoal-950" />
        </Link>
      </div>

      {/* Primary Navigation */}
      <div className="flex-1 flex flex-col items-center py-4 space-y-2 overflow-y-auto">
        {primaryNavItems.map((item) => (
          <NavItem
            key={item.path}
            item={item}
            isActive={isActiveRoute(item.path)}
          />
        ))}
      </div>

      {/* Divider */}
      <div className="mx-4 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />

      {/* Secondary Navigation */}
      <div className="flex flex-col items-center py-4 space-y-2">
        {secondaryNavItems.map((item) => (
          <NavItem
            key={item.path}
            item={item}
            isActive={isActiveRoute(item.path)}
          />
        ))}

        {/* Admin Link (Conditional) */}
        {isAdmin && (
          <NavItem
            item={{
              path: '/admin',
              label: 'Admin Panel',
              shortLabel: 'Admin',
              icon: Shield,
              description: 'System administration'
            }}
            isActive={isActiveRoute('/admin')}
          />
        )}
      </div>

      {/* Quick Status Footer */}
      <div className="border-t border-white/5 p-3">
        <Link
          to="/profile"
          className="flex items-center justify-center w-12 h-12 mx-auto rounded-xl bg-charcoal-900/50 border border-white/10 hover:border-gold-500/30 hover:bg-charcoal-800/50 transition-all group"
        >
          {user?.photoURL ? (
            <img
              src={user.photoURL}
              alt="Profile"
              className="w-8 h-8 rounded-lg object-cover border border-white/20 group-hover:border-gold-500/50 transition-colors"
            />
          ) : (
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-gold-400/20 to-gold-600/20 flex items-center justify-center border border-gold-500/30">
              <User className="w-4 h-4 text-gold-400" />
            </div>
          )}
        </Link>
      </div>

      {/* Stadium Lights Effect - Subtle glow at top */}
      <div className="absolute top-0 left-0 right-0 h-32 bg-stadium-lights-subtle pointer-events-none" />
    </nav>
  );
};

export default CommandRail;
