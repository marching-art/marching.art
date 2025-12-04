// src/App.jsx
import React, { useState, useEffect, createContext, useContext, lazy, Suspense } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Toaster } from 'react-hot-toast';
import { useAuthState } from 'react-firebase-hooks/auth';
import { QueryClientProvider } from '@tanstack/react-query';
import { auth, authHelpers, analyticsHelpers } from './firebase';
import { queryClient } from './lib/queryClient';
import LoadingScreen from './components/LoadingScreen';
import GamingHeader from './components/GamingHeader';
import BottomNav from './components/BottomNav';
import PWAInstallPrompt from './components/PWAInstallPrompt';
import { CelebrationContainer } from './components/Celebration';
import Tutorial from './components/Tutorial';
import ErrorBoundary from './components/ErrorBoundary';
import { PageErrorBoundary } from './components/PageErrorBoundary';
import { ThemeProvider, useTheme } from './context/ThemeContext';
import { useSeasonStore } from './store/seasonStore';

// Lazy load pages for better performance
const Dashboard = lazy(() => import('./pages/Dashboard'));
const Schedule = lazy(() => import('./pages/Schedule'));
const Scores = lazy(() => import('./pages/Scores'));
const Profile = lazy(() => import('./pages/Profile'));
const Settings = lazy(() => import('./pages/Settings'));
const HowToPlay = lazy(() => import('./pages/HowToPlay'));
const HallOfChampions = lazy(() => import('./pages/HallOfChampions'));
const Admin = lazy(() => import('./pages/Admin'));
const Staff = lazy(() => import('./pages/Staff'));
const BattlePass = lazy(() => import('./pages/BattlePass'));
const Leagues = lazy(() => import('./pages/Leagues'));
const Onboarding = lazy(() => import('./pages/Onboarding'));
const Login = lazy(() => import('./pages/Login'));
const Register = lazy(() => import('./pages/Register'));
const Landing = lazy(() => import('./pages/Landing'));
const RetiredCorpsGallery = lazy(() => import('./pages/RetiredCorpsGallery'));
const CorpsHistory = lazy(() => import('./pages/CorpsHistory'));
const Privacy = lazy(() => import('./pages/Privacy'));
const Terms = lazy(() => import('./pages/Terms'));

// Helper component to wrap pages with error boundaries
const Page = ({ name, children }) => (
  <PageErrorBoundary name={name}>
    {children}
  </PageErrorBoundary>
);

// Auth Context
const AuthContext = createContext(null);
export const useAuth = () => useContext(AuthContext);

// Page transition animations
const pageVariants = {
  initial: {
    opacity: 0,
    y: 20
  },
  in: {
    opacity: 1,
    y: 0
  },
  out: {
    opacity: 0,
    y: -20
  }
};

const pageTransition = {
  type: 'tween',
  ease: 'anticipate',
  duration: 0.5
};

// Protected Route Component
const ProtectedRoute = ({ children }) => {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return <LoadingScreen />;
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return children;
};

