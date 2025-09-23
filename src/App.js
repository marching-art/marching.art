// src/App.js - Main app with AuthProvider wrapper (Updated for existing structure)
import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, useNavigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider } from './contexts/AuthContext';
import { useUserStore } from './store/userStore';
import { ErrorBoundary } from './components/ErrorBoundary';
import ProtectedRoute from './components/auth/ProtectedRoute';
import AuthModal from './components/auth/AuthModal';

// Import existing pages
import Header from './components/layout/Header';
import Footer from './components/layout/Footer';
import HomePage from './pages/HomePage';
import DashboardPage from './pages/DashboardPage';
import ProfilePage from './pages/ProfilePage';
import AdminPage from './pages/AdminPage';
import LeaguePage from './pages/LeaguePage';
import LeagueDetailPage from './pages/LeagueDetailPage';
import LeaderboardPage from './pages/LeaderboardPage';
import SchedulePage from './pages/SchedulePage';
import ScoresPage from './pages/ScoresPage';
import StatsPage from './pages/StatsPage';
import HowToPlayPage from './pages/HowToPlayPage';
import UserSettingsPage from './pages/UserSettingsPage';

function AppContent() {
    const { loggedInProfile } = useUserStore();
    const navigate = useNavigate();

    const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
    const [authModalView, setAuthModalView] = useState('login');
    const [themeMode, setThemeMode] = useState(localStorage.getItem('theme') || 'dark');
    
    useEffect(() => {
        if (themeMode === 'dark') {
            document.documentElement.classList.add('dark');
        } else {
            document.documentElement.classList.remove('dark');
        }
        localStorage.setItem('theme', themeMode);
    }, [themeMode]);

    // Handle modal events from ScheduleAuthPrompt
    useEffect(() => {
        const handleOpenSignUpModal = () => {
            setAuthModalView('signup');
            setIsAuthModalOpen(true);
        };

        const handleOpenLoginModal = () => {
            setAuthModalView('login');
            setIsAuthModalOpen(true);
        };

        window.addEventListener('openSignUpModal', handleOpenSignUpModal);
        window.addEventListener('openLoginModal', handleOpenLoginModal);

        return () => {
            window.removeEventListener('openSignUpModal', handleOpenSignUpModal);
            window.removeEventListener('openLoginModal', handleOpenLoginModal);
        };
    }, []);

    const toggleThemeMode = () => {
        setThemeMode(prevMode => prevMode === 'light' ? 'dark' : 'light');
    };

    const handleAuthSuccess = () => {
        setIsAuthModalOpen(false);
        // Redirect to dashboard after successful auth
        navigate('/dashboard');
    };

    return (
        <div className="min-h-screen bg-background dark:bg-background-dark">
            <Header 
                themeMode={themeMode}
                toggleThemeMode={toggleThemeMode}
                onSignUpClick={() => {
                    setAuthModalView('signup');
                    setIsAuthModalOpen(true);
                }}
                onLoginClick={() => {
                    setAuthModalView('login');
                    setIsAuthModalOpen(true);
                }}
            />
            
            <main className="flex-grow">
                <Routes>
                    {/* Public Routes */}
                    <Route 
                        path="/" 
                        element={
                            <HomePage 
                                onSignUpClick={() => {
                                    setAuthModalView('signup');
                                    setIsAuthModalOpen(true);
                                }}
                            />
                        } 
                    />
                    <Route path="/profile/:username" element={<ProfilePage />} />
                    <Route path="/schedule" element={<SchedulePage />} />
                    <Route path="/scores" element={<ScoresPage />} />
                    <Route path="/stats" element={<StatsPage />} />
                    <Route path="/leaderboard" element={<LeaderboardPage />} />
                    <Route path="/how-to-play" element={<HowToPlayPage />} />
                    
                    {/* Protected Routes */}
                    <Route 
                        path="/dashboard" 
                        element={
                            <ProtectedRoute>
                                <DashboardPage />
                            </ProtectedRoute>
                        } 
                    />
                    <Route 
                        path="/settings" 
                        element={
                            <ProtectedRoute>
                                <UserSettingsPage />
                            </ProtectedRoute>
                        } 
                    />
                    <Route 
                        path="/leagues" 
                        element={
                            <ProtectedRoute>
                                <LeaguePage />
                            </ProtectedRoute>
                        } 
                    />
                    <Route 
                        path="/leagues/:leagueId" 
                        element={
                            <ProtectedRoute>
                                <LeagueDetailPage />
                            </ProtectedRoute>
                        } 
                    />
                    
                    {/* Admin Routes */}
                    <Route 
                        path="/admin" 
                        element={
                            <ProtectedRoute adminOnly={true}>
                                <AdminPage />
                            </ProtectedRoute>
                        } 
                    />
                </Routes>
            </main>
            
            <Footer />
            
            {/* Auth Modal */}
            <AuthModal
                isOpen={isAuthModalOpen}
                onClose={() => setIsAuthModalOpen(false)}
                onAuthSuccess={handleAuthSuccess}
                initialView={authModalView}
            />
            
            {/* Toast Notifications */}
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
                            primary: '#ef4444',
                            secondary: '#ffffff',
                        },
                    },
                }}
            />
        </div>
    );
}

function App() {
    return (
        <ErrorBoundary>
            <AuthProvider>
                <Router>
                    <AppContent />
                </Router>
            </AuthProvider>
        </ErrorBoundary>
    );
}

export default App;