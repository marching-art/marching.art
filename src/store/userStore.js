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
          
          // DIAGNOSTIC: Check all possible profile paths
          console.log('=== PROFILE PATH DIAGNOSTIC ===');
          console.log('User ID:', firebaseUser.uid);
          console.log('dataNamespace:', dataNamespace);
          console.log('dataNamespace type:', typeof dataNamespace);
          console.log('dataNamespace is undefined?', dataNamespace === undefined);
          
          const expectedPath = `artifacts/${dataNamespace}/users/${firebaseUser.uid}/profile/data`;
          console.log('Expected path:', expectedPath);
          
          // Try multiple possible paths
          const pathsToTry = [
            { name: 'Standard', parts: ['artifacts', dataNamespace, 'users', firebaseUser.uid, 'profile', 'data'] },
            { name: 'Without namespace', parts: ['users', firebaseUser.uid, 'profile', 'data'] },
            { name: 'Hardcoded namespace', parts: ['artifacts', 'marching-art', 'users', firebaseUser.uid, 'profile', 'data'] },
          ];
          
          for (const pathConfig of pathsToTry) {
            try {
              const pathStr = pathConfig.parts.filter(p => p !== undefined).join('/');
              console.log(`Trying ${pathConfig.name} path:`, pathStr);
              
              const testRef = doc(db, ...pathConfig.parts.filter(p => p !== undefined));
              const testSnap = await getDoc(testRef);
              
              if (testSnap.exists()) {
                console.log(`  ✅ FOUND at ${pathConfig.name}! Data:`, testSnap.data());
              } else {
                console.log(`  ❌ Does not exist at ${pathConfig.name}`);
              }
            } catch (error) {
              console.log(`  ⚠️ Error trying ${pathConfig.name}:`, error.message);
            }
          }
          console.log('=== END DIAGNOSTIC ===');
          
          // Listen to the user's profile document (using the expected path)
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
              console.log('Profile snapshot exists:', profileSnap.exists());
              if (profileSnap.exists()) {
                const profileData = {
                  userId: firebaseUser.uid,
                  isAdmin: isAdmin, // Add admin status from custom claims
                  ...profileSnap.data()
                };
                console.log('Setting loggedInProfile:', profileData);
                set({ loggedInProfile: profileData });
              } else {
                // Profile doesn't exist yet
                console.log('Profile does not exist');
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
        } catch (error) {
          console.error('Error getting token or setting up profile listener:', error);
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