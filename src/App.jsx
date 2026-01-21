// src/App.jsx
import React, { useEffect, useMemo, createContext, useContext, lazy, Suspense } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { useAuthState } from 'react-firebase-hooks/auth';
import { QueryClientProvider } from '@tanstack/react-query';
import { auth, authHelpers } from './firebase';
import { queryClient } from './lib/queryClient';
import LoadingScreen from './components/LoadingScreen';
import {
  DashboardSkeleton,
  ScoresPageSkeleton,
  LeaguesPageSkeleton,
  SchedulePageSkeleton,
  ProfilePageSkeleton,
} from './components/Skeleton';
import GameShell from './components/Layout/GameShell';
import PWAInstallPrompt from './components/PWAInstallPrompt';
import UsernamePromptModal from './components/modals/UsernamePromptModal';
import { CelebrationContainer } from './components/Celebration';
import { XPFeedbackContainer } from './components/XPFeedback';
import { LevelUpCelebrationContainer } from './components/LevelUpCelebration';
import ErrorBoundary from './components/ErrorBoundary';
import { PageErrorBoundary } from './components/PageErrorBoundary';
import { ThemeProvider } from './context/ThemeContext';
import { MotionProvider } from './components/MotionProvider';
import { useSeasonStore } from './store/seasonStore';
import { useScheduleStore } from './store/scheduleStore';
import { useUserStore } from './store/userStore';
import { useProfileStore } from './store/profileStore';
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
const Leagues = lazy(() => import('./pages/Leagues'));
const Onboarding = lazy(() => import('./pages/Onboarding'));
const Login = lazy(() => import('./pages/Login'));
const Register = lazy(() => import('./pages/Register'));
const Landing = lazy(() => import('./pages/Landing'));
const RetiredCorpsGallery = lazy(() => import('./pages/RetiredCorpsGallery'));
const CorpsHistory = lazy(() => import('./pages/CorpsHistory'));
const SoundSport = lazy(() => import('./pages/SoundSport'));
const Privacy = lazy(() => import('./pages/Privacy'));
const Terms = lazy(() => import('./pages/Terms'));
const ForgotPassword = lazy(() => import('./pages/ForgotPassword'));
const Article = lazy(() => import('./pages/Article'));
const HowToPlay = lazy(() => import('./pages/HowToPlay'));
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
    return <Navigate to="/" state={{ from: location }} replace />;
  }

  return children;
};

