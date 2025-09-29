import { create } from 'zustand';
import { doc, getDoc } from 'firebase/firestore';
import { db, dataNamespace } from '../firebaseConfig';

export const useUserStore = create((set, get) => ({
  profile: null,
  isLoading: false, // Changed from true to false - only loading when actively fetching
  error: null,
  
  fetchUserProfile: async (uid) => {
    if (!uid) {
      return set({ profile: null, isLoading: false, error: null });
    }
    
    set({ isLoading: true, error: null });
    
    try {
      // Use the dataNamespace variable to build the correct path
      const userProfileRef = doc(db, `artifacts/${dataNamespace}/users/${uid}/profile/data`);
      const docSnap = await getDoc(userProfileRef);
      
      if (docSnap.exists()) {
        const profileData = { id: docSnap.id, ...docSnap.data() };
        set({ 
          profile: profileData, 
          isLoading: false, 
          error: null 
        });
      } else {
        console.warn(`Profile not found for user ${uid} at path: artifacts/${dataNamespace}/users/${uid}/profile/data`);
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
    set({ profile: null, isLoading: false, error: null });
  }
}));