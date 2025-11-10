// src/components/Navigation.jsx
import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Home, Trophy, Calendar, Music, User, Settings, LogOut, 
  Users, Award, HelpCircle, ChevronRight, Sparkles, 
  BarChart3, MessageSquare, Bell, Star, Zap
} from 'lucide-react';
import { useAuth } from '../App';
import { db } from '../firebase';
import { doc, onSnapshot } from 'firebase/firestore';

const Navigation = () => {
  const location = useLocation();
  const { user, signOut } = useAuth();
  const [profile, setProfile] = useState(null);
  const [notifications, setNotifications] = useState(0);
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    if (user) {
      // Subscribe to profile updates
      const profileRef = doc(db, 'artifacts/marching-art/users', user.uid, 'profile/data');
      const unsubscribe = onSnapshot(profileRef, (doc) => {
        if (doc.exists()) {
          setProfile(doc.data());
        }
      });

      return () => unsubscribe();
    }
  }, [user]);

  const navItems = [
    {
      section: 'Main',
      items: [
        { 
          path: '/dashboard', 
          label: 'Dashboard', 
          icon: Home,
          badge: null,
          premium: false
        },
        { 
          path: '/hub', 
          label: 'League Hub', 
          icon: Users,
          badge: notifications > 0 ? notifications : null,
          premium: false
        },
        { 
          path: '/leaderboard', 
          label: 'Leaderboard', 
          icon: Trophy,
          badge: null,
          premium: false
        },
        { 
          path: '/schedule', 
          label: 'Schedule', 
          icon: Calendar,
          badge: null,
          premium: false
        },
        { 
          path: '/scores', 
          label: 'Scores', 
          icon: Music,
          badge: 'LIVE',
          badgeColor: 'bg-red-500',
          premium: false
        }
      ]
    },
    {
      section: 'Community',
      items: [
        { 
          path: '/hall-of-champions', 
          label: 'Hall of Champions', 
          icon: Award,
          badge: null,
          premium: false
        },
        { 
          path: '/profile', 
          label: 'My Profile', 
          icon: User,
          badge: null,
          premium: false
        },
        { 
          path: '/settings', 
          label: 'Settings', 
          icon: Settings,
          badge: null,
          premium: false
        }
      ]
    },
    {
      section: 'Help',
      items: [
        { 
          path: '/how-to-play', 
          label: 'How to Play', 
          icon: HelpCircle,
          badge: null,
          premium: false
        }
      ]
    }
  ];

  const handleSignOut = async () => {
    try {
      await signOut();
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  return (
    <nav className={`fixed left-0 top-0 h-full ${collapsed ? 'w-20' : 'w-64'} bg-charcoal-950/95 backdrop-blur-lg border-r border-cream-500/10 transition-all duration-300 z-40`}>
      <div className="flex flex-col h-full">
        {/* Logo Section */}
        <div className="p-6 border-b border-cream-500/10">
          <Link to="/" className="flex items-center gap-3">
            <div className="relative">
              <div className="w-10 h-10 bg-gradient-gold rounded-lg flex items-center justify-center">
                <Music className="w-6 h-6 text-charcoal-900" />
              </div>
              <div className="absolute -top-1 -right-1 w-3 h-3 bg-gold-500 rounded-full animate-pulse" />
            </div>
            {!collapsed && (
              <div>
                <h1 className="text-xl font-display font-bold text-gradient">
                  marching.art
                </h1>
                <p className="text-xs text-cream-500/60">Ultimate Fantasy DCI</p>
              </div>
            )}
          </Link>

          {/* Collapse Toggle */}
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="mt-4 w-full flex items-center justify-center p-2 rounded-lg hover:bg-cream-500/10 transition-colors"
          >
            <ChevronRight className={`w-5 h-5 text-cream-500 transition-transform ${collapsed ? '' : 'rotate-180'}`} />
          </button>
        </div>

        {/* User Info */}
        {user && profile && (
          <div className={`p-4 border-b border-cream-500/10 ${collapsed ? 'px-2' : ''}`}>
            <div className={`glass rounded-lg p-3 ${collapsed ? 'p-2' : ''}`}>
              <div className="flex items-center gap-3">
                <div className="relative">
                  <div className="w-10 h-10 bg-gradient-cream rounded-full flex items-center justify-center">
                    <User className="w-5 h-5 text-charcoal-900" />
                  </div>
                  {profile.xpLevel >= 10 && (
                    <div className="absolute -top-1 -right-1">
                      <Star className="w-4 h-4 text-gold-500" />
                    </div>
                  )}
                </div>
                {!collapsed && (
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-cream-100 truncate">
                      {profile.displayName || 'Director'}
                    </p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-xs text-cream-500/60">
                        Level {profile.xpLevel || 1}
                      </span>
                      <div className="flex-1 h-1 bg-charcoal-800 rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-gradient-gold transition-all duration-500"
                          style={{ width: `${(profile.xp % 1000) / 10}%` }}
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Navigation Items */}
        <div className="flex-1 overflow-y-auto py-4">
          {navItems.map((section) => (
            <div key={section.section} className="mb-6">
              {!collapsed && (
                <h3 className="px-6 mb-2 text-xs font-semibold text-cream-500/40 uppercase tracking-wider">
                  {section.section}
                </h3>
              )}
              <div className="space-y-1 px-3">
                {section.items.map((item) => {
                  const isActive = location.pathname === item.path;
                  const Icon = item.icon;

                  return (
                    <Link
                      key={item.path}
                      to={item.path}
                      className={`
                        flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-300 group
                        ${isActive 
                          ? 'bg-gold-500/20 text-gold-500 shadow-inner-glow' 
                          : 'text-cream-300 hover:bg-cream-500/10 hover:text-cream-100'
                        }
                        ${collapsed ? 'justify-center' : ''}
                      `}
                    >
                      <div className="relative">
                        <Icon className={`w-5 h-5 ${isActive ? 'animate-pulse-gold' : ''}`} />
                        {item.premium && (
                          <Sparkles className="absolute -top-1 -right-1 w-3 h-3 text-gold-500" />
                        )}
                      </div>
                      {!collapsed && (
                        <>
                          <span className="flex-1 font-medium">
                            {item.label}
                          </span>
                          {item.badge && (
                            <span className={`
                              px-2 py-0.5 text-xs font-semibold rounded-full
                              ${item.badgeColor || 'bg-gold-500/20 text-gold-300'}
                            `}>
                              {item.badge}
                            </span>
                          )}
                        </>
                      )}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        {/* Bottom Actions */}
        <div className="p-4 border-t border-cream-500/10">
          <button
            onClick={handleSignOut}
            className={`
              w-full flex items-center gap-3 px-3 py-2.5 rounded-lg
              text-cream-300 hover:bg-red-500/10 hover:text-red-400
              transition-all duration-300
              ${collapsed ? 'justify-center' : ''}
            `}
          >
            <LogOut className="w-5 h-5" />
            {!collapsed && <span className="font-medium">Sign Out</span>}
          </button>
        </div>

        {/* Season Info */}
        {!collapsed && (
          <div className="p-4 border-t border-cream-500/10">
            <div className="text-center">
              <p className="text-xs text-cream-500/60">Current Season</p>
              <p className="text-sm font-semibold text-gold-500 mt-1">
                2025 Live Season
              </p>
              <p className="text-xs text-cream-500/40 mt-1">
                Week 3 of 10
              </p>
            </div>
          </div>
        )}
      </div>
    </nav>
  );
};

export default Navigation;
