import React, { useState, useEffect } from 'react'; 
import { signOut } from 'firebase/auth'; 
import { auth } from './firebase'; 
import { AuthProvider, useAuth } from './context/AuthContext'; 
import { Toaster } from 'react-hot-toast'; 
import { useUserStore } from './store/userStore';
import { BrowserRouter as Router, Routes, Route, useParams } from 'react-router-dom';

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
    const { user, isLoadingAuth } = useAuth();
    const { loggedInProfile } = useUserStore();

    const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
    const [authModalView, setAuthModalView] = useState('login');
    const [themeMode, setThemeMode] = useState(localStorage.getItem('theme') || 'dark');
    
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
        } catch (error) {
            console.error("Error signing out:", error);
        }
    };

    if (isLoadingAuth) {
        return (
            <div className="bg-background dark:bg-background-dark min-h-screen flex items-center justify-center text-primary dark:text-primary-dark">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary dark:border-primary-dark"></div>
                    <p className="mt-4">Loading marching.art...</p>
                </div>
            </div>
        );
    }

    return (
        <Router>
            <div className="flex flex-col min-h-screen bg-background dark:bg-background-dark">
                <Toaster position="bottom-center" toastOptions={{ style: { background: '#333', color: '#fff' } }} />
                <AuthModal
                    isOpen={isAuthModalOpen}
                    onClose={() => setIsAuthModalOpen(false)}
                    initialView={authModalView}
                    onAuthSuccess={() => {
                        setIsAuthModalOpen(false);
                    }}
                />
                <Header />
                <main className="flex-grow relative">
                    <Routes>
                        <Route path="/" element={<HomePage onSignUpClick={() => { setAuthModalView('signup'); setIsAuthModalOpen(true); }} />} />
                        <Route path="/dashboard" element={<DashboardPage />} />
                        <Route path="/profile/:userId" element={<ProfilePageWrapper />} />
                        <Route path="/admin" element={<AdminPage />} />
                        <Route path="/leagues" element={<LeaguePage />} />
                        <Route path="/league/:leagueId" element={<LeagueDetailPageWrapper />} />
                        <Route path="/leaderboard" element={<LeaderboardPage />} />
                        <Route path="/schedule" element={<SchedulePage />} />
                        <Route path="/scores" element={<ScoresPage theme={themeMode} />} />
                        <Route path="/stats" element={<StatsPage />} />
                        <Route path="/howtoplay" element={<HowToPlayPage />} />
                    </Routes>
                </main>
                <Footer />
            </div>
        </Router>
    );
}

function App() {
    return (
        <AuthProvider>
            <AppContent />
        </AuthProvider>
    );
}

function ProfilePageWrapper() {
    const { userId } = useParams();
    return <ProfilePage viewingUserId={userId} />;
}

function LeagueDetailPageWrapper() {
    const { leagueId } = useParams();
    return <LeagueDetailPage leagueId={leagueId} />;
}

export default App;