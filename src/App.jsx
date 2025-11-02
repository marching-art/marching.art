import React, { useState, useEffect, lazy, Suspense } from 'react';
import { signOut } from 'firebase/auth';
import { auth } from './firebase';
import { AuthProvider, useAuth } from './context/AuthContext';
import { Toaster } from 'react-hot-toast';

import ModernSidebar from './components/modern/ModernSidebar';
import AuthModal from './components/auth/AuthModal';
import ProfileCompletionModal from './components/profile/ProfileCompletionModal';
import ErrorBoundary from './components/ErrorBoundary';

// Import design system
import './styles/modern-design-system.css';

// Eager load critical pages
import ModernDashboard from './pages/ModernDashboard';

// Lazy load other pages (will be modernized progressively)
const ProfilePage = lazy(() => import('./pages/ProfilePage'));
const AdminPage = lazy(() => import('./pages/AdminPage'));
const LeaguePage = lazy(() => import('./pages/LeaguePage'));
const LeagueDetailPage = lazy(() => import('./pages/LeagueDetailPage'));
const LeaderboardPage = lazy(() => import('./pages/LeaderboardPage'));
const SchedulePage = lazy(() => import('./pages/SchedulePage'));
const ScoresPage = lazy(() => import('./pages/ScoresPage'));
const HowToPlayPage = lazy(() => import('./pages/HowToPlayPage'));

const LoadingScreen = () => (
    <div className="flex items-center justify-center h-screen bg-slate-950">
        <div className="text-center">
            <div className="text-6xl mb-4 animate-pulse">🎺</div>
            <p className="text-lg font-semibold text-gradient">Loading...</p>
        </div>
    </div>
);

function AppContent() {
    const { user, loggedInProfile, isLoadingAuth, needsProfileCompletion } = useAuth();
    const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
    const [authModalView, setAuthModalView] = useState('login');
    const [page, setPage] = useState('dashboard');
    const [pageProps, setPageProps] = useState({});
    const [themeMode] = useState('dark'); // Always dark mode for now

    useEffect(() => {
        // Redirect to dashboard if not logged in and trying to access protected page
        const protectedPages = ['dashboard', 'profile', 'leagues', 'leaderboard', 'admin'];
        if (!isLoadingAuth && !user && protectedPages.includes(page)) {
            setPage('scores');
        }
    }, [user, isLoadingAuth, page]);

    const handleLogout = async () => {
        try {
            await signOut(auth);
            setPage('scores');
        } catch (error) {
            console.error("Error signing out:", error);
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
                return <ModernDashboard {...commonProps} />;
            
            case 'profile':
                return (
                    <Suspense fallback={<LoadingScreen />}>
                        <ProfilePage 
                            loggedInProfile={loggedInProfile}
                            loggedInUserId={user?.uid}
                            viewingUserId={pageProps.userId}
                        />
                    </Suspense>
                );
            
            case 'admin':
                return loggedInProfile?.isAdmin ? (
                    <Suspense fallback={<LoadingScreen />}>
                        <AdminPage />
                    </Suspense>
                ) : (
                    <div className="app-main">
                        <div className="card-floating text-center py-12">
                            <h2 className="text-2xl font-bold mb-2">Access Denied</h2>
                            <p className="opacity-60">You don't have permission to access this page.</p>
                        </div>
                    </div>
                );
            
            case 'leagues':
                return (
                    <Suspense fallback={<LoadingScreen />}>
                        <LeaguePage 
                            {...commonProps}
                            onViewLeague={(leagueId) => handleSetPage('leagueDetail', { leagueId })}
                        />
                    </Suspense>
                );
            
            case 'leagueDetail':
                return (
                    <Suspense fallback={<LoadingScreen />}>
                        <LeagueDetailPage
                            {...commonProps}
                            leagueId={pageProps.leagueId}
                        />
                    </Suspense>
                );
            
            case 'leaderboard':
                return (
                    <Suspense fallback={<LoadingScreen />}>
                        <LeaderboardPage {...commonProps} />
                    </Suspense>
                );
            
            case 'schedule':
                return (
                    <Suspense fallback={<LoadingScreen />}>
                        <SchedulePage setPage={handleSetPage} />
                    </Suspense>
                );
            
            case 'scores':
                return (
                    <Suspense fallback={<LoadingScreen />}>
                        <ScoresPage theme={themeMode} />
                    </Suspense>
                );
            
            case 'howtoplay':
                return (
                    <Suspense fallback={<LoadingScreen />}>
                        <HowToPlayPage setPage={handleSetPage} />
                    </Suspense>
                );
            
            default:
                return <ModernDashboard {...commonProps} />;
        }
    };

    return (
        <div className="app-layout">
            <Toaster 
                position="top-center"
                toastOptions={{
                    duration: 3000,
                    style: {
                        background: '#1e293b',
                        color: '#f8fafc',
                        border: '1px solid #334155',
                        borderRadius: '0.75rem',
                        padding: '1rem',
                        boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1)',
                    },
                }}
            />
            
            <ModernSidebar
                currentPage={page}
                onNavigate={handleSetPage}
                user={user}
                profile={loggedInProfile}
                onLogout={handleLogout}
                onLogin={() => {
                    setAuthModalView('login');
                    setIsAuthModalOpen(true);
                }}
            />

            <main className="flex-1 overflow-hidden">
                <ErrorBoundary>
                    {isLoadingAuth ? (
                        <LoadingScreen />
                    ) : (
                        renderPage()
                    )}
                </ErrorBoundary>
            </main>

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
            
            {/* Mobile nav padding */}
            <div className="md:hidden h-20"></div>
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
