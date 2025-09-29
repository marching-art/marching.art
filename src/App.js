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

// --- IMPORT NEW ADMIN PAGE ---
import AdminPage from './pages/AdminPage';

const AppLayout = () => (
  <div className="flex flex-col min-h-screen bg-background dark:bg-background-dark">
    <Header />
    <main className="flex-grow container mx-auto p-4">
      <Outlet />
    </main>
    <Footer />
  </div>
);

const UserProfileFetcher = () => {
  const { currentUser } = useAuth();
  const { profile, fetchUserProfile, isLoading } = useUserStore((state) => ({
    profile: state.profile,
    fetchUserProfile: state.fetchUserProfile,
    isLoading: state.isLoading
  }));
  
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (currentUser) {
      // Always fetch profile when we have a user
      if (!profile || profile.id !== currentUser.uid) {
        fetchUserProfile(currentUser.uid);
      }
      
      // Redirect logged-in users from home to dashboard
      // But only after profile is loaded to avoid race conditions
      if (location.pathname === '/' && profile && !isLoading) {
        navigate('/dashboard');
      }
    } else {
      // No user logged in, redirect to home if they're trying to access protected pages
      const publicPaths = ['/', '/leaderboard', '/scores', '/schedule'];
      if (!publicPaths.includes(location.pathname) && !location.pathname.startsWith('/profile/')) {
        navigate('/');
      }
    }
  }, [currentUser, profile, fetchUserProfile, navigate, location.pathname, isLoading]);

  return null;
};

function App() {
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
            {/* NEW ADMIN ROUTE - Only accessible to admin user */}
            <Route path="/admin" element={<AdminPage />} />
          </Route>
        </Routes>
      </Router>
    </AuthProvider>
  );
}

export default App;