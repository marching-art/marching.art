// App.js - Enhanced Fantasy Drum Corps Game Application
// Optimized for 10,000+ users with premium UX and performance

import React, { useState, useEffect, Suspense, lazy } from 'react';
import { signOut } from 'firebase/auth';
import { auth } from './firebase';
import { AuthProvider, useAuth } from './context/AuthContext';
import { Toaster } from 'react-hot-toast';
import { useUserStore } from './store/userStore';
import { BrowserRouter as Router, Routes, Route, useNavigate, useLocation } from 'react-router-dom';
import { ErrorBoundary } from './components/ErrorBoundary';
import { motion, AnimatePresence } from 'framer-motion';

// Core Layout Components
import Header from './components/layout/Header';
import Footer from './components/layout/Footer';
import LoadingScreen from './components/ui/LoadingScreen';
import AuthModal from './components/auth/AuthModal';
import ProtectedRoute from './components/auth/ProtectedRoute';

// Lazy load pages for optimal performance
const HomePage = lazy(() => import('./pages/HomePage'));
const DashboardPage = lazy(() => import('./pages/DashboardPage'));
const ProfilePage = lazy(() => import('./pages/ProfilePage'));
const AdminPage = lazy(() => import('./pages/AdminPage'));
const LeaguePage = lazy(() => import('./pages/LeaguePage'));
const LeagueDetailPage = lazy(() => import('./pages/LeagueDetailPage'));
const LeaderboardPage = lazy(() => import('./pages/LeaderboardPage'));
const SchedulePage = lazy(() => import('./pages/SchedulePage'));
const ScoresPage = lazy(() => import('./pages/ScoresPage'));
const StatsPage = lazy(() => import('./pages/StatsPage'));
const HowToPlayPage = lazy(() => import('./pages/HowToPlayPage'));
const OnboardingFlow = lazy(() => import('./components/onboarding/OnboardingFlow'));
const AchievementsPage = lazy(() => import('./pages/AchievementsPage'));
const TradingCenterPage = lazy(() => import('./pages/TradingCenterPage'));
const EnhancedLineupBuilder = lazy(() => import('./components/EnhancedLineupBuilder'));
const AnalyticsPage = lazy(() => import('./pages/AnalyticsPage'));
const NotificationsPage = lazy(() => import('./pages/NotificationsPage'));
const SettingsPage = lazy(() => import('./pages/SettingsPage'));

// Enhanced Loading Component with progress
const AppLoadingFallback = ({ message = 'Loading...', showProgress = false }) => (
  <div className="min-h-screen bg-background dark:bg-background-dark flex items-center justify-center">
    <div className="text-center max-w-md">
      <div className="relative mb-4">
        <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-primary dark:border-primary-dark mx-auto"></div>
        {showProgress && (
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-xs font-bold text-primary dark:text-primary-dark">⚡</span>
          </div>
        )}
      </div>
      <h3 className="text-xl font-semibold text-text-primary dark:text-text-primary-dark mb-2">
        {message}
      </h3>
      <p className="text-text-secondary dark:text-text-secondary-dark">
        Building the ultimate fantasy drum corps experience...
      </p>
    </div>
  </div>
);

// Page transition animations
const pageVariants = {
  initial: { opacity: 0, y: 20 },
  in: { opacity: 1, y: 0 },
  out: { opacity: 0, y: -20 }
};

const pageTransition = {
  type: 'tween',
  ease: 'anticipate',
  duration: 0.3
};

// Enhanced Error Boundary for the entire app
class AppErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('App Error Boundary caught an error:', error, errorInfo);
    
    // Log error to analytics in production
    if (process.env.NODE_ENV === 'production') {
      // Could integrate with your analytics service here
    }
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-background dark:bg-background-dark flex items-center justify-center">
          <div className="text-center max-w-md p-8">
            <div className="text-6xl mb-4">🥁</div>
            <h1 className="text-2xl font-bold text-text-primary dark:text-text-primary-dark mb-4">
              Oops! Something went wrong
            </h1>
            <p className="text-text-secondary dark:text-text-secondary-dark mb-6">
              Don't worry - even the best drum corps have off days! Please refresh the page to try again.
            </p>
            <button
              onClick={() => window.location.reload()}
              className="px-6 py-3 bg-primary text-white rounded-lg hover:bg-primary-dark transition-colors"
            >
              Refresh Page
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

