// src/components/auth/ProtectedRoute.js
import React from 'react';
import { useUserStore } from '../../store/userStore';
import { Navigate, useLocation } from 'react-router-dom';
import Icon from '../ui/Icon';

const ProtectedRoute = ({ children, requireAdmin = false, requireProfile = true }) => {
    const { user, loggedInProfile, isLoadingAuth } = useUserStore();
    const location = useLocation();

    // Show loading spinner while authentication is being determined
    if (isLoadingAuth) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="text-center">
                    <Icon path="M12 2.25c-5.385 0-9.75 4.365-9.75 9.75s4.365 9.75 9.75 9.75 9.75-4.365 9.75-9.75S17.385 2.25 12 2.25z" className="w-8 h-8 text-primary dark:text-primary-dark animate-spin mx-auto mb-4" />
                    <p className="text-text-secondary dark:text-text-secondary-dark">Loading...</p>
                </div>
            </div>
        );
    }

    // Redirect to login if not authenticated
    if (!user) {
        return <Navigate to="/" state={{ from: location }} replace />;
    }

    // Check admin requirement
    if (requireAdmin && !loggedInProfile?.role?.includes('admin')) {
        return (
            <div className="min-h-screen flex items-center justify-center p-4">
                <div className="text-center max-w-md">
                    <div className="w-16 h-16 bg-red-100 dark:bg-red-900/20 rounded-full flex items-center justify-center mx-auto mb-6">
                        <Icon 
                            path="M12 9v3.75m0-10.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.75c0 5.592 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.57-.598-3.75h-.152c-3.196 0-6.1-1.249-8.25-3.286zm0 13.036h.008v.008H12v-.008z" 
                            className="w-8 h-8 text-red-600 dark:text-red-400" 
                        />
                    </div>
                    
                    <h2 className="text-2xl font-bold text-text-primary dark:text-text-primary-dark mb-4">
                        Access Denied
                    </h2>
                    
                    <p className="text-text-secondary dark:text-text-secondary-dark mb-6">
                        Admin privileges are required to access this page.
                    </p>
                    
                    <button
                        onClick={() => window.location.href = '/dashboard'}
                        className="px-6 py-3 bg-primary hover:bg-primary/90 text-white rounded-xl transition-all font-semibold"
                    >
                        Go to Dashboard
                    </button>
                </div>
            </div>
        );
    }

    // Check if user profile exists when required
    if (requireProfile && !loggedInProfile) {
        // Redirect to profile setup instead of settings
        return <Navigate to="/setup" replace />;
    }

    // All checks passed, render the protected content
    return children;
};

export default ProtectedRoute;