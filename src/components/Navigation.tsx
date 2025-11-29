// =============================================================================
// NAVIGATION COMPONENT (TypeScript)
// =============================================================================
// Desktop sidebar navigation with collapsible menu

import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  Home, Trophy, Calendar, User, Settings, LogOut,
  Users, Award, HelpCircle, ChevronRight, Sparkles,
  Star, Shield, ShoppingCart, Crown,
  Sun, Moon, LucideIcon
} from 'lucide-react';
import { useAuth } from '../App';
import { useTheme } from '../context/ThemeContext';
import { db, adminHelpers } from '../firebase';
import { doc, onSnapshot, DocumentData } from 'firebase/firestore';
import { useSeasonStore } from '../store/seasonStore';

// =============================================================================
// TYPES
// =============================================================================

interface NavItem {
  path: string;
  label: string;
  icon: LucideIcon;
  badge: number | null;
  premium: boolean;
  badgeColor?: string;
}

interface NavSection {
  section: string;
  items: NavItem[];
}

interface UserProfile {
  displayName?: string;
  xpLevel?: number;
  xp?: number;
}

// =============================================================================
// COMPONENT
// =============================================================================

const Navigation: React.FC = () => {
  const location = useLocation();
  const { user, signOut } = useAuth();
  const { toggleTheme, isDark } = useTheme();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [notifications] = useState(0);
  const [collapsed, setCollapsed] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);

  // Use global season store instead of creating a separate listener
  const seasonData = useSeasonStore((state) => state.seasonData);
  const currentWeek = useSeasonStore((state) => state.currentWeek);

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

  const navItems: NavSection[] = [
    {
      section: 'Main',
      items: [
        {
          path: '/dashboard',
          label: 'Dashboard',
          icon: Home,
          badge: null,
          premium: false,
        },
        {
          path: '/schedule',
          label: 'Schedule',
          icon: Calendar,
          badge: null,
          premium: false,
        },
        {
          path: '/scores',
          label: 'Scores & Rankings',
          icon: Trophy,
          badge: null,
          premium: false,
        },
      ],
    },
    {
      section: 'Manage',
      items: [
        {
          path: '/staff',
          label: 'Staff Market',
          icon: ShoppingCart,
          badge: null,
          premium: false,
        },
        {
          path: '/battlepass',
          label: 'Battle Pass',
          icon: Crown,
          badge: null,
          premium: true,
        },
      ],
    },
    {
      section: 'Community',
      items: [
        {
          path: '/leagues',
          label: 'Leagues',
          icon: Users,
          badge: notifications > 0 ? notifications : null,
          premium: false,
        },
        {
          path: '/hall-of-champions',
          label: 'Hall of Champions',
          icon: Award,
          badge: null,
          premium: false,
        },
      ],
    },
    {
      section: 'Account',
      items: [
        {
          path: '/profile',
          label: 'Profile',
          icon: User,
          badge: null,
          premium: false,
        },
        {
          path: '/settings',
          label: 'Settings',
          icon: Settings,
          badge: null,
          premium: false,
        },
        {
          path: '/how-to-play',
          label: 'How to Play',
          icon: HelpCircle,
          badge: null,
          premium: false,
        },
      ],
    },
  ];

  // Add Admin section if user is admin
  if (isAdmin) {
    navItems.splice(3, 0, {
      section: 'Admin',
      items: [
        {
          path: '/admin',
          label: 'Admin Panel',
          icon: Shield,
          badge: null,
          premium: false,
        },
      ],
    });
  }

  const handleSignOut = async () => {
    try {
      await signOut();
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  return (
    <nav
      className={`fixed left-0 top-0 h-full ${collapsed ? 'w-20' : 'w-64'} bg-forest-900 border-r border-forest-800 backdrop-blur-lg transition-all duration-300 z-40`}
    >
      <div className="flex flex-col h-full">
        {/* Logo Section */}
        <div className="p-6 border-b border-gold-400/20">
          <Link to="/" className="flex items-center gap-3">
            <div className="relative">
              <div className="w-10 h-10 rounded-lg overflow-hidden flex items-center justify-center bg-charcoal-800">
                <img src="/logo192.webp" alt="marching.art logo" className="w-full h-full object-cover" />
              </div>
              <div className="absolute -top-1 -right-1 w-3 h-3 bg-gold-500 rounded-full animate-pulse" />
            </div>
            {!collapsed && (
              <div>
                <h1 className="text-xl font-bold text-cream-100 tracking-wide">
                  MARCHING.ART
                </h1>
                <p className="text-xs text-cream-200/60">Fantasy Drum & Bugle Corps</p>
              </div>
            )}
          </Link>

          {/* Collapse Toggle */}
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="mt-4 w-full flex items-center justify-center p-2 rounded-lg hover:bg-gold-500/10 transition-colors"
          >
            <ChevronRight className={`w-5 h-5 text-cream-200 transition-transform ${collapsed ? '' : 'rotate-180'}`} />
          </button>
        </div>

        {/* User Info */}
        {user && profile && (
          <div className={`p-4 border-b border-gold-400/20 ${collapsed ? 'px-2' : ''}`}>
            <div className={`glass rounded-lg p-3 ${collapsed ? 'p-2' : ''}`}>
              <div className="flex items-center gap-3">
                <div className="relative">
                  <div className="w-10 h-10 bg-gold-500 rounded-full flex items-center justify-center">
                    <User className="w-5 h-5 text-charcoal-900" />
                  </div>
                  {(profile.xpLevel ?? 0) >= 10 && (
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
                          style={{ width: `${((profile.xp ?? 0) % 1000) / 10}%` }}
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
                <h3 className="px-6 mb-2 text-xs font-semibold text-gold-400/60 uppercase tracking-wider">
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
                        flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 ease-damped group
                        ${isActive
                          ? 'bg-gold-500/20 text-gold-400'
                          : 'text-cream-200 hover:bg-forest-800 hover:text-cream-100'
                        }
                        ${collapsed ? 'justify-center' : ''}
                      `}
                    >
                      <div className="relative">
                        <Icon className={`w-5 h-5 ${isActive ? 'text-gold-600' : ''}`} />
                        {item.premium && (
                          <Sparkles className="absolute -top-1 -right-1 w-3 h-3 text-gold-500" />
                        )}
                      </div>
                      {!collapsed && (
                        <>
                          <span className={`flex-1 font-medium ${isActive ? 'font-semibold' : ''}`}>
                            {item.label}
                          </span>
                          {item.badge && (
                            <span className={`
                              px-2 py-0.5 text-xs font-semibold rounded-full
                              ${item.badgeColor || 'bg-gold-500 text-charcoal-900'}
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
        <div className="p-4 border-t border-gold-400/20 space-y-2">
          {/* Theme Toggle */}
          <button
            onClick={toggleTheme}
            className={`
              w-full flex items-center gap-3 px-3 py-2.5 rounded-lg
              text-cream-200 hover:bg-forest-800 hover:text-gold-400
              transition-all duration-200
              ${collapsed ? 'justify-center' : ''}
            `}
            title={isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
          >
            {isDark ? (
              <Sun className="w-5 h-5" />
            ) : (
              <Moon className="w-5 h-5" />
            )}
            {!collapsed && (
              <span className="font-medium">
                {isDark ? 'Light Mode' : 'Dark Mode'}
              </span>
            )}
          </button>

          {/* Sign Out */}
          <button
            onClick={handleSignOut}
            className={`
              w-full flex items-center gap-3 px-3 py-2.5 rounded-lg
              text-cream-200 hover:bg-red-500/20 hover:text-red-400
              transition-all duration-200
              ${collapsed ? 'justify-center' : ''}
            `}
          >
            <LogOut className="w-5 h-5" />
            {!collapsed && <span className="font-medium">Sign Out</span>}
          </button>
        </div>

        {/* Season Info */}
        {!collapsed && seasonData && (
          <div className="p-4 border-t border-gold-400/20">
            <div className="bg-forest-800 rounded-lg p-3 text-center">
              <p className="text-xs text-gold-400/60 uppercase tracking-wider">Current Season</p>
              <p className="text-sm font-semibold text-cream-100 mt-1 capitalize">
                {seasonData.name?.replace(/_/g, ' ') || 'No Active Season'}
              </p>
              {currentWeek && (
                <p className="text-xs text-cream-200/60 mt-1">
                  Week {currentWeek} {seasonData.status === 'off-season' ? 'of 7' : 'of 10'}
                </p>
              )}
            </div>
          </div>
        )}
      </div>
    </nav>
  );
};

export default Navigation;
