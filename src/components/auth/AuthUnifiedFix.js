// src/components/auth/AuthUnifiedFix.js - Unified auth solution
import React, { createContext, useContext, useEffect } from 'react';
import { useUserStore } from '../store/userStore';

const UnifiedAuthContext = createContext();

export const useUnifiedAuth = () => {
    const context = useContext(UnifiedAuthContext);
    if (!context) {
        throw new Error('useUnifiedAuth must be used within UnifiedAuthProvider');
    }
    return context;
};

export const UnifiedAuthProvider = ({ children }) => {
    // Get auth state from userStore which is the source of truth
    const { 
        user, 
        loggedInProfile, 
        isLoadingAuth, 
        connectionError,
        initAuthListener, 
        retryConnection, 
        clearError,
        cleanup
    } = useUserStore();

    // Initialize auth listener on mount
    useEffect(() => {
        const unsubscribe = initAuthListener();
        
        return () => {
            if (unsubscribe) unsubscribe();
            cleanup();
        };
    }, [initAuthListener, cleanup]);

    const value = {
        user,
        loggedInProfile,
        isLoadingAuth,
        connectionError,
        retryConnection,
        clearError,
    };

    return (
        <UnifiedAuthContext.Provider value={value}>
            {children}
        </UnifiedAuthContext.Provider>
    );
};