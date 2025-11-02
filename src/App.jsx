import React, { useState, useEffect, lazy, Suspense } from 'react';
import { signOut } from 'firebase/auth';
import { auth, trace, logEvent } from './firebase';
import { AuthProvider, useAuth } from './context/AuthContext';
import { Toaster } from 'react-hot-toast';

import Header from './components/layout/Header';
import Footer from './components/layout/Footer';
import AuthModal from './components/auth/AuthModal';
import ProfileCompletionModal from './components/profile/ProfileCompletionModal';
import ErrorBoundary from './components/ErrorBoundary';
import LoadingSpinner from './components/ui/LoadingSpinner';

// Import viewport CSS
import './styles/viewport.css';

// Eager load critical pages
import HomePage from './pages/HomePage';
import DashboardPage from './pages/DashboardPage';

// Lazy load non-critical pages
const ProfilePage = lazy(() => import('./pages/ProfilePage'));
const AdminPage = lazy(() => import('./pages/AdminPage'));
const LeaguePage = lazy(() => import('./pages/LeaguePage'));
const LeagueDetailPage = lazy(() => import('./pages/LeagueDetailPage'));
const LeaderboardPage = lazy(() => import('./pages/LeaderboardPage'));
const SchedulePage = lazy(() => import('./pages/SchedulePage'));
const ScoresPage = lazy(() => import('./pages/ScoresPage'));
const StatsPage = lazy(() => import('./pages/StatsPage'));
const HowToPlayPage = lazy(() => import('./pages/HowToPlayPage'));

function AppContent() {
    const { user, loggedInProfile, isLoadingAuth, needsProfileCompletion } = useAuth();
    const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
    const [authModalView, setAuthModalView] = useState('login');
    const [page, setPage] = useState('home');
    const [pageProps, setPageProps] = useState({});
    const [themeMode, setThemeMode] = useState(() => {
        return localStorage.getItem('theme') || 'dark';
    });
    
    useEffect(() => {
        if (!isLoadingAuth && !user && page !== 'home' && page !== 'howtoplay' && page !== 'schedule' && page !== 'scores' && page !== 'stats') {
            setPage('home');
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

    useEffect(() => {
        if (process.env.NODE_ENV === 'production') {
            logEvent('page_view', { page_name: page });
        }
    }, [page]);

    const handleLogout = async () => {
        const logoutTrace = trace('user_logout');
        logoutTrace.start();
        
        try {
            await signOut(auth);
            setPage('home');
            logEvent('logout');
        } catch (error) {
            console.error("Error signing out:", error);
        } finally {
            logoutTrace.stop();
        }
    };

    const handleSetPage = (newPage, props = {}) => {
        setPage(newPage);
        setPageProps(props);
    };

    const handleProfileComplete = () => {
        window.location.reload();
    };

    const renderPage = () => {
        const commonProps = {
            profile: loggedInProfile,
            userId: user?.uid,
            setPage: handleSetPage,
            onViewProfile: (userId) => handleSetPage('profile', { userId })
        };

        switch (page) {
            case 'dashboard':
                return <DashboardPage {...commonProps} />;
            
            case 'profile':
                return (
                    <Suspense fallback={<div className="flex items-center justify-center h-full"><LoadingSpinner /></div>}>
                        <ProfilePage 
                            loggedInProfile={loggedInProfile}
                            loggedInUserId={user?.uid}
                            viewingUserId={pageProps.userId}
                        />
                    </Suspense>
                );
            
            case 'admin':
                return loggedInProfile?.isAdmin ? (
                    <Suspense fallback={<div className="flex items-center justify-center h-full"><LoadingSpinner /></div>}>
                        <AdminPage />
                    </Suspense>
                ) : (
                    <div className="h-full overflow-y-auto custom-scrollbar">
                        <HomePage setPage={handleSetPage} />
                    </div>
                );
            
            case 'leagues':
                return (
                    <Suspense fallback={<div className="flex items-center justify-center h-full"><LoadingSpinner /></div>}>
                        <LeaguePage 
                            {...commonProps}
                            onViewLeague={(leagueId) => handleSetPage('leagueDetail', { leagueId })}
                        />
                    </Suspense>
                );
            
            case 'leagueDetail':
                return (
                    <Suspense fallback={<div className="flex items-center justify-center h-full"><LoadingSpinner /></div>}>
                        <LeagueDetailPage
                            {...commonProps}
                            leagueId={pageProps.leagueId}
                        />
                    </Suspense>
                );
            
            case 'leaderboard':
                return (
                    <Suspense fallback={<div className="flex items-center justify-center h-full"><LoadingSpinner /></div>}>
                        <LeaderboardPage {...commonProps} />
                    </Suspense>
                );
            
            case 'schedule':
                return (
                    <Suspense fallback={<div className="flex items-center justify-center h-full"><LoadingSpinner /></div>}>
                        <SchedulePage setPage={handleSetPage} />
                    </Suspense>
                );
            
            case 'scores':
                return (
                    <Suspense fallback={<div className="flex items-center justify-center h-full"><LoadingSpinner /></div>}>
                        <ScoresPage theme={themeMode} />
                    </Suspense>
                );
            
            case 'stats':
                return (
                    <Suspense fallback={<div className="flex items-center justify-center h-full"><LoadingSpinner /></div>}>
                        <StatsPage />
                    </Suspense>
                );
            
            case 'howtoplay':
                return (
                    <Suspense fallback={<div className="flex items-center justify-center h-full"><LoadingSpinner /></div>}>
                        <HowToPlayPage setPage={handleSetPage} />
                    </Suspense>
                );
            
            default:
                return (
                    <div className="h-full overflow-y-auto custom-scrollbar">
                        <HomePage setPage={handleSetPage} />
                    </div>
                );
        }
    };

    return (
        <div className="app-container bg-background dark:bg-background-dark text-text-primary dark:text-text-primary-dark">
            <Toaster 
                position="top-center"
                toastOptions={{
                    duration: 3000,
                    style: {
                        background: themeMode === 'dark' ? '#1f2937' : '#ffffff',
                        color: themeMode === 'dark' ? '#f3f4f6' : '#111827',
                    },
                }}
            />
            
            <Header
                user={user}
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
                setPage={handleSetPage}
                onViewOwnProfile={() => handleSetPage('profile', { userId: user?.uid })}
                profile={loggedInProfile}
                themeMode={themeMode}
                toggleThemeMode={() => setThemeMode(prev => prev === 'dark' ? 'light' : 'dark')}
            />

            <main className="flex-1 overflow-hidden">
                <ErrorBoundary>
                    {isLoadingAuth ? (
                        <div className="flex items-center justify-center h-full">
                            <LoadingSpinner />
                        </div>
                    ) : (
                        renderPage()
                    )}
                </ErrorBoundary>
            </main>

            {page === 'home' && <Footer />}

            <AuthModal
                isOpen={isAuthModalOpen}
                onClose={() => setIsAuthModalOpen(false)}
                initialView={authModalView}
            />

            {needsProfileCompletion && user && (
                <ProfileCompletionModal
                    isOpen={needsProfileCompletion}
                    onComplete={handleProfileComplete}
                    userId={user.uid}
                />
            )}
        </div>
    );
}

export default function App() {
    return (
        <ErrorBoundary>
            <AuthProvider>
                <AppContent />
            </AuthProvider>
        </ErrorBoundary>
    );
}
