// src/store/userStore.js - Direct fix for profile loading issue
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

  // Initialize authentication listener
  initAuthListener: () => {
    console.log('Initializing auth listener...');
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      console.log('Auth state changed:', firebaseUser?.uid || 'No user');
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

  // Initialize profile listener with proper error handling
  initProfileListener: (userId) => {
    console.log('Initializing profile listener for user:', userId);
    console.log('Data namespace:', dataNamespace);
    
    // Clean up existing listener first
    const { profileUnsubscribe } = get();
    if (profileUnsubscribe) {
      console.log('Cleaning up existing profile listener');
      profileUnsubscribe();
    }

    // Ensure we have the required data
    if (!dataNamespace) {
      console.error('No dataNamespace configured! Check REACT_APP_DATA_NAMESPACE');
      set({ 
        connectionError: 'Configuration error: missing dataNamespace',
        loggedInProfile: null
      });
      return;
    }

    const profilePath = `artifacts/${dataNamespace}/users/${userId}/profile/data`;
    console.log('Profile path:', profilePath);
    
    const profileRef = doc(db, 'artifacts', dataNamespace, 'users', userId, 'profile', 'data');
    
    // Profile listener with detailed error handling
    const unsubscribe = onSnapshot(profileRef, (docSnapshot) => {
      console.log('Profile snapshot received');
      console.log('Document exists:', docSnapshot.exists());
      
      try {
        if (docSnapshot.exists()) {
          const profileData = { userId, ...docSnapshot.data() };
          console.log('Profile data loaded:', {
            username: profileData.username,
            email: profileData.email,
            isAdmin: profileData.isAdmin
          });
          set({ 
            loggedInProfile: profileData,
            connectionError: null
          });
        } else {
          console.warn('Profile document does not exist at path:', profilePath);
          set({ 
            loggedInProfile: null,
            connectionError: 'Profile not found - document does not exist'
          });
        }
      } catch (error) {
        console.error('Error processing profile data:', error);
        set({ 
          connectionError: 'Profile data processing error: ' + error.message
        });
      }
    }, (error) => {
      console.error('Profile listener error:', error);
      console.error('Error code:', error.code);
      console.error('Error message:', error.message);
      
      // Handle different types of Firestore errors
      if (error.code === 'permission-denied') {
        console.error('Permission denied accessing profile for user:', userId);
        console.error('Profile path attempted:', profilePath);
        set({ 
          connectionError: 'Access denied to profile data. Check Firebase rules.',
          loggedInProfile: null
        });
      } else if (error.code === 'unavailable') {
        set({ 
          connectionError: 'Service temporarily unavailable'
        });
        // Retry connection after 5 seconds
        setTimeout(() => {
          console.log('Retrying profile listener...');
          get().initProfileListener(userId);
        }, 5000);
      } else if (error.code === 'not-found') {
        set({ 
          connectionError: 'Profile not found in database',
          loggedInProfile: null
        });
      } else {
        set({ 
          connectionError: `Connection error: ${error.code} - ${error.message}`,
          loggedInProfile: null
        });
      }
    });

    // Store unsubscribe function for cleanup
    set({ profileUnsubscribe: unsubscribe });
  },

  // Activity tracking for "last active" updates
  startActivityTracking: (userId) => {
    const updateActivity = async () => {
      const { lastActiveUpdate } = get();
      const now = Date.now();
      
      // Only update if it's been more than 5 minutes since last update
      if (lastActiveUpdate && (now - lastActiveUpdate) < 5 * 60 * 1000) {
        return;
      }

      try {
        const profileRef = doc(db, 'artifacts', dataNamespace, 'users', userId, 'profile', 'data');
        await updateDoc(profileRef, {
          lastActive: new Date()
        });
        set({ lastActiveUpdate: now });
      } catch (error) {
        // Silently fail for activity tracking to avoid spam
        console.debug('Activity tracking update failed:', error);
      }
    };

    // Update immediately, then every 5 minutes
    updateActivity();
    const interval = setInterval(updateActivity, 5 * 60 * 1000);
    
    set({ activityInterval: interval });
  },

  stopActivityTracking: () => {
    const { activityInterval } = get();
    if (activityInterval) {
      clearInterval(activityInterval);
      set({ activityInterval: null, lastActiveUpdate: null });
    }
  },

  // Retry connection for error recovery
  retryConnection: async () => {
    console.log('Retrying connection...');
    const { user } = get();
    if (user) {
      set({ connectionError: null });
      await get().initProfileListener(user.uid);
    }
  },

  // Clear errors
  clearError: () => {
    console.log('Clearing error...');
    set({ connectionError: null });
  },

  // Cleanup function
  cleanup: () => {
    console.log('Cleaning up userStore...');
    const { profileUnsubscribe, activityInterval } = get();
    
    if (profileUnsubscribe) {
      profileUnsubscribe();
      set({ profileUnsubscribe: null });
    }
    
    if (activityInterval) {
      clearInterval(activityInterval);
      set({ activityInterval: null });
    }
  }
}));