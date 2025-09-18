import React, { createContext, useState, useEffect, useContext } from 'react';
// MODIFIED: Added signOut to the import list
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { doc, onSnapshot, getDoc } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { auth, db, functions, dataNamespace } from '../firebase';
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
            if (!currentUser) {
                setUser(null);
                setLoggedInProfile(null);
                setIsLoading(false);
                return;
            }

            if (!dataNamespace) {
                console.error("DATA_NAMESPACE is not set in frontend environment variables!");
                setIsLoading(false);
                return;
            }
            
            setUser(currentUser);
            const idTokenResult = await currentUser.getIdTokenResult();
            const isAdmin = idTokenResult.claims.admin === true;
            
            const userDocRef = doc(db, 'artifacts', dataNamespace, 'users', currentUser.uid, 'profile', 'data');
            
            const docSnap = await getDoc(userDocRef);

            if (!docSnap.exists()) {
                console.warn("Profile document not found for logged-in user. Attempting to create one.");
                try {
                    const createUserProfileFunc = httpsCallable(functions, 'createUserProfile');
                    await createUserProfileFunc();
                } catch (error) {
                    console.error("Failed to create missing user profile:", error);
                    signOut(auth); 
                    setIsLoading(false);
                    return;
                }
            }

            const unsubProfile = onSnapshot(userDocRef, (docSnap) => {
                if (docSnap.exists()) {
                    const profileData = ensureProfileCompatibility(docSnap.data());
                    setLoggedInProfile({
                        userId: currentUser.uid,
                        ...profileData,
                        isAdmin: isAdmin
                    });
                }
                setIsLoading(false);
            }, (error) => {
                console.error("Error fetching profile:", error);
                setLoggedInProfile(null);
                setIsLoading(false);
            });

            return () => unsubProfile();
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