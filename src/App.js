import React, { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { useUserStore } from './store/userStore';
import Header from './components/layout/Header';
import Footer from './components/layout/Footer';

// --- IMPORT ALL EXISTING PAGES ---
import HomePage from './pages/HomePage';
import DashboardPage from './pages/DashboardPage';
import LeaguesPage from './pages/LeaguesPage';
import ScoresPage from './pages/ScoresPage';
import SchedulePage from './pages/SchedulePage';
import LeaderboardPage from './pages/LeaderboardPage';
import ProfilePage from './pages/ProfilePage';
import SettingsPage from './pages/SettingsPage';
import AdminPage from './pages/AdminPage';

const AppLayout = () => (
  <div className="flex flex-col min-h-screen bg-background dark:bg-background-dark transition-colors duration-200">
    <Header />
    <main className="flex-grow container mx-auto p-4">
      <Outlet />
    </main>
    <Footer />
  </div>
);

const UserProfileFetcher = () => {
  const { currentUser } = useAuth();
  const profile = useUserStore((state) => state.profile);
  const fetchUserProfile = useUserStore((state) => state.fetchUserProfile);
  
  const navigate = useNavigate();
  const location = useLocation();

  // FIXED: Only fetch when UID changes AND profile doesn't match
  useEffect(() => {
    if (currentUser) {
      // Only fetch if we don't have a profile OR the profile doesn't match the current user
      if (!profile || profile.id !== currentUser.uid) {
        console.log('App.js: Fetching profile for user', currentUser.uid);
        fetchUserProfile(currentUser.uid);
      }
    } else if (profile) {
      // Clear profile when user logs out
      useUserStore.getState().clearProfile();
    }
  }, [currentUser?.uid]); // CRITICAL: Only depend on UID, NOT profile or fetchUserProfile

  // FIXED: Handle navigation separately with proper dependencies
  useEffect(() => {
    if (currentUser && profile) {
      // Redirect logged-in users from home to dashboard
      if (location.pathname === '/') {
        navigate('/dashboard');
      }
    } else if (!currentUser) {
      // No user logged in, redirect to home if accessing protected pages
      const publicPaths = ['/', '/leaderboard', '/scores', '/schedule'];
      if (!publicPaths.includes(location.pathname) && !location.pathname.startsWith('/profile/')) {
        navigate('/');
      }
    }
  }, [currentUser, profile, location.pathname]); // Safe because we're not calling fetchUserProfile here

  return null;
};

function App() {
  // Initialize theme on app load
  useEffect(() => {
    const isDarkMode = localStorage.getItem('theme') === 'dark' ||
      (!localStorage.getItem('theme') && window.matchMedia('(prefers-color-scheme: dark)').matches);
    
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
    }
  }, []);

  return (
    <AuthProvider>
      <Router>
        <UserProfileFetcher />
        <Routes>
          <Route element={<AppLayout />}>
            <Route path="/" element={<HomePage />} />
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/leagues" element={<LeaguesPage />} />
            <Route path="/scores" element={<ScoresPage />} />
            <Route path="/schedule" element={<SchedulePage />} />
            <Route path="/leaderboard" element={<LeaderboardPage />} />
            <Route path="/profile/:userId" element={<ProfilePage />} />
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="/admin" element={<AdminPage />} />
          </Route>
        </Routes>
      </Router>
    </AuthProvider>
  );
}

export default App;