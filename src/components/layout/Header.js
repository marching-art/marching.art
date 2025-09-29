import React, { useState } from 'react';
import { Link, NavLink } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useUserStore } from '../../store/userStore';
import { signOut } from 'firebase/auth';
import { auth } from '../../firebaseConfig';
import AuthModal from '../auth/AuthModal';
import ThemeToggle from '../common/ThemeToggle';
import { Settings } from 'lucide-react';

const Header = () => {
  const { currentUser } = useAuth();
  const profile = useUserStore((state) => state.profile);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Check if current user is admin
  const isAdmin = currentUser?.uid === 'o8vfRCOevjTKBY0k2dISlpiYiIH2';

  const handleLogout = async () => {
    try {
      await signOut(auth);
      useUserStore.getState().clearProfile();
    } catch (error) {
      console.error("Failed to log out:", error);
    }
  };

  return (
    <>
      <header className="bg-surface dark:bg-surface-dark text-text-primary dark:text-text-primary-dark shadow-theme dark:shadow-theme-dark sticky top-0 z-40 border-b border-accent dark:border-accent-dark">
        <nav className="container mx-auto px-4 py-3 flex justify-between items-center">
          <Link to="/" className="text-2xl font-bold text-primary dark:text-primary-dark hover:text-secondary dark:hover:text-secondary-dark transition-colors">
            marching.art
          </Link>
          
          <div className="hidden md:flex items-center space-x-6">
            {currentUser && (
              <>
                <NavLink 
                  to="/dashboard" 
                  className={({ isActive }) => 
                    `transition-colors ${isActive ? "text-primary dark:text-primary-dark font-semibold" : "text-text-secondary dark:text-text-secondary-dark hover:text-primary dark:hover:text-primary-dark"}`
                  }
                >
                  Dashboard
                </NavLink>
                <NavLink 
                  to="/leagues" 
                  className={({ isActive }) => 
                    `transition-colors ${isActive ? "text-primary dark:text-primary-dark font-semibold" : "text-text-secondary dark:text-text-secondary-dark hover:text-primary dark:hover:text-primary-dark"}`
                  }
                >
                  Leagues
                </NavLink>
                <NavLink 
                  to="/scores" 
                  className={({ isActive }) => 
                    `transition-colors ${isActive ? "text-primary dark:text-primary-dark font-semibold" : "text-text-secondary dark:text-text-secondary-dark hover:text-primary dark:hover:text-primary-dark"}`
                  }
                >
                  Scores
                </NavLink>
                <NavLink 
                  to="/schedule" 
                  className={({ isActive }) => 
                    `transition-colors ${isActive ? "text-primary dark:text-primary-dark font-semibold" : "text-text-secondary dark:text-text-secondary-dark hover:text-primary dark:hover:text-primary-dark"}`
                  }
                >
                  Schedule
                </NavLink>
              </>
            )}
            <NavLink 
              to="/leaderboard" 
              className={({ isActive }) => 
                `transition-colors ${isActive ? "text-primary dark:text-primary-dark font-semibold" : "text-text-secondary dark:text-text-secondary-dark hover:text-primary dark:hover:text-primary-dark"}`
              }
            >
              Leaderboard
            </NavLink>
            
            {/* ADMIN NAVIGATION */}
            {isAdmin && (
              <NavLink 
                to="/admin" 
                className={({ isActive }) => 
                  `flex items-center space-x-1 transition-colors ${isActive ? "text-error font-semibold" : "text-error opacity-70 hover:opacity-100"}`
                }
              >
                <Settings className="w-4 h-4" />
                <span>Admin</span>
              </NavLink>
            )}
          </div>
          
          <div className="flex items-center gap-3">
            <ThemeToggle />
            
            {currentUser ? (
              <div className="flex items-center gap-4">
                <span className="text-text-secondary dark:text-text-secondary-dark text-sm hidden sm:block">
                  {profile?.corps?.corpsName || 'Director'}
                  {isAdmin && <span className="ml-2 text-error text-xs font-bold">[ADMIN]</span>}
                </span>
                <button 
                  onClick={handleLogout} 
                  className="bg-primary dark:bg-primary-dark hover:bg-secondary dark:hover:bg-secondary-dark text-on-primary dark:text-on-primary-dark font-bold py-2 px-4 rounded-theme transition-colors"
                >
                  Logout
                </button>
              </div>
            ) : (
              <button 
                onClick={() => setIsModalOpen(true)} 
                className="bg-primary dark:bg-primary-dark hover:bg-secondary dark:hover:bg-secondary-dark text-on-primary dark:text-on-primary-dark font-bold py-2 px-4 rounded-theme transition-colors"
              >
                Login
              </button>
            )}
          </div>
        </nav>
      </header>
      <AuthModal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)}
        defaultMode="login"
      />
    </>
  );
};

export default Header;