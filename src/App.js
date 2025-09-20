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

    const handleLogout = async () => {
        try {
            await signOut(auth);
            navigate('/');
        } catch (error) {
            console.error("Error signing out:", error);
        }
    };

    const openLoginModal = () => {
        setAuthModalView('login');
        setIsAuthModalOpen(true);
    };

    const openSignUpModal = () => {
        setAuthModalView('signup');
        setIsAuthModalOpen(true);
    };

    const handleViewOwnProfile = () => {
        if (user?.uid) {
            navigate(`/profile/${user.uid}`);
        } else if (loggedInProfile?.userId) {
            navigate(`/profile/${loggedInProfile.userId}`);
        } else {
            console.error('No user ID available for profile navigation');
        }
    };

    if (isLoadingAuth && !user) { // Only show full page loader on initial load without a user
        return (
            <div className="bg-background dark:bg-background-dark min-h-screen flex items-center justify-center text-primary dark:text-primary-dark">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary dark:border-primary-dark"></div>
                    <p className="mt-4">Loading marching.art...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="flex flex-col min-h-screen bg-background dark:bg-background-dark">
            <Toaster position="bottom-center" toastOptions={{ style: { background: '#333', color: '#fff' } }} />
            
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
                        <Route path="/profile/:userId" element={<ProtectedRoute><ProfilePageWrapper /></ProtectedRoute>} />
                        <Route path="/admin" element={<ProtectedRoute><AdminPage /></ProtectedRoute>} />
                        <Route path="/leagues" element={<ProtectedRoute><LeaguePage /></ProtectedRoute>} />
                        <Route path="/league/:leagueId" element={<ProtectedRoute><LeagueDetailPageWrapper /></ProtectedRoute>} />
                        <Route path="/leaderboard" element={<ProtectedRoute><LeaderboardPage /></ProtectedRoute>} />
                        <Route path="/stats" element={<ProtectedRoute><StatsPage /></ProtectedRoute>} />
                    </Routes>
                </main>
            </ErrorBoundary>
            
            <Footer />
        </div>
    );
}

function App() {
    return (
        <Router>
            <AuthProvider>
                <AppContent />
            </AuthProvider>
        </Router>
    );
}

function ProfilePageWrapper() {
    const { userId } = useParams();
    return <ProfilePage viewingUserId={userId} />;
}

function LeagueDetailPageWrapper() {
    const { leagueId } = useParams();
    return <LeagueDetailPage leagueId={leagueId} />;
}

// Enhanced global error handling for better user experience
window.addEventListener('unhandledrejection', (event) => {
    console.error('Unhandled promise rejection:', event.reason);
    // Send to error tracking service
});

window.addEventListener('error', (event) => {
    console.error('Global error:', event.error);
    // Send to error tracking service
});

export default App;