// Main App Content Component
const AppContent = () => {
  const { user, loggedInProfile, isLoadingAuth } = useUserStore();
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authMode, setAuthMode] = useState('login');
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const location = useLocation();

  // Monitor online status
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Handle authentication modal
  const openAuthModal = (mode = 'login') => {
    setAuthMode(mode);
    setShowAuthModal(true);
  };

  const closeAuthModal = () => {
    setShowAuthModal(false);
  };

  // Handle user logout
  const handleLogout = async () => {
    try {
      await signOut(auth);
      // The user store will automatically update via the auth state listener
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  // Show loading screen while authentication is being determined
  if (isLoadingAuth) {
    return <AppLoadingFallback message="Initializing game..." showProgress />;
  }

  return (
    <div className="min-h-screen bg-background dark:bg-background-dark">
      {/* Offline indicator */}
      {!isOnline && (
        <div className="bg-yellow-500 text-white text-center py-2 text-sm font-medium">
          🌐 You're offline. Some features may not work properly.
        </div>
      )}

      {/* Header */}
      <Header 
        user={user}
        profile={loggedInProfile}
        onLogin={() => openAuthModal('login')}
        onSignup={() => openAuthModal('signup')}
        onLogout={handleLogout}
      />

      {/* Main Content */}
      <main className="flex-1">
        <AnimatePresence mode="wait">
          <motion.div
            key={location.pathname}
            initial="initial"
            animate="in"
            exit="out"
            variants={pageVariants}
            transition={pageTransition}
          >
            <Suspense fallback={<AppLoadingFallback />}>
              <Routes>
                {/* Public Routes */}
                <Route path="/" element={<HomePage />} />
                <Route path="/how-to-play" element={<HowToPlayPage />} />
                <Route path="/leaderboard" element={<LeaderboardPage />} />
                <Route path="/schedule" element={<SchedulePage />} />
                <Route path="/scores" element={<ScoresPage />} />
                <Route path="/stats" element={<StatsPage />} />

                {/* Protected Routes */}
                <Route path="/dashboard" element={
                  <ProtectedRoute>
                    <DashboardPage />
                  </ProtectedRoute>
                } />
                
                <Route path="/profile" element={
                  <ProtectedRoute>
                    <ProfilePage />
                  </ProtectedRoute>
                } />

                <Route path="/onboarding" element={
                  <ProtectedRoute>
                    <OnboardingFlow />
                  </ProtectedRoute>
                } />

                <Route path="/achievements" element={
                  <ProtectedRoute>
                    <AchievementsPage />
                  </ProtectedRoute>
                } />

                <Route path="/trading" element={
                  <ProtectedRoute>
                    <TradingCenterPage />
                  </ProtectedRoute>
                } />

                <Route path="/lineup/:corpsClass?" element={
                  <ProtectedRoute>
                    <EnhancedLineupBuilder />
                  </ProtectedRoute>
                } />

                <Route path="/enhanced-lineup/:corpsClass?" element={
                  <ProtectedRoute>
                    <EnhancedLineupBuilder />
                  </ProtectedRoute>
                } />

                <Route path="/leagues" element={
                  <ProtectedRoute>
                    <LeaguePage />
                  </ProtectedRoute>
                } />

                <Route path="/league/:leagueId" element={
                  <ProtectedRoute>
                    <LeagueDetailPage />
                  </ProtectedRoute>
                } />

                <Route path="/notifications" element={
                  <ProtectedRoute>
                    <NotificationsPage />
                  </ProtectedRoute>
                } />

                <Route path="/settings" element={
                  <ProtectedRoute>
                    <SettingsPage />
                  </ProtectedRoute>
                } />

                {/* Admin Routes */}
                <Route path="/admin" element={
                  <ProtectedRoute adminOnly>
                    <AdminPage />
                  </ProtectedRoute>
                } />

                <Route path="/analytics" element={
                  <ProtectedRoute adminOnly>
                    <AnalyticsPage />
                  </ProtectedRoute>
                } />

                {/* 404 Route */}
                <Route path="*" element={
                  <div className="min-h-screen flex items-center justify-center">
                    <div className="text-center">
                      <div className="text-6xl mb-4">🥁</div>
                      <h1 className="text-3xl font-bold text-text-primary dark:text-text-primary-dark mb-4">
                        404 - Page Not Found
                      </h1>
                      <p className="text-text-secondary dark:text-text-secondary-dark mb-6">
                        Looks like this page marched off the field!
                      </p>
                      <button
                        onClick={() => window.history.back()}
                        className="px-6 py-3 bg-primary text-white rounded-lg hover:bg-primary-dark transition-colors"
                      >
                        Go Back
                      </button>
                    </div>
                  </div>
                } />
              </Routes>
            </Suspense>
          </motion.div>
        </AnimatePresence>
      </main>

      {/* Footer */}
      <Footer />

      {/* Authentication Modal */}
      <AuthModal
        isOpen={showAuthModal}
        onClose={closeAuthModal}
        mode={authMode}
        onSwitchMode={setAuthMode}
      />

      {/* Toast Notifications */}
      <Toaster
        position="top-right"
        toastOptions={{
          duration: 4000,
          className: 'bg-surface dark:bg-surface-dark text-text-primary dark:text-text-primary-dark',
          style: {
            background: 'var(--color-surface)',
            color: 'var(--color-text-primary)',
            border: '1px solid var(--color-accent)'
          }
        }}
      />
    </div>
  );
};

// Main App Component
const App = () => {
  return (
    <AppErrorBoundary>
      <AuthProvider>
        <Router>
          <div className="App font-body">
            <AppContent />
          </div>
        </Router>
      </AuthProvider>
    </AppErrorBoundary>
  );
};

export default App;