// Layout Component
const Layout = ({ children }) => {
  const location = useLocation();

  useEffect(() => {
    // Log page views
    analyticsHelpers.logPageView(location.pathname);
  }, [location]);

  return (
    <div className="min-h-screen font-sans transition-colors duration-200 bg-surface text-text-main">
      {/* Global Gaming Header - Top Navigation */}
      <GamingHeader />

      {/* Main Content */}
      <main className="min-h-screen pb-20 lg:pb-8">
        <AnimatePresence mode="wait">
          <motion.div
            key={location.pathname}
            initial="initial"
            animate="in"
            exit="out"
            variants={pageVariants}
            transition={pageTransition}
            className="container-responsive py-6"
          >
            <Suspense fallback={<LoadingScreen />}>
              {children}
            </Suspense>
          </motion.div>
        </AnimatePresence>
      </main>

      {/* Mobile Bottom Navigation */}
      <BottomNav />

      {/* Footer */}
      <footer className="mt-auto mb-20 lg:mb-0">
        <div className="container-responsive py-8 border-t border-cream-500/20">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <p className="text-cream-500/60 text-sm">
              © 2025 marching.art - The Ultimate Fantasy Drum Corps Game
            </p>
            <div className="flex gap-6">
              <a href="/privacy" className="text-cream-500/60 hover:text-gold-500 text-sm transition-colors">
                Privacy
              </a>
              <a href="/terms" className="text-cream-500/60 hover:text-gold-500 text-sm transition-colors">
                Terms
              </a>
              <a href="/support" className="text-cream-500/60 hover:text-gold-500 text-sm transition-colors">
                Support
              </a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};

// Main App Component
function App() {
  const [user, loading, error] = useAuthState(auth);
  const [initialAuthChecked, setInitialAuthChecked] = useState(false);
  const initSeasonListener = useSeasonStore((state) => state.initSeasonListener);
  const cleanupSeasonListener = useSeasonStore((state) => state.cleanup);

  // Initialize global season listener ONCE at app startup
  // This prevents duplicate Firestore listeners across components
  useEffect(() => {
    const unsubscribe = initSeasonListener();
    return () => {
      cleanupSeasonListener();
    };
  }, [initSeasonListener, cleanupSeasonListener]);

  useEffect(() => {
    // Check for initial auth token (from URL parameters)
    const urlParams = new URLSearchParams(window.location.search);
    const authToken = urlParams.get('__initial_auth_token');

    if (authToken && !user && !loading) {
      authHelpers.signInWithToken(authToken)
        .then(() => {
          // Remove token from URL
          window.history.replaceState({}, document.title, window.location.pathname);
        })
        .catch((err) => {
          console.error('Error with initial auth token:', err);
        })
        .finally(() => {
          setInitialAuthChecked(true);
        });
    } else {
      setInitialAuthChecked(true);
    }
  }, [user, loading]);

  if (!initialAuthChecked || loading) {
    return <LoadingScreen fullScreen />;
  }

  const authContextValue = {
    user,
    loading,
    error,
    signIn: authHelpers.signInWithEmail,
    signUp: authHelpers.signUpWithEmail,
    signInAnonymously: authHelpers.signInAnon,
    signOut: authHelpers.signOut
  };

  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider>
          <AuthContext.Provider value={authContextValue}>
            <Router>
          {/* Global Components */}
          <Toaster
            position="top-right"
            toastOptions={{
              duration: 4000,
              style: {
                background: 'var(--bg-secondary)',
                color: 'var(--text-primary)',
                border: '1px solid var(--border-color)',
                borderRadius: '0.5rem',
              },
              success: {
                iconTheme: {
                  primary: 'var(--color-primary)',
                  secondary: 'var(--color-surface-secondary)',
                },
              },
              error: {
                iconTheme: {
                  primary: 'var(--color-danger)',
                  secondary: 'var(--color-surface-secondary)',
                },
              },
            }}
          />

        {/* PWA Install Prompt - shows after user engagement */}
        {user && <PWAInstallPrompt />}

        {/* Celebration System - for achievements and level ups */}
        <CelebrationContainer />

        {/* First-Time Tutorial - shows on first login */}
        {user && <Tutorial />}

        <Routes>
          {/* Public Routes */}
          <Route path="/" element={user ? <Navigate to="/dashboard" /> : <Suspense fallback={<LoadingScreen fullScreen />}><Landing /></Suspense>} />
          <Route path="/login" element={user ? <Navigate to="/dashboard" /> : <Suspense fallback={<LoadingScreen fullScreen />}><Login /></Suspense>} />
          <Route path="/register" element={user ? <Navigate to="/dashboard" /> : <Suspense fallback={<LoadingScreen fullScreen />}><Register /></Suspense>} />
          <Route path="/how-to-play" element={<Suspense fallback={<LoadingScreen fullScreen />}><HowToPlay /></Suspense>} />
          <Route path="/privacy" element={<Suspense fallback={<LoadingScreen fullScreen />}><Privacy /></Suspense>} />
          <Route path="/terms" element={<Suspense fallback={<LoadingScreen fullScreen />}><Terms /></Suspense>} />

          {/* Onboarding - Protected but minimal layout */}
          <Route path="/onboarding" element={
            <ProtectedRoute>
              <Suspense fallback={<LoadingScreen fullScreen />}>
                <Onboarding />
              </Suspense>
            </ProtectedRoute>
          } />

          {/* Protected Routes - Each page wrapped with error boundary */}
          <Route path="/dashboard" element={
            <ProtectedRoute>
              <Layout>
                <Page name="Dashboard"><Dashboard /></Page>
              </Layout>
            </ProtectedRoute>
          } />

          {/* Redirect old /hub route to /leagues */}
          <Route path="/hub" element={<Navigate to="/leagues" replace />} />

          {/* Redirect old /leaderboard route to /scores */}
          <Route path="/leaderboard" element={<Navigate to="/scores" replace />} />

          <Route path="/schedule" element={
            <ProtectedRoute>
              <Layout>
                <Page name="Schedule"><Schedule /></Page>
              </Layout>
            </ProtectedRoute>
          } />

          <Route path="/scores" element={
            <ProtectedRoute>
              <Layout>
                <Page name="Scores"><Scores /></Page>
              </Layout>
            </ProtectedRoute>
          } />

          <Route path="/scores/:date" element={
            <ProtectedRoute>
              <Layout>
                <Page name="Scores"><Scores /></Page>
              </Layout>
            </ProtectedRoute>
          } />

          <Route path="/profile/:userId?" element={
            <ProtectedRoute>
              <Layout>
                <Page name="Profile"><Profile /></Page>
              </Layout>
            </ProtectedRoute>
          } />

          <Route path="/settings" element={
            <ProtectedRoute>
              <Layout>
                <Page name="Settings"><Settings /></Page>
              </Layout>
            </ProtectedRoute>
          } />

          <Route path="/hall-of-champions" element={
            <Layout>
              <Page name="Hall of Champions"><HallOfChampions /></Page>
            </Layout>
          } />

          <Route path="/admin" element={
            <ProtectedRoute>
              <Layout>
                <Page name="Admin"><Admin /></Page>
              </Layout>
            </ProtectedRoute>
          } />

          <Route path="/staff" element={
            <ProtectedRoute>
              <Layout>
                <Page name="Staff"><Staff /></Page>
              </Layout>
            </ProtectedRoute>
          } />

          <Route path="/battlepass" element={
            <ProtectedRoute>
              <Layout>
                <Page name="Battle Pass"><BattlePass /></Page>
              </Layout>
            </ProtectedRoute>
          } />

          <Route path="/leagues" element={
            <ProtectedRoute>
              <Layout>
                <Page name="Leagues"><Leagues /></Page>
              </Layout>
            </ProtectedRoute>
          } />

          <Route path="/retired-corps" element={
            <ProtectedRoute>
              <Layout>
                <Page name="Retired Corps"><RetiredCorpsGallery /></Page>
              </Layout>
            </ProtectedRoute>
          } />

          <Route path="/corps-history" element={
            <ProtectedRoute>
              <Layout>
                <Page name="Corps History"><CorpsHistory /></Page>
              </Layout>
            </ProtectedRoute>
          } />

          {/* 404 Route */}
          <Route path="*" element={
            <div className="min-h-screen bg-gradient-main flex items-center justify-center">
              <div className="text-center">
                <h1 className="text-6xl font-display font-bold text-gradient mb-4">404</h1>
                <p className="text-cream-300 mb-8">Page not found</p>
                <a href="/" className="btn-primary">
                  Return Home
                </a>
              </div>
            </div>
          } />
          </Routes>
          </Router>
        </AuthContext.Provider>
        </ThemeProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}

export default App;
