// =============================================================================
// BOTTOM NAV COMPONENT (TypeScript)
// =============================================================================
// Mobile bottom navigation bar with gaming aesthetic
// Updated to include all essential navigation routes

import React, { useState, useRef, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  Home,
  Calendar,
  Trophy,
  Users,
  ShoppingCart,
  Crown,
  User,
  Settings,
  MoreHorizontal,
  X,
  LucideIcon
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

// =============================================================================
// TYPES
// =============================================================================

interface NavItem {
  path: string;
  label: string;
  icon: LucideIcon;
}

// =============================================================================
// CONSTANTS
// =============================================================================

const primaryNavItems: NavItem[] = [
  { path: '/dashboard', label: 'Home', icon: Home },
  { path: '/schedule', label: 'Schedule', icon: Calendar },
  { path: '/staff', label: 'Market', icon: ShoppingCart },
  { path: '/scores', label: 'Scores', icon: Trophy },
  { path: '/leagues', label: 'Leagues', icon: Users },
];

const moreMenuItems: NavItem[] = [
  { path: '/battlepass', label: 'Season Pass', icon: Crown },
  { path: '/profile', label: 'Profile', icon: User },
  { path: '/settings', label: 'Settings', icon: Settings },
];

// =============================================================================
// MORE MENU COMPONENT
// =============================================================================

interface MoreMenuProps {
  isOpen: boolean;
  onClose: () => void;
  items: NavItem[];
  currentPath: string;
}

const MoreMenu: React.FC<MoreMenuProps> = ({ isOpen, onClose, items, currentPath }) => {
  const menuRef = useRef<HTMLDivElement>(null);

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen, onClose]);

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40"
            onClick={onClose}
          />

          {/* Menu Panel */}
          <motion.div
            ref={menuRef}
            initial={{ opacity: 0, y: 100 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 100 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="fixed bottom-20 left-4 right-4 z-50 bg-charcoal-900/95 backdrop-blur-xl border border-white/10 rounded-2xl overflow-hidden shadow-2xl"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
              <span className="text-sm font-display font-bold text-cream uppercase tracking-wider">
                More Options
              </span>
              <button
                onClick={onClose}
                className="p-1.5 rounded-lg hover:bg-white/10 text-cream-muted hover:text-cream transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Menu Items */}
            <div className="p-2 space-y-1">
              {items.map((item) => {
                const Icon = item.icon;
                const isActive = currentPath === item.path ||
                  (item.path === '/profile' && currentPath.startsWith('/profile'));

                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    onClick={onClose}
                    className={`
                      flex items-center gap-3 px-4 py-3 rounded-xl transition-all
                      ${isActive
                        ? 'bg-gold-500/20 text-gold-400'
                        : 'text-cream hover:bg-white/5'
                      }
                    `}
                  >
                    <div className={`
                      p-2 rounded-lg
                      ${isActive
                        ? 'bg-gold-500/20 shadow-[0_0_10px_rgba(234,179,8,0.3)]'
                        : 'bg-white/5'
                      }
                    `}>
                      <Icon
                        className={`w-5 h-5 ${isActive ? 'text-gold-400' : 'text-cream-muted'}`}
                      />
                    </div>
                    <span className="font-display font-semibold">{item.label}</span>
                    {isActive && (
                      <div className="ml-auto w-2 h-2 rounded-full bg-gold-400 shadow-[0_0_6px_rgba(234,179,8,0.6)]" />
                    )}
                  </Link>
                );
              })}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

// =============================================================================
// COMPONENT
// =============================================================================

const BottomNav: React.FC = () => {
  const location = useLocation();
  const [isMoreMenuOpen, setIsMoreMenuOpen] = useState(false);

  // Check if any "more" menu item is active
  const isMoreActive = moreMenuItems.some(item =>
    item.path === location.pathname ||
    (item.path === '/profile' && location.pathname.startsWith('/profile'))
  );

  return (
    <>
      {/* More Menu */}
      <MoreMenu
        isOpen={isMoreMenuOpen}
        onClose={() => setIsMoreMenuOpen(false)}
        items={moreMenuItems}
        currentPath={location.pathname}
      />

      <nav
        className="lg:hidden fixed bottom-0 left-0 right-0 z-40 safe-area-bottom"
        aria-label="Mobile navigation"
      >
        {/* Golden accent line at top */}
        <div className="h-px w-full bg-gradient-to-r from-transparent via-yellow-500/40 to-transparent" />

        {/* Nav container - Glassmorphism */}
        <div className="bg-black/60 backdrop-blur-xl border-t border-white/10">
          <div className="flex items-center justify-around px-1 py-1.5">
            {/* Primary Nav Items */}
            {primaryNavItems.map((item) => {
              const Icon = item.icon;
              const isActive = location.pathname === item.path;

              return (
                <Link
                  key={item.path}
                  to={item.path}
                  aria-label={item.label}
                  aria-current={isActive ? 'page' : undefined}
                  className="relative flex flex-col items-center gap-0.5 px-3 py-1.5 min-w-[56px]"
                >
                  {/* Active indicator - Glass glow effect */}
                  {isActive && (
                    <motion.div
                      layoutId="bottomNavActive"
                      className="absolute inset-0 bg-yellow-500/10 rounded-xl shadow-[0_0_20px_rgba(234,179,8,0.15)]"
                      transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                    />
                  )}

                  {/* Icon */}
                  <div className={`relative z-10 p-1.5 rounded-lg transition-all duration-300 ${isActive ? 'bg-yellow-500/20 shadow-[0_0_10px_rgba(234,179,8,0.3)]' : ''}`}>
                    <Icon
                      className={`w-5 h-5 transition-all duration-300 ${
                        isActive ? 'text-yellow-400 drop-shadow-[0_0_4px_rgba(234,179,8,0.5)]' : 'text-yellow-50/50'
                      }`}
                      aria-hidden="true"
                    />
                  </div>

                  {/* Label */}
                  <span
                    className={`relative z-10 text-[10px] font-display font-semibold uppercase tracking-wide transition-all duration-300 ${
                      isActive ? 'text-yellow-400' : 'text-yellow-50/50'
                    }`}
                  >
                    {item.label}
                  </span>

                  {/* Active glow dot indicator */}
                  {isActive && (
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      className="absolute -top-0.5 right-1/2 translate-x-1/2 w-1.5 h-1.5 bg-yellow-400 rounded-full shadow-[0_0_6px_rgba(234,179,8,0.6)]"
                    />
                  )}
                </Link>
              );
            })}

            {/* More Button */}
            <button
              onClick={() => setIsMoreMenuOpen(true)}
              aria-label="More options"
              className="relative flex flex-col items-center gap-0.5 px-3 py-1.5 min-w-[56px]"
            >
              {/* Active indicator for More button */}
              {isMoreActive && (
                <motion.div
                  className="absolute inset-0 bg-yellow-500/10 rounded-xl shadow-[0_0_20px_rgba(234,179,8,0.15)]"
                />
              )}

              {/* Icon */}
              <div className={`relative z-10 p-1.5 rounded-lg transition-all duration-300 ${isMoreActive ? 'bg-yellow-500/20 shadow-[0_0_10px_rgba(234,179,8,0.3)]' : ''}`}>
                <MoreHorizontal
                  className={`w-5 h-5 transition-all duration-300 ${
                    isMoreActive ? 'text-yellow-400 drop-shadow-[0_0_4px_rgba(234,179,8,0.5)]' : 'text-yellow-50/50'
                  }`}
                  aria-hidden="true"
                />
              </div>

              {/* Label */}
              <span
                className={`relative z-10 text-[10px] font-display font-semibold uppercase tracking-wide transition-all duration-300 ${
                  isMoreActive ? 'text-yellow-400' : 'text-yellow-50/50'
                }`}
              >
                More
              </span>

              {/* Active glow dot indicator */}
              {isMoreActive && (
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  className="absolute -top-0.5 right-1/2 translate-x-1/2 w-1.5 h-1.5 bg-yellow-400 rounded-full shadow-[0_0_6px_rgba(234,179,8,0.6)]"
                />
              )}
            </button>
          </div>
        </div>
      </nav>
    </>
  );
};

export default BottomNav;
