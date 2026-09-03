// @ts-nocheck -- grandfathered before checkJs; remove when this file is typed or cleaned up
// src/App.jsx
import React, { useEffect, useMemo, Suspense } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { useAuthState } from 'react-firebase-hooks/auth';
import { QueryClientProvider } from '@tanstack/react-query';
import { auth, authHelpers, analytics } from './api';
import { queryClient } from './lib/queryClient';
import LoadingScreen from './components/LoadingScreen';
import {
  DashboardSkeleton,
  ScoresPageSkeleton,
  LeaguesPageSkeleton,
  SchedulePageSkeleton,
  ProfilePageSkeleton,
  GalleryPageSkeleton,
} from './components/Skeleton';
import PublicShell from './components/Layout/PublicShell';
import RouteAnalytics from './components/RouteAnalytics';
import { useSEO } from './hooks/useSEO';
import { useAuthRedirectTarget, resolveAuthRedirect } from './hooks/useAuthRedirect';
import {
  rememberPendingRedirect,
  peekPendingRedirect,
  clearPendingRedirect,
} from './lib/pendingRedirect';
import { useAppBootstrap } from './hooks/useAppBootstrap';
import { useProfileStore } from './store/profileStore';
import PWAInstallPrompt from './components/PWAInstallPrompt';
import ErrorBoundary from './components/ErrorBoundary';
import { PageErrorBoundary } from './components/PageErrorBoundary';
import { ThemeProvider } from './context/ThemeContext';
import { AuthContext, useAuth } from './context/AuthContext';
import { BMAC_URL } from './utils/supporterTiers';
import { MotionProvider } from './components/MotionProvider';
import OfflineBanner from './components/OfflineBanner';
import AnalyticsConsentBanner from './components/AnalyticsConsentBanner';
import { SkipToContent, RouteChangeFocus } from './components/a11y';
import { lazyWithRetry } from './utils/lazyWithRetry';

// Lazy load pages for better performance.
// lazyWithRetry auto-reloads once on stale-chunk errors after a new deploy
// (old hashed chunks 404 -> "Failed to fetch dynamically imported module").
// The signed-in shell (header, ticker, bottom nav, notification panel) and the
// signed-in-only overlays are lazy too: a visitor on `/`, an article or the
// guide never needs them, and they were ~50 kB min of the eager index chunk.
const GameShellChunk = lazyWithRetry(() => import('./components/Layout/GameShell'), 'GameShell');
const AuthedOverlays = lazyWithRetry(
  () => import('./components/Layout/AuthedOverlays'),
  'AuthedOverlays'
);

/**
 * Drop-in for the shell: every route keeps writing `<GameShell>` while the
 * chunk loads behind one Suspense boundary here.
 * @param {{ children: React.ReactNode }} props
 */
const GameShell = ({ children }) => (
  <Suspense fallback={<LoadingScreen fullScreen />}>
    <GameShellChunk>{children}</GameShellChunk>
  </Suspense>
);

