// src/store/userStore.js
import { create } from 'zustand';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, onSnapshot, updateDoc } from 'firebase/firestore';
import { auth, db, dataNamespace } from '../firebase';

export const useUserStore = create((set, get) => ({
  user: null,
  loggedInProfile: null,
  isLoadingAuth: true,
  lastActiveUpdate: null,

  // Initialize authentication listener
  initAuthListener: () => {
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      set({ user: firebaseUser, isLoadingAuth: false });
      
      if (firebaseUser) {
        get().initProfileListener(firebaseUser.uid);
        get().startActivityTracking(firebaseUser.uid);
      } else {
        set({ 
          loggedInProfile: null,
          lastActiveUpdate: null
        });
        get().stopActivityTracking();
      }
    });
    
    return unsubscribe;
  },

  // Initialize profile listener
  initProfileListener: (userId) => {
    const profileRef = doc(db, 'artifacts', dataNamespace, 'users', userId, 'profile', 'data');
    
    // Profile listener
    const profileUnsubscribe = onSnapshot(profileRef, (doc) => {
      if (doc.exists()) {
        const profileData = { userId, ...doc.data() };
        set({ loggedInProfile: profileData });
      } else {
        set({ loggedInProfile: null });
      }
    }, (error) => {
      console.error('Profile listener error:', error);
      set({ loggedInProfile: null });
    });

    // Store unsubscribe function for cleanup
    set({ profileUnsubscribe });
  },

  // Activity tracking for "last active" updates
  startActivityTracking: (userId) => {
    const updateActivity = async () => {
      try {
        const profileRef = doc(db, 'artifacts', dataNamespace, 'users', userId, 'profile', 'data');
        await updateDoc(profileRef, {
          lastActive: new Date()
        });
      } catch (error) {
        console.error('Error updating last active:', error);
      }
    };

    // Update immediately and then every 5 minutes
    updateActivity();
    const intervalId = setInterval(updateActivity, 5 * 60 * 1000);
    
    set({ lastActiveUpdate: intervalId });
  },

  stopActivityTracking: () => {
    const { lastActiveUpdate } = get();
    if (lastActiveUpdate) {
      clearInterval(lastActiveUpdate);
      set({ lastActiveUpdate: null });
    }
  },

  // Cleanup function
  cleanup: () => {
    const { profileUnsubscribe } = get();
    if (profileUnsubscribe) profileUnsubscribe();
    get().stopActivityTracking();
  }
}));