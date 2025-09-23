// src/App.js - Complete App with all routing and authentication
import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, useNavigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider } from './context/AuthContext';
import { useUserStore } from './store/userStore';
import ProtectedRoute from './components/auth/ProtectedRoute';
import AuthModal from './components/auth/AuthModal';

// Layout Components
import Header from './components/layout/Header';
import Footer from './components/layout/Footer';

// Page Components
import HomePage from './pages/HomePage';
import DashboardPage from './pages/DashboardPage';
import ProfilePage from './pages/ProfilePage';
import ProfileSetupPage from './pages/ProfileSetupPage';
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

    // Handle modal events from components
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
        // Navigation will be handled by ProtectedRoute based on profile status
    };

    return (
        <div className="min-h-screen bg-background dark:bg-background-dark text-text-primary dark:text-text-primary-dark">
            {/* Header - show on all pages except setup */}
            <Header 
                themeMode={themeMode}
                toggleThemeMode={toggleThemeMode}
                onOpenAuthModal={() => setIsAuthModalOpen(true)}
            />

            {/* Main Content */}
            <main className="flex-1">
                <Routes>
                    {/* Public Routes */}
                    <Route path="/" element={<HomePage />} />
                    <Route path="/how-to-play" element={<HowToPlayPage />} />

                    {/* Profile Setup - Requires auth but not profile */}
                    <Route 
                        path="/setup" 
                        element={
                            <ProtectedRoute requireProfile={false}>
                                <ProfileSetupPage />
                            </ProtectedRoute>
                        } 
                    />

                    {/* Protected Routes - Require both auth and profile */}
                    <Route 
                        path="/dashboard" 
                        element={
                            <ProtectedRoute>
                                <DashboardPage />
                            </ProtectedRoute>
                        } 
                    />

                    <Route 
                        path="/profile/:userId?" 
                        element={
                            <ProtectedRoute>
                                <ProfilePage />
                            </ProtectedRoute>
                        } 
                    />

                    <Route 
                        path="/scores" 
                        element={
                            <ProtectedRoute>
                                <ScoresPage />
                            </ProtectedRoute>
                        } 
                    />

                    <Route 
                        path="/schedule" 
                        element={
                            <ProtectedRoute>
                                <SchedulePage />
                            </ProtectedRoute>
                        } 
                    />

                    <Route 
                        path="/leaderboard" 
                        element={
                            <ProtectedRoute>
                                <LeaderboardPage />
                            </ProtectedRoute>
                        } 
                    />

                    <Route 
                        path="/stats" 
                        element={
                            <ProtectedRoute>
                                <StatsPage />
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
                        path="/league/:leagueId" 
                        element={
                            <ProtectedRoute>
                                <LeagueDetailPage />
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

                    {/* Admin Routes */}
                    <Route 
                        path="/admin" 
                        element={
                            <ProtectedRoute requireAdmin={true}>
                                <AdminPage />
                            </ProtectedRoute>
                        } 
                    />

                    {/* Catch-all redirect to home */}
                    <Route path="*" element={<HomePage />} />
                </Routes>
            </main>

            {/* Footer - show on all pages except setup */}
            <Footer />

            {/* Auth Modal */}
            <AuthModal
                isOpen={isAuthModalOpen}
                onClose={() => setIsAuthModalOpen(false)}
                initialView={authModalView}
                onAuthSuccess={handleAuthSuccess}
            />

            {/* Toast Notifications */}
            <Toaster
                position="top-right"
                toastOptions={{
                    duration: 4000,
                    style: {
                        background: themeMode === 'dark' ? '#374151' : '#ffffff',
                        color: themeMode === 'dark' ? '#f3f4f6' : '#111827',
                        border: themeMode === 'dark' ? '1px solid #4b5563' : '1px solid #d1d5db',
                    },
                    success: {
                        iconTheme: {
                            primary: '#10b981',
                            secondary: '#ffffff',
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
        <AuthProvider>
            <Router>
                <AppContent />
            </Router>
        </AuthProvider>
    );
}

export default App;