// src/App.js - Fixed authentication logic and profile routing
import React, { useState, useEffect } from 'react';
import { signOut } from 'firebase/auth';
import { auth } from './firebase';
import { AuthProvider, useAuth } from './context/AuthContext';
import { Toaster } from 'react-hot-toast';
import ErrorBoundary from './components/ui/ErrorBoundary';

import Header from './components/layout/Header';
import Footer from './components/layout/Footer';
import ConnectionStatus from './components/ui/ConnectionStatus';
import HomePage from './pages/HomePage';
import DashboardPage from './pages/DashboardPage';
import ProfilePage from './pages/ProfilePage';
import SettingsPage from './pages/SettingsPage';
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
    const { user, loggedInProfile, isLoadingAuth } = useAuth();
    const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
    const [authModalView, setAuthModalView] = useState('login');
    const [page, setPage] = useState('home');
    const [pageProps, setPageProps] = useState({});
    const [themeMode, setThemeMode] = useState(localStorage.getItem('theme') || 'dark');
    
    useEffect(() => {
        if (!isLoadingAuth && !user) {
            // Only redirect to home if we're on a protected page
            if (['dashboard', 'settings', 'leagues', 'leaderboard'].includes(page)) {
                setPage('home');
            }
        }
    }, [user, isLoadingAuth, page]);

    useEffect(() => {
        if (themeMode === 'dark') {
            document.documentElement.classList.add('dark');
        } else {
            document.documentElement.classList.remove('dark');
        }
        localStorage.setItem('theme', themeMode);
    }, [themeMode]);

    const handleLogout = async () => {
        try {
            await signOut(auth);
            setPage('home');
        } catch (error) {
            console.error("Error signing out:", error);
        }
    };

    const navigate = (newPage, props = {}) => {
        // Handle league detail navigation with proper routing
        if (newPage.startsWith('/league/')) {
            const leagueId = newPage.replace('/league/', '');
            setPage('league-detail');
            setPageProps({ leagueId });
        } else if (newPage.startsWith('/profile/')) {
            const userId = newPage.replace('/profile/', '');
            setPage('profile');
            setPageProps({ userId });
        } else {
            // Convert route to page name and handle direct page names
            let pageName = newPage;
            if (newPage.startsWith('/')) {
                pageName = newPage.replace('/', '') || 'home';
            }
            setPage(pageName);
            setPageProps(props);
        }
    };

    const renderCurrentPage = () => {
        const commonProps = {
            navigate,
            user,
            loggedInProfile,
            isLoadingAuth
        };

        switch (page) {
            case 'home':
                return <HomePage {...commonProps} />;
            case 'dashboard':
                return <DashboardPage {...commonProps} />;
            case 'profile':
                return <ProfilePage {...commonProps} {...pageProps} />;
            case 'settings':
                return <SettingsPage {...commonProps} />;
            case 'admin':
                return <AdminPage {...commonProps} />;
            case 'leagues':
                return <LeaguePage {...commonProps} />;
            case 'league-detail':
                return <LeagueDetailPage {...commonProps} {...pageProps} />;
            case 'leaderboard':
                return <LeaderboardPage {...commonProps} />;
            case 'schedule':
                return <SchedulePage {...commonProps} />;
            case 'scores':
                return <ScoresPage {...commonProps} />;
            case 'stats':
                return <StatsPage {...commonProps} />;
            case 'how-to-play':
                return <HowToPlayPage {...commonProps} />;
            default:
                return <HomePage {...commonProps} />;
        }
    };

    return (
        <div className={`min-h-screen flex flex-col bg-background dark:bg-background-dark text-text-primary dark:text-text-primary-dark transition-colors duration-200`}>
            <Header
                user={user}
                profile={loggedInProfile}
                isLoggedIn={!!user}
                isAdmin={loggedInProfile?.isAdmin || false}
                onLoginClick={() => {
                    setAuthModalView('login');
                    setIsAuthModalOpen(true);
                }}
                onSignUpClick={() => {
                    setAuthModalView('signup');
                    setIsAuthModalOpen(true);
                }}
                onLogout={handleLogout}
                setPage={navigate}
                onViewOwnProfile={() => navigate(`/profile/${user?.uid}`)}
                onViewLeague={(leagueId) => navigate(`/league/${leagueId}`)}
                themeMode={themeMode}
                toggleThemeMode={() => setThemeMode(prev => prev === 'dark' ? 'light' : 'dark')}
                currentPage={page}
            />
            
            <main className="flex-1">
                {renderCurrentPage()}
            </main>
            
            <Footer />
            
            <AuthModal
                isOpen={isAuthModalOpen}
                onClose={() => setIsAuthModalOpen(false)}
                initialView={authModalView}
                onNavigateToProfile={() => {
                    setIsAuthModalOpen(false);
                    navigate('/profile');
                }}
            />
            
            <ConnectionStatus />
            <Toaster position="bottom-right" />
        </div>
    );
}

function App() {
    return (
        <ErrorBoundary>
            <AuthProvider>
                <AppContent />
            </AuthProvider>
        </ErrorBoundary>
    );
}

export default App;