// components/auth/ProtectedRoute.js
// Route protection component for Enhanced Fantasy Drum Corps Game

import React from 'react';
import { Navigate } from 'react-router-dom';
import { useUserStore } from '../../store/userStore';
import LoadingScreen from '../ui/LoadingScreen';

const ProtectedRoute = ({ children, adminOnly = false }) => {
  const { user, loggedInProfile, isLoadingAuth } = useUserStore();

  // Show loading while authentication is being determined
  if (isLoadingAuth) {
    return <LoadingScreen message="Checking authentication..." />;
  }

  // Redirect to home if not logged in
  if (!user) {
    return <Navigate to="/" replace />;
  }

  // Check admin requirements
  if (adminOnly && !loggedInProfile?.isAdmin) {
    return <Navigate to="/dashboard" replace />;
  }

  return children;
};

export default ProtectedRoute;