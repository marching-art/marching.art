import React, { useState, useEffect } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import ScheduleAuthPrompt from '../schedule/ScheduleAuthPrompt';

const ProtectedRoute = ({ children, showAuthPrompt = false }) => {
    const { user, isLoadingAuth } = useAuth();
    const location = useLocation();
    const [showRedirectMessage, setShowRedirectMessage] = useState(false);

    // Handle redirect messaging for non-schedule pages
    useEffect(() => {
        if (!isLoadingAuth && !user && !showAuthPrompt) {
            setShowRedirectMessage(true);
            // Auto-redirect after showing message briefly
            const timer = setTimeout(() => {
                setShowRedirectMessage(false);
            }, 2000);
            return () => clearTimeout(timer);
        }
    }, [isLoadingAuth, user, showAuthPrompt]);

    // While authentication is loading, show a loading indicator
    if (isLoadingAuth) {
        return (
            <div className="bg-background dark:bg-background-dark min-h-screen flex items-center justify-center text-primary dark:text-primary-dark">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-16 w-16 border-4 border-primary border-t-transparent mb-4"></div>
                    <p className="text-lg font-medium">Loading marching.art...</p>
                    <p className="text-sm text-text-secondary dark:text-text-secondary-dark mt-2">
                        Checking your authentication status
                    </p>
                </div>
            </div>
        );
    }

    // If loading is finished and there is no user
    if (!user) {
        // For schedule page, show custom auth prompt instead of redirecting
        if (showAuthPrompt || location.pathname === '/schedule') {
            return (
                <ScheduleAuthPrompt 
                    onSignUpClick={() => {
                        // Trigger sign up modal - this would need to be passed down or handled differently
                        window.dispatchEvent(new CustomEvent('openSignUpModal'));
                    }}
                    onLoginClick={() => {
                        // Trigger login modal - this would need to be passed down or handled differently
                        window.dispatchEvent(new CustomEvent('openLoginModal'));
                    }}
                />
            );
        }

        // Show redirect message briefly before redirecting to home
        if (showRedirectMessage) {
            return (
                <div className="bg-background dark:bg-background-dark min-h-screen flex items-center justify-center text-primary dark:text-primary-dark">
                    <div className="text-center max-w-md mx-auto p-8">
                        <div className="w-16 h-16 bg-primary/20 rounded-full flex items-center justify-center mx-auto mb-4">
                            <svg className="w-8 h-8 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                                      d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
                            </svg>
                        </div>
                        <h2 className="text-xl font-bold text-text-primary dark:text-text-primary-dark mb-2">
                            Authentication Required
                        </h2>
                        <p className="text-text-secondary dark:text-text-secondary-dark mb-4">
                            You need to sign in to access this page. Redirecting you to the home page...
                        </p>
                        <div className="flex items-center justify-center">
                            <div className="animate-spin rounded-full h-4 w-4 border-2 border-primary border-t-transparent"></div>
                        </div>
                    </div>
                </div>
            );
        }

        // Redirect to homepage with state to remember where they were trying to go
        return <Navigate to="/" state={{ from: location }} replace />;
    }

    // If the user is authenticated, render the child component
    return children;
};

export default ProtectedRoute;