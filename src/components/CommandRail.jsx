// =============================================================================
// COMMAND RAIL COMPONENT
// =============================================================================
// Persistent desktop sidebar navigation with gamified "Night Mode Stadium" aesthetic
// Features: Dark glass, gold accents, distinct active states, expandable with labels
// Width: 80px (collapsed) or 240px (expanded) - User toggleable

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
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import { useAuth } from '../App';
import { adminHelpers } from '../firebase';

// =============================================================================
// MARCHING.ART GAME LOGO
// =============================================================================

const MarchingArtLogo = ({ className = '' }) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="-5 -5 65 65" className={className}>
    <g>
      <circle cx="0" cy="0" r="4" className="fill-gold-400"/>
      <circle cx="25" cy="0" r="4" className="fill-gold-400"/>
      <circle cx="50" cy="0" r="4" className="fill-gold-400"/>
      <circle cx="0" cy="25" r="4" className="fill-gold-400"/>
      <circle cx="25" cy="25" r="4" className="fill-gold-400"/>
      <circle cx="50" cy="25" r="4" className="fill-gold-400"/>
      <circle cx="0" cy="50" r="4" className="fill-gold-400"/>
      <circle cx="25" cy="50" r="4" className="fill-gold-400"/>
      <circle cx="50" cy="50" r="4" className="fill-gold-400"/>
      <path d="M 0 0 Q 50 0, 50 50" className="stroke-charcoal-950" strokeWidth="6" fill="none" strokeLinecap="round"/>
    </g>
  </svg>
);

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
// TOOLTIP COMPONENT (for collapsed state)
// =============================================================================

