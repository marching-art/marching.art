import { create } from 'zustand';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, onSnapshot } from 'firebase/firestore';
import { auth, db, dataNamespace } from '../firebase';

// This is the single source of truth for user authentication and profile data.
let profileListener = null; // To hold the unsubscribe function for Firestore

export const useUserStore = create((set) => ({
  // STATE: The data we want to share globally
  user: null,
  loggedInProfile: null,
  isLoadingAuth: true,
  
  // ACTIONS: Functions that modify the state
  
  /**
   * Initializes the authentication listener. This function should be called
   * once when the application loads.
   */
  initAuthListener: () => {
    onAuthStateChanged(auth, (user) => {
      // If a user is logged in
      if (user) {
        set({ user });
        
        // Unsubscribe from any previous profile listener
        if (profileListener) profileListener();

        // Listen for real-time updates to the user's profile document
        const profileRef = doc(db, `artifacts/${dataNamespace}/users/${user.uid}/profile/data`);
        profileListener = onSnapshot(profileRef, (docSnap) => {
          if (docSnap.exists()) {
            // Combine the user ID with the profile data for easy access
            set({ loggedInProfile: { userId: user.uid, ...docSnap.data() } });
          } else {
            // Profile doesn't exist yet (e.g., during signup)
            set({ loggedInProfile: null });
          }
          set({ isLoadingAuth: false });
        }, (error) => {
          console.error("Error listening to profile:", error);
          set({ isLoadingAuth: false, loggedInProfile: null });
        });
        
      } else {
        // If no user is logged in (or they logged out)
        if (profileListener) profileListener();
        set({ user: null, loggedInProfile: null, isLoadingAuth: false });
      }
    });
  },
}));