import { create } from 'zustand';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, onSnapshot, getDoc } from 'firebase/firestore';
import { auth, db, dataNamespace } from '../firebase';

export const useUserStore = create((set, get) => ({
  // State
  user: null,
  loggedInProfile: null,
  isLoadingAuth: true,

  // Actions
  initAuthListener: () => {
    const unsubscribeAuth = onAuthStateChanged(auth, async (firebaseUser) => {
      console.log('=== AUTH STATE CHANGED ===');
      console.log('firebaseUser:', firebaseUser);
      
      if (firebaseUser) {
        // User is signed in
        set({ user: firebaseUser, isLoadingAuth: false });
        
        try {
          // Get the ID token to check for admin claims
          const tokenResult = await firebaseUser.getIdTokenResult();
          const isAdmin = tokenResult.claims.admin === true;
          
          console.log('Token claims:', tokenResult.claims);
          console.log('isAdmin:', isAdmin);
          
          // FIRST: Do a direct read to get the profile immediately
          const profileRef = doc(
            db,
            'artifacts',
            dataNamespace,
            'users',
            firebaseUser.uid,
            'profile',
            'data'
          );
          
          console.log('Attempting direct read of profile...');
          const profileSnap = await getDoc(profileRef);
          
          if (profileSnap.exists()) {
            console.log('✅ Direct read SUCCESS! Profile data:', profileSnap.data());
            const profileData = {
              userId: firebaseUser.uid,
              isAdmin: isAdmin,
              ...profileSnap.data()
            };
            set({ loggedInProfile: profileData });
          } else {
            console.log('❌ Direct read: Profile does not exist');
            set({ loggedInProfile: null });
          }
          
          // THEN: Set up the realtime listener for updates
          console.log('Setting up realtime listener...');
          const unsubscribeProfile = onSnapshot(
            profileRef,
            (profileSnap) => {
              console.log('📡 Realtime update - Profile exists:', profileSnap.exists());
              if (profileSnap.exists()) {
                const profileData = {
                  userId: firebaseUser.uid,
                  isAdmin: isAdmin,
                  ...profileSnap.data()
                };
                console.log('📡 Updating profile from listener:', profileData);
                set({ loggedInProfile: profileData });
              } else {
                console.log('📡 Profile no longer exists');
                set({ loggedInProfile: null });
              }
            },
            (error) => {
              console.error('❌ Listener error:', error);
              // Don't set profile to null on error - keep the existing data
            }
          );

          // Store the unsubscribe function
          set({ unsubscribeProfile });
        } catch (error) {
          console.error('Error in profile setup:', error);
          set({ isLoadingAuth: false });
        }
      } else {
        // User is signed out
        console.log('User signed out');
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