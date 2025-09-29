import React, { useState, useEffect } from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useUserStore } from '../../store/userStore';
import { signOut } from 'firebase/auth';
import { auth } from '../../firebaseConfig';
import AuthModal from '../auth/AuthModal';
import { 
  Menu, 
  X, 
  User, 
  Settings, 
  Trophy, 
  Coins,
  ChevronDown,
  Bell,
  Crown,
  Zap
} from 'lucide-react';

const Header = () => {
  const { currentUser } = useAuth();
  const profile = useUserStore((state) => state.profile);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isProfileDropdownOpen, setIsProfileDropdownOpen] = useState(false);
  const navigate = useNavigate();

  const handleLogout = async () => {
    try {
      await signOut(auth);
      useUserStore.getState().fetchUserProfile(null);
      setIsProfileDropdownOpen(false);
    } catch (error) {
      console.error("Failed to log out:", error);
    }
  };

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (!event.target.closest('.profile-dropdown')) {
        setIsProfileDropdownOpen(false);
      }
    };

    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, []);

  const getClassIcon = (className) => {
    switch(className) {
      case 'World Class': return <Crown className="w-4 h-4 text-purple-500" />;
      case 'Open Class': return <Zap className="w-4 h-4 text-blue-500" />;
      case 'A Class': return <Trophy className="w-4 h-4 text-green-500" />;
      default: return <Trophy className="w-4 h-4 text-orange-500" />;
    }
  };

  const getClassBadge = (className) => {
    const badges = {
      'World Class': 'class-world',
      'Open Class': 'class-open', 
      'A Class': 'class-a',
      'SoundSport': 'class-soundsport'
    };
    return badges[className] || 'class-soundsport';
  };

  const navigationItems = [
    { path: '/dashboard', label: 'Dashboard', icon: '🎯' },
    { path: '/leagues', label: 'Leagues', icon: '👥' },
    { path: '/scores', label: 'Scores', icon: '📊' },
    { path: '/schedule', label: 'Schedule', icon: '📅' },
    { path: '/leaderboard', label: 'Leaderboard', icon: '🏆' }
  ];

  return (
    <>
      <header className="bg-surface-dark/95 backdrop-gaming border-b border-accent-dark/20 sticky top-0 z-50 shadow-xl">
        <nav className="container mx-auto px-4 py-3">
          <div className="flex justify-between items-center">
            {/* Logo */}
            <Link 
              to="/" 
              className="text-2xl font-bold text-gradient-primary hover:scale-105 transition-transform duration-200 flex items-center gap-2"
            >
              <img 
                src="/logo192.png" 
                alt="marching.art logo" 
                className="w-8 h-8 rounded-lg shadow-lg"
              />
              marching.art
            </Link>

            {/* Desktop Navigation */}
            <div className="hidden lg:flex items-center space-x-1">
              {navigationItems.map(item => (
                <NavLink
                  key={item.path}
                  to={item.path}
                  className={({ isActive }) => 
                    `nav-link flex items-center gap-2 px-4 py-2 rounded-xl transition-all duration-200 ${
                      isActive ? 'nav-link-active glow-primary' : 'hover:scale-105'
                    }`
                  }
                >
                  <span className="text-lg">{item.icon}</span>
                  {item.label}
                </NavLink>
              ))}
            </div>

            {/* User Actions */}
            <div className="flex items-center gap-4">
              {currentUser ? (
                <>
                  {/* User Stats (Desktop) */}
                  {profile && (
                    <div className="hidden md:flex items-center gap-4">
                      {/* CorpsCoin */}
                      <div className="flex items-center gap-2 bg-primary/10 px-3 py-1 rounded-full">
                        <Coins className="w-4 h-4 text-primary-dark" />
                        <span className="text-sm font-bold text-primary-dark">{profile.corpsCoin || 0}</span>
                      </div>
                      
                      {/* XP Level */}
                      <div className="flex items-center gap-2 bg-accent-dark/20 px-3 py-1 rounded-full">
                        <Zap className="w-4 h-4 text-accent" />
                        <span className="text-sm font-bold text-text-primary-dark">Lv.{profile.level || 1}</span>
                      </div>
                    </div>
                  )}

                  {/* Notifications */}
                  <button className="btn-icon relative">
                    <Bell className="w-5 h-5 text-text-primary-dark" />
                    <span className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full animate-pulse"></span>
                  </button>

                  {/* Profile Dropdown */}
                  <div className="relative profile-dropdown">
                    <button
                      onClick={() => setIsProfileDropdownOpen(!isProfileDropdownOpen)}
                      className="flex items-center gap-3 bg-surface-dark/50 hover:bg-accent-dark/20 px-4 py-2 rounded-xl transition-all duration-200 hover:scale-105"
                    >
                      {/* Corps Avatar */}
                      <div 
                        className="w-8 h-8 rounded-full border-2 flex items-center justify-center text-sm font-bold shadow-lg"
                        style={{ 
                          backgroundColor: profile?.uniforms?.primaryColor || '#8B4513',
                          borderColor: profile?.uniforms?.secondaryColor || '#F7941D',
                          color: profile?.uniforms?.textColor || '#FFFFFF'
                        }}
                      >
                        {profile?.corps?.corpsName?.charAt(0) || 'C'}
                      </div>

                      <div className="hidden md:block text-left">
                        <div className="text-sm font-medium text-text-primary-dark">
                          {profile?.corps?.alias || profile?.displayName || currentUser.email}
                        </div>
                        <div className="flex items-center gap-1">
                          {profile?.corps?.class && getClassIcon(profile.corps.class)}
                          <span className="text-xs text-text-secondary-dark">
                            {profile?.corps?.class || 'SoundSport'}
                          </span>
                        </div>
                      </div>

                      <ChevronDown className={`w-4 h-4 text-text-secondary-dark transition-transform duration-200 ${isProfileDropdownOpen ? 'rotate-180' : ''}`} />
                    </button>

                    {/* Dropdown Menu */}
                    {isProfileDropdownOpen && (
                      <div className="absolute right-0 mt-2 w-72 bg-surface-dark border border-accent-dark/20 rounded-2xl shadow-2xl slide-in-bottom z-50">
                        {/* Corp Info Header */}
                        {profile && (
                          <div className="p-4 border-b border-accent-dark/20">
                            <div className="flex items-center gap-3">
                              <div 
                                className="w-12 h-12 rounded-full border-3 flex items-center justify-center text-lg font-bold shadow-lg"
                                style={{ 
                                  backgroundColor: profile?.uniforms?.primaryColor || '#8B4513',
                                  borderColor: profile?.uniforms?.secondaryColor || '#F7941D',
                                  color: profile?.uniforms?.textColor || '#FFFFFF'
                                }}
                              >
                                {profile?.corps?.corpsName?.charAt(0) || 'C'}
                              </div>
                              <div className="flex-1">
                                <div className="font-bold text-text-primary-dark">{profile.corps?.corpsName}</div>
                                <div className="text-sm text-text-secondary-dark">{profile.corps?.alias}</div>
                                <div className={`inline-block mt-1 ${getClassBadge(profile.corps?.class)}`}>
                                  {profile.corps?.class || 'SoundSport'}
                                </div>
                              </div>
                            </div>
                            
                            {/* Quick Stats */}
                            <div className="grid grid-cols-3 gap-2 mt-3">
                              <div className="text-center bg-background-dark/50 p-2 rounded-lg">
                                <div className="text-lg font-bold text-primary-dark">{profile.corpsCoin || 0}</div>
                                <div className="text-xs text-text-secondary-dark">Coins</div>
                              </div>
                              <div className="text-center bg-background-dark/50 p-2 rounded-lg">
                                <div className="text-lg font-bold text-primary-dark">{profile.xp || 0}</div>
                                <div className="text-xs text-text-secondary-dark">XP</div>
                              </div>
                              <div className="text-center bg-background-dark/50 p-2 rounded-lg">
                                <div className="text-lg font-bold text-primary-dark">{profile.level || 1}</div>
                                <div className="text-xs text-text-secondary-dark">Level</div>
                              </div>
                            </div>
                          </div>
                        )}

                        {/* Menu Items */}
                        <div className="p-2">
                          <button
                            onClick={() => {
                              navigate(`/profile/${currentUser.uid}`);
                              setIsProfileDropdownOpen(false);
                            }}
                            className="w-full flex items-center gap-3 px-3 py-2 text-left hover:bg-accent-dark/20 rounded-lg transition-colors"
                          >
                            <User className="w-4 h-4 text-text-secondary-dark" />
                            <span className="text-text-primary-dark">View Profile</span>
                          </button>
                          
                          <button
                            onClick={() => {
                              navigate('/settings');
                              setIsProfileDropdownOpen(false);
                            }}
                            className="w-full flex items-center gap-3 px-3 py-2 text-left hover:bg-accent-dark/20 rounded-lg transition-colors"
                          >
                            <Settings className="w-4 h-4 text-text-secondary-dark" />
                            <span className="text-text-primary-dark">Settings</span>
                          </button>
                          
                          <hr className="my-2 border-accent-dark/20" />
                          
                          <button
                            onClick={handleLogout}
                            className="w-full flex items-center gap-3 px-3 py-2 text-left hover:bg-red-500/20 rounded-lg transition-colors text-red-400"
                          >
                            <X className="w-4 h-4" />
                            <span>Logout</span>
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </>
              ) : (
                <button 
                  onClick={() => setIsModalOpen(true)} 
                  className="btn-primary-glow"
                >
                  <User className="w-4 h-4 mr-2" />
                  Login
                </button>
              )}

              {/* Mobile Menu Button */}
              <button
                onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                className="lg:hidden btn-icon"
              >
                {isMobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
              </button>
            </div>
          </div>

          {/* Mobile Navigation Menu */}
          {isMobileMenuOpen && (
            <div className="lg:hidden mt-4 py-4 border-t border-accent-dark/20 slide-in-bottom">
              <div className="space-y-2">
                {navigationItems.map(item => (
                  <NavLink
                    key={item.path}
                    to={item.path}
                    onClick={() => setIsMobileMenuOpen(false)}
                    className={({ isActive }) => 
                      `block px-4 py-3 rounded-xl transition-all duration-200 ${
                        isActive 
                          ? 'bg-primary/10 text-primary-dark border-l-4 border-primary-dark' 
                          : 'text-text-secondary-dark hover:bg-accent-dark/20 hover:text-text-primary-dark'
                      }`
                    }
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-lg">{item.icon}</span>
                      {item.label}
                    </div>
                  </NavLink>
                ))}
              </div>

              {/* Mobile User Stats */}
              {currentUser && profile && (
                <div className="mt-4 pt-4 border-t border-accent-dark/20">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-primary/10 p-3 rounded-xl text-center">
                      <div className="text-lg font-bold text-primary-dark">{profile.corpsCoin || 0}</div>
                      <div className="text-xs text-text-secondary-dark">CorpsCoin</div>
                    </div>
                    <div className="bg-accent-dark/20 p-3 rounded-xl text-center">
                      <div className="text-lg font-bold text-text-primary-dark">Lv.{profile.level || 1}</div>
                      <div className="text-xs text-text-secondary-dark">Level</div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </nav>
      </header>

      {/* Auth Modal */}
      <AuthModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} />
    </>
  );
};

export default Header;