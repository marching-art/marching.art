import React, { useState } from 'react';
import { Link, NavLink } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useUserStore } from '../../store/userStore';
import { signOut } from 'firebase/auth';
import { auth } from '../../firebaseConfig';
import AuthModal from '../auth/AuthModal';
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
      useUserStore.getState().fetchUserProfile(null);
    } catch (error) {
      console.error("Failed to log out:", error);
    }
  };

  return (
    <>
      <header className="bg-surface-dark text-text-primary-dark shadow-theme-dark sticky top-0 z-40">
        <nav className="container mx-auto px-4 py-3 flex justify-between items-center">
          <Link to="/" className="text-2xl font-bold text-primary dark:text-primary-dark text-shadow">
            marching.art
          </Link>
          <div className="hidden md:flex items-center space-x-6">
            <NavLink to="/dashboard" className={({ isActive }) => isActive ? "text-primary-dark" : "hover:text-primary-dark"}>
              Dashboard
            </NavLink>
            <NavLink to="/leagues" className={({ isActive }) => isActive ? "text-primary-dark" : "hover:text-primary-dark"}>
              Leagues
            </NavLink>
            <NavLink to="/scores" className={({ isActive }) => isActive ? "text-primary-dark" : "hover:text-primary-dark"}>
              Scores
            </NavLink>
            <NavLink to="/schedule" className={({ isActive }) => isActive ? "text-primary-dark" : "hover:text-primary-dark"}>
              Schedule
            </NavLink>
            <NavLink to="/leaderboard" className={({ isActive }) => isActive ? "text-primary-dark" : "hover:text-primary-dark"}>
              Leaderboard
            </NavLink>
            {/* ADMIN NAVIGATION - Only show for admin user */}
            {isAdmin && (
              <NavLink 
                to="/admin" 
                className={({ isActive }) => 
                  `flex items-center space-x-1 ${isActive ? "text-red-400" : "hover:text-red-400"}`
                }
              >
                <Settings className="w-4 h-4" />
                <span>Admin</span>
              </NavLink>
            )}
          </div>
          <div>
            {currentUser ? (
              <div className="relative">
                <span className="mr-4">
                  Welcome, {profile?.displayName || currentUser.email}
                  {isAdmin && <span className="ml-2 text-red-400 text-xs font-bold">[ADMIN]</span>}
                </span>
                <button 
                  onClick={handleLogout} 
                  className="bg-primary hover:bg-primary-dark text-on-primary font-bold py-2 px-4 rounded-theme"
                >
                  Logout
                </button>
              </div>
            ) : (
              <button 
                onClick={() => setIsModalOpen(true)} 
                className="bg-primary hover:bg-primary-dark text-on-primary font-bold py-2 px-4 rounded-theme"
              >
                Login
              </button>
            )}
          </div>
        </nav>
      </header>
      <AuthModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} />
    </>
  );
};

export default Header;