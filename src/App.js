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

  // FIXED: Fetch profile only when user changes, not when profile/fetchUserProfile changes
  useEffect(() => {
    if (currentUser && (!profile || profile.id !== currentUser.uid)) {
      console.log('App.js: Fetching profile for user', currentUser.uid);
      fetchUserProfile(currentUser.uid);
    }
  }, [currentUser?.uid]); // ONLY depend on currentUser.uid

  // FIXED: Handle navigation in a separate effect
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
  }, [currentUser, profile, location.pathname, navigate]);

  return null;
};

function App() {
  useEffect(() => {
    // Initialize theme on app load
    const savedTheme = localStorage.getItem('theme');
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    
    if (savedTheme === 'dark' || (!savedTheme && prefersDark)) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
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