import React, { createContext, useState, useEffect, useContext } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, onSnapshot, updateDoc } from 'firebase/firestore';
import { auth, db, dataNamespace } from '../firebase';
import { ensureProfileCompatibility } from '../utils/profileCompatibility';

const AuthContext = createContext();

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [loggedInProfile, setLoggedInProfile] = useState(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
        setIsLoading(true);
        if (currentUser) {
            if (!dataNamespace) {
                console.error("DATA_NAMESPACE is not set in frontend environment variables!");
                setUser(null);
                setLoggedInProfile(null);
                setIsLoading(false);
                return;
            }
            
            setUser(currentUser);
            const idTokenResult = await currentUser.getIdTokenResult();
            const isAdmin = idTokenResult.claims.admin === true;
            
            const userDocRef = doc(db, 'artifacts', dataNamespace, 'users', currentUser.uid, 'profile', 'data');
            
            const unsubProfile = onSnapshot(userDocRef, async (docSnap) => {
                if (docSnap.exists()) {
                    const profileData = ensureProfileCompatibility(docSnap.data());
                    setLoggedInProfile({
                        userId: currentUser.uid,
                        ...profileData,
                        isAdmin: isAdmin
                    });
                    
                    // FIXED: Update lastActive AFTER confirming profile exists
                    try {
                        await updateDoc(userDocRef, { lastActive: new Date() });
                    } catch (error) {
                        console.warn("Could not update lastActive status:", error.message);
                    }
                } else {
                    console.warn("Profile document does not exist for this user. They may need to complete signup.");
                    setLoggedInProfile(null);
                }
                setIsLoading(false);
            }, (error) => {
                console.error("Error fetching profile:", error);
                setLoggedInProfile(null);
                setIsLoading(false);
            });

            return () => unsubProfile();
        } else {
            setUser(null);
            setLoggedInProfile(null);
            setIsLoading(false);
        }
    });
    return () => unsubscribe();
}, []);

    const value = {
        user,
        loggedInProfile,
        isLoadingAuth: isLoading,
    };

    return (
        <AuthContext.Provider value={value}>
            {children}
        </AuthContext.Provider>
    );
};