// Main App Component
function App() {
  const [user, loading, error] = useAuthState(auth);
  const initSeasonListener = useSeasonStore((state) => state.initSeasonListener);
  const cleanupSeasonListener = useSeasonStore((state) => state.cleanup);
  const seasonUid = useSeasonStore((state) => state.seasonUid);
  const initScheduleListener = useScheduleStore((state) => state.initScheduleListener);
  const cleanupScheduleListener = useScheduleStore((state) => state.cleanup);
  const initAuthListener = useUserStore((state) => state.initAuthListener);
  const initProfileListener = useProfileStore((state) => state.initProfileListener);
  const cleanupProfileListener = useProfileStore((state) => state.cleanup);

  // Initialize global season listener ONCE at app startup
  // This prevents duplicate Firestore listeners across components
  useEffect(() => {
    const unsubscribe = initSeasonListener();
    return () => {
      cleanupSeasonListener();
    };
  }, [initSeasonListener, cleanupSeasonListener]);

  // Initialize global schedule listener when seasonUid changes
  // This keeps schedule data in sync with the current season
  useEffect(() => {
    if (seasonUid) {
      initScheduleListener(seasonUid);
    }
    return () => {
      cleanupScheduleListener();
    };
  }, [seasonUid, initScheduleListener, cleanupScheduleListener]);

  // Initialize global profile listener when user changes
  // This prevents duplicate Firestore listeners for profile data across components
  useEffect(() => {
    if (user) {
      initProfileListener(user.uid, user);
    } else {
      cleanupProfileListener();
    }
    return () => {
      // Only cleanup on unmount, not on user change (handled above)
    };
  }, [user, initProfileListener, cleanupProfileListener]);

  // Initialize push notifications when user is authenticated
  // Only attempts to get token if user has previously granted permission
  useEffect(() => {
    const initPushNotifications = async () => {
      if (!user) return;

      // Only proceed if notifications are supported and permission granted
      if ('Notification' in window && Notification.permission === 'granted') {
        try {
          const { initializePushNotifications } = await import('./api/pushNotifications');
          await initializePushNotifications(user.uid);
        } catch (error) {
          console.warn('Push notification initialization skipped:', error.message);
        }
      }
    };

    initPushNotifications();
  }, [user]);

  // Initialize user profile listener to sync profile data with auth state
  // This ensures loggedInProfile is available for components like Scores
  useEffect(() => {
    const unsubscribe = initAuthListener();
    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [initAuthListener]);

  // Memoize auth context value to prevent unnecessary re-renders of all consumers
  // Only recreates when user, loading, or error actually change
  // NOTE: This MUST be before any early returns to maintain consistent hook order
  const authContextValue = useMemo(() => ({
    user,
    loading,
    error,
    signIn: authHelpers.signInWithEmail,
    signUp: authHelpers.signUpWithEmail,
    signInAnonymously: authHelpers.signInAnon,
    signOut: authHelpers.signOut
  }), [user, loading, error]);

  if (loading) {
    return <LoadingScreen fullScreen />;
  }

  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider>
          <MotionProvider>
          <AuthContext.Provider value={authContextValue}>
            <Router>
          {/* Skip to Content - Accessibility */}
          <SkipToContent />

          {/* Offline Banner - Shows when network is unavailable */}
          <OfflineBanner />

          {/* Global Toast Notifications - Mobile aware positioning */}
          {/* ARIA live region for screen reader accessibility (WCAG 4.1.3) */}
          <div
            role="region"
            aria-live="polite"
            aria-atomic="true"
            aria-label="Notifications"
          >
            <Toaster
              position="top-right"
              containerStyle={{
                // Safe area + header offset, with right padding to prevent overflow
                top: 'max(env(safe-area-inset-top, 0px) + 16px, 16px)',
                right: 'max(env(safe-area-inset-right, 0px) + 16px, 16px)',
              }}
              toastOptions={{
                duration: 4000,
                className: 'press-feedback',
                style: {
                  background: '#1a1a1a',
                  color: '#fff',
                  border: '1px solid #333',
                  borderRadius: '2px',
                  fontSize: '12px',
                  padding: '10px 14px',
                  maxWidth: 'min(360px, calc(100vw - 32px))',
                },
                success: {
                  iconTheme: {
                    primary: '#22c55e',
                    secondary: '#1a1a1a',
                  },
                },
                error: {
                  iconTheme: {
                    primary: '#ef4444',
                    secondary: '#1a1a1a',
                  },
                },
              }}
            />
          </div>

        {/* PWA Install Prompt - shows after user engagement */}
        {user && <PWAInstallPrompt />}

        {/* Username Prompt Modal - shows for existing users without username */}
        {user && <UsernamePromptModal />}

        {/* Celebration System - for achievements and level ups */}
        <CelebrationContainer />

        {/* XP/CC Floating Feedback - for gains throughout the app */}
        <XPFeedbackContainer />

        {/* Level Up Celebration - full-screen animation on level up */}
        <LevelUpCelebrationContainer />

        <Suspense fallback={<LoadingScreen fullScreen />}>
        <Routes>
          {/* Public Routes - Landing page visible to all users */}
          <Route path="/" element={<Suspense fallback={<LoadingScreen fullScreen />}><Landing /></Suspense>} />
          <Route path="/article/:id" element={<Suspense fallback={<LoadingScreen fullScreen />}><Article /></Suspense>} />
          <Route path="/login" element={user ? <Navigate to="/dashboard" /> : <Suspense fallback={<LoadingScreen fullScreen />}><Login /></Suspense>} />
          <Route path="/register" element={user ? <Navigate to="/dashboard" /> : <Suspense fallback={<LoadingScreen fullScreen />}><Register /></Suspense>} />
          <Route path="/forgot-password" element={user ? <Navigate to="/dashboard" /> : <Suspense fallback={<LoadingScreen fullScreen />}><ForgotPassword /></Suspense>} />
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
                <Suspense fallback={<DashboardSkeleton />}>
                  <Page name="Dashboard"><Dashboard /></Page>
                </Suspense>
              </GameShell>
            </ProtectedRoute>
          } />

          {/* Game Guide - accessible to all authenticated users */}
          <Route path="/guide" element={
            <ProtectedRoute>
              <GameShell>
                <Suspense fallback={<DashboardSkeleton />}>
                  <Page name="Guide"><HowToPlay /></Page>
                </Suspense>
              </GameShell>
            </ProtectedRoute>
          } />
          <Route path="/how-to-play" element={<Navigate to="/guide" replace />} />

          {/* Redirect old routes */}
          <Route path="/hub" element={<Navigate to="/leagues" replace />} />
          <Route path="/leaderboard" element={<Navigate to="/scores" replace />} />
          <Route path="/hud" element={<Navigate to="/dashboard" replace />} />

          <Route path="/schedule" element={
            <ProtectedRoute>
              <GameShell>
                <Suspense fallback={<SchedulePageSkeleton />}>
                  <Page name="Schedule"><Schedule /></Page>
                </Suspense>
              </GameShell>
            </ProtectedRoute>
          } />

          <Route path="/scores" element={
            <ProtectedRoute>
              <GameShell>
                <Suspense fallback={<ScoresPageSkeleton />}>
                  <Page name="Scores"><Scores /></Page>
                </Suspense>
              </GameShell>
            </ProtectedRoute>
          } />

          <Route path="/scores/:date" element={
            <ProtectedRoute>
              <GameShell>
                <Suspense fallback={<ScoresPageSkeleton />}>
                  <Page name="Scores"><Scores /></Page>
                </Suspense>
              </GameShell>
            </ProtectedRoute>
          } />

          <Route path="/profile/:userId?" element={
            <ProtectedRoute>
              <GameShell>
                <Suspense fallback={<ProfilePageSkeleton />}>
                  <Page name="Profile"><Profile /></Page>
                </Suspense>
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

          <Route path="/leagues" element={
            <ProtectedRoute>
              <GameShell>
                <Suspense fallback={<LeaguesPageSkeleton />}>
                  <Page name="Leagues"><Leagues /></Page>
                </Suspense>
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

          <Route path="/soundsport" element={
            <ProtectedRoute>
              <GameShell>
                <Page name="SoundSport"><SoundSport /></Page>
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
          </MotionProvider>
        </ThemeProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}

export default App;
