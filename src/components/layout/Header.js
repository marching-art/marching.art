import React, { useState } from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useUserStore } from '../../store/userStore';
import { signOut } from 'firebase/auth';
import { auth } from '../../firebaseConfig';
import AuthModal from '../auth/AuthModal';
import ThemeToggle from '../common/ThemeToggle';
import { 
  Settings, 
  Menu, 
  X,
  Home,
  LayoutDashboard,
  Users,
  Trophy,
  Calendar,
  BarChart3,
  LogOut,
  User
} from 'lucide-react';

const Header = () => {
  const { currentUser } = useAuth();
  const profile = useUserStore((state) => state.profile);
  const navigate = useNavigate();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const isAdmin = currentUser?.uid === 'o8vfRCOevjTKBY0k2dISlpiYiIH2';

  const handleLogout = async () => {
    try {
      await signOut(auth);
      useUserStore.getState().clearProfile();
      setIsMobileMenuOpen(false);
      navigate('/');
    } catch (error) {
      console.error("Failed to log out:", error);
    }
  };

  const navItems = [
    { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard', authRequired: true },
    { to: '/leagues', icon: Users, label: 'Leagues', authRequired: true },
    { to: '/scores', icon: Trophy, label: 'Scores', authRequired: false },
    { to: '/schedule', icon: Calendar, label: 'Schedule', authRequired: false },
    { to: '/leaderboard', icon: BarChart3, label: 'Leaderboard', authRequired: false }
  ];

  // Filter nav items based on auth status
  const visibleNavItems = currentUser 
    ? navItems 
    : navItems.filter(item => !item.authRequired);

  const closeMobileMenu = () => setIsMobileMenuOpen(false);

  return (
    <>
      <header className="bg-surface dark:bg-surface-dark text-text-primary dark:text-text-primary-dark shadow-theme dark:shadow-theme-dark sticky top-0 z-40 border-b border-accent dark:border-accent-dark">
        <nav className="container mx-auto px-4 py-3 flex justify-between items-center">
          {/* Logo */}
          <Link 
            to="/" 
            className="text-xl sm:text-2xl font-bold text-primary dark:text-primary-dark hover:text-secondary dark:hover:text-secondary-dark transition-colors"
            onClick={closeMobileMenu}
          >
            marching.art
          </Link>
          
          {/* Desktop Navigation */}
          <div className="hidden lg:flex items-center space-x-6">
            {visibleNavItems.map(item => (
              <NavLink 
                key={item.to}
                to={item.to} 
                className={({ isActive }) => 
                  `transition-colors flex items-center gap-2 ${isActive ? "text-primary dark:text-primary-dark font-semibold" : "text-text-secondary dark:text-text-secondary-dark hover:text-primary dark:hover:text-primary-dark"}`
                }
              >
                <item.icon className="w-4 h-4" />
                {item.label}
              </NavLink>
            ))}
            
            {isAdmin && (
              <NavLink 
                to="/admin" 
                className={({ isActive }) => 
                  `transition-colors flex items-center gap-2 ${isActive ? "text-primary dark:text-primary-dark font-semibold" : "text-text-secondary dark:text-text-secondary-dark hover:text-primary dark:hover:text-primary-dark"}`
                }
              >
                <Settings className="w-4 h-4" />
                Admin
              </NavLink>
            )}
          </div>

          {/* Desktop Right Side */}
          <div className="hidden lg:flex items-center space-x-4">
            <ThemeToggle />
            
            {currentUser ? (
              <>
                <NavLink
                  to="/settings"
                  className="p-2 hover:bg-accent dark:hover:bg-accent-dark rounded-theme transition-colors"
                  title="Settings"
                >
                  <Settings className="w-5 h-5" />
                </NavLink>
                <NavLink
                  to={`/profile/${currentUser.uid}`}
                  className="p-2 hover:bg-accent dark:hover:bg-accent-dark rounded-theme transition-colors"
                  title="Profile"
                >
                  <User className="w-5 h-5" />
                </NavLink>
                <button
                  onClick={handleLogout}
                  className="px-4 py-2 bg-error hover:bg-error-dark text-white rounded-theme transition-colors font-semibold"
                >
                  Logout
                </button>
              </>
            ) : (
              <button
                onClick={() => setIsModalOpen(true)}
                className="px-4 py-2 bg-primary dark:bg-primary-dark hover:bg-primary-dark dark:hover:bg-primary text-white rounded-theme transition-colors font-semibold"
              >
                Login
              </button>
            )}
          </div>

          {/* Mobile Menu Button */}
          <div className="flex items-center gap-2 lg:hidden">
            <ThemeToggle />
            <button
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="p-2 hover:bg-accent dark:hover:bg-accent-dark rounded-theme transition-colors"
              aria-label="Toggle menu"
            >
              {isMobileMenuOpen ? (
                <X className="w-6 h-6" />
              ) : (
                <Menu className="w-6 h-6" />
              )}
            </button>
          </div>
        </nav>

        {/* Mobile Menu Overlay */}
        {isMobileMenuOpen && (
          <div 
            className="fixed inset-0 bg-black/50 z-40 lg:hidden"
            onClick={closeMobileMenu}
          />
        )}

        {/* Mobile Menu Drawer */}
        <div 
          className={`fixed top-[57px] right-0 bottom-0 w-64 bg-surface dark:bg-surface-dark border-l border-accent dark:border-accent-dark z-50 transform transition-transform duration-300 ease-in-out lg:hidden ${
            isMobileMenuOpen ? 'translate-x-0' : 'translate-x-full'
          }`}
        >
          <div className="flex flex-col h-full">
            {/* Navigation Links */}
            <nav className="flex-1 overflow-y-auto py-4">
              {visibleNavItems.map(item => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  onClick={closeMobileMenu}
                  className={({ isActive }) =>
                    `flex items-center gap-3 px-6 py-3 transition-colors ${
                      isActive
                        ? 'bg-primary/10 dark:bg-primary-dark/10 text-primary dark:text-primary-dark font-semibold border-r-4 border-primary dark:border-primary-dark'
                        : 'text-text-secondary dark:text-text-secondary-dark hover:bg-accent dark:hover:bg-accent-dark'
                    }`
                  }
                >
                  <item.icon className="w-5 h-5" />
                  {item.label}
                </NavLink>
              ))}

              {isAdmin && (
                <NavLink
                  to="/admin"
                  onClick={closeMobileMenu}
                  className={({ isActive }) =>
                    `flex items-center gap-3 px-6 py-3 transition-colors ${
                      isActive
                        ? 'bg-primary/10 dark:bg-primary-dark/10 text-primary dark:text-primary-dark font-semibold border-r-4 border-primary dark:border-primary-dark'
                        : 'text-text-secondary dark:text-text-secondary-dark hover:bg-accent dark:hover:bg-accent-dark'
                    }`
                  }
                >
                  <Settings className="w-5 h-5" />
                  Admin
                </NavLink>
              )}
            </nav>

            {/* Bottom Actions */}
            <div className="border-t border-accent dark:border-accent-dark p-4 space-y-2">
              {currentUser ? (
                <>
                  <NavLink
                    to={`/profile/${currentUser.uid}`}
                    onClick={closeMobileMenu}
                    className="flex items-center gap-3 px-4 py-3 bg-accent dark:bg-accent-dark rounded-theme text-text-primary dark:text-text-primary-dark hover:bg-accent-dark dark:hover:bg-accent transition-colors"
                  >
                    <User className="w-5 h-5" />
                    Profile
                  </NavLink>
                  <NavLink
                    to="/settings"
                    onClick={closeMobileMenu}
                    className="flex items-center gap-3 px-4 py-3 bg-accent dark:bg-accent-dark rounded-theme text-text-primary dark:text-text-primary-dark hover:bg-accent-dark dark:hover:bg-accent transition-colors"
                  >
                    <Settings className="w-5 h-5" />
                    Settings
                  </NavLink>
                  <button
                    onClick={handleLogout}
                    className="w-full flex items-center gap-3 px-4 py-3 bg-error hover:bg-error-dark text-white rounded-theme transition-colors font-semibold"
                  >
                    <LogOut className="w-5 h-5" />
                    Logout
                  </button>
                </>
              ) : (
                <button
                  onClick={() => {
                    setIsModalOpen(true);
                    closeMobileMenu();
                  }}
                  className="w-full px-4 py-3 bg-primary dark:bg-primary-dark hover:bg-primary-dark dark:hover:bg-primary text-white rounded-theme transition-colors font-semibold"
                >
                  Login / Sign Up
                </button>
              )}
            </div>
          </div>
        </div>
      </header>

      <AuthModal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
      />
    </>
  );
};

export default Header;