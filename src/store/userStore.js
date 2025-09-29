import { create } from 'zustand';
import { doc, getDoc } from 'firebase/firestore';
import { db, dataNamespace } from '../firebaseConfig';

export const useUserStore = create((set, get) => ({
  profile: null,
  isLoading: false,
  error: null,
  lastFetchedUid: null, // Track which user we last fetched
  
  fetchUserProfile: async (uid) => {
    if (!uid) {
      set({ profile: null, isLoading: false, error: null, lastFetchedUid: null });
      return;
    }
    
    // Prevent duplicate fetches
    const state = get();
    if (state.isLoading && state.lastFetchedUid === uid) {
      console.log('Already fetching profile for', uid);
      return;
    }
    
    // If we already have this user's profile, don't refetch
    if (state.profile && state.profile.id === uid && !state.error) {
      console.log('Profile already loaded for', uid);
      return;
    }
    
    set({ isLoading: true, error: null, lastFetchedUid: uid });
    
    try {
      const userProfileRef = doc(db, `artifacts/${dataNamespace}/users/${uid}/profile/data`);
      const docSnap = await getDoc(userProfileRef);
      
      if (docSnap.exists()) {
        const profileData = { id: docSnap.id, ...docSnap.data() };
        set({ 
          profile: profileData, 
          isLoading: false, 
          error: null 
        });
        console.log('Profile loaded successfully for', uid);
      } else {
        console.warn(`Profile not found for user ${uid}`);
        set({ 
          profile: null, 
          isLoading: false, 
          error: 'Profile not found' 
        });
      }
    } catch (error) {
      console.error("Error fetching user profile:", error);
      set({ 
        profile: null, 
        isLoading: false, 
        error: error.message 
      });
    }
  },
  
  clearProfile: () => {
    set({ profile: null, isLoading: false, error: null, lastFetchedUid: null });
  },
  
  updateProfile: (updates) => {
    const state = get();
    if (state.profile) {
      set({ 
        profile: { ...state.profile, ...updates } 
      });
    }
  }
}));