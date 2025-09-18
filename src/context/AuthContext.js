import React, { createContext, useState, useEffect, useContext } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
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
            if (currentUser) {
                if (!dataNamespace) {
                    console.error("DATA_NAMESPACE is not set in frontend environment variables!");
                    setIsLoading(false);
                    return;
                }
                
                setUser(currentUser);
                const idTokenResult = await currentUser.getIdTokenResult();
                const isAdmin = idTokenResult.claims.admin === true;
                
                const userDocRef = doc(db, 'artifacts', dataNamespace, 'users', currentUser.uid, 'profile', 'data');
                
                // --- NEW, MORE ROBUST LOGIC ---
                // 1. First, just get the document once to check its existence.
                const docSnap = await getDoc(userDocRef);

                if (!docSnap.exists()) {
                    // 2. If the profile doesn't exist for a logged-in user, create it.
                    // This makes the app "self-healing" if signup was ever interrupted.
                    console.warn("Profile document not found for logged-in user. Attempting to create one.");
                    try {
                        const createUserProfileFunc = httpsCallable(functions, 'createUserProfile');
                        await createUserProfileFunc();
                    } catch (error) {
                        console.error("Failed to create missing user profile:", error);
                        // Log out the user if profile creation fails, as they are in an invalid state.
                        signOut(auth); 
                        setIsLoading(false);
                        return;
                    }
                }
                // --- END OF NEW LOGIC ---

                // 3. Now, set up the real-time listener.
                // This will fire immediately with the existing or newly created document.
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