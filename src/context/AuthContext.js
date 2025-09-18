import React, { createContext, useState, useEffect, useContext } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, onSnapshot, getDoc, updateDoc } from 'firebase/firestore';
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
            // If the user logs out, clear everything and stop.
            if (!currentUser) {
                setUser(null);
                setLoggedInProfile(null);
                setIsLoading(false);
                return;
            }

            // If a user is logged in, proceed.
            if (!dataNamespace) {
                console.error("DATA_NAMESPACE is not set in frontend environment variables!");
                setIsLoading(false);
                return;
            }
            
            setUser(currentUser);
            const idTokenResult = await currentUser.getIdTokenResult();
            const isAdmin = idTokenResult.claims.admin === true;
            
            const userDocRef = doc(db, 'artifacts', dataNamespace, 'users', currentUser.uid, 'profile', 'data');
            
            // --- NEW, STABLE LOGIC ---
            // 1. Update lastActive status ONCE upon authentication.
            try {
                await updateDoc(userDocRef, { lastActive: new Date() });
            } catch (error) {
                // This might fail if the profile doc doesn't exist yet (first login). That's okay.
                console.warn("Could not update lastActive status. This may be a new user.", error.message);
            }

            // 2. Set up the real-time listener for profile data.
            // This now ONLY listens and does not cause writes, preventing the loop.
            const unsubProfile = onSnapshot(userDocRef, async (docSnap) => {
                if (docSnap.exists()) {
                    const profileData = ensureProfileCompatibility(docSnap.data());
                    setLoggedInProfile({
                        userId: currentUser.uid,
                        ...profileData,
                        isAdmin: isAdmin
                    });
                } else {
                    // If profile doesn't exist, call the self-healing cloud function.
                    console.warn("Profile document not found. Attempting to create one.");
                    try {
                        const createUserProfileFunc = httpsCallable(functions, 'createUserProfile');
                        await createUserProfileFunc();
                        // The onSnapshot listener will automatically pick up the newly created profile.
                    } catch (error) {
                        console.error("Failed to create missing user profile:", error);
                        signOut(auth);
                    }
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