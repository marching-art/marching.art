import { create } from 'zustand';
import { auth, db, dataNamespace } from '../firebase';
import { 
  onAuthStateChanged, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword,
  signOut,
  sendPasswordResetEmail,
  updateProfile
} from 'firebase/auth';
import { 
  doc, 
  getDoc, 
  setDoc, 
  updateDoc,
  collection,
  query,
  where,
  getDocs
} from 'firebase/firestore';
import toast from 'react-hot-toast';

export const useUserStore = create((set, get) => ({
  // State
  user: null,
  loggedInProfile: null,
  isLoadingAuth: true,
  error: null,
  
  // Auth state management
  setUser: (user) => set({ user }),
  setLoggedInProfile: (profile) => set({ loggedInProfile: profile }),
  setIsLoadingAuth: (loading) => set({ isLoadingAuth: loading }),
  setError: (error) => set({ error }),

  // Initialize auth listener
  initAuthListener: () => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      set({ isLoadingAuth: true });
      
      if (user) {
        set({ user });
        
        // Fetch user profile from Firestore
        try {
          const profileRef = doc(
            db, 
            'artifacts', 
            dataNamespace, 
            'users', 
            user.uid, 
            'profile', 
            'data'
          );
          
          const profileSnap = await getDoc(profileRef);
          
          if (profileSnap.exists()) {
            const profileData = {
              uid: user.uid,
              email: user.email,
              ...profileSnap.data()
            };
            set({ loggedInProfile: profileData });
          } else {
            // Profile doesn't exist, create a basic one
            const newProfile = {
              uid: user.uid,
              email: user.email,
              username: null,
              displayName: user.displayName || null,
              createdAt: new Date(),
              trophies: 0,
              totalScore: 0,
              seasonsPlayed: 0,
              currentCorps: null,
              userTitle: 'Rookie'
            };
            
            await setDoc(profileRef, newProfile);
            set({ loggedInProfile: newProfile });
          }
        } catch (error) {
          console.error('Error fetching user profile:', error);
          set({ error: error.message });
          toast.error('Failed to load user profile');
        }
      } else {
        set({ user: null, loggedInProfile: null });
      }
      
      set({ isLoadingAuth: false });
    });

    return unsubscribe;
  },

  // Sign in
  signIn: async (email, password) => {
    set({ isLoadingAuth: true, error: null });
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      toast.success('Welcome back!');
      return userCredential.user;
    } catch (error) {
      set({ error: error.message });
      toast.error(error.message);
      throw error;
    } finally {
      set({ isLoadingAuth: false });
    }
  },

  // Sign up
  signUp: async (email, password, username) => {
    set({ isLoadingAuth: true, error: null });
    try {
      // Check if username is available
      const usernameQuery = query(
        collection(db, 'artifacts', dataNamespace, 'usernames'),
        where('username', '==', username.toLowerCase())
      );
      const usernameSnapshot = await getDocs(usernameQuery);
      
      if (!usernameSnapshot.empty) {
        throw new Error('Username already taken');
      }

      // Create user account
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;

      // Update display name
      await updateProfile(user, { displayName: username });

      // Create user profile
      const profileRef = doc(
        db, 
        'artifacts', 
        dataNamespace, 
        'users', 
        user.uid, 
        'profile', 
        'data'
      );
      
      const newProfile = {
        uid: user.uid,
        email: user.email,
        username: username,
        displayName: username,
        createdAt: new Date(),
        trophies: 0,
        totalScore: 0,
        seasonsPlayed: 0,
        currentCorps: null,
        userTitle: 'Rookie'
      };
      
      await setDoc(profileRef, newProfile);

      // Reserve username
      const usernameRef = doc(
        db,
        'artifacts',
        dataNamespace,
        'usernames',
        username.toLowerCase()
      );
      await setDoc(usernameRef, {
        uid: user.uid,
        username: username.toLowerCase(),
        createdAt: new Date()
      });

      set({ loggedInProfile: newProfile });
      toast.success('Account created successfully!');
      return user;
    } catch (error) {
      set({ error: error.message });
      toast.error(error.message);
      throw error;
    } finally {
      set({ isLoadingAuth: false });
    }
  },

  // Sign out
  signOutUser: async () => {
    set({ isLoadingAuth: true, error: null });
    try {
      await signOut(auth);
      set({ user: null, loggedInProfile: null });
      toast.success('Signed out successfully');
    } catch (error) {
      set({ error: error.message });
      toast.error('Failed to sign out');
      throw error;
    } finally {
      set({ isLoadingAuth: false });
    }
  },

  // Reset password
  resetPassword: async (email) => {
    set({ isLoadingAuth: true, error: null });
    try {
      await sendPasswordResetEmail(auth, email);
      toast.success('Password reset email sent!');
    } catch (error) {
      set({ error: error.message });
      toast.error(error.message);
      throw error;
    } finally {
      set({ isLoadingAuth: false });
    }
  },

  // Update profile
  updateUserProfile: async (updates) => {
    const { user, loggedInProfile } = get();
    
    if (!user || !loggedInProfile) {
      toast.error('No user logged in');
      return;
    }

    set({ isLoadingAuth: true, error: null });
    try {
      const profileRef = doc(
        db, 
        'artifacts', 
        dataNamespace, 
        'users', 
        user.uid, 
        'profile', 
        'data'
      );
      
      await updateDoc(profileRef, updates);
      
      const updatedProfile = {
        ...loggedInProfile,
        ...updates
      };
      
      set({ loggedInProfile: updatedProfile });
      toast.success('Profile updated successfully!');
      return updatedProfile;
    } catch (error) {
      set({ error: error.message });
      toast.error('Failed to update profile');
      throw error;
    } finally {
      set({ isLoadingAuth: false });
    }
  }
}));

export default useUserStore;