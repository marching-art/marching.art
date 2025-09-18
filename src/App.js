import React, { useState, useEffect } from 'react';
import { signOut } from 'firebase/auth';
import { auth } from './firebase';
import { AuthProvider, useAuth } from './context/AuthContext';
import { Toaster } from 'react-hot-toast';
import { useUserStore } from './store/userStore';

function AppContent() {
    const { user, isLoadingAuth } = useAuth();
    // You can also get the profile directly here if needed,
    // but the real benefit is in child components.
    const { loggedInProfile } = useUserStore(); 

    const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
    const [authModalView, setAuthModalView] = useState('login');
    const [page, setPage] = useState('home');
    const [pageProps, setPageProps] = useState({});
    const [themeMode, setThemeMode] = useState(localStorage.getItem('theme') || 'dark');
    
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
        // MODIFIED: No need to pass props like `profile` or `loggedInProfile`
        switch (page) {
            case 'dashboard': return <DashboardPage />;
            case 'profile': return <ProfilePage viewingUserId={pageProps.userId} />;
            case 'admin': return loggedInProfile?.isAdmin ? <AdminPage /> : <HomePage onSignUpClick={() => { /*...*/ }} />;
            case 'leagues': return <LeaguePage setPage={handleSetPage} onViewLeague={(id) => handleSetPage('leagueDetail', { leagueId: id })} />;
            case 'leagueDetail': return <LeagueDetailPage leagueId={pageProps.leagueId} setPage={handleSetPage} onViewProfile={(id) => handleSetPage('profile', { userId: id })} />;
            case 'leaderboard': return <LeaderboardPage onViewProfile={(id) => handleSetPage('profile', { userId: id })} />;
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
                onClose={() => setIsAuthModalOpen(false)}
                initialView={authModalView}
                onAuthSuccess={() => {
                    setIsAuthModalOpen(false);
                    setPage('dashboard');
                }}
            />
            <Header
                onLoginClick={() => { setAuthModalView('login'); setIsAuthModalOpen(true); }}
                onSignUpClick={() => { setAuthModalView('signup'); setIsAuthModalOpen(true); }}
                onLogout={handleLogout}
                setPage={handleSetPage}
                onViewOwnProfile={() => handleSetPage('profile', { userId: user.uid })}
                onViewLeague={(id) => handleSetPage('leagueDetail', { leagueId: id })}
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