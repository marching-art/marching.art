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
        // Initialize theme from localStorage
        return localStorage.getItem('theme') || 'dark';
    });
    
    useEffect(() => {
        // Redirect to home if not logged in
        if (!isLoadingAuth && !user && page !== 'home' && page !== 'howtoplay' && page !== 'schedule' && page !== 'scores' && page !== 'stats') {
            setPage('home');
        }
    }, [user, isLoadingAuth, page]);

    useEffect(() => {
        // Apply theme
        if (themeMode === 'dark') {
            document.documentElement.classList.add('dark');
        } else {
            document.documentElement.classList.remove('dark');
        }
        localStorage.setItem('theme', themeMode);
    }, [themeMode]);

    useEffect(() => {
        // Log page views in production
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
        
        // Scroll to top on page change
        window.scrollTo(0, 0);
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
                    <Suspense fallback={<LoadingSpinner />}>
                        <ProfilePage 
                            loggedInProfile={loggedInProfile}
                            loggedInUserId={user?.uid}
                            viewingUserId={pageProps.userId}
                        />
                    </Suspense>
                );
            
            case 'admin':
                return loggedInProfile?.isAdmin ? (
                    <Suspense fallback={<LoadingSpinner />}>
                        <AdminPage />
                    </Suspense>
                ) : <HomePage setPage={handleSetPage} />;
            
            case 'leagues':
                return (
                    <Suspense fallback={<LoadingSpinner />}>
                        <LeaguePage 
                            {...commonProps}
                            onViewLeague={(leagueId) => handleSetPage('leagueDetail', { leagueId })}
                        />
                    </Suspense>
                );
            
            case 'leagueDetail':
                return (
                    <Suspense fallback={<LoadingSpinner />}>
                        <LeagueDetailPage
                            {...commonProps}
                            leagueId={pageProps.leagueId}
                        />
                    </Suspense>
                );
            
            case 'leaderboard':
                return (
                    <Suspense fallback={<LoadingSpinner />}>
                        <LeaderboardPage {...commonProps} />
                    </Suspense>
                );
            
            case 'schedule':
                return (
                    <Suspense fallback={<LoadingSpinner />}>
                        <SchedulePage setPage={handleSetPage} />
                    </Suspense>
                );
            
            case 'scores':
                return (
                    <Suspense fallback={<LoadingSpinner />}>
                        <ScoresPage theme={themeMode} />
                    </Suspense>
                );
            
            case 'stats':
                return (
                    <Suspense fallback={<LoadingSpinner />}>
                        <StatsPage />
                    </Suspense>
                );
            
            case 'howtoplay':
                return (
                    <Suspense fallback={<LoadingSpinner />}>
                        <HowToPlayPage setPage={handleSetPage} />
                    </Suspense>
                );
            
            default:
                return <HomePage setPage={handleSetPage} />;
        }
    };

    return (
        <div className="flex flex-col min-h-screen bg-background dark:bg-background-dark text-text-primary dark:text-text-primary-dark">
            <Toaster 
                position="top-center"
                toastOptions={{
                    duration: 3000,
                    style: {
                        background: themeMode === 'dark' ? '#1f2937' : '#ffffff',
                        color: themeMode === 'dark' ? '#f9fafb' : '#111827',
                    },
                }}
            />
            
            <AuthModal 
                isOpen={isAuthModalOpen}
                onClose={() => setIsAuthModalOpen(false)}
                initialView={authModalView}
            />
            
            {needsProfileCompletion && (
                <ProfileCompletionModal 
                    userId={user.uid}
                    onComplete={handleProfileComplete}
                />
            )}
            
            <Header
                user={user}
                isLoggedIn={!!user}
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
                <ErrorBoundary>
                    {renderPage()}
                </ErrorBoundary>
            </main>
            
            <Footer setPage={handleSetPage} />
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