// src/App.jsx
import React, { useEffect, useMemo, Suspense } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { useAuthState } from 'react-firebase-hooks/auth';
import { QueryClientProvider } from '@tanstack/react-query';
import { auth, authHelpers, analytics } from './api';
import { claimDailyLogin } from './api/functions';
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
import { AuthContext, useAuth } from './context/AuthContext';
import { MotionProvider } from './components/MotionProvider';
import { useSeasonStore } from './store/seasonStore';
import { useScheduleStore } from './store/scheduleStore';
import { useProfileStore } from './store/profileStore';
import OfflineBanner from './components/OfflineBanner';
import { SkipToContent } from './components/a11y';
import { lazyWithRetry } from './utils/lazyWithRetry';

// Lazy load pages for better performance.
// lazyWithRetry auto-reloads once on stale-chunk errors after a new deploy
// (old hashed chunks 404 -> "Failed to fetch dynamically imported module").
const Dashboard = lazyWithRetry(() => import('./pages/Dashboard'), 'Dashboard');
const Schedule = lazyWithRetry(() => import('./pages/Schedule'), 'Schedule');
const Scores = lazyWithRetry(() => import('./pages/Scores'), 'Scores');
const Profile = lazyWithRetry(() => import('./pages/Profile'), 'Profile');
// Settings is now integrated into Profile page
const HallOfChampions = lazyWithRetry(() => import('./pages/HallOfChampions'), 'HallOfChampions');
const Admin = lazyWithRetry(() => import('./pages/Admin'), 'Admin');
const Leagues = lazyWithRetry(() => import('./pages/Leagues'), 'Leagues');
const Onboarding = lazyWithRetry(() => import('./pages/Onboarding'), 'Onboarding');
const Login = lazyWithRetry(() => import('./pages/Login'), 'Login');
const Register = lazyWithRetry(() => import('./pages/Register'), 'Register');
const Landing = lazyWithRetry(() => import('./pages/Landing'), 'Landing');
const RetiredCorpsGallery = lazyWithRetry(
  () => import('./pages/RetiredCorpsGallery'),
  'RetiredCorpsGallery'
);
const CorpsHistory = lazyWithRetry(() => import('./pages/CorpsHistory'), 'CorpsHistory');
const SoundSport = lazyWithRetry(() => import('./pages/SoundSport'), 'SoundSport');
const Privacy = lazyWithRetry(() => import('./pages/Privacy'), 'Privacy');
const Terms = lazyWithRetry(() => import('./pages/Terms'), 'Terms');
const ForgotPassword = lazyWithRetry(() => import('./pages/ForgotPassword'), 'ForgotPassword');
const Article = lazyWithRetry(() => import('./pages/Article'), 'Article');
const HowToPlay = lazyWithRetry(() => import('./pages/HowToPlay'), 'HowToPlay');
const HowToPlayPublic = lazyWithRetry(() => import('./pages/HowToPlayPublic'), 'HowToPlayPublic');
const NotFound = lazyWithRetry(() => import('./pages/NotFound'), 'NotFound');
const GuestDashboard = lazyWithRetry(() => import('./pages/GuestDashboard'), 'GuestDashboard');

// Helper component to wrap pages with error boundaries
const Page = ({ name, children }) => <PageErrorBoundary name={name}>{children}</PageErrorBoundary>;

// Auth context + useAuth hook live in ./context/AuthContext so this file only
// exports components (keeps Vite fast refresh working).

