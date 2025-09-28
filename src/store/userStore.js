import { create } from 'zustand';
import { doc, getDoc } from 'firebase/firestore';
import { db, dataNamespace } from 'firebaseConfig'; // Import dataNamespace

export const useUserStore = create((set) => ({
  profile: null,
  isLoading: true,
  fetchUserProfile: async (uid) => {
    if (!uid) {
      return set({ profile: null, isLoading: false });
    }
    set({ isLoading: true });
    try {
      // Use the dataNamespace variable to build the correct path
      const userProfileRef = doc(db, `artifacts/${dataNamespace}/users/${uid}/profile/data`);
      const docSnap = await getDoc(userProfileRef);
      if (docSnap.exists()) {
        set({ profile: { id: docSnap.id, ...docSnap.data() }, isLoading: false });
      } else {
        console.warn(`Profile not found for user ${uid} at path: artifacts/${dataNamespace}/users/${uid}/profile/data`);
        set({ profile: null, isLoading: false });
      }
    } catch (error) {
      console.error("Error fetching user profile:", error);
      set({ profile: null, isLoading: false });
    }
  },
}));