import React, { createContext, useContext, useEffect, useState } from 'react';
import { useUserStore } from '../store/userStore';
import { doc, setDoc } from 'firebase/firestore';
import { db, dataNamespace } from '../firebase';

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
        const checkAndFixProfile = async () => {
            if (!isLoadingAuth && user && loggedInProfile) {
                // Check if username is missing
                const missingUsername = !loggedInProfile.username || loggedInProfile.username.trim() === '';
                setNeedsProfileCompletion(missingUsername);
                
                if (missingUsername) {
                    console.log('⚠️ Username is missing - showing completion modal');
                    return; // Don't auto-fix if username is missing
                }
                
                // Auto-fix missing createdAt and trophies
                const needsFix = !loggedInProfile.createdAt || !loggedInProfile.trophies;
                
                if (needsFix) {
                    console.log('🔧 Auto-fixing missing profile fields...');
                    try {
                        const userProfileRef = doc(
                            db, 
                            'artifacts', 
                            dataNamespace, 
                            'users', 
                            user.uid, 
                            'profile', 
                            'data'
                        );
                        
                        const updates = {};
                        
                        if (!loggedInProfile.createdAt) {
                            updates.createdAt = new Date();
                        }
                        
                        if (!loggedInProfile.trophies) {
                            updates.trophies = {
                                championships: [],
                                regionals: [],
                                finalistMedals: []
                            };
                        }
                        
                        await setDoc(userProfileRef, updates, { merge: true });
                        console.log('✅ Profile fields auto-fixed');
                    } catch (error) {
                        console.error('❌ Failed to auto-fix profile:', error);
                    }
                }
            } else {
                setNeedsProfileCompletion(false);
            }
        };

        checkAndFixProfile();
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