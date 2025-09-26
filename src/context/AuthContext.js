// src/context/AuthContext.js - Fixed integration with userStore
import React, { createContext, useContext, useEffect } from 'react';
import { useUserStore } from '../store/userStore';

const AuthContext = createContext();

// This custom hook will now get its data from the Zustand store.
// Components using useAuth() won't need to be changed.
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  // Select the state and actions from the store
  const { 
    user, 
    loggedInProfile, 
    isLoadingAuth,
    isLoadingProfile,
    connectionError,
    initAuthListener, 
    retryConnection, 
    clearError,
    cleanup
  } = useUserStore();

  // On initial app load, run the authentication listener
  useEffect(() => {
    const unsubscribe = initAuthListener();
    
    // Cleanup on unmount
    return () => {
      if (unsubscribe) unsubscribe();
      cleanup();
    };
  }, [initAuthListener, cleanup]);

  const value = {
    user,
    loggedInProfile,
    isLoadingAuth,
    isLoadingProfile,
    connectionError,
    retryConnection,
    clearError,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};