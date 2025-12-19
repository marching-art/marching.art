// src/App.jsx
import React, { useEffect, createContext, useContext, lazy, Suspense } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { useAuthState } from 'react-firebase-hooks/auth';
import { QueryClientProvider } from '@tanstack/react-query';
import { auth, authHelpers } from './firebase';
import { queryClient } from './lib/queryClient';
import LoadingScreen from './components/LoadingScreen';
import GameShell from './components/Layout/GameShell';
import PWAInstallPrompt from './components/PWAInstallPrompt';
import { CelebrationContainer } from './components/Celebration';
import ErrorBoundary from './components/ErrorBoundary';
import { PageErrorBoundary } from './components/PageErrorBoundary';
import { ThemeProvider } from './context/ThemeContext';
import { useSeasonStore } from './store/seasonStore';
import { useUserStore } from './store/userStore';
import OfflineBanner from './components/OfflineBanner';
import { SkipToContent } from './components/a11y';

// Lazy load pages for better performance
const Dashboard = lazy(() => import('./pages/Dashboard'));
const Schedule = lazy(() => import('./pages/Schedule'));
const Scores = lazy(() => import('./pages/Scores'));
const Profile = lazy(() => import('./pages/Profile'));
// Settings is now integrated into Profile page
const HallOfChampions = lazy(() => import('./pages/HallOfChampions'));
const Admin = lazy(() => import('./pages/Admin'));
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
const NotFound = lazy(() => import('./pages/NotFound'));

// Helper component to wrap pages with error boundaries
const Page = ({ name, children }) => (
  <PageErrorBoundary name={name}>
    {children}
  </PageErrorBoundary>
);

// Auth Context
const AuthContext = createContext(null);
export const useAuth = () => useContext(AuthContext);

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

// Main App Component
function App() {
  const [user, loading, error] = useAuthState(auth);
  const initSeasonListener = useSeasonStore((state) => state.initSeasonListener);
  const cleanupSeasonListener = useSeasonStore((state) => state.cleanup);
  const initAuthListener = useUserStore((state) => state.initAuthListener);

  // Initialize global season listener ONCE at app startup
  // This prevents duplicate Firestore listeners across components
  useEffect(() => {
    const unsubscribe = initSeasonListener();
    return () => {
      cleanupSeasonListener();
    };
  }, [initSeasonListener, cleanupSeasonListener]);

  // Initialize user profile listener to sync profile data with auth state
  // This ensures loggedInProfile is available for components like Scores
  useEffect(() => {
    const unsubscribe = initAuthListener();
    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [initAuthListener]);

  if (loading) {
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
          {/* Skip to Content - Accessibility */}
          <SkipToContent />

          {/* Offline Banner - Shows when network is unavailable */}
          <OfflineBanner />

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

        <Suspense fallback={<LoadingScreen fullScreen />}>
        <Routes>
          {/* Public Routes */}
          <Route path="/" element={user ? <Navigate to="/dashboard" /> : <Suspense fallback={<LoadingScreen fullScreen />}><Landing /></Suspense>} />
          <Route path="/login" element={user ? <Navigate to="/dashboard" /> : <Suspense fallback={<LoadingScreen fullScreen />}><Login /></Suspense>} />
          <Route path="/register" element={user ? <Navigate to="/dashboard" /> : <Suspense fallback={<LoadingScreen fullScreen />}><Register /></Suspense>} />
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
              <GameShell>
                <Page name="Dashboard"><Dashboard /></Page>
              </GameShell>
            </ProtectedRoute>
          } />

          {/* Redirect old routes */}
          <Route path="/hub" element={<Navigate to="/leagues" replace />} />
          <Route path="/leaderboard" element={<Navigate to="/scores" replace />} />
          <Route path="/how-to-play" element={<Navigate to="/dashboard" replace />} />
          <Route path="/hud" element={<Navigate to="/dashboard" replace />} />

          <Route path="/schedule" element={
            <ProtectedRoute>
              <GameShell>
                <Page name="Schedule"><Schedule /></Page>
              </GameShell>
            </ProtectedRoute>
          } />

          <Route path="/scores" element={
            <ProtectedRoute>
              <GameShell>
                <Page name="Scores"><Scores /></Page>
              </GameShell>
            </ProtectedRoute>
          } />

          <Route path="/scores/:date" element={
            <ProtectedRoute>
              <GameShell>
                <Page name="Scores"><Scores /></Page>
              </GameShell>
            </ProtectedRoute>
          } />

          <Route path="/profile/:userId?" element={
            <ProtectedRoute>
              <GameShell>
                <Page name="Profile"><Profile /></Page>
              </GameShell>
            </ProtectedRoute>
          } />

          {/* Settings is now integrated into Profile - redirect for backwards compatibility */}
          <Route path="/settings" element={<Navigate to="/profile" replace />} />

          <Route path="/hall-of-champions" element={
            <Suspense fallback={<LoadingScreen fullScreen />}>
              <GameShell>
                <Page name="Hall of Champions"><HallOfChampions /></Page>
              </GameShell>
            </Suspense>
          } />

          <Route path="/admin" element={
            <ProtectedRoute>
              <GameShell>
                <Page name="Admin"><Admin /></Page>
              </GameShell>
            </ProtectedRoute>
          } />

          <Route path="/battlepass" element={
            <ProtectedRoute>
              <GameShell>
                <Page name="Battle Pass"><BattlePass /></Page>
              </GameShell>
            </ProtectedRoute>
          } />

          <Route path="/leagues" element={
            <ProtectedRoute>
              <GameShell>
                <Page name="Leagues"><Leagues /></Page>
              </GameShell>
            </ProtectedRoute>
          } />

          <Route path="/retired-corps" element={
            <ProtectedRoute>
              <GameShell>
                <Page name="Retired Corps"><RetiredCorpsGallery /></Page>
              </GameShell>
            </ProtectedRoute>
          } />

          <Route path="/corps-history" element={
            <ProtectedRoute>
              <GameShell>
                <Page name="Corps History"><CorpsHistory /></Page>
              </GameShell>
            </ProtectedRoute>
          } />

          {/* 404 Route */}
          <Route path="*" element={
            <Suspense fallback={<LoadingScreen fullScreen />}>
              <NotFound />
            </Suspense>
          } />
          </Routes>
        </Suspense>
          </Router>
        </AuthContext.Provider>
        </ThemeProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}

export default App;