const Tooltip = ({ children, label, description, show = true }) => {
  const [isVisible, setIsVisible] = useState(false);

  if (!show) {
    return children;
  }

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

const NavItem = ({ item, isActive, isExpanded }) => {
  const Icon = item.icon;

  return (
    <Tooltip label={item.label} description={item.description} show={!isExpanded}>
      <Link
        to={item.path}
        className={`
          relative flex items-center rounded-xl
          transition-all duration-300 group
          ${isExpanded ? 'w-full px-3 py-2.5 gap-3' : 'w-12 h-12 justify-center'}
          ${isActive
            ? 'bg-gold-500/20 shadow-[0_0_20px_rgba(234,179,8,0.3)]'
            : 'hover:shadow-[0_0_12px_rgba(234,179,8,0.15)]'
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
            w-5 h-5 transition-all duration-300 shrink-0
            ${isActive
              ? 'text-gold-400 drop-shadow-[0_0_6px_rgba(234,179,8,0.5)]'
              : 'text-cream-muted group-hover:text-cream'
            }
          `}
        />

        {/* Label (expanded state) */}
        <AnimatePresence>
          {isExpanded && (
            <motion.span
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
              transition={{ duration: 0.2 }}
              className={`
                text-sm font-medium truncate
                ${isActive ? 'text-gold-400' : 'text-cream-muted group-hover:text-cream'}
              `}
            >
              {item.label}
            </motion.span>
          )}
        </AnimatePresence>

        {/* Active glow background */}
        {isActive && (
          <div className="absolute inset-0 rounded-xl bg-gold-500/10 animate-pulse" style={{ animationDuration: '3s' }} />
        )}
      </Link>
    </Tooltip>
  );
};

// =============================================================================
// TOGGLE BUTTON COMPONENT
// =============================================================================

const ToggleButton = ({ isExpanded, onToggle }) => {
  return (
    <button
      onClick={onToggle}
      className="
        absolute -right-3 top-8 -translate-y-1/2 z-30
        w-6 h-6 rounded-full
        bg-charcoal-800 border border-gold-500/30
        flex items-center justify-center
        hover:bg-charcoal-700 hover:border-gold-500/50 hover:shadow-[0_0_10px_rgba(234,179,8,0.3)]
        transition-all duration-200
        shadow-lg shadow-black/50
      "
      aria-label={isExpanded ? 'Collapse sidebar' : 'Expand sidebar'}
    >
      {isExpanded ? (
        <ChevronLeft className="w-3.5 h-3.5 text-gold-400" />
      ) : (
        <ChevronRight className="w-3.5 h-3.5 text-gold-400" />
      )}
    </button>
  );
};

// =============================================================================
// COMMAND RAIL COMPONENT
// =============================================================================

const CommandRail = ({ isExpanded = false, onToggle }) => {
  const location = useLocation();
  const { user } = useAuth();
  const [isAdmin, setIsAdmin] = useState(false);

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
      className="h-full flex flex-col bg-charcoal-950/80 backdrop-blur-xl border-r border-gold-500/10 relative"
      aria-label="Main navigation"
    >
      {/* Toggle Button */}
      {onToggle && <ToggleButton isExpanded={isExpanded} onToggle={onToggle} />}

      {/* Logo/Brand Area */}
      <div className={`
        flex items-center h-16 border-b border-white/5
        ${isExpanded ? 'px-4 gap-3' : 'justify-center'}
      `}>
        <Link
          to="/dashboard"
          className="flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-br from-gold-400 to-gold-600 shadow-gold-glow-sm hover:shadow-gold-glow-md transition-shadow shrink-0 p-1.5"
        >
          <MarchingArtLogo className="w-full h-full" />
        </Link>

        {/* Brand text (expanded) */}
        <AnimatePresence>
          {isExpanded && (
            <motion.div
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden"
            >
              <div className="text-sm font-display font-bold text-cream tracking-wide">
                MARCHING
              </div>
              <div className="text-xs text-gold-400 font-medium -mt-0.5">
                Command Console
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Primary Navigation */}
      <div className={`
        flex-1 flex flex-col py-4 space-y-1 overflow-y-auto overflow-x-hidden
        ${isExpanded ? 'px-3' : 'items-center px-2'}
      `}>
        {primaryNavItems.map((item) => (
          <NavItem
            key={item.path}
            item={item}
            isActive={isActiveRoute(item.path)}
            isExpanded={isExpanded}
          />
        ))}
      </div>

      {/* Divider */}
      <div className={`h-px bg-gradient-to-r from-transparent via-white/10 to-transparent ${isExpanded ? 'mx-4' : 'mx-3'}`} />

      {/* Secondary Navigation */}
      <div className={`
        flex flex-col py-4 space-y-1
        ${isExpanded ? 'px-3' : 'items-center px-2'}
      `}>
        {secondaryNavItems.map((item) => (
          <NavItem
            key={item.path}
            item={item}
            isActive={isActiveRoute(item.path)}
            isExpanded={isExpanded}
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
            isExpanded={isExpanded}
          />
        )}
      </div>

      {/* User Profile Footer */}
      <div className={`border-t border-white/5 p-3 ${isExpanded ? '' : ''}`}>
        <Link
          to="/profile"
          className={`
            flex items-center rounded-xl
            bg-charcoal-900/50 border border-white/10
            hover:border-gold-500/30 hover:bg-charcoal-800/50
            transition-all group
            ${isExpanded ? 'px-3 py-2.5 gap-3' : 'w-12 h-12 justify-center mx-auto'}
          `}
        >
          {user?.photoURL ? (
            <img
              src={user.photoURL}
              alt="Profile"
              className="w-8 h-8 rounded-lg object-cover border border-white/20 group-hover:border-gold-500/50 transition-colors shrink-0"
            />
          ) : (
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-gold-400/20 to-gold-600/20 flex items-center justify-center border border-gold-500/30 shrink-0">
              <User className="w-4 h-4 text-gold-400" />
            </div>
          )}

          {/* User info (expanded) */}
          <AnimatePresence>
            {isExpanded && (
              <motion.div
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                transition={{ duration: 0.2 }}
                className="overflow-hidden flex-1 min-w-0"
              >
                <div className="text-sm font-medium text-cream truncate">
                  {user?.displayName || 'Player'}
                </div>
                <div className="text-xs text-cream-muted truncate">
                  View Profile
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </Link>
      </div>

      {/* Stadium Lights Effect - Subtle glow at top */}
      <div className="absolute top-0 left-0 right-0 h-32 bg-stadium-lights-subtle pointer-events-none" />
    </nav>
  );
};

export default CommandRail;
