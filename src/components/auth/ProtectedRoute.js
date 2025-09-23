// src/components/auth/ProtectedRoute.js - Route protection component
import React, { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import AuthModal from './AuthModal';
import Icon from '../ui/Icon';

const ProtectedRoute = ({ children, requireEmailVerification = false, adminOnly = false }) => {
    const { user, userProfile, loading, initializing, isAdmin, isEmailVerified } = useAuth();
    const [showAuthModal, setShowAuthModal] = useState(false);

    // Show loading spinner while initializing
    if (initializing || loading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="text-center">
                    <Icon 
                        path="M12 2.25c-5.385 0-9.75 4.365-9.75 9.75s4.365 9.75 9.75 9.75 9.75-4.365 9.75-9.75S17.385 2.25 12 2.25z" 
                        className="w-8 h-8 text-primary mx-auto mb-4 animate-spin" 
                    />
                    <p className="text-text-secondary dark:text-text-secondary-dark">Loading...</p>
                </div>
            </div>
        );
    }

    // Redirect to auth if not logged in
    if (!user) {
        return (
            <div className="min-h-screen flex items-center justify-center p-4">
                <div className="text-center max-w-md">
                    <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-6">
                        <Icon 
                            path="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" 
                            className="w-8 h-8 text-primary" 
                        />
                    </div>
                    
                    <h2 className="text-2xl font-bold text-text-primary dark:text-text-primary-dark mb-4">
                        Sign in Required
                    </h2>
                    
                    <p className="text-text-secondary dark:text-text-secondary-dark mb-6">
                        You need to be signed in to access this page. Join the marching.art community to unlock all features!
                    </p>
                    
                    <div className="space-y-3">
                        <button
                            onClick={() => setShowAuthModal(true)}
                            className="w-full px-6 py-3 bg-primary hover:bg-primary/90 text-on-primary rounded-xl transition-all font-semibold"
                        >
                            Sign In
                        </button>
                        
                        <button
                            onClick={() => setShowAuthModal(true)}
                            className="w-full px-6 py-3 bg-transparent hover:bg-accent/10 dark:hover:bg-accent-dark/10 text-text-primary dark:text-text-primary-dark border border-accent dark:border-accent-dark rounded-xl transition-all"
                        >
                            Create Account
                        </button>
                    </div>
                </div>
                
                <AuthModal
                    isOpen={showAuthModal}
                    onClose={() => setShowAuthModal(false)}
                    onAuthSuccess={() => setShowAuthModal(false)}
                    initialView="login"
                />
            </div>
        );
    }

    // Check for email verification requirement
    if (requireEmailVerification && !isEmailVerified()) {
        return (
            <div className="min-h-screen flex items-center justify-center p-4">
                <div className="text-center max-w-md">
                    <div className="w-16 h-16 bg-yellow-100 dark:bg-yellow-900/20 rounded-full flex items-center justify-center mx-auto mb-6">
                        <Icon 
                            path="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" 
                            className="w-8 h-8 text-yellow-600 dark:text-yellow-400" 
                        />
                    </div>
                    
                    <h2 className="text-2xl font-bold text-text-primary dark:text-text-primary-dark mb-4">
                        Email Verification Required
                    </h2>
                    
                    <p className="text-text-secondary dark:text-text-secondary-dark mb-6">
                        Please verify your email address to access this feature. Check your inbox for a verification link.
                    </p>
                    
                    <button
                        onClick={() => window.location.href = '/settings'}
                        className="px-6 py-3 bg-primary hover:bg-primary/90 text-on-primary rounded-xl transition-all font-semibold"
                    >
                        Go to Settings
                    </button>
                </div>
            </div>
        );
    }

    // Check for admin requirement
    if (adminOnly && !isAdmin()) {
        return (
            <div className="min-h-screen flex items-center justify-center p-4">
                <div className="text-center max-w-md">
                    <div className="w-16 h-16 bg-red-100 dark:bg-red-900/20 rounded-full flex items-center justify-center mx-auto mb-6">
                        <Icon 
                            path="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" 
                            className="w-8 h-8 text-red-600 dark:text-red-400" 
                        />
                    </div>
                    
                    <h2 className="text-2xl font-bold text-text-primary dark:text-text-primary-dark mb-4">
                        Access Denied
                    </h2>
                    
                    <p className="text-text-secondary dark:text-text-secondary-dark mb-6">
                        You don't have permission to access this page. Admin privileges are required.
                    </p>
                    
                    <button
                        onClick={() => window.location.href = '/dashboard'}
                        className="px-6 py-3 bg-primary hover:bg-primary/90 text-on-primary rounded-xl transition-all font-semibold"
                    >
                        Go to Dashboard
                    </button>
                </div>
            </div>
        );
    }

    // Check if user profile exists
    if (!userProfile) {
        return (
            <div className="min-h-screen flex items-center justify-center p-4">
                <div className="text-center max-w-md">
                    <div className="w-16 h-16 bg-blue-100 dark:bg-blue-900/20 rounded-full flex items-center justify-center mx-auto mb-6">
                        <Icon 
                            path="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" 
                            className="w-8 h-8 text-blue-600 dark:text-blue-400" 
                        />
                    </div>
                    
                    <h2 className="text-2xl font-bold text-text-primary dark:text-text-primary-dark mb-4">
                        Profile Setup Required
                    </h2>
                    
                    <p className="text-text-secondary dark:text-text-secondary-dark mb-6">
                        Please complete your profile setup to continue using marching.art.
                    </p>
                    
                    <button
                        onClick={() => window.location.href = '/settings'}
                        className="px-6 py-3 bg-primary hover:bg-primary/90 text-on-primary rounded-xl transition-all font-semibold"
                    >
                        Complete Setup
                    </button>
                </div>
            </div>
        );
    }

    // All checks passed, render the protected content
    return children;
};

export default ProtectedRoute;