// Protected Route Component
// requireProfile: when true (default), an authenticated user who has no profile
// yet is redirected to onboarding. This prevents profile-less users from reaching
// the dashboard and hammering backend callables (registerCorps, claimDailyLogin,
// etc.) that 404 with "profile not found". The onboarding route itself opts out.
const ProtectedRoute = ({ children, requireProfile = true }) => {
  const { user, loading } = useAuth();
  const location = useLocation();
  const profile = useProfileStore((state) => state.profile);
  const profileLoading = useProfileStore((state) => state.loading);
  const profileUid = useProfileStore((state) => state._currentUid);
  const profileError = useProfileStore((state) => state.error);

  if (loading) {
    return <LoadingScreen />;
  }

  if (!user) {
    return <Navigate to="/" state={{ from: location }} replace />;
  }

  if (requireProfile) {
    // Only trust "no profile" once the profile listener is bound to THIS user
    // and has finished loading. On a hard refresh the listener effect runs
    // AFTER this render — until then the store still holds the cleared state
    // (profile: null, loading: false) from before auth resolved, and
    // redirecting on that would bounce fully-onboarded users to /onboarding.
    if (profileLoading || profileUid !== user.uid) {
      return <LoadingScreen />;
    }
    if (!profile) {
      // A subscription error also leaves profile null — hold on the loading
      // screen (the store already surfaced a toast) rather than shunting a
      // possibly-onboarded user into onboarding.
      if (profileError) {
        return <LoadingScreen />;
      }
      return <Navigate to="/onboarding" replace />;
    }
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
  const initProfileListener = useProfileStore((state) => state.initProfileListener);
  const cleanupProfileListener = useProfileStore((state) => state.cleanup);
  const profile = useProfileStore((state) => state.profile);

  // Initialize global season listener ONCE at app startup
  // This prevents duplicate Firestore listeners across components
  useEffect(() => {
    initSeasonListener();
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
      initProfileListener(user.uid);
    } else {
      cleanupProfileListener();
      // Evict cached per-user react-query data (profiles, leagues, etc.) so a
      // subsequent sign-in with a different account can't briefly see the
      // previous account's cached reads.
      queryClient.clear();
    }
    return () => {
      // Only cleanup on unmount, not on user change (handled above)
    };
  }, [user, initProfileListener, cleanupProfileListener]);

  // Claim daily login once per calendar day to award XP, update streak, and
  // update userTitle. The backend is idempotent (returns alreadyClaimed:true
  // on subsequent calls within the same day); the localStorage guard just
  // avoids redundant network calls per session.
  // Gate on `profile` as well as `user`: a freshly-authenticated user going
  // through onboarding has no profile yet, and claimDailyLogin would 404 with
  // "profile not found". Waiting for the profile to exist avoids that race.
  useEffect(() => {
    if (!user || !profile) return;
    const todayKey = new Date().toISOString().slice(0, 10);
    const storageKey = `dailyLoginClaimed:${user.uid}`;
    if (typeof window === 'undefined') return;
    const lastClaimed = window.localStorage.getItem(storageKey);
    if (lastClaimed === todayKey) return;
    claimDailyLogin()
      .then(() => {
        window.localStorage.setItem(storageKey, todayKey);
      })
      .catch((err) => {
        console.warn('Daily login claim skipped:', err?.message || err);
      });
  }, [user, profile]);

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

  // Memoize auth context value to prevent unnecessary re-renders of all consumers
  // Only recreates when user, loading, or error actually change
  // NOTE: This MUST be before any early returns to maintain consistent hook order
  const authContextValue = useMemo(
    () => ({
      user,
      loading,
      error,
      // Analytics funnel events fire here so every auth entry point is counted
      signIn: async (email, password) => {
        const result = await authHelpers.signInWithEmail(email, password);
        analytics.logLogin('email');
        return result;
      },
      signUp: async (email, password, displayName) => {
        const result = await authHelpers.signUpWithEmail(email, password, displayName);
        analytics.logSignUp('email');
        return result;
      },
      signInAnonymously: async () => {
        const result = await authHelpers.signInAnon();
        analytics.logLogin('anonymous');
        return result;
      },
      signOut: async () => {
        analytics.logLogout();
        return authHelpers.signOut();
      },
    }),
    [user, loading, error]
  );

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
                <div role="region" aria-live="polite" aria-atomic="true" aria-label="Notifications">
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
                    <Route
                      path="/"
                      element={
                        <Suspense fallback={<LoadingScreen fullScreen />}>
                          <Landing />
                        </Suspense>
                      }
                    />
                    <Route
                      path="/article/:id"
                      element={
                        <Suspense fallback={<LoadingScreen fullScreen />}>
                          <Article />
                        </Suspense>
                      }
                    />
                    <Route
                      path="/login"
                      element={
                        user ? (
                          <Navigate to="/dashboard" />
                        ) : (
                          <Suspense fallback={<LoadingScreen fullScreen />}>
                            <Login />
                          </Suspense>
                        )
                      }
                    />
                    <Route
                      path="/register"
                      element={
                        user ? (
                          <Navigate to="/dashboard" />
                        ) : (
                          <Suspense fallback={<LoadingScreen fullScreen />}>
                            <Register />
                          </Suspense>
                        )
                      }
                    />
                    <Route
                      path="/forgot-password"
                      element={
                        user ? (
                          <Navigate to="/dashboard" />
                        ) : (
                          <Suspense fallback={<LoadingScreen fullScreen />}>
                            <ForgotPassword />
                          </Suspense>
                        )
                      }
                    />
                    <Route
                      path="/privacy"
                      element={
                        <Suspense fallback={<LoadingScreen fullScreen />}>
                          <Privacy />
                        </Suspense>
                      }
                    />
                    <Route
                      path="/terms"
                      element={
                        <Suspense fallback={<LoadingScreen fullScreen />}>
                          <Terms />
                        </Suspense>
                      }
                    />

                    {/* Guest Preview - Demo dashboard for unauthenticated users */}
                    <Route
                      path="/preview"
                      element={
                        user ? (
                          <Navigate to="/dashboard" />
                        ) : (
                          <Suspense fallback={<DashboardSkeleton />}>
                            <GuestDashboard />
                          </Suspense>
                        )
                      }
                    />

                    {/* Onboarding - Protected but minimal layout.
              requireProfile={false}: this is where the profile gets created, so
              a profile-less user must be allowed in (otherwise the guard would
              loop them back here forever). */}
                    <Route
                      path="/onboarding"
                      element={
                        <ProtectedRoute requireProfile={false}>
                          <Suspense fallback={<LoadingScreen fullScreen />}>
                            <Onboarding />
                          </Suspense>
                        </ProtectedRoute>
                      }
                    />

                    {/* Protected Routes - Each page wrapped with error boundary */}
                    <Route
                      path="/dashboard"
                      element={
                        <ProtectedRoute>
                          <GameShell>
                            <Suspense fallback={<DashboardSkeleton />}>
                              <Page name="Dashboard">
                                <Dashboard />
                              </Page>
                            </Suspense>
                          </GameShell>
                        </ProtectedRoute>
                      }
                    />

                    {/* Game Guide - accessible to all authenticated users */}
                    <Route
                      path="/guide"
                      element={
                        <ProtectedRoute>
                          <GameShell>
                            <Suspense fallback={<DashboardSkeleton />}>
                              <Page name="Guide">
                                <HowToPlay />
                              </Page>
                            </Suspense>
                          </GameShell>
                        </ProtectedRoute>
                      }
                    />
                    {/* Public, crawlable guide — the SEO landing page for "fantasy drum
              corps" searches. Authenticated users get the in-app /guide. */}
                    <Route
                      path="/how-to-play"
                      element={
                        <Suspense fallback={<LoadingScreen fullScreen />}>
                          <HowToPlayPublic />
                        </Suspense>
                      }
                    />

                    {/* Redirect old routes */}
                    <Route path="/hub" element={<Navigate to="/dashboard" replace />} />
                    <Route path="/leaderboard" element={<Navigate to="/scores" replace />} />
                    <Route path="/hud" element={<Navigate to="/dashboard" replace />} />

                    <Route
                      path="/schedule"
                      element={
                        <ProtectedRoute>
                          <GameShell>
                            <Suspense fallback={<SchedulePageSkeleton />}>
                              <Page name="Schedule">
                                <Schedule />
                              </Page>
                            </Suspense>
                          </GameShell>
                        </ProtectedRoute>
                      }
                    />

                    <Route
                      path="/scores"
                      element={
                        <ProtectedRoute>
                          <GameShell>
                            <Suspense fallback={<ScoresPageSkeleton />}>
                              <Page name="Scores">
                                <Scores />
                              </Page>
                            </Suspense>
                          </GameShell>
                        </ProtectedRoute>
                      }
                    />

                    <Route
                      path="/scores/:date"
                      element={
                        <ProtectedRoute>
                          <GameShell>
                            <Suspense fallback={<ScoresPageSkeleton />}>
                              <Page name="Scores">
                                <Scores />
                              </Page>
                            </Suspense>
                          </GameShell>
                        </ProtectedRoute>
                      }
                    />

                    <Route
                      path="/profile/:userId?"
                      element={
                        <ProtectedRoute>
                          <GameShell>
                            <Suspense fallback={<ProfilePageSkeleton />}>
                              <Page name="Profile">
                                <Profile />
                              </Page>
                            </Suspense>
                          </GameShell>
                        </ProtectedRoute>
                      }
                    />

                    {/* Settings is now integrated into Profile - redirect for backwards compatibility */}
                    <Route path="/settings" element={<Navigate to="/profile" replace />} />

                    <Route
                      path="/hall-of-champions"
                      element={
                        <Suspense fallback={<LoadingScreen fullScreen />}>
                          <GameShell>
                            <Page name="Hall of Champions">
                              <HallOfChampions />
                            </Page>
                          </GameShell>
                        </Suspense>
                      }
                    />

                    <Route
                      path="/admin"
                      element={
                        <ProtectedRoute>
                          <GameShell>
                            <Page name="Admin">
                              <Admin />
                            </Page>
                          </GameShell>
                        </ProtectedRoute>
                      }
                    />

                    <Route
                      path="/leagues"
                      element={
                        <ProtectedRoute>
                          <GameShell>
                            <Suspense fallback={<LeaguesPageSkeleton />}>
                              <Page name="Leagues">
                                <Leagues />
                              </Page>
                            </Suspense>
                          </GameShell>
                        </ProtectedRoute>
                      }
                    />

                    <Route
                      path="/retired-corps"
                      element={
                        <ProtectedRoute>
                          <GameShell>
                            <Page name="Retired Corps">
                              <RetiredCorpsGallery />
                            </Page>
                          </GameShell>
                        </ProtectedRoute>
                      }
                    />

                    <Route
                      path="/corps-history"
                      element={
                        <ProtectedRoute>
                          <GameShell>
                            <Page name="Corps History">
                              <CorpsHistory />
                            </Page>
                          </GameShell>
                        </ProtectedRoute>
                      }
                    />

                    <Route
                      path="/soundsport"
                      element={
                        <ProtectedRoute>
                          <GameShell>
                            <Page name="SoundSport">
                              <SoundSport />
                            </Page>
                          </GameShell>
                        </ProtectedRoute>
                      }
                    />

                    {/* 404 Route */}
                    <Route
                      path="*"
                      element={
                        <Suspense fallback={<LoadingScreen fullScreen />}>
                          <NotFound />
                        </Suspense>
                      }
                    />
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
