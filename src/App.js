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
    const [theme, setTheme] = useState('light');

    // --- Theme Management ---
    useEffect(() => {
        const savedTheme = localStorage.getItem('theme') || 'light';
        setTheme(savedTheme);
    }, []);

    useEffect(() => {
        if (theme === 'dark') {
            document.documentElement.classList.add('dark');
        } else {
            document.documentElement.classList.remove('dark');
        }
        localStorage.setItem('theme', theme);
    }, [theme]);

    const toggleTheme = () => {
        setTheme(prevTheme => (prevTheme === 'light' ? 'dark' : 'light'));
    };

    // --- Authentication & Profile Loading ---
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
                setProfile(doc.exists() ? doc.data() : null);
            }, (error) => {
                console.error("Error fetching profile:", error);
            });
        } else {
            setProfile(null);
        }
        return () => { if (unsubscribe) unsubscribe(); };
    }, [user]);

    // --- Page Navigation ---
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
            setProfile(null);
            setIsAdmin(false);
            setPage('home');
        } catch (error) {
            console.error("Error signing out: ", error);
        }
    };

    const openLoginModal = () => { setSignUpModalOpen(false); setLoginModalOpen(true); };
    const openSignUpModal = () => { setLoginModalOpen(false); setSignUpModalOpen(true); };
    const closeModal = () => { setLoginModalOpen(false); setSignUpModalOpen(false); };
    
    const isLoggedIn = user && !user.isAnonymous;

    const renderPage = () => {
        switch (page) {
            case 'schedule':
                return <SchedulePage />;
            case 'scores':
                return <ScoresPage theme={theme} />; // Pass theme prop here
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
            <div className="bg-white dark:bg-black min-h-screen flex items-center justify-center text-yellow-600 dark:text-yellow-400 text-2xl font-sans">
                Loading System...
            </div>
        );
    }

    return (
        <div className="bg-white dark:bg-black text-gray-800 dark:text-yellow-200 min-h-screen flex flex-col font-sans">
            <Header
                isLoggedIn={isLoggedIn}
                isAdmin={isAdmin}
                profile={profile}
                onLoginClick={openLoginModal}
                onSignUpClick={openSignUpModal}
                onLogout={handleLogout}
                setPage={setPage}
                theme={theme}
                toggleTheme={toggleTheme}
            />
            <main className="flex-grow container mx-auto px-4 py-8">
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
