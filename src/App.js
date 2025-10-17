import React, { useState, useEffect } from 'react';
import { signOut } from 'firebase/auth';
import { auth } from './firebase';
import { AuthProvider, useAuth } from './context/AuthContext';
import { Toaster } from 'react-hot-toast';

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
    const { user, loggedInProfile, isLoadingAuth } = useAuth();
    const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
    const [authModalView, setAuthModalView] = useState('login');
    const [page, setPage] = useState('home');
    const [pageProps, setPageProps] = useState({});
    const [themeMode, setThemeMode] = useState(localStorage.getItem('theme') || 'dark');
    
    // If user is logged in but has no profile, force them to the signup modal
    // This handles the edge case where a user was created without going through the signup flow
    useEffect(() => {
        if (!isLoadingAuth && user && !loggedInProfile) {
            console.warn('User exists but profile is missing. Opening signup modal to create profile.');
            setAuthModalView('signup');
            setIsAuthModalOpen(true);
        }
    }, [user, loggedInProfile, isLoadingAuth]);
    
    useEffect(() => {
        if (!isLoadingAuth && !user) {
            setPage('home');
        }
    }, [user, isLoadingAuth]);

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

    const handleSetPage = (newPage, props = {}) => {
        setPage(newPage);
        setPageProps(props);
    };

    const renderPage = () => {
        // If user exists but no profile, show a loading/waiting state
        if (user && !loggedInProfile) {
            return (
                <div className="flex items-center justify-center min-h-screen">
                    <div className="text-center p-8">
                        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary dark:border-primary-dark mx-auto mb-4"></div>
                        <h2 className="text-2xl font-bold text-text-primary dark:text-text-primary-dark mb-2">
                            Setting up your profile...
                        </h2>
                        <p className="text-text-secondary dark:text-text-secondary-dark">
                            Please complete the signup form to continue.
                        </p>
                    </div>
                </div>
            );
        }

        switch (page) {
            case 'dashboard': return <DashboardPage profile={loggedInProfile} userId={user?.uid} />;
            case 'profile': return <ProfilePage loggedInProfile={loggedInProfile} loggedInUserId={user?.uid} viewingUserId={pageProps.userId} />;
            case 'admin': return loggedInProfile?.isAdmin ? <AdminPage /> : <HomePage onSignUpClick={() => { setAuthModalView('signup'); setIsAuthModalOpen(true); }} />;
            case 'leagues': return <LeaguePage profile={loggedInProfile} setPage={handleSetPage} onViewLeague={(id) => handleSetPage('leagueDetail', { leagueId: id })} />;
            case 'leagueDetail': return <LeagueDetailPage profile={loggedInProfile} leagueId={pageProps.leagueId} setPage={handleSetPage} onViewProfile={(id) => handleSetPage('profile', { userId: id })} />;
            case 'leaderboard': return <LeaderboardPage profile={loggedInProfile} onViewProfile={(id) => handleSetPage('profile', { userId: id })} />;
            case 'schedule': return <SchedulePage setPage={handleSetPage} />;
            case 'scores': return <ScoresPage theme={themeMode} />;
            case 'stats': return <StatsPage />;
            case 'howtoplay': return <HowToPlayPage />;
            case 'home':
            default:
                return <HomePage onSignUpClick={() => { setAuthModalView('signup'); setIsAuthModalOpen(true); }} />;
        }
    };

    if (isLoadingAuth) {
        return <div className="bg-background dark:bg-background-dark min-h-screen flex items-center justify-center text-primary dark:text-primary-dark">Loading...</div>;
    }

    return (
        <div className="flex flex-col min-h-screen bg-background dark:bg-background-dark">
            <Toaster position="bottom-center" toastOptions={{ style: { background: '#333', color: '#fff' } }} />
            <AuthModal
                isOpen={isAuthModalOpen}
                onClose={() => {
                    // Don't allow closing if user exists but has no profile
                    if (user && !loggedInProfile) {
                        return;
                    }
                    setIsAuthModalOpen(false);
                }}
                initialView={authModalView}
                onAuthSuccess={() => {
                    setIsAuthModalOpen(false);
                    setPage('dashboard');
                }}
            />
            <Header
                user={user}
                isLoggedIn={!!user && !!loggedInProfile}
                isAdmin={loggedInProfile?.isAdmin}
                onLoginClick={() => { setAuthModalView('login'); setIsAuthModalOpen(true); }}
                onSignUpClick={() => { setAuthModalView('signup'); setIsAuthModalOpen(true); }}
                onLogout={handleLogout}
                setPage={handleSetPage}
                onViewOwnProfile={() => handleSetPage('profile', { userId: user.uid })}
                onViewLeague={(id) => handleSetPage('leagueDetail', { leagueId: id })}
                profile={loggedInProfile}
                themeMode={themeMode}
                toggleThemeMode={() => setThemeMode(themeMode === 'light' ? 'dark' : 'light')}
            />
            <main className="flex-grow relative">
                {renderPage()}
            </main>
            <Footer setPage={handleSetPage} />
        </div>
    );
}

function App() {
    return (
        <AuthProvider>
            <AppContent />
        </AuthProvider>
    );
}

export default App;