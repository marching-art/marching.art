import React, { useEffect, lazy, Suspense } from 'react';
import { BrowserRouter as Router, Routes, Route, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { useUserStore } from './store/userStore';
import Header from './components/layout/Header';
import Footer from './components/layout/Footer';
import LoadingScreen from './components/common/LoadingScreen';

// Lazy load pages for better performance
const HomePage = lazy(() => import('./pages/HomePage'));
const DashboardPage = lazy(() => import('./pages/DashboardPage'));
const LeaguesPage = lazy(() => import('./pages/LeaguesPage'));
const ScoresPage = lazy(() => import('./pages/ScoresPage'));
const SchedulePage = lazy(() => import('./pages/SchedulePage'));
const LeaderboardPage = lazy(() => import('./pages/LeaderboardPage'));
const ProfilePage = lazy(() => import('./pages/ProfilePage'));
const SettingsPage = lazy(() => import('./pages/SettingsPage'));
const AdminPage = lazy(() => import('./pages/AdminPage'));

const AppLayout = () => (
  <div className="flex flex-col min-h-screen bg-background dark:bg-background-dark transition-colors duration-200">
    <Header />
    <main className="flex-grow container mx-auto p-4 max-w-7xl">
      <Suspense fallback={<LoadingScreen message="Loading page..." />}>
        <Outlet />
      </Suspense>
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