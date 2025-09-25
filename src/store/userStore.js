// src/store/userStore.js - Enhanced with better error handling and connection stability
import { create } from 'zustand';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, onSnapshot, updateDoc } from 'firebase/firestore';
import { auth, db, dataNamespace } from '../firebase';

export const useUserStore = create((set, get) => ({
  user: null,
  loggedInProfile: null,
  isLoadingAuth: true,
  lastActiveUpdate: null,
  connectionError: null,
  profileUnsubscribe: null,

  // Initialize authentication listener with enhanced error handling
  initAuthListener: () => {
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      set({ 
        user: firebaseUser, 
        isLoadingAuth: false,
        connectionError: null 
      });
      
      if (firebaseUser) {
        get().initProfileListener(firebaseUser.uid);
        get().startActivityTracking(firebaseUser.uid);
      } else {
        set({ 
          loggedInProfile: null,
          lastActiveUpdate: null,
          connectionError: null
        });
        get().stopActivityTracking();
        get().cleanup();
      }
    }, (error) => {
      console.error('Auth state change error:', error);
      set({ 
        isLoadingAuth: false,
        connectionError: 'Authentication error occurred'
      });
    });
    
    return unsubscribe;
  },

  // Initialize profile listener with retry logic and better error handling
  initProfileListener: (userId) => {
    // Clean up existing listener first
    const { profileUnsubscribe } = get();
    if (profileUnsubscribe) {
      profileUnsubscribe();
    }

    const profileRef = doc(db, 'artifacts', dataNamespace, 'users', userId, 'profile', 'data');
    
    // Profile listener with enhanced error handling
    const unsubscribe = onSnapshot(profileRef, (doc) => {
      try {
        if (doc.exists()) {
          const profileData = { userId, ...doc.data() };
          set({ 
            loggedInProfile: profileData,
            connectionError: null
          });
        } else {
          set({ 
            loggedInProfile: null,
            connectionError: null
          });
        }
      } catch (error) {
        console.error('Error processing profile data:', error);
        set({ 
          connectionError: 'Profile data processing error'
        });
      }
    }, (error) => {
      console.error('Profile listener error:', error);
      
      // Handle different types of Firestore errors
      if (error.code === 'permission-denied') {
        set({ 
          connectionError: 'Access denied to profile data',
          loggedInProfile: null
        });
      } else if (error.code === 'unavailable') {
        set({ 
          connectionError: 'Service temporarily unavailable'
        });
        // Retry connection after 5 seconds
        setTimeout(() => {
          get().initProfileListener(userId);
        }, 5000);
      } else {
        set({ 
          connectionError: 'Connection error occurred',
          loggedInProfile: null
        });
      }
    });

    // Store unsubscribe function for cleanup
    set({ profileUnsubscribe: unsubscribe });
  },

  // Activity tracking for "last active" updates with error handling
  startActivityTracking: (userId) => {
    const updateActivity = async () => {
      try {
        const profileRef = doc(db, 'artifacts', dataNamespace, 'users', userId, 'profile', 'data');
        await updateDoc(profileRef, {
          lastActive: new Date()
        });
      } catch (error) {
        // Only log non-critical errors, don't disrupt user experience
        if (error.code !== 'permission-denied' && error.code !== 'not-found') {
          console.error('Error updating last active:', error);
        }
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

  // Enhanced cleanup function
  cleanup: () => {
    const { profileUnsubscribe } = get();
    if (profileUnsubscribe) {
      try {
        profileUnsubscribe();
      } catch (error) {
        console.error('Error unsubscribing from profile:', error);
      }
    }
    get().stopActivityTracking();
    set({ 
      profileUnsubscribe: null,
      connectionError: null
    });
  },

  // Retry connection method
  retryConnection: () => {
    const { user } = get();
    if (user) {
      set({ connectionError: null });
      get().initProfileListener(user.uid);
    }
  },

  // Clear errors
  clearError: () => {
    set({ connectionError: null });
  }
}));