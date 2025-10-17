import { create } from 'zustand';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, onSnapshot } from 'firebase/firestore';
import { auth, db, dataNamespace } from '../firebase';

export const useUserStore = create((set, get) => ({
  // State
  user: null,
  loggedInProfile: null,
  isLoadingAuth: true,

  // Actions
  initAuthListener: () => {
    const unsubscribeAuth = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        // User is signed in
        set({ user: firebaseUser, isLoadingAuth: false });
        
        // Listen to the user's profile document
        const profileRef = doc(
          db,
          'artifacts',
          dataNamespace,
          'users',
          firebaseUser.uid,
          'profile',
          'data'
        );

        const unsubscribeProfile = onSnapshot(
          profileRef,
          (profileSnap) => {
            if (profileSnap.exists()) {
              const profileData = {
                userId: firebaseUser.uid,
                ...profileSnap.data()
              };
              set({ loggedInProfile: profileData });
            } else {
              // Profile doesn't exist yet
              set({ loggedInProfile: null });
            }
          },
          (error) => {
            console.error('Error fetching user profile:', error);
            set({ loggedInProfile: null });
          }
        );

        // Store the unsubscribe function
        set({ unsubscribeProfile });
      } else {
        // User is signed out
        // Clean up profile listener if it exists
        const { unsubscribeProfile } = get();
        if (unsubscribeProfile) {
          unsubscribeProfile();
        }
        
        set({
          user: null,
          loggedInProfile: null,
          isLoadingAuth: false,
          unsubscribeProfile: null
        });
      }
    });

    // Store the auth unsubscribe function
    set({ unsubscribeAuth });
  },

  // Internal state for cleanup
  unsubscribeAuth: null,
  unsubscribeProfile: null,
}));