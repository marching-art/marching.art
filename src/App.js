import React, { useState, useEffect } from 'react';
import { signOut } from 'firebase/auth';
import { auth } from './firebase';
import { AuthProvider, useAuth } from './context/AuthContext';
import { Toaster } from 'react-hot-toast';
import { useUserStore } from './store/userStore';
import { BrowserRouter as Router, Routes, Route, useParams, useNavigate } from 'react-router-dom';
import { ErrorBoundary } from './components/ErrorBoundary';

// Import the new ProtectedRoute component
import ProtectedRoute from './components/auth/ProtectedRoute';

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
import UserSettingsPage from './pages/UserSettingsPage'; // Import the new settings page
import AuthModal from './components/auth/AuthModal';

function AppContent() {
    const { user, isLoadingAuth } = useAuth();
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

    const openLoginModal = () => {
        setAuthModalView('login');
        setIsAuthModalOpen(true);
    };

    const openSignUpModal = () => {
        setAuthModalView('signup');
        setIsAuthModalOpen(true);
    };

    const handleLogout = async () => {
        try {
            await signOut(auth);
            navigate('/');
        } catch (error) {
            console.error('Error signing out:', error);
        }
    };

    const handleViewOwnProfile = () => {
        if (loggedInProfile?.username) {
            navigate(`/profile/${loggedInProfile.username}`);
        }
    };

    // Component for handling profile routes with username parameter
    const ProfileRouteHandler = () => {
        const { username } = useParams();
        return <ProfilePage username={username} />;
    };

    // Component for handling league detail routes
    const LeagueDetailRouteHandler = () => {
        const { leagueId } = useParams();
        return <LeagueDetailPage leagueId={leagueId} />;
    };

    if (isLoadingAuth) {
        return (
            <div className="min-h-screen bg-background dark:bg-background-dark flex items-center justify-center">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary dark:border-primary-dark"></div>
                    <p className="mt-4 text-text-secondary dark:text-text-secondary-dark">Loading marching.art...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-background dark:bg-background-dark text-text-primary dark:text-text-primary-dark flex flex-col">
            <Toaster
                position="top-right"
                toastOptions={{
                    duration: 4000,
                    style: {
                        background: themeMode === 'dark' ? '#374151' : '#f9fafb',
                        color: themeMode === 'dark' ? '#f9fafb' : '#374151',
                        border: `1px solid ${themeMode === 'dark' ? '#4b5563' : '#d1d5db'}`,
                    },
                }}
            />
            
            <AuthModal
                isOpen={isAuthModalOpen}
                onClose={() => setIsAuthModalOpen(false)}
                initialView={authModalView}
                onAuthSuccess={() => {
                    setIsAuthModalOpen(false);
                    // If user was trying to access schedule, navigate them there
                    if (window.location.pathname === '/' && window.history.state?.from?.pathname === '/schedule') {
                        navigate('/schedule');
                    }
                }}
            />
            
            <Header
                onLoginClick={openLoginModal}
                onSignUpClick={openSignUpModal}
                onLogout={handleLogout}
                onViewOwnProfile={handleViewOwnProfile}
                themeMode={themeMode}
                toggleThemeMode={toggleThemeMode}
            />
            
            <ErrorBoundary>
                <main className="flex-grow relative">
                    <Routes>
                        {/* Public Routes */}
                        <Route path="/" element={<HomePage onSignUpClick={openSignUpModal} />} />
                        <Route path="/howtoplay" element={<HowToPlayPage />} />
                        <Route path="/scores" element={<ScoresPage theme={themeMode} />} />

                        {/* Protected Routes - Schedule now requires authentication */}
                        <Route path="/schedule" element={<ProtectedRoute showAuthPrompt={true}><SchedulePage /></ProtectedRoute>} />
                        <Route path="/dashboard" element={<ProtectedRoute><DashboardPage /></ProtectedRoute>} />
                        <Route path="/settings" element={<ProtectedRoute><UserSettingsPage /></ProtectedRoute>} />
                        <Route path="/stats" element={<ProtectedRoute><StatsPage /></ProtectedRoute>} />
                        <Route path="/leaderboard" element={<ProtectedRoute><LeaderboardPage /></ProtectedRoute>} />
                        <Route path="/leagues" element={<ProtectedRoute><LeaguePage /></ProtectedRoute>} />
                        <Route path="/leagues/:leagueId" element={<ProtectedRoute><LeagueDetailRouteHandler /></ProtectedRoute>} />
                        <Route path="/profile/:username" element={<ProtectedRoute><ProfileRouteHandler /></ProtectedRoute>} />

                        {/* Admin Routes */}
                        <Route path="/admin" element={<ProtectedRoute><AdminPage /></ProtectedRoute>} />

                        {/* Catch-all route */}
                        <Route path="*" element={
                            <div className="min-h-screen flex items-center justify-center">
                                <div className="text-center">
                                    <h1 className="text-4xl font-bold text-text-primary dark:text-text-primary-dark mb-4">404</h1>
                                    <p className="text-text-secondary dark:text-text-secondary-dark mb-6">Page not found</p>
                                    <button
                                        onClick={() => navigate('/')}
                                        className="bg-primary dark:bg-primary-dark text-white font-bold py-2 px-4 rounded-theme hover:bg-primary-dark dark:hover:bg-primary transition-colors"
                                    >
                                        Go Home
                                    </button>
                                </div>
                            </div>
                        } />
                    </Routes>
                </main>
            </ErrorBoundary>
            
            <Footer />
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