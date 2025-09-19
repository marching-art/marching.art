import { create } from 'zustand';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, onSnapshot, updateDoc } from 'firebase/firestore';
import { auth, db, dataNamespace } from '../firebase';

// This is the single source of truth for user authentication and profile data.
let profileListener = null; // To hold the unsubscribe function for Firestore

export const useUserStore = create((set, get) => ({
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
    onAuthStateChanged(auth, async (user) => {
      // If a user is logged in
      if (user) {
        set({ user });
        
        // Unsubscribe from any previous profile listener
        if (profileListener) profileListener();

        // Get the user's custom claims to check admin status
        const tokenResult = await user.getIdTokenResult();
        const isAdminFromClaims = tokenResult.claims.admin === true;

        // Listen for real-time updates to the user's profile document
        const profileRef = doc(db, `artifacts/${dataNamespace}/users/${user.uid}/profile/data`);
        profileListener = onSnapshot(profileRef, async (docSnap) => {
          if (docSnap.exists()) {
            const profileData = docSnap.data();
            
            // Check if we need to sync the admin status
            const isAdminInProfile = profileData.isAdmin === true;
            
            // If admin status doesn't match, update the profile document
            // If admin status doesn't match, update the profile document
if (isAdminFromClaims && !isAdminInProfile) {
  try {
    await updateDoc(profileRef, { isAdmin: true });
    console.log('Admin status synced to profile document');
    // The onSnapshot will fire again with the updated data
    return;
  } catch (error) {
    console.error('Error syncing admin status:', error);
  }
}
            
            // Combine the user ID with the profile data for easy access
            // Use the custom claims value for isAdmin to ensure consistency
            set({ 
              loggedInProfile: { 
                userId: user.uid, 
                ...profileData,
                isAdmin: isAdminFromClaims // Always use the authoritative source
              } 
            });
          } else {
            // Profile doesn't exist yet (e.g., during signup)
            set({ 
              loggedInProfile: { 
                userId: user.uid,
                isAdmin: isAdminFromClaims 
              } 
            });
          }
          set({ isLoadingAuth: false });
        }, (error) => {
          console.error("Error listening to profile:", error);
          set({ 
            isLoadingAuth: false, 
            loggedInProfile: {
              userId: user.uid,
              isAdmin: isAdminFromClaims
            }
          });
        });
        
      } else {
        // If no user is logged in (or they logged out)
        if (profileListener) profileListener();
        set({ user: null, loggedInProfile: null, isLoadingAuth: false });
      }
    });
  },
}));