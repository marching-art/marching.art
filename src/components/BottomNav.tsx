// =============================================================================
// BOTTOM NAV COMPONENT (TypeScript)
// =============================================================================
// Mobile bottom navigation bar with gaming aesthetic

import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Home, Calendar, Trophy, Users, ShoppingCart, LucideIcon } from 'lucide-react';
import { motion } from 'framer-motion';

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

const navItems: NavItem[] = [
  { path: '/dashboard', label: 'Home', icon: Home },
  { path: '/schedule', label: 'Schedule', icon: Calendar },
  { path: '/staff', label: 'Market', icon: ShoppingCart },
  { path: '/scores', label: 'Scores', icon: Trophy },
  { path: '/leagues', label: 'Leagues', icon: Users },
];

// =============================================================================
// COMPONENT
// =============================================================================

const BottomNav: React.FC = () => {
  const location = useLocation();

  return (
    <nav
      className="lg:hidden fixed bottom-0 left-0 right-0 z-40 safe-area-bottom"
      aria-label="Mobile navigation"
    >
      {/* Hazard stripe accent at top */}
      <div className="h-0.5 w-full bg-hazard-stripe animate-hazard" />

      {/* Nav container */}
      <div className="bg-charcoal-950 border-t border-gold-500/20">
        <div className="flex items-center justify-around px-1 py-1.5">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path;

            return (
              <Link
                key={item.path}
                to={item.path}
                aria-label={item.label}
                aria-current={isActive ? 'page' : undefined}
                className="relative flex flex-col items-center gap-0.5 px-3 py-1.5 min-w-[60px]"
              >
                {/* Active indicator */}
                {isActive && (
                  <motion.div
                    layoutId="bottomNavActive"
                    className="absolute inset-0 bg-gold-500/10 rounded"
                    transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                  />
                )}

                {/* Icon */}
                <div className={`relative z-10 p-1 rounded ${isActive ? 'bg-gold-500/20' : ''}`}>
                  <Icon
                    className={`w-5 h-5 transition-colors duration-200 ${
                      isActive ? 'text-gold-500' : 'text-cream-500'
                    }`}
                    aria-hidden="true"
                  />
                </div>

                {/* Label */}
                <span
                  className={`relative z-10 text-[10px] font-display font-semibold uppercase tracking-wide transition-colors duration-200 ${
                    isActive ? 'text-gold-500' : 'text-cream-500'
                  }`}
                >
                  {item.label}
                </span>

                {/* Active dot indicator */}
                {isActive && (
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    className="absolute -top-0.5 right-1/2 translate-x-1/2 w-1 h-1 bg-gold-500 rounded-full"
                  />
                )}
              </Link>
            );
          })}
        </div>
      </div>
    </nav>
  );
};

export default BottomNav;
