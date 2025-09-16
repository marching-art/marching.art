import React, { useState, useEffect } from 'react';
import { onAuthStateChanged, signOut, getIdTokenResult } from 'firebase/auth';
import { doc, onSnapshot } from 'firebase/firestore';
import { auth, db, appId } from './firebase';

// Import Page Components
import HomePage from './components/pages/HomePage';
import DashboardPage from './components/pages/DashboardPage';
import ProfilePage from './components/pages/ProfilePage';
import AdminPage from './components/pages/AdminPage';
import SchedulePage from './components/pages/SchedulePage';
import ScoresPage from './components/pages/ScoresPage';

// Import Layout & UI Components
import Header from './components/layout/Header';
import Footer from './components/layout/Footer';
import Modal from './components/ui/Modal';
import LoginForm from './components/auth/LoginForm';
import SignUpForm from './components/auth/SignUpForm';

export default function App() {
    const [user, setUser] = useState(null);
    const [profile, setProfile] = useState(null);
    const [isAdmin, setIsAdmin] = useState(false);
    const [loading, setLoading] = useState(true);
    const [page, setPage] = useState('home');
    const [isLoginModalOpen, setLoginModalOpen] = useState(false);
    const [isSignUpModalOpen, setSignUpModalOpen] = useState(false);

    const [theme, setTheme] = useState({
        style: localStorage.getItem('themeStyle') || 'brutalist',
        mode: localStorage.getItem('themeMode') || 'dark',
    });

    useEffect(() => {
        const root = document.documentElement;
        root.classList.remove('theme-brand', 'theme-brutalist', 'dark', 'light');
        root.classList.add(`theme-${theme.style}`);
        root.classList.add(theme.mode);
        localStorage.setItem('themeStyle', theme.style);
        localStorage.setItem('themeMode', theme.mode);
    }, [theme]);

    const toggleThemeMode = () => {
        setTheme(prevTheme => ({
            ...prevTheme,
            mode: prevTheme.mode === 'light' ? 'dark' : 'light',
        }));
    };
    
    const switchThemeStyle = (newStyle) => {
        setTheme(prevTheme => ({
            ...prevTheme,
            style: newStyle,
        }));
    };

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
            setUser(currentUser);
            if (currentUser) {
                const tokenResult = await getIdTokenResult(currentUser);
                setIsAdmin(!!tokenResult.claims.admin);
            } else {
                setIsAdmin(false);
            }
            setLoading(false);
        });
        return () => unsubscribe();
    }, []);

    useEffect(() => {
        let unsubscribe;
        if (user && !user.isAnonymous) {
            const userDocRef = doc(db, 'artifacts', appId, 'users', user.uid, 'profile', 'data');
            unsubscribe = onSnapshot(userDocRef, (doc) => {
                setProfile(doc.exists() ? { userId: user.uid, ...doc.data() } : null);
            }, (error) => {
                console.error("Error fetching profile:", error);
            });
        } else {
            setProfile(null);
        }
        return () => { if (unsubscribe) unsubscribe(); };
    }, [user]);

    useEffect(() => {
        if (user && !user.isAnonymous) {
            setPage('dashboard');
        } else {
            setPage('home');
        }
    }, [user]);

    const handleLogout = async () => {
        try {
            await signOut(auth);
            setPage('home');
        } catch (error) {
            console.error("Error signing out: ", error);
        }
    };

    const openLoginModal = () => setLoginModalOpen(true);
    const openSignUpModal = () => setSignUpModalOpen(true);
    const closeModal = () => {
        setLoginModalOpen(false);
        setSignUpModalOpen(false);
    };
    
    const isLoggedIn = user && !user.isAnonymous;

    const renderPage = () => {
        switch (page) {
            case 'schedule':
                return <SchedulePage setPage={setPage} />;
            case 'scores':
                return <ScoresPage theme={theme} />; 
            case 'dashboard': 
                return isLoggedIn ? <DashboardPage profile={profile} userId={user?.uid} /> : <HomePage onSignUpClick={openSignUpModal} />;
            case 'profile': 
                return isLoggedIn ? <ProfilePage profile={profile} userId={user?.uid} /> : <HomePage onSignUpClick={openSignUpModal} />;
            case 'admin':
                return isLoggedIn && isAdmin ? <AdminPage /> : <HomePage onSignUpClick={openSignUpModal} />;
            case 'home': 
            default: 
                return <HomePage onSignUpClick={openSignUpModal} />;
        }
    };

    if (loading) {
        return (
             <div className="bg-background dark:bg-background-dark min-h-screen flex items-center justify-center text-secondary-dark text-2xl font-sans">
                Loading System...
            </div>
        );
    }

    return (
        <div className="bg-background dark:bg-background-dark text-text-primary dark:text-text-primary-dark min-h-screen flex flex-col font-sans">
            <Header
                isLoggedIn={isLoggedIn}
                isAdmin={isAdmin}
                profile={profile}
                onLoginClick={openLoginModal}
                onSignUpClick={openSignUpModal}
                onLogout={handleLogout}
                setPage={setPage}
                themeMode={theme.mode}
                toggleThemeMode={toggleThemeMode}
                switchThemeStyle={switchThemeStyle} 
                currentThemeStyle={theme.style}
            />
            <main className="flex-grow w-full">
                {renderPage()}
            </main>
            <Footer />
            <Modal isOpen={isLoginModalOpen} onClose={closeModal} title="LOGIN">
                <LoginForm onLoginSuccess={closeModal} switchToSignUp={openSignUpModal} />
            </Modal>
            <Modal isOpen={isSignUpModalOpen} onClose={closeModal} title="CREATE ACCOUNT">
                <SignUpForm onSignUpSuccess={closeModal} switchToLogin={openLoginModal} />
            </Modal>
        </div>
    );
}