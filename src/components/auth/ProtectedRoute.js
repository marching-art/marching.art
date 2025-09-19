import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

const ProtectedRoute = ({ children }) => {
    const { user, isLoadingAuth } = useAuth();

    // While authentication is loading, show a loading indicator
    // to prevent a flash of the login page for logged-in users.
    if (isLoadingAuth) {
        return (
            <div className="bg-background dark:bg-background-dark min-h-screen flex items-center justify-center text-primary dark:text-primary-dark">
                <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary dark:border-primary-dark"></div>
            </div>
        );
    }

    // If loading is finished and there is no user, redirect to the homepage.
    if (!user) {
        return <Navigate to="/" replace />;
    }

    // If the user is authenticated, render the child component (the protected page).
    return children;
};

export default ProtectedRoute;