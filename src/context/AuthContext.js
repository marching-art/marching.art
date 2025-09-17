import React, { createContext, useState, useEffect, useContext } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, onSnapshot, setDoc } from 'firebase/firestore';
import { auth, db } from '../firebase';
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
                const appId = process.env.REACT_APP_FIREBASE_APP_ID;
                setUser(currentUser);
                const idTokenResult = await currentUser.getIdTokenResult();
                const isAdmin = idTokenResult.claims.admin === true;
                const userDocRef = doc(db, 'artifacts', appId, 'users', currentUser.uid, 'profile', 'data');
                
                await setDoc(userDocRef, { lastActive: new Date() }, { merge: true });

                const unsubProfile = onSnapshot(userDocRef, (docSnap) => {
                    if (docSnap.exists()) {
                        const profileData = ensureProfileCompatibility(docSnap.data());
                        setLoggedInProfile({
                            userId: currentUser.uid,
                            ...profileData,
                            isAdmin: isAdmin
                        });
                    } else {
                        setLoggedInProfile(null); // Profile creation is pending
                    }
                    setIsLoading(false);
                }, (error) => {
                    console.error("Error fetching profile:", error);
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