// src/App.js - Ultimate Fantasy Drum Corps Game Application
// No framer-motion dependencies - using CSS animations instead

import React, { useState, useEffect, Suspense, lazy } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { useUserStore } from './store/userStore';
import { Toaster } from 'react-hot-toast';
import './App.css';

// Loading component with CSS animation
const LoadingScreen = ({ message = 'Loading...' }) => (
  <div className="loading-screen">
    <div className="loading-content">
      <div className="spinner"></div>
      <p>{message}</p>
      <div className="loading-subtitle">Ultimate Fantasy Drum Corps Game</div>
    </div>
  </div>
);

// Error Boundary Component
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('Error caught by boundary:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="error-boundary">
          <h2>Something went wrong</h2>
          <p>We're sorry, but something went wrong. Please refresh the page.</p>
          <button onClick={() => window.location.reload()}>
            Refresh Page
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

// Header Component
const Header = ({ user, isAdmin, onAuthClick }) => (
  <header className="app-header">
    <div className="header-content">
      <div className="logo">
        <h1>Ultimate Fantasy Drum Corps</h1>
      </div>
      <nav className="nav-menu">
        <a href="#dashboard">Dashboard</a>
        <a href="#lineup">Lineup</a>
        <a href="#trading">Trading</a>
        <a href="#leaderboard">Leaderboard</a>
        {isAdmin && <a href="#admin" className="admin-link">Admin</a>}
      </nav>
      <div className="auth-section">
        {user ? (
          <div className="user-info">
            <span>Welcome, {user.displayName || user.email}</span>
            {isAdmin && <span className="admin-badge">ADMIN</span>}
            <button onClick={() => useAuth().logout()} className="logout-btn">
              Logout
            </button>
          </div>
        ) : (
          <button onClick={onAuthClick} className="auth-btn">
            Sign In
          </button>
        )}
      </div>
    </div>
  </header>
);

// Authentication Modal with CSS transitions
const AuthModal = ({ isOpen, onClose }) => {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [loading, setLoading] = useState(false);
  const { login, signup, signInWithGoogle } = useAuth();

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (isLogin) {
        await login(email, password);
      } else {
        await signup(email, password, { displayName });
      }
      onClose();
    } catch (error) {
      console.error('Auth error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setLoading(true);
    try {
      await signInWithGoogle();
      onClose();
    } catch (error) {
      console.error('Google sign in error:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay fade-in" onClick={onClose}>
      <div 
        className="auth-modal slide-up"
        onClick={(e) => e.stopPropagation()}
      >
        <h2>{isLogin ? 'Sign In' : 'Create Account'}</h2>
        
        <form onSubmit={handleSubmit}>
          {!isLogin && (
            <input
              type="text"
              placeholder="Display Name"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              required
            />
          )}
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          
          <button type="submit" disabled={loading} className="auth-submit">
            {loading ? 'Loading...' : (isLogin ? 'Sign In' : 'Create Account')}
          </button>
        </form>

        <div className="auth-divider">or</div>

        <button onClick={handleGoogleSignIn} disabled={loading} className="google-btn">
          Sign in with Google
        </button>

        <div className="auth-footer">
          <button 
            type="button"
            onClick={() => setIsLogin(!isLogin)}
            className="toggle-auth"
          >
            {isLogin ? 'Need an account? Sign up' : 'Have an account? Sign in'}
          </button>
        </div>

        <button onClick={onClose} className="close-btn">×</button>
      </div>
    </div>
  );
};

// Dashboard Component
const Dashboard = ({ user, isAdmin }) => {
  const { level, experience, totalScore, achievements } = useUserStore();

  return (
    <div className="dashboard">
      <div className="dashboard-header">
        <h2>Dashboard</h2>
        {isAdmin && (
          <div className="admin-status">
            <span>Admin Account: {user.uid}</span>
            <span className="admin-indicator">ADMIN ACCESS ACTIVE</span>
          </div>
        )}
      </div>

      <div className="stats-grid">
        <div className="stat-card slide-in-left">
          <h3>Level</h3>
          <div className="stat-value">{level}</div>
        </div>
        <div className="stat-card slide-in-down" style={{animationDelay: '0.1s'}}>
          <h3>Experience</h3>
          <div className="stat-value">{experience.toLocaleString()}</div>
        </div>
        <div className="stat-card slide-in-down" style={{animationDelay: '0.2s'}}>
          <h3>Total Score</h3>
          <div className="stat-value">{totalScore.toLocaleString()}</div>
        </div>
        <div className="stat-card slide-in-right" style={{animationDelay: '0.3s'}}>
          <h3>Achievements</h3>
          <div className="stat-value">{achievements.length}</div>
        </div>
      </div>

      <div className="recent-activity slide-in-up">
        <h3>Recent Activity</h3>
        <div className="activity-list">
          <div className="activity-item">Welcome to Ultimate Fantasy Drum Corps!</div>
          <div className="activity-item">Account created successfully</div>
          {isAdmin && (
            <div className="activity-item admin-activity">
              Admin privileges activated
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// Home Component
const Home = ({ onGetStarted }) => (
  <div className="home">
    <div className="hero-section">
      <h1 className="fade-in-up">Ultimate Fantasy Drum Corps Game</h1>
      <p className="hero-subtitle fade-in-up" style={{animationDelay: '0.2s'}}>
        Create your dream drum corps lineup with real DCI Hall of Fame staff
      </p>
      
      <div className="features">
        <div className="feature slide-in-left" style={{animationDelay: '0.4s'}}>
          <h3>Authentic DCI Integration</h3>
          <p>Real Hall of Fame staff with accurate specialties</p>
        </div>
        <div className="feature slide-in-up" style={{animationDelay: '0.6s'}}>
          <h3>Dynamic Trading System</h3>
          <p>Full marketplace with supply/demand economics</p>
        </div>
        <div className="feature slide-in-right" style={{animationDelay: '0.8s'}}>
          <h3>Class Progression</h3>
          <p>A Class → Open Class → World Class advancement</p>
        </div>
      </div>

      <button onClick={onGetStarted} className="cta-button pulse" style={{animationDelay: '1s'}}>
        Get Started
      </button>
    </div>
  </div>
);

// Admin Panel Component
const AdminPanel = ({ user }) => {
  if (user?.uid !== 'o8vfRCOevjTKBY0k2dISlpiYiIH2') {
    return <div className="admin-panel">Access Denied</div>;
  }

  return (
    <div className="admin-panel slide-in-up">
      <h2>Admin Panel</h2>
      <div className="admin-info">
        <p>Admin Account: {user.uid}</p>
        <p>Email: {user.email}</p>
        <p>Status: Super Admin</p>
      </div>
      
      <div className="admin-actions">
        <h3>Admin Actions</h3>
        <button className="admin-btn">Manage Users</button>
        <button className="admin-btn">View Analytics</button>
        <button className="admin-btn">System Settings</button>
        <button className="admin-btn">Database Management</button>
      </div>
    </div>
  );
};

// Main App Content Component
const AppContent = () => {
  const { currentUser, isAdmin, loading } = useAuth();
  const { initializeUser } = useUserStore();
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [currentView, setCurrentView] = useState('home');

  useEffect(() => {
    if (currentUser) {
      initializeUser(currentUser);
      if (currentView === 'home') {
        setCurrentView('dashboard');
      }
    }
  }, [currentUser, initializeUser]);

  if (loading) {
    return <LoadingScreen message="Loading Ultimate Fantasy Drum Corps..." />;
  }

  const handleGetStarted = () => {
    if (currentUser) {
      setCurrentView('dashboard');
    } else {
      setShowAuthModal(true);
    }
  };

  const renderCurrentView = () => {
    switch (currentView) {
      case 'dashboard':
        return currentUser ? (
          <Dashboard user={currentUser} isAdmin={isAdmin} />
        ) : (
          <Home onGetStarted={handleGetStarted} />
        );
      case 'admin':
        return isAdmin ? (
          <AdminPanel user={currentUser} />
        ) : (
          <div className="access-denied">Admin access required</div>
        );
      default:
        return <Home onGetStarted={handleGetStarted} />;
    }
  };

  return (
    <div className="app">
      <Header 
        user={currentUser} 
        isAdmin={isAdmin}
        onAuthClick={() => setShowAuthModal(true)}
      />
      
      <main className="main-content">
        {renderCurrentView()}
      </main>

      <nav className="bottom-nav">
        <button 
          onClick={() => setCurrentView('home')}
          className={currentView === 'home' ? 'active' : ''}
        >
          Home
        </button>
        {currentUser && (
          <>
            <button 
              onClick={() => setCurrentView('dashboard')}
              className={currentView === 'dashboard' ? 'active' : ''}
            >
              Dashboard
            </button>
            {isAdmin && (
              <button 
                onClick={() => setCurrentView('admin')}
                className={currentView === 'admin' ? 'active' : ''}
              >
                Admin
              </button>
            )}
          </>
        )}
      </nav>

      <AuthModal 
        isOpen={showAuthModal}
        onClose={() => setShowAuthModal(false)}
      />
    </div>
  );
};

// Main App Component with Providers
const App = () => {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <div className="app-container">
          <AppContent />
          <Toaster
            position="top-right"
            toastOptions={{
              duration: 4000,
              style: {
                background: '#333',
                color: '#fff',
                borderRadius: '8px',
              },
            }}
          />
        </div>
      </AuthProvider>
    </ErrorBoundary>
  );
};

export default App;