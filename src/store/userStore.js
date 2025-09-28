import { create } from 'zustand';
import { doc, getDoc } from 'firebase/firestore';
import { db } from 'firebase';

export const useUserStore = create((set) => ({
  profile: null,
  isLoading: true,
  fetchUserProfile: async (uid) => {
    if (!uid) {
      return set({ profile: null, isLoading: false });
    }
    set({ isLoading: true });
    try {
      // The path must match your Firestore structure for user profiles.
      // From your rules file, it looks like: /artifacts/{namespace}/users/{userId}/profile/data
      // We will use a placeholder namespace for now.
      const userProfileRef = doc(db, `artifacts/v1/users/${uid}/profile/data`);
      const docSnap = await getDoc(userProfileRef);
      if (docSnap.exists()) {
        set({ profile: { id: docSnap.id, ...docSnap.data() }, isLoading: false });
      } else {
        set({ profile: null, isLoading: false });
      }
    } catch (error) {
      console.error("Error fetching user profile:", error);
      set({ profile: null, isLoading: false });
    }
  },
}));