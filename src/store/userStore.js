import { create } from 'zustand';
import { doc, getDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { db, dataNamespace } from '../firebaseConfig';

export const useUserStore = create((set, get) => ({
  profile: null,
  corpsList: [], // NEW: Array of all user's corps
  activeCorpsId: null, // NEW: Currently selected corps
  isLoading: false,
  error: null,
  lastFetchedUid: null,
  
  fetchUserProfile: async (uid) => {
    if (!uid) {
      set({ profile: null, corpsList: [], activeCorpsId: null, isLoading: false, error: null, lastFetchedUid: null });
      return;
    }
    
    const state = get();
    if (state.isLoading && state.lastFetchedUid === uid) {
      console.log('Already fetching profile for', uid);
      return;
    }
    
    if (state.profile && state.profile.id === uid && !state.error) {
      console.log('Profile already loaded for', uid);
      return;
    }
    
    set({ isLoading: true, error: null, lastFetchedUid: uid });
    
    try {
      // Fetch profile
      const userProfileRef = doc(db, `artifacts/${dataNamespace}/users/${uid}/profile/data`);
      const docSnap = await getDoc(userProfileRef);
      
      if (!docSnap.exists()) {
        console.warn(`Profile not found for user ${uid}`);
        set({ 
          profile: null, 
          corpsList: [],
          activeCorpsId: null,
          isLoading: false, 
          error: 'Profile not found' 
        });
        return;
      }

      const profileData = { id: docSnap.id, ...docSnap.data() };
      
      // Fetch all corps for this user
      const corpsRef = collection(db, `artifacts/${dataNamespace}/users/${uid}/corps`);
      const corpsQuery = query(corpsRef, where('isActive', '==', true));
      const corpsSnapshot = await getDocs(corpsQuery);
      
      const corpsList = [];
      corpsSnapshot.forEach((doc) => {
        corpsList.push({ id: doc.id, ...doc.data() });
      });

      // Sort corps by class hierarchy
      const classOrder = ['World Class', 'Open Class', 'A Class', 'SoundSport'];
      corpsList.sort((a, b) => classOrder.indexOf(a.corpsClass) - classOrder.indexOf(b.corpsClass));

      // Set active corps (first one or user's last selected)
      const activeCorpsId = corpsList.length > 0 ? 
        (profileData.lastActiveCorps || corpsList[0].id) : null;
      
      set({ 
        profile: profileData, 
        corpsList: corpsList,
        activeCorpsId: activeCorpsId,
        isLoading: false, 
        error: null 
      });
      
      console.log('Profile and corps loaded successfully for', uid, '- Corps count:', corpsList.length);
    } catch (error) {
      console.error("Error fetching user profile:", error);
      set({ 
        profile: null, 
        corpsList: [],
        activeCorpsId: null,
        isLoading: false, 
        error: error.message 
      });
    }
  },
  
  setActiveCorps: (corpsId) => {
    set({ activeCorpsId: corpsId });
  },
  
  getActiveCorps: () => {
    const state = get();
    return state.corpsList.find(c => c.id === state.activeCorpsId) || null;
  },
  
  addCorps: (newCorps) => {
    const state = get();
    set({ 
      corpsList: [...state.corpsList, newCorps],
      activeCorpsId: newCorps.id
    });
  },
  
  updateCorpsInList: (corpsId, updates) => {
    const state = get();
    const updatedList = state.corpsList.map(corps => 
      corps.id === corpsId ? { ...corps, ...updates } : corps
    );
    set({ corpsList: updatedList });
  },
  
  removeCorps: (corpsId) => {
    const state = get();
    const updatedList = state.corpsList.filter(c => c.id !== corpsId);
    const newActiveId = updatedList.length > 0 ? updatedList[0].id : null;
    set({ 
      corpsList: updatedList,
      activeCorpsId: state.activeCorpsId === corpsId ? newActiveId : state.activeCorpsId
    });
  },
  
  clearProfile: () => {
    set({ profile: null, corpsList: [], activeCorpsId: null, isLoading: false, error: null, lastFetchedUid: null });
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