const Dashboard = lazyWithRetry(() => import('./pages/Dashboard'), 'Dashboard');
const Schedule = lazyWithRetry(() => import('./pages/Schedule'), 'Schedule');
const Scores = lazyWithRetry(() => import('./pages/Scores'), 'Scores');
const Profile = lazyWithRetry(() => import('./pages/Profile'), 'Profile');
const Achievements = lazyWithRetry(() => import('./pages/Achievements'), 'Achievements');
const Studio = lazyWithRetry(() => import('./pages/Studio'), 'Studio');
const Exchange = lazyWithRetry(() => import('./pages/Exchange'), 'Exchange');
// Settings is now integrated into Profile page
const HallOfChampions = lazyWithRetry(() => import('./pages/HallOfChampions'), 'HallOfChampions');
const Admin = lazyWithRetry(() => import('./pages/Admin'), 'Admin');
const Leagues = lazyWithRetry(() => import('./pages/Leagues'), 'Leagues');
const Shop = lazyWithRetry(() => import('./pages/Shop'), 'Shop');
const Records = lazyWithRetry(() => import('./pages/Records'), 'Records');
const Onboarding = lazyWithRetry(() => import('./pages/Onboarding'), 'Onboarding');
const Login = lazyWithRetry(() => import('./pages/Login'), 'Login');
const Register = lazyWithRetry(() => import('./pages/Register'), 'Register');
const Landing = lazyWithRetry(() => import('./pages/Landing'), 'Landing');
const PodiumPreview = lazyWithRetry(() => import('./pages/PodiumPreview'), 'PodiumPreview');
const RetiredCorpsGallery = lazyWithRetry(
  () => import('./pages/RetiredCorpsGallery'),
  'RetiredCorpsGallery'
);
const CorpsHistory = lazyWithRetry(() => import('./pages/CorpsHistory'), 'CorpsHistory');
const Privacy = lazyWithRetry(() => import('./pages/Privacy'), 'Privacy');
const Terms = lazyWithRetry(() => import('./pages/Terms'), 'Terms');
const StyleGuide = lazyWithRetry(() => import('./pages/StyleGuide'), 'StyleGuide');
const ForgotPassword = lazyWithRetry(() => import('./pages/ForgotPassword'), 'ForgotPassword');
const Article = lazyWithRetry(() => import('./pages/Article'), 'Article');
const HowToPlay = lazyWithRetry(() => import('./pages/HowToPlay'), 'HowToPlay');
const HowToPlayPublic = lazyWithRetry(() => import('./pages/HowToPlayPublic'), 'HowToPlayPublic');
const Updates = lazyWithRetry(() => import('./pages/Updates'), 'Updates');
const PodiumGuide = lazyWithRetry(() => import('./pages/PodiumGuide'), 'PodiumGuide');
const NotFound = lazyWithRetry(() => import('./pages/NotFound'), 'NotFound');
const GuestDashboard = lazyWithRetry(() => import('./pages/GuestDashboard'), 'GuestDashboard');

// Helper component to wrap pages with error boundaries
const Page = ({ name, children }) => <PageErrorBoundary name={name}>{children}</PageErrorBoundary>;

// Public page: the shared shell (header, footer, bottom nav) plus the same
// error boundary and suspense treatment the app routes get. Public routes used
// to have neither — a render crash on /privacy or /article escalated to the
// root boundary and white-screened the whole app.
const PublicPage = ({ name, children, ...shellProps }) => (
  <PublicShell {...shellProps}>
    {/* Inline (not fullScreen) so the shell's header and nav stay put while the
        lazy chunk loads, instead of flashing a full-page loader over them. */}
    <Suspense fallback={<LoadingScreen fullScreen={false} />}>
      <Page name={name}>{children}</Page>
    </Suspense>
  </PublicShell>
);

// Auth context + useAuth hook live in ./context/AuthContext so this file only
// exports components (keeps Vite fast refresh working).

// A crawler that reaches an auth-walled route sees a loader and then the
// homepage redirect; without this it indexed that spinner under the homepage
// title. Rendered only while the wall is up — once the page renders it sets
// its own metadata, and this unmounts (its cleanup clears the robots tag).
const AuthWallMeta = () => {
  useSEO({ noindex: true });
  return null;
};

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

  // Deep-link preservation across the auth funnel (lib/pendingRedirect):
  // stash the attempted route when a signed-out visitor is bounced, and forget
  // it once a signed-in, onboarded director actually reaches it.
  useEffect(() => {
    if (loading) return;
    if (!user) {
      rememberPendingRedirect(resolveAuthRedirect(location));
      return;
    }
    if (profile) {
      const here = `${location.pathname}${location.search}${location.hash}`;
      if (peekPendingRedirect() === here) clearPendingRedirect();
    }
  }, [loading, user, profile, location]);

  if (loading) {
    return (
      <>
        <AuthWallMeta />
        <LoadingScreen />
      </>
    );
  }

  if (!user) {
    return (
      <>
        <AuthWallMeta />
        <Navigate to="/" state={{ from: location }} replace />
      </>
    );
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

// /supporters entry point: logged-in directors go to the in-app Supporters wall
// tab; logged-out visitors (e.g. a shared link) are sent to the Buy Me a Coffee
// page. External redirects can't use React Router's <Navigate>, so we use
// window.location for that leg.
const SupportersEntry = () => {
  const { user, loading } = useAuth();
  useEffect(() => {
    if (!loading && !user) {
      window.location.replace(BMAC_URL);
    }
  }, [loading, user]);
  if (loading) return <LoadingScreen fullScreen />;
  if (user) return <Navigate to="/scores?tab=supporters" replace />;
  return <LoadingScreen fullScreen />; // brief, while the external redirect fires
};

// See the /scores/:date route comment — the segment was never read, so keep the
// old URLs working but land them on the canonical path with their query intact.
const ScoresDateRedirect = () => {
  const location = useLocation();
  return <Navigate to={`/scores${location.search}`} replace />;
};

// Auth pages bounce already-authenticated users onward. The destination is the
// route they were originally trying to reach (ProtectedRoute's `state.from`),
// not an unconditional /dashboard.
const RedirectIfAuthed = ({ children }) => {
  const { user } = useAuth();
  const target = useAuthRedirectTarget();
  return user ? <Navigate to={target} replace /> : children;
};

// /hall-of-champions is public — robots.txt allows it and the sitemap lists it —
// but it rendered inside GameShell, whose entire nav points at protected routes.
// A logged-out visitor arriving from search got the full app chrome and bounced
// to / on every click. Pick the shell that matches the visitor instead.
//
// This is the one canonical home for the Hall of Champions (the /scores tab that
// used to duplicate it was removed; old ?tab=champions links redirect here). SEO
// lives in this route wrapper rather than the shared page component so the two
// shells it can render in agree on one canonical URL.
const HallOfChampionsEntry = () => {
  const { user } = useAuth();

  useSEO({
    title: 'Hall of Champions — Every marching.art Season Champion',
    description:
      'The championship record book: World, Open, A Class, SoundSport, and Podium champions from every completed marching.art season, with finals scores and finalists.',
    path: '/hall-of-champions',
  });

  const content = (
    <Suspense fallback={<GalleryPageSkeleton />}>
      <Page name="Hall of Champions">
        <HallOfChampions />
      </Page>
    </Suspense>
  );

  return user ? <GameShell>{content}</GameShell> : <PublicShell>{content}</PublicShell>;
};

// Main App Component
function App() {
  const [user, loading, error] = useAuthState(auth);

  // App-wide listeners and daily-loop side effects (season/schedule/profile
  // Firestore listeners, offline lineup replay, daily-login claim, push
  // re-attach). Extracted so this file is about routing and nothing else.
  useAppBootstrap(user);

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

                {/* Reset scroll + move focus to main content on navigation */}
                <RouteChangeFocus />

                {/* Page views for every route (this used to live in GameShell,
                    so the whole public funnel went unrecorded) */}
                <RouteAnalytics />

                {/* Offline Banner - Shows when network is unavailable */}
                <OfflineBanner />

                {/* Google Analytics is consent-based (Privacy §7): asked once
                    per browser, off until answered, changeable in Settings */}
                <AnalyticsConsentBanner />

                {/* Global Toast Notifications - Mobile aware positioning */}
                {/* ARIA live region for screen reader accessibility (WCAG 4.1.3) */}
                <div role="region" aria-live="polite" aria-atomic="true" aria-label="Notifications">
                  <Toaster
                    position="bottom-center"
                    // Bottom-center is thumb-reachable and clear of the notch,
                    // header, and offline banner. The container class offsets
                    // above the mobile bottom nav (see .toaster-container in
                    // index.css); on lg+ (no bottom nav) it hugs the bottom.
                    containerClassName="toaster-container"
                    toastOptions={{
                      duration: 4000,
                      className: 'press-feedback',
                      // Colors come from the design-system CSS variables
                      // declared in index.css (:root), which mirror the
                      // Tailwind tokens: surface-card, line, success, error.
                      style: {
                        background: 'var(--bg-panel)',
                        color: 'white',
                        border: '1px solid var(--border-subtle)',
                        borderRadius: '2px',
                        fontSize: '12px',
                        padding: '10px 14px',
                        maxWidth: 'min(360px, calc(100vw - 32px))',
                      },
                      success: {
                        iconTheme: {
                          primary: 'var(--success)',
                          secondary: 'var(--bg-panel)',
                        },
                      },
                      error: {
                        iconTheme: {
                          primary: 'var(--error)',
                          secondary: 'var(--bg-panel)',
                        },
                      },
                    }}
                  />
                </div>

                {/* PWA Install Prompt - shows after engagement delay, for
                    anonymous visitors too (they're the likeliest installers);
                    the component handles dismissal memory + installed state */}
                <PWAInstallPrompt />

                {/* Signed-in-only overlays (username prompt, achievement / XP /
                    level-up celebrations), lazy so guests never download them */}
                {user && (
                  <Suspense fallback={null}>
                    <AuthedOverlays />
                  </Suspense>
                )}

                <Suspense fallback={<LoadingScreen fullScreen />}>
                  <Routes>
                    {/* Public Routes - Landing page visible to all users */}
                    <Route
                      path="/"
                      element={
                        <Suspense fallback={<LoadingScreen fullScreen />}>
                          <Page name="Home">
                            <Landing />
                          </Page>
                        </Suspense>
                      }
                    />
                    <Route
                      path="/article/:id"
                      element={
                        <Suspense fallback={<LoadingScreen fullScreen />}>
                          <Page name="Article">
                            <Article />
                          </Page>
                        </Suspense>
                      }
                    />
                    <Route
                      path="/login"
                      element={
                        <RedirectIfAuthed>
                          <Suspense fallback={<LoadingScreen fullScreen />}>
                            <Page name="Sign In">
                              <Login />
                            </Page>
                          </Suspense>
                        </RedirectIfAuthed>
                      }
                    />
                    <Route
                      path="/register"
                      element={
                        <RedirectIfAuthed>
                          <Suspense fallback={<LoadingScreen fullScreen />}>
                            <Page name="Sign Up">
                              <Register />
                            </Page>
                          </Suspense>
                        </RedirectIfAuthed>
                      }
                    />
                    {/* The dedicated Podium recruiting/signup page was retired
                        once onboarding began offering the Podium-vs-SoundSport
                        choice up front — it became a duplicate signup path. The
                        path is kept as a redirect so inbound links land on the
                        public Podium guide (its informational successor). */}
                    <Route path="/podium" element={<Navigate to="/podium-guide" replace />} />
                    {/* Podium "try it out" demo — the interactive Podium daily
                        loop, no signup. Signed-in users go to the real thing. */}
                    <Route
                      path="/podium/preview"
                      element={
                        user ? (
                          <Navigate to="/dashboard" replace />
                        ) : (
                          <Suspense fallback={<LoadingScreen fullScreen />}>
                            <Page name="Podium Preview">
                              <PodiumPreview />
                            </Page>
                          </Suspense>
                        )
                      }
                    />
                    <Route
                      path="/forgot-password"
                      element={
                        user ? (
                          <Navigate to="/dashboard" replace />
                        ) : (
                          <Suspense fallback={<LoadingScreen fullScreen />}>
                            <Page name="Password Reset">
                              <ForgotPassword />
                            </Page>
                          </Suspense>
                        )
                      }
                    />
                    <Route
                      path="/privacy"
                      element={
                        <PublicPage name="Privacy">
                          <Privacy />
                        </PublicPage>
                      }
                    />
                    <Route
                      path="/terms"
                      element={
                        <PublicPage name="Terms">
                          <Terms />
                        </PublicPage>
                      }
                    />
                    {/* Living design-system reference (docs/DESIGN_SYSTEM.md).
                        Dev-only: it's an internal reference, not a product
                        surface — in production the path 404s like any other. */}
                    {import.meta.env.DEV && (
                      <Route
                        path="/styleguide"
                        element={
                          <Suspense fallback={<LoadingScreen fullScreen />}>
                            <StyleGuide />
                          </Suspense>
                        }
                      />
                    )}

                    {/* Guest Preview - Demo dashboard for unauthenticated users */}
                    <Route
                      path="/preview"
                      element={
                        user ? (
                          <Navigate to="/dashboard" replace />
                        ) : (
                          <Suspense fallback={<DashboardSkeleton />}>
                            <Page name="Preview">
                              <GuestDashboard />
                            </Page>
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
                            <Page name="Onboarding">
                              <Onboarding />
                            </Page>
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
                        <PublicPage name="How to Play">
                          <HowToPlayPublic />
                        </PublicPage>
                      }
                    />
                    {/* Player-facing changelog + roadmap — crawlable, no auth
                        (docs/FMA_LESSONS.md lesson 2: make the update cadence visible) */}
                    <Route
                      path="/updates"
                      element={
                        <PublicPage name="Updates">
                          <Updates />
                        </PublicPage>
                      }
                    />
                    {/* Public Podium Class guide (Phase 7.6) — crawlable, no auth */}
                    <Route
                      path="/podium-guide"
                      element={
                        <PublicPage name="Podium Guide">
                          <PodiumGuide />
                        </PublicPage>
                      }
                    />
                    {/* Supporters wall lives as a Scores tab for signed-in
                        directors; logged-out visitors are sent to Buy Me a Coffee. */}
                    <Route path="/supporters" element={<SupportersEntry />} />

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
                      path="/records"
                      element={
                        <ProtectedRoute>
                          <GameShell>
                            <Suspense fallback={<GalleryPageSkeleton />}>
                              <Page name="Records">
                                <Records />
                              </Page>
                            </Suspense>
                          </GameShell>
                        </ProtectedRoute>
                      }
                    />

                    <Route
                      path="/shop"
                      element={
                        <ProtectedRoute>
                          <GameShell>
                            <Suspense fallback={<GalleryPageSkeleton />}>
                              <Page name="Shop">
                                <Shop />
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

                    {/* /scores/:date looked like a per-day deep link but Scores
                        never called useParams — it only reads ?season and ?tab,
                        so the date segment was silently dropped and the page
                        rendered as though it weren't there. Redirect to the
                        canonical path instead of serving a URL that lies. */}
                    <Route path="/scores/:date" element={<ScoresDateRedirect />} />

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

                    <Route
                      path="/studio"
                      element={
                        <ProtectedRoute>
                          <GameShell>
                            <Suspense fallback={<GalleryPageSkeleton />}>
                              <Page name="Studio">
                                <Studio />
                              </Page>
                            </Suspense>
                          </GameShell>
                        </ProtectedRoute>
                      }
                    />

                    <Route
                      path="/exchange"
                      element={
                        <ProtectedRoute>
                          <GameShell>
                            <Suspense fallback={<GalleryPageSkeleton />}>
                              <Page name="Exchange">
                                <Exchange />
                              </Page>
                            </Suspense>
                          </GameShell>
                        </ProtectedRoute>
                      }
                    />

                    <Route
                      path="/achievements"
                      element={
                        <ProtectedRoute>
                          <GameShell>
                            <Suspense fallback={<GalleryPageSkeleton />}>
                              <Page name="Achievements">
                                <Achievements />
                              </Page>
                            </Suspense>
                          </GameShell>
                        </ProtectedRoute>
                      }
                    />

                    {/* Settings is now integrated into Profile - redirect for backwards compatibility */}
                    <Route path="/settings" element={<Navigate to="/profile" replace />} />

                    <Route path="/hall-of-champions" element={<HallOfChampionsEntry />} />

                    <Route
                      path="/admin"
                      element={
                        <ProtectedRoute>
                          <GameShell>
                            <Suspense fallback={<GalleryPageSkeleton />}>
                              <Page name="Admin">
                                <Admin />
                              </Page>
                            </Suspense>
                          </GameShell>
                        </ProtectedRoute>
                      }
                    />

                    {/* A league needs a URL. Detail used to be component state,
                        so there was no shareable link, no browser back, nothing
                        to restore on refresh — and the champion notification
                        written at season archival links to /leagues/{id}, which
                        landed on the catch-all. */}
                    <Route
                      path="/leagues/:leagueId?/:tab?"
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
                            <Suspense fallback={<GalleryPageSkeleton />}>
                              <Page name="Retired Corps">
                                <RetiredCorpsGallery />
                              </Page>
                            </Suspense>
                          </GameShell>
                        </ProtectedRoute>
                      }
                    />

                    <Route
                      path="/corps-history"
                      element={
                        <ProtectedRoute>
                          <GameShell>
                            <Suspense fallback={<GalleryPageSkeleton />}>
                              <Page name="Corps History">
                                <CorpsHistory />
                              </Page>
                            </Suspense>
                          </GameShell>
                        </ProtectedRoute>
                      }
                    />

                    {/* SoundSport rules were consolidated into the unified Game
                        Guide — keep the old path working for existing links. */}
                    <Route path="/soundsport" element={<Navigate to="/guide" replace />} />

                    {/* 404 Route — inside the shell so a wrong URL still leaves
                        the visitor somewhere they can navigate from. */}
                    <Route
                      path="*"
                      element={
                        <PublicPage name="Not Found">
                          <NotFound />
                        </PublicPage>
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
