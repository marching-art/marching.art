// =============================================================================
// GUEST ACTION BAR
// =============================================================================
// The signed-out counterpart to BottomNav. The home screen (/) has no persistent
// navigation of its own, and the authenticated 5-tab BottomNav can't be shown to
// guests — every one of its tabs (Dashboard, Schedule, Scores, Profile) sits
// behind ProtectedRoute and would dead-end a logged-out visitor at the login
// wall. Instead this fixed bar offers the three things a guest can actually do:
// try the demo, sign in, or create a free account. It occupies the same slot as
// BottomNav so the chrome feels continuous across the login boundary.

import React from 'react';
import { Link } from 'react-router-dom';
import { Play, LogIn, UserPlus } from 'lucide-react';
import { triggerHaptic } from '../../hooks/useHaptic';
import { prefetchRoute } from '../../lib/prefetch';

const actions = [
  { path: '/preview', label: 'Demo', icon: Play },
  { path: '/login', label: 'Sign In', icon: LogIn },
  { path: '/register', label: 'Join Free', icon: UserPlus, emphasized: true },
];

const GuestActionBar = () => {
  return (
    <nav
      className="lg:hidden fixed bottom-0 left-0 right-0 z-50 safe-area-bottom select-none"
      aria-label="Get started"
    >
      {/* Accent line at top - matches BottomNav */}
      <div className="h-px w-full bg-yellow-500/30" />

      <div className="bg-surface-card border-t border-white/10">
        <div className="flex items-center justify-around px-0.5 xs:px-1 py-1.5">
          {actions.map((item) => {
            const Icon = item.icon;
            return (
              <Link
                key={item.path}
                to={item.path}
                aria-label={item.label}
                onClick={() => triggerHaptic('light')}
                onMouseEnter={() => prefetchRoute(item.path)}
                onFocus={() => prefetchRoute(item.path)}
                className={`relative flex flex-col items-center justify-center gap-0.5 px-1 xs:px-2 py-1.5 min-w-[44px] xs:min-w-[50px] min-h-[48px] press-feedback rounded-none ${
                  item.emphasized ? 'bg-yellow-500/10' : ''
                }`}
              >
                <div
                  className={`relative z-10 p-1.5 rounded-none transition-all duration-150 ${
                    item.emphasized ? 'bg-yellow-500/20' : ''
                  }`}
                >
                  <Icon
                    className={`w-5 h-5 xs:w-[22px] xs:h-[22px] transition-all duration-150 ${
                      item.emphasized ? 'text-yellow-400' : 'text-yellow-50/70'
                    }`}
                    aria-hidden="true"
                  />
                </div>
                <span
                  className={`relative z-10 text-[9px] xs:text-[10px] font-medium transition-all duration-150 leading-tight ${
                    item.emphasized ? 'text-yellow-400' : 'text-yellow-50/60'
                  }`}
                >
                  {item.label}
                </span>
              </Link>
            );
          })}
        </div>
      </div>
    </nav>
  );
};

export default GuestActionBar;
