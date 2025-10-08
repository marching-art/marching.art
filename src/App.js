import React, { useEffect, Suspense, lazy } from 'react';
import { BrowserRouter as Router, Routes, Route, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { useUserStore } from './store/userStore';
import LoadingScreen from './components/common/LoadingScreen';

// Critical components loaded immediately
import Header from './components/layout/Header';
import Footer from './components/layout/Footer';
import BottomNav from './components/layout/BottomNav';

// Lazy load all pages for better performance
const HomePage = lazy(() => import('./pages/HomePage'));
const DashboardPage = lazy(() => import('./pages/DashboardPage'));
const LeaguesPage = lazy(() => import('./pages/LeaguesPage'));
const ScoresPage = lazy(() => import('./pages/ScoresPage'));
const SchedulePage = lazy(() => import('./pages/SchedulePage'));
const LeaderboardPage = lazy(() => import('./pages/LeaderboardPage'));
const ProfilePage = lazy(() => import('./pages/ProfilePage'));
const SettingsPage = lazy(() => import('./pages/SettingsPage'));
const AdminPage = lazy(() => import('./pages/AdminPage'));

const AppLayout = () => {
  const { currentUser } = useAuth();
  
  return (
    <div className="flex flex-col min-h-screen bg-background dark:bg-background-dark transition-colors duration-200">
      {/* Skip to main content link for accessibility */}
      <a 
        href="#main-content" 
        className="skip-link"
        tabIndex={0}
      >
        Skip to main content
      </a>
      
      <Header />
      <main 
        id="main-content"
        className={`flex-grow container mx-auto p-4 ${currentUser ? 'pb-20 lg:pb-4' : ''}`}
        role="main"
        aria-label="Main content"
      >
        <Suspense fallback={<LoadingScreen fullScreen={false} />}>
          <Outlet />
        </Suspense>
      </main>
      <Footer />
      <BottomNav />
    </div>
  );
};

const UserProfileFetcher = () => {
  const { currentUser } = useAuth();
  const profile = useUserStore((state) => state.profile);
  const fetchUserProfile = useUserStore((state) => state.fetchUserProfile);
  
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (currentUser) {
      if (!profile || profile.id !== currentUser.uid) {
        fetchUserProfile(currentUser.uid);
      }
    } else if (profile) {
      useUserStore.getState().clearProfile();
    }
  }, [currentUser?.uid]);

  useEffect(() => {
    if (currentUser && profile) {
      if (location.pathname === '/') {
        navigate('/dashboard');
      }
    } else if (!currentUser) {
      const publicPaths = ['/', '/leaderboard', '/scores', '/schedule'];
      if (!publicPaths.includes(location.pathname) && !location.pathname.startsWith('/profile/')) {
        navigate('/');
      }
    }
  }, [currentUser, profile, location.pathname, navigate]);

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
            <Route path="/admin" element={<AdminPage />} />
          </Route>
        </Routes>
      </Router>
    </AuthProvider>
  );
}

export default App;