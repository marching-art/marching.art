import React, { useState, useEffect } from 'react';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { doc, onSnapshot, setDoc } from 'firebase/firestore';
import { auth, db, appId } from './firebase';

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
import { ensureProfileCompatibility } from './utils/profileCompatibility';

function App() {
    const [user, setUser] = useState(null);
    const [loggedInProfile, setLoggedInProfile] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
    const [authModalView, setAuthModalView] = useState('login');
    const [page, setPage] = useState('home');
    const [pageProps, setPageProps] = useState({});
    const [themeMode, setThemeMode] = useState(localStorage.getItem('theme') || 'dark');

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
            setIsLoading(true);
            if (currentUser) {
                setUser(currentUser);

                // *** NEW LOGIC TO INCLUDE ADMIN ROLE ***
                // When a user logs in, get their ID token to check for custom claims.
                const idTokenResult = await currentUser.getIdTokenResult();
                const isAdmin = idTokenResult.claims.admin === true;

                const userDocRef = doc(db, 'artifacts', appId, 'users', currentUser.uid, 'profile', 'data');
                
                // Set lastActive status on login
                await setDoc(userDocRef, { lastActive: new Date() }, { merge: true });

                const unsubProfile = onSnapshot(userDocRef, (docSnap) => {
                    if (docSnap.exists()) {
                        const profileData = ensureProfileCompatibility(docSnap.data());
                        // Merge Firestore profile data with the admin status from the token
                        setLoggedInProfile({ 
                            userId: currentUser.uid, 
                            ...profileData, 
                            isAdmin: isAdmin // Add the isAdmin flag here
                        });
                    } else {
                        setLoggedInProfile(null);
                    }
                });
                
                setIsLoading(false);
                return () => unsubProfile();

            } else {
                setUser(null);
                setLoggedInProfile(null);
                setIsLoading(false);
                setPage('home');
            }
        });
        return () => unsubscribe();
    }, []);

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
            setUser(null);
            setLoggedInProfile(null);
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

    if (isLoading) {
        return <div className="bg-background dark:bg-background-dark min-h-screen flex items-center justify-center text-primary dark:text-primary-dark">Loading...</div>;
    }

    return (
        <div className="flex flex-col min-h-screen bg-background dark:bg-background-dark">
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
            <main className="flex-grow">
                {renderPage()}
            </main>
            <Footer setPage={handleSetPage} />
        </div>
    );
}

export default App;