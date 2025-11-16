// src/App.jsx
import React, { useState, useEffect, createContext, useContext, lazy, Suspense } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Toaster } from 'react-hot-toast';
import { useAuthState } from 'react-firebase-hooks/auth';
import { auth, authHelpers, analyticsHelpers } from './firebase';
import LoadingScreen from './components/LoadingScreen';
import Navigation from './components/Navigation';
import MobileNav from './components/MobileNav';

// Lazy load pages for better performance
const Dashboard = lazy(() => import('./pages/Dashboard'));
const Hub = lazy(() => import('./pages/Hub'));
const Leaderboard = lazy(() => import('./pages/Leaderboard'));
const Schedule = lazy(() => import('./pages/Schedule'));
const Scores = lazy(() => import('./pages/Scores'));
const Profile = lazy(() => import('./pages/ProfileNew'));
const Settings = lazy(() => import('./pages/Settings'));
const HowToPlay = lazy(() => import('./pages/HowToPlay'));
const HallOfChampions = lazy(() => import('./pages/HallOfChampions'));
const Admin = lazy(() => import('./pages/Admin'));
const Staff = lazy(() => import('./pages/Staff'));
const BattlePass = lazy(() => import('./pages/BattlePass'));
const Onboarding = lazy(() => import('./pages/Onboarding'));
const Login = lazy(() => import('./pages/Login'));
const Register = lazy(() => import('./pages/Register'));
const Landing = lazy(() => import('./pages/Landing'));

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
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const location = useLocation();

  useEffect(() => {
    // Log page views
    analyticsHelpers.logPageView(location.pathname);
    // Close mobile menu on route change
    setMobileMenuOpen(false);
  }, [location]);

  return (
    <div className="min-h-screen bg-gradient-main">
      {/* Desktop Navigation */}
      <div className="hidden lg:block">
        <Navigation />
      </div>

      {/* Mobile Navigation */}
      <div className="lg:hidden">
        <MobileNav 
          isOpen={mobileMenuOpen} 
          setIsOpen={setMobileMenuOpen} 
        />
      </div>

      {/* Main Content */}
      <main className="lg:ml-64 min-h-screen">
        <AnimatePresence mode="wait">
          <motion.div
            key={location.pathname}
            initial="initial"
            animate="in"
            exit="out"
            variants={pageVariants}
            transition={pageTransition}
            className="container-responsive py-8"
          >
            <Suspense fallback={<LoadingScreen />}>
              {children}
            </Suspense>
          </motion.div>
        </AnimatePresence>
      </main>

      {/* Footer */}
      <footer className="lg:ml-64 mt-auto">
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
    <AuthContext.Provider value={authContextValue}>
      <Router>
        <Toaster
          position="top-right"
          toastOptions={{
            duration: 4000,
            style: {
              background: '#1A1A1A',
              color: '#E5D396',
              border: '1px solid rgba(229, 211, 150, 0.2)',
              borderRadius: '0.5rem',
            },
            success: {
              iconTheme: {
                primary: '#FFD44D',
                secondary: '#1A1A1A',
              },
            },
            error: {
              iconTheme: {
                primary: '#EF4444',
                secondary: '#1A1A1A',
              },
            },
          }}
        />

        <Routes>
          {/* Public Routes */}
          <Route path="/" element={user ? <Navigate to="/dashboard" /> : <Landing />} />
          <Route path="/login" element={user ? <Navigate to="/dashboard" /> : <Login />} />
          <Route path="/register" element={user ? <Navigate to="/dashboard" /> : <Register />} />
          <Route path="/how-to-play" element={<HowToPlay />} />

          {/* Onboarding - Protected but minimal layout */}
          <Route path="/onboarding" element={
            <ProtectedRoute>
              <Onboarding />
            </ProtectedRoute>
          } />

          {/* Protected Routes */}
          <Route path="/dashboard" element={
            <ProtectedRoute>
              <Layout>
                <Dashboard />
              </Layout>
            </ProtectedRoute>
          } />
          
          <Route path="/hub" element={
            <ProtectedRoute>
              <Layout>
                <Hub />
              </Layout>
            </ProtectedRoute>
          } />
          
          <Route path="/leaderboard" element={
            <Layout>
              <Leaderboard />
            </Layout>
          } />
          
          <Route path="/schedule" element={
            <ProtectedRoute>
              <Layout>
                <Schedule />
              </Layout>
            </ProtectedRoute>
          } />
          
          <Route path="/scores" element={
            <ProtectedRoute>
              <Layout>
                <Scores />
              </Layout>
            </ProtectedRoute>
          } />
          
          <Route path="/scores/:date" element={
            <ProtectedRoute>
              <Layout>
                <Scores />
              </Layout>
            </ProtectedRoute>
          } />
          
          <Route path="/profile/:userId?" element={
            <ProtectedRoute>
              <Layout>
                <Profile />
              </Layout>
            </ProtectedRoute>
          } />
          
          <Route path="/settings" element={
            <ProtectedRoute>
              <Layout>
                <Settings />
              </Layout>
            </ProtectedRoute>
          } />
          
          <Route path="/hall-of-champions" element={
            <Layout>
              <HallOfChampions />
            </Layout>
          } />

          <Route path="/admin" element={
            <ProtectedRoute>
              <Layout>
                <Admin />
              </Layout>
            </ProtectedRoute>
          } />

          <Route path="/staff" element={
            <ProtectedRoute>
              <Layout>
                <Staff />
              </Layout>
            </ProtectedRoute>
          } />

          <Route path="/battlepass" element={
            <ProtectedRoute>
              <Layout>
                <BattlePass />
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
  );
}

export default App;
