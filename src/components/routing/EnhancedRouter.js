// src/components/routing/EnhancedRouter.js
// Enhanced routing configuration for Fantasy Drum Corps Game
// Handles all lineup builder routes and lazy loading optimization

import React, { Suspense, lazy } from 'react';
import { Routes, Route } from 'react-router-dom';
import { ErrorBoundary } from '../ErrorBoundary';
import ProtectedRoute from '../auth/ProtectedRoute';
import LoadingScreen from '../ui/LoadingScreen';

// Lazy load all components for optimal performance
const HomePage = lazy(() => import('../../pages/HomePage'));
const DashboardPage = lazy(() => import('../../pages/DashboardPage'));
const ProfilePage = lazy(() => import('../../pages/ProfilePage'));
const AdminPage = lazy(() => import('../../pages/AdminPage'));
const LeaguePage = lazy(() => import('../../pages/LeaguePage'));
const LeagueDetailPage = lazy(() => import('../../pages/LeagueDetailPage'));
const LeaderboardPage = lazy(() => import('../../pages/LeaderboardPage'));
const SchedulePage = lazy(() => import('../../pages/SchedulePage'));
const ScoresPage = lazy(() => import('../../pages/ScoresPage'));
const StatsPage = lazy(() => import('../../pages/StatsPage'));
const HowToPlayPage = lazy(() => import('../../pages/HowToPlayPage'));
const OnboardingFlow = lazy(() => import('../onboarding/OnboardingFlow'));
const AchievementsPage = lazy(() => import('../../pages/AchievementsPage'));
const TradingCenterPage = lazy(() => import('../../pages/TradingCenterPage'));
const AnalyticsPage = lazy(() => import('../../pages/AnalyticsPage'));
const NotificationsPage = lazy(() => import('../../pages/NotificationsPage'));
const SettingsPage = lazy(() => import('../../pages/SettingsPage'));

// Enhanced Lineup Builder - This will be our main component
const LineupBuilderPage = lazy(() => import('../../pages/LineupBuilderPage'));

// Error boundary wrapper for each route
const RouteErrorBoundary = ({ children }) => (
  <ErrorBoundary
    fallback={({ error, resetErrorBoundary }) => (
      <div className="min-h-screen bg-background dark:bg-background-dark flex items-center justify-center p-4">
        <div className="text-center max-w-md">
          <div className="text-6xl mb-4">🥁</div>
          <h1 className="text-2xl font-bold text-text-primary dark:text-text-primary-dark mb-4">
            Route Error
          </h1>
          <p className="text-text-secondary dark:text-text-secondary-dark mb-6">
            Something went wrong loading this page. Don't worry - even the best corps have off days!
          </p>
          <div className="space-y-3">
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
              Go Home
            </button>
          </div>
          {process.env.NODE_ENV === 'development' && (
            <details className="mt-4 text-left">
              <summary className="cursor-pointer text-sm text-text-secondary dark:text-text-secondary-dark">
                Error Details (Dev Mode)
              </summary>
              <pre className="mt-2 text-xs bg-surface dark:bg-surface-dark p-2 rounded border overflow-auto">
                {error?.toString()}
              </pre>
            </details>
          )}
        </div>
      </div>
    )}
  >
    {children}
  </ErrorBoundary>
);

// Enhanced loading fallback with context
const ContextualLoadingFallback = ({ route }) => {
  const getLoadingMessage = () => {
    switch (route) {
      case 'lineup':
        return 'Loading lineup builder...';
      case 'dashboard':
        return 'Loading your dashboard...';
      case 'trading':
        return 'Loading trading center...';
      case 'admin':
        return 'Loading admin panel...';
      case 'analytics':
        return 'Loading analytics...';
      default:
        return 'Loading...';
    }
  };

  return <LoadingScreen message={getLoadingMessage()} />;
};

// 404 Component
const NotFoundPage = () => (
  <div className="min-h-screen flex items-center justify-center">
    <div className="text-center max-w-md px-4">
      <div className="text-6xl mb-4">🥁</div>
      <h1 className="text-3xl font-bold text-text-primary dark:text-text-primary-dark mb-4">
        404 - Page Not Found
      </h1>
      <p className="text-text-secondary dark:text-text-secondary-dark mb-6">
        Looks like this page marched off the field and can't find its way back to formation!
      </p>
      <div className="space-y-3">
        <button
          onClick={() => window.history.back()}
          className="w-full bg-primary text-on-primary px-6 py-3 rounded-theme font-medium hover:bg-primary-hover transition-colors"
        >
          Return to Formation
        </button>
        <button
          onClick={() => window.location.href = '/'}
          className="w-full bg-surface dark:bg-surface-dark text-text-primary dark:text-text-primary-dark px-6 py-3 rounded-theme font-medium border border-accent dark:border-accent-dark hover:bg-accent/10 transition-colors"
        >
          Go to Home Field
        </button>
      </div>
    </div>
  </div>
);

// Main Enhanced Router Component
const EnhancedRouter = () => {
  return (
    <Routes>
      {/* ================================ */}
      {/* PUBLIC ROUTES */}
      {/* ================================ */}
      
      <Route path="/" element={
        <RouteErrorBoundary>
          <Suspense fallback={<ContextualLoadingFallback route="home" />}>
            <HomePage />
          </Suspense>
        </RouteErrorBoundary>
      } />
      
      <Route path="/how-to-play" element={
        <RouteErrorBoundary>
          <Suspense fallback={<ContextualLoadingFallback route="help" />}>
            <HowToPlayPage />
          </Suspense>
        </RouteErrorBoundary>
      } />
      
      <Route path="/leaderboard" element={
        <RouteErrorBoundary>
          <Suspense fallback={<ContextualLoadingFallback route="leaderboard" />}>
            <LeaderboardPage />
          </Suspense>
        </RouteErrorBoundary>
      } />
      
      <Route path="/schedule" element={
        <RouteErrorBoundary>
          <Suspense fallback={<ContextualLoadingFallback route="schedule" />}>
            <SchedulePage />
          </Suspense>
        </RouteErrorBoundary>
      } />
      
      <Route path="/scores" element={
        <RouteErrorBoundary>
          <Suspense fallback={<ContextualLoadingFallback route="scores" />}>
            <ScoresPage />
          </Suspense>
        </RouteErrorBoundary>
      } />
      
      <Route path="/stats" element={
        <RouteErrorBoundary>
          <Suspense fallback={<ContextualLoadingFallback route="stats" />}>
            <StatsPage />
          </Suspense>
        </RouteErrorBoundary>
      } />

      {/* ================================ */}
      {/* PROTECTED USER ROUTES */}
      {/* ================================ */}
      
      <Route path="/dashboard" element={
        <RouteErrorBoundary>
          <ProtectedRoute>
            <Suspense fallback={<ContextualLoadingFallback route="dashboard" />}>
              <DashboardPage />
            </Suspense>
          </ProtectedRoute>
        </RouteErrorBoundary>
      } />
      
      <Route path="/profile" element={
        <RouteErrorBoundary>
          <ProtectedRoute>
            <Suspense fallback={<ContextualLoadingFallback route="profile" />}>
              <ProfilePage />
            </Suspense>
          </ProtectedRoute>
        </RouteErrorBoundary>
      } />

      <Route path="/onboarding" element={
        <RouteErrorBoundary>
          <ProtectedRoute>
            <Suspense fallback={<ContextualLoadingFallback route="onboarding" />}>
              <OnboardingFlow />
            </Suspense>
          </ProtectedRoute>
        </RouteErrorBoundary>
      } />

      <Route path="/achievements" element={
        <RouteErrorBoundary>
          <ProtectedRoute>
            <Suspense fallback={<ContextualLoadingFallback route="achievements" />}>
              <AchievementsPage />
            </Suspense>
          </ProtectedRoute>
        </RouteErrorBoundary>
      } />

      <Route path="/trading" element={
        <RouteErrorBoundary>
          <ProtectedRoute>
            <Suspense fallback={<ContextualLoadingFallback route="trading" />}>
              <TradingCenterPage />
            </Suspense>
          </ProtectedRoute>
        </RouteErrorBoundary>
      } />

      {/* ================================ */}
      {/* LINEUP BUILDER ROUTES */}
      {/* ================================ */}
      
      {/* Primary lineup builder route */}
      <Route path="/lineup/:corpsClass?" element={
        <RouteErrorBoundary>
          <ProtectedRoute>
            <Suspense fallback={<ContextualLoadingFallback route="lineup" />}>
              <LineupBuilderPage />
            </Suspense>
          </ProtectedRoute>
        </RouteErrorBoundary>
      } />

      {/* Enhanced lineup builder route (same component, different URL for compatibility) */}
      <Route path="/enhanced-lineup/:corpsClass?" element={
        <RouteErrorBoundary>
          <ProtectedRoute>
            <Suspense fallback={<ContextualLoadingFallback route="lineup" />}>
              <LineupBuilderPage />
            </Suspense>
          </ProtectedRoute>
        </RouteErrorBoundary>
      } />

      {/* Legacy lineup builder route for backwards compatibility */}
      <Route path="/build/:corpsClass?" element={
        <RouteErrorBoundary>
          <ProtectedRoute>
            <Suspense fallback={<ContextualLoadingFallback route="lineup" />}>
              <LineupBuilderPage />
            </Suspense>
          </ProtectedRoute>
        </RouteErrorBoundary>
      } />

      {/* ================================ */}
      {/* LEAGUE AND COMPETITION ROUTES */}
      {/* ================================ */}
      
      <Route path="/leagues" element={
        <RouteErrorBoundary>
          <ProtectedRoute>
            <Suspense fallback={<ContextualLoadingFallback route="leagues" />}>
              <LeaguePage />
            </Suspense>
          </ProtectedRoute>
        </RouteErrorBoundary>
      } />

      <Route path="/league/:leagueId" element={
        <RouteErrorBoundary>
          <ProtectedRoute>
            <Suspense fallback={<ContextualLoadingFallback route="league" />}>
              <LeagueDetailPage />
            </Suspense>
          </ProtectedRoute>
        </RouteErrorBoundary>
      } />

      {/* ================================ */}
      {/* USER ACCOUNT ROUTES */}
      {/* ================================ */}
      
      <Route path="/notifications" element={
        <RouteErrorBoundary>
          <ProtectedRoute>
            <Suspense fallback={<ContextualLoadingFallback route="notifications" />}>
              <NotificationsPage />
            </Suspense>
          </ProtectedRoute>
        </RouteErrorBoundary>
      } />

      <Route path="/settings" element={
        <RouteErrorBoundary>
          <ProtectedRoute>
            <Suspense fallback={<ContextualLoadingFallback route="settings" />}>
              <SettingsPage />
            </Suspense>
          </ProtectedRoute>
        </RouteErrorBoundary>
      } />

      {/* ================================ */}
      {/* ADMIN ROUTES */}
      {/* ================================ */}
      
      <Route path="/admin" element={
        <RouteErrorBoundary>
          <ProtectedRoute adminOnly>
            <Suspense fallback={<ContextualLoadingFallback route="admin" />}>
              <AdminPage />
            </Suspense>
          </ProtectedRoute>
        </RouteErrorBoundary>
      } />

      <Route path="/analytics" element={
        <RouteErrorBoundary>
          <ProtectedRoute adminOnly>
            <Suspense fallback={<ContextualLoadingFallback route="analytics" />}>
              <AnalyticsPage />
            </Suspense>
          </ProtectedRoute>
        </RouteErrorBoundary>
      } />

      {/* ================================ */}
      {/* PREMIUM FEATURE ROUTES */}
      {/* ================================ */}
      
      <Route path="/premium/*" element={
        <RouteErrorBoundary>
          <ProtectedRoute>
            <Routes>
              <Route path="analytics" element={
                <Suspense fallback={<ContextualLoadingFallback route="premium" />}>
                  <AnalyticsPage />
                </Suspense>
              } />
              <Route path="trading" element={
                <Suspense fallback={<ContextualLoadingFallback route="premium" />}>
                  <TradingCenterPage />
                </Suspense>
              } />
              {/* Add more premium routes as needed */}
            </Routes>
          </ProtectedRoute>
        </RouteErrorBoundary>
      } />

      {/* ================================ */}
      {/* API AND UTILITY ROUTES */}
      {/* ================================ */}
      
      {/* Health check route for monitoring */}
      <Route path="/health" element={
        <div className="p-4 text-center">
          <div className="text-green-500 font-bold">✅ System Healthy</div>
          <div className="text-sm text-text-secondary dark:text-text-secondary-dark mt-2">
            Fantasy Drum Corps Game is running smoothly
          </div>
        </div>
      } />

      {/* ================================ */}
      {/* 404 FALLBACK ROUTE */}
      {/* ================================ */}
      
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
};

export default EnhancedRouter;