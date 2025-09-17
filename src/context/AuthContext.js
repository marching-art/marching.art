import React, { createContext, useState, useEffect, useContext } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, onSnapshot, updateDoc } from 'firebase/firestore';
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
                // This new, unambiguous variable points to the "marching-art" document ID
                const dataNamespace = process.env.REACT_APP_DATA_NAMESPACE;
                if (!dataNamespace) {
                    console.error("DATA_NAMESPACE is not set in frontend environment variables!");
                    setIsLoading(false);
                    return;
                }
                
                setUser(currentUser);
                const idTokenResult = await currentUser.getIdTokenResult();
                const isAdmin = idTokenResult.claims.admin === true;
                // The path is now constructed with the correct variable
                const userDocRef = doc(db, 'artifacts', dataNamespace, 'users', currentUser.uid, 'profile', 'data');
                
                try {
                    await updateDoc(userDocRef, { lastActive: new Date() });
                } catch (error) {
                    console.warn("Could not update lastActive status. This may be the user's first login or the profile document is missing.", error.message);
                }

                const unsubProfile = onSnapshot(userDocRef, (docSnap) => {
                    if (docSnap.exists()) {
                        const profileData = ensureProfileCompatibility(docSnap.data());
                        setLoggedInProfile({
                            userId: currentUser.uid,
                            ...profileData,
                            isAdmin: isAdmin
                        });
                    } else {
                        console.error("Profile document does not exist for this user at the specified path.");
                        setLoggedInProfile(null);
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