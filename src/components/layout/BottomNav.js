import React from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import {
  Home,
  LayoutDashboard,
  Trophy,
  Calendar,
  User
} from 'lucide-react';

const BottomNav = () => {
  const { currentUser } = useAuth();

  if (!currentUser) return null;

  const navItems = [
    { to: '/', icon: Home, label: 'Home' },
    { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
    { to: '/scores', icon: Trophy, label: 'Scores' },
    { to: '/schedule', icon: Calendar, label: 'Schedule' },
    { to: `/profile/${currentUser.uid}`, icon: User, label: 'Profile' }
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-surface dark:bg-surface-dark border-t border-accent dark:border-accent-dark z-40 lg:hidden safe-bottom">
      <div className="flex justify-around items-center h-16">
        {navItems.map(item => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              `flex flex-col items-center justify-center flex-1 h-full transition-colors ${
                isActive
                  ? 'text-primary dark:text-primary-dark bg-primary/10 dark:bg-primary-dark/10'
                  : 'text-text-secondary dark:text-text-secondary-dark'
              }`
            }
          >
            {({ isActive }) => (
              <>
                <item.icon className={`w-6 h-6 ${isActive ? 'scale-110' : ''} transition-transform`} />
                <span className="text-xs mt-1 font-medium">{item.label}</span>
              </>
            )}
          </NavLink>
        ))}
      </div>
    </nav>
  );
};

export default BottomNav;