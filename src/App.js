import React, { useState, useEffect, lazy, Suspense } from 'react';
import { signOut } from 'firebase/auth';
import { auth, trace, logEvent } from './firebase';
import { AuthProvider, useAuth } from './context/AuthContext';
import { Toaster } from 'react-hot-toast';

// --- NEW IMPORTS ---
import { BrowserRouter, Routes, Route, Navigate, useNavigate } from 'react-router-dom';

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


/**
 * A helper component to protect routes that require authentication.
 */
function ProtectedRoute({ profile, isLoading, children }) {
    if (isLoading) {
        return <LoadingSpinner />;
    }
    if (!profile) {
        return <Navigate to="/" replace />;
    }
    return children;
}

/**
 * A helper component to protect routes that require Admin status.
 */
function AdminRoute({ profile, isLoading, children }) {
    if (isLoading) {
        return <LoadingSpinner />;
    }
    if (!profile || !profile.isAdmin) {
        return <Navigate to="/dashboard" replace />;
    }
    return children;
}


function AppContent() {
    const { user, loggedInProfile, isLoadingAuth, needsProfileCompletion } = useAuth();
    const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
    const [authModalView, setAuthModalView] = useState('login');
    const [themeMode, setThemeMode] = useState(() => {
        return localStorage.getItem('theme') || 'dark';
    });
    
    // --- NEW: React Router's navigation hook ---
    const navigate = useNavigate();
    
    // This effect is fine, it just applies the theme
    useEffect(() => {
        if (themeMode === 'dark') {
            document.documentElement.classList.add('dark');
        } else {
            document.documentElement.classList.remove('dark');
        }
        localStorage.setItem('theme', themeMode);
    }, [themeMode]);

    // This effect is no longer needed, routing handles it
    // useEffect(() => {
    //     if (!isLoadingAuth && !user && page !== 'home' ...) {
    //         setPage('home');
    //     }
    // }, [user, isLoadingAuth, page]);

    // This effect can be simplified or removed,
    // but logging page views can be done with a dedicated router hook if needed.
    // For now, we'll leave it out as it depends on the `page` state we removed.

    const handleLogout = async () => {
        const logoutTrace = trace('user_logout');
        logoutTrace.start();
        
        try {
            await signOut(auth);
            navigate('/'); // <-- Navigate to home on logout
            logEvent('logout');
        } catch (error) {
            console.error("Error signing out:", error);
        } finally {
            logoutTrace.stop();
        }
    };

    const handleProfileComplete = () => {
        window.location.reload();
    };

    // --- We no longer need `handleSetPage`, `page`, `pageProps`, or `renderPage` ---

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
                onAuthSuccess={() => {
                    setIsAuthModalOpen(false);
                    navigate('/dashboard'); // <-- Go to dashboard after auth
                }}
                initialView={authModalView}
            />
            
            {needsProfileCompletion && (
                <ProfileCompletionModal 
                    userId={user.uid}
                    onComplete={handleProfileComplete}
                />
            )}
            
            {/* Header now uses <Link> components internally (see Step 3) */}
            <Header
                user={user}
                isLoggedIn={!!user}
                isAdmin={loggedInProfile?.isAdmin}
                onLoginClick={() => { setAuthModalView('login'); setIsAuthModalOpen(true); }}
                onSignUpClick={() => { setAuthModalView('signup'); setIsAuthModalOpen(true); }}
                onLogout={handleLogout}
                profile={loggedInProfile}
                themeMode={themeMode}
                toggleThemeMode={() => setThemeMode(themeMode === 'light' ? 'dark' : 'light')}
            />
            
            <main className="flex-grow relative">
                <ErrorBoundary>
                    {/* The `renderPage` switch statement is replaced by `Routes` */}
                    <Suspense fallback={<LoadingSpinner />}>
                        <Routes>
                            {/* Public Routes */}
                            <Route 
                                path="/" 
                                element={<HomePage onSignUpClick={() => navigate('/dashboard')} />} 
                            />
                            <Route path="/how-to-play" element={<HowToPlayPage />} />
                            <Route path="/schedule" element={<SchedulePage onViewScores={() => navigate('/scores')} />} />
                            <Route path="/scores" element={<ScoresPage theme={themeMode} />} />
                            <Route path="/stats" element={<StatsPage />} />
                            <Route 
                                path="/leaderboard" 
                                element={<LeaderboardPage 
                                    profile={loggedInProfile} 
                                    onViewProfile={(userId) => navigate(`/profile/${userId}`)} 
                                />} 
                            />
                            
                            {/* Profile Routes (can be public, but one is special) */}
                            <Route 
                                path="/profile/:userId" 
                                element={<ProfilePage 
                                    loggedInProfile={loggedInProfile}
                                    loggedInUserId={user?.uid}
                                    // viewingUserId is now passed by the router from the URL
                                />} 
                            />
                            
                            {/* Protected Routes (Require Login) */}
                            <Route 
                                path="/dashboard" 
                                element={<ProtectedRoute profile={loggedInProfile} isLoading={isLoadingAuth}>
                                    <DashboardPage profile={loggedInProfile} userId={user?.uid} />
                                </ProtectedRoute>} 
                            />
                            <Route 
                                path="/leagues" 
                                element={<ProtectedRoute profile={loggedInProfile} isLoading={isLoadingAuth}>
                                    <LeaguePage 
                                        profile={loggedInProfile} 
                                        onViewLeague={(leagueId) => navigate(`/league/${leagueId}`)} 
                                    />
                                </ProtectedRoute>} 
                            />
                            <Route 
                                path="/league/:leagueId" 
                                element={<ProtectedRoute profile={loggedInProfile} isLoading={isLoadingAuth}>
                                    <LeagueDetailPage
                                        profile={loggedInProfile}
                                        onBackToLeagues={() => navigate('/leagues')}
                                        onViewProfile={(userId) => navigate(`/profile/${userId}`)}
                                        // leagueId is now passed by the router from the URL
                                    />
                                </ProtectedRoute>} 
                            />
                            <Route 
                                path="/profile" 
                                element={<ProtectedRoute profile={loggedInProfile} isLoading={isLoadingAuth}>
                                    {/* Redirects /profile to /profile/my-user-id */}
                                    <Navigate to={`/profile/${user?.uid}`} replace />
                                </ProtectedRoute>} 
                            />

                            {/* Admin Route */}
                            <Route 
                                path="/admin" 
                                element={<AdminRoute profile={loggedInProfile} isLoading={isLoadingAuth}>
                                    <AdminPage />
                                </AdminRoute>} 
                            />

                            {/* Fallback for unknown routes */}
                            <Route path="*" element={<Navigate to="/" replace />} />

                        </Routes>
                    </Suspense>
                </ErrorBoundary>
            </main>
            
            {/* Footer now uses <Link> components internally (see Step 3) */}
            <Footer />
        </div>
    );
}

// --- NEW: Wrap AppContent in BrowserRouter ---
function App() {
    return (
        <ErrorBoundary>
            <AuthProvider>
                <BrowserRouter>
                    <AppContent />
                </BrowserRouter>
            </AuthProvider>
        </ErrorBoundary>
    );
}

export default App;