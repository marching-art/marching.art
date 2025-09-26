// src/App.js - Updated with debug component for profile troubleshooting
import React, { useState, useEffect } from 'react';
import { signOut } from 'firebase/auth';
import { auth } from './firebase';
import { useUserStore } from './store/userStore';
import { Toaster } from 'react-hot-toast';

import Header from './components/layout/Header';
import Footer from './components/layout/Footer';
import ConnectionStatus from './components/ui/ConnectionStatus';
import ErrorBoundary from './components/ui/ErrorBoundary';
import DebugAuth from './components/debug/DebugAuth';
import ProfileDebugInfo from './components/debug/ProfileDebugInfo';
import ProfileDataTest from './components/debug/ProfileDataTest';
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

function App() {
    // Use userStore directly instead of context
    const { user, loggedInProfile, isLoadingAuth, initAuthListener } = useUserStore();
    
    const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
    const [authModalView, setAuthModalView] = useState('login');
    const [page, setPage] = useState('home');
    const [pageProps, setPageProps] = useState({});
    const [themeMode, setThemeMode] = useState(localStorage.getItem('theme') || 'dark');
    
    // Initialize auth listener
    useEffect(() => {
        console.log('App: Initializing auth listener');
        const unsubscribe = initAuthListener();
        return unsubscribe;
    }, [initAuthListener]);
    
    // Theme management
    useEffect(() => {
        const root = window.document.documentElement;
        root.classList.remove('light', 'dark');
        root.classList.add(themeMode);
        localStorage.setItem('theme', themeMode);
    }, [themeMode]);

    const handleLogout = async () => {
        try {
            await signOut(auth);
            setPage('home');
        } catch (error) {
            console.error('Logout error:', error);
        }
    };

    const navigate = (newPage, props = {}) => {
        console.log('Navigating to:', newPage);
        
        // Handle profile navigation with user ID
        if (typeof newPage === 'string' && newPage.startsWith('/profile/')) {
            const userId = newPage.replace('/profile/', '');
            setPage('profile');
            setPageProps({ viewingUserId: userId });
            return;
        }
        
        // Handle league detail navigation
        if (typeof newPage === 'string' && newPage.startsWith('/league/')) {
            const leagueId = newPage.replace('/league/', '');
            setPage('league-detail');
            setPageProps({ leagueId });
            return;
        }
        
        // Remove leading slash if present
        const cleanPage = typeof newPage === 'string' ? newPage.replace(/^\//, '') : newPage;
        setPage(cleanPage);
        setPageProps(props);
    };

    const renderCurrentPage = () => {
        const commonProps = {
            navigate,
            user,
            loggedInProfile,
            loggedInUserId: user?.uid,
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
        <ErrorBoundary>
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
                <DebugAuth />
                <ProfileDebugInfo />
                <ProfileDataTest />
                <Toaster position="bottom-right" />
            </div>
        </ErrorBoundary>
    );
}

export default App;