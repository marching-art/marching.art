import React, { createContext, useContext, useEffect, useState } from 'react';
import { useUserStore } from '../stores/userStore';
import { validateProfile } from '../utils/profileValidation';

const AuthContext = createContext();

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error('useAuth must be used within AuthProvider');
    }
    return context;
};

export const AuthProvider = ({ children }) => {
    const { user, loggedInProfile, isLoadingAuth, initAuthListener } = useUserStore();
    const [needsProfileCompletion, setNeedsProfileCompletion] = useState(false);

    useEffect(() => {
        initAuthListener();
    }, [initAuthListener]);

    useEffect(() => {
        if (!isLoadingAuth && user && loggedInProfile) {
            const validation = validateProfile(loggedInProfile);
            setNeedsProfileCompletion(!validation.isValid);
            
            if (!validation.isValid) {
                console.log('⚠️ Profile incomplete. Missing:', validation.missingFields);
            }
        } else {
            setNeedsProfileCompletion(false);
        }
    }, [user, loggedInProfile, isLoadingAuth]);

    return (
        <AuthContext.Provider value={{ 
            user, 
            loggedInProfile, 
            isLoadingAuth,
            needsProfileCompletion 
        }}>
            {children}
        </AuthContext.Provider>
    );
};