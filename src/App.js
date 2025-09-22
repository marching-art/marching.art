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
const LineupBuilder = lazy(() => import('./components/LineupBuilder')); // FIXED: Using correct component name
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
            <span className="text-xs font-bold text-primary dark:text-primary-dark">
              %
            </span>
          </div>
        )}
      </div>
      <p className="text-text-secondary dark:text-text-secondary-dark font-medium">
        {message}
      </p>
      <div className="text-xs text-text-secondary dark:text-text-secondary-dark mt-2 opacity-60">
        🎺 Preparing the ultimate drum corps experience...
      </div>
    </div>
  </div>
);

// Performance monitoring component
const PerformanceTracker = () => {
  useEffect(() => {
    // Monitor core web vitals
    if ('PerformanceObserver' in window) {
      const observer = new PerformanceObserver((list) => {
        list.getEntries().forEach((entry) => {
          // Track key metrics for optimization
          if (entry.entryType === 'navigation') {
            console.debug('Page load time:', entry.loadEventEnd - entry.loadEventStart);
          }
        });
      });
      observer.observe({ entryTypes: ['navigation', 'paint'] });
    }
  }, []);
  return null;
};

// Enhanced error fallback component
const ErrorFallback = ({ error, resetErrorBoundary }) => (
  <div className="min-h-screen bg-background dark:bg-background-dark flex items-center justify-center p-4">
    <div className="text-center max-w-md">
      <div className="text-6xl mb-4">🥁</div>
      <h1 className="text-2xl font-bold text-text-primary dark:text-text-primary-dark mb-4">
        Something went off tempo!
      </h1>
      <p className="text-text-secondary dark:text-text-secondary-dark mb-6">
        Don't worry - even the best corps have bad rehearsals. Let's get back in sync.
      </p>
      <div className="space-y-4">
        <button
          onClick={resetErrorBoundary}
          className="w-full bg-primary text-on-primary px-6 py-3 rounded-theme font-medium hover:bg-primary-hover transition-colors"
        >
          Try Again
        </button>
        <button
          onClick={() => window.location.href = '/'}
          className="w-full bg-surface dark:bg-surface-dark text-text-primary dark:text-text-primary-dark px-6 py-3 rounded-theme font-medium border border-accent dark:border-accent-dark hover:bg-accent/10 transition-colors"
        >
          Return to Home
        </button>
      </div>
    </div>
  </div>
);

// Main App component
const AppContent = () => {
  const { user, loggedInProfile, initializeUser, clearUser, isLoadingAuth } = useUserStore();
  const [authModal, setAuthModal] = useState({ isOpen: false, mode: 'login' });
  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  const location = useLocation();

  // Initialize authentication state
  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged(async (authUser) => {
      if (authUser) {
        await initializeUser(authUser);
      } else {
        clearUser();
      }
    });

    return () => unsubscribe();
  }, [initializeUser, clearUser]);

  // Handle offline status
  useEffect(() => {
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Enhanced logout with cleanup
  const handleLogout = async () => {
    try {
      await signOut(auth);
      clearUser();
      window.location.href = '/';
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  // Auth modal management
  const openAuthModal = (mode = 'login') => {
    setAuthModal({ isOpen: true, mode });
  };

  const closeAuthModal = () => {
    setAuthModal({ isOpen: false, mode: 'login' });
  };

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

  // Show loading screen during auth initialization
  if (isLoadingAuth) {
    return <LoadingScreen message="Initializing your drum corps experience..." />;
  }

  return (
    <div className="flex flex-col min-h-screen">
      {/* Performance monitoring */}
      <PerformanceTracker />

      {/* Offline indicator */}
      {isOffline && (
        <div className="bg-yellow-500 text-yellow-900 px-4 py-2 text-center text-sm font-medium">
          🚫 You're offline. Some features may not work properly.
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

                {/* FIXED: Both lineup routes now use LineupBuilder */}
                <Route path="/lineup/:corpsClass?" element={
                  <ProtectedRoute>
                    <LineupBuilder />
                  </ProtectedRoute>
                } />

                <Route path="/enhanced-lineup/:corpsClass?" element={
                  <ProtectedRoute>
                    <LineupBuilder />
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
                      <motion.button
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={() => window.history.back()}
                        className="bg-primary text-on-primary px-6 py-3 rounded-theme font-medium hover:bg-primary-hover transition-colors"
                      >
                        Return to Formation
                      </motion.button>
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

      {/* Modals */}
      <AuthModal
        isOpen={authModal.isOpen}
        mode={authModal.mode}
        onClose={closeAuthModal}
        onSwitchMode={(newMode) => setAuthModal({ ...authModal, mode: newMode })}
      />

      {/* Toast notifications */}
      <Toaster
        position="top-right"
        toastOptions={{
          duration: 4000,
          style: {
            background: 'var(--surface)',
            color: 'var(--text-primary)',
            border: '1px solid var(--accent)',
          },
          success: {
            iconTheme: {
              primary: 'var(--primary)',
              secondary: 'var(--on-primary)',
            },
          },
          error: {
            iconTheme: {
              primary: 'var(--error)',
              secondary: 'var(--on-error)',
            },
          },
        }}
      />
    </div>
  );
};

// Root App wrapper with providers
const App = () => {
  return (
    <ErrorBoundary fallback={ErrorFallback}>
      <AuthProvider>
        <Router>
          <AppContent />
        </Router>
      </AuthProvider>
    </ErrorBoundary>
  );
};

export default App;