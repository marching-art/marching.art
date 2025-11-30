// src/components/BottomNav.jsx
import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Home, Calendar, Trophy, Users, User } from 'lucide-react';

const BottomNav = () => {
  const location = useLocation();

  const navItems = [
    { path: '/dashboard', label: 'Home', icon: Home },
    { path: '/schedule', label: 'Schedule', icon: Calendar },
    { path: '/scores', label: 'Scores', icon: Trophy },
    { path: '/leagues', label: 'Leagues', icon: Users },
    { path: '/profile', label: 'Profile', icon: User }
  ];

  return (
    <nav
      className="lg:hidden fixed bottom-0 left-0 right-0 backdrop-blur-lg z-40 safe-area-bottom"
      style={{ background: 'var(--bg-secondary)', borderTop: '1px solid var(--border-color-light)' }}
      aria-label="Mobile navigation"
    >
      <div className="flex items-center justify-around px-2 py-2">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = location.pathname === item.path;

          return (
            <Link
              key={item.path}
              to={item.path}
              aria-label={item.label}
              aria-current={isActive ? 'page' : undefined}
              className={`
                flex flex-col items-center gap-1 px-4 py-2 rounded-lg transition-all duration-300 min-w-[64px]
                ${isActive
                  ? 'text-gold-500'
                  : 'text-cream-400 hover:text-cream-100'
                }
              `}
            >
              <Icon className={`w-6 h-6 ${isActive ? 'animate-pulse-gold' : ''}`} aria-hidden="true" />
              <span className={`text-xs font-medium ${isActive ? 'font-semibold' : ''}`}>
                {item.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
};

export default BottomNav;
