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

// Get the "game day" string - resets at 2 AM EST (after scores are posted)
// This ensures challenges reset after daily score processing
export const getGameDay = () => {
  const now = new Date();

  // Convert to EST (UTC-5) or EDT (UTC-4)
  const estOffset = -5 * 60; // EST is UTC-5
  const edtOffset = -4 * 60; // EDT is UTC-4

  // Determine if we're in EDT (roughly March-November)
  const jan = new Date(now.getFullYear(), 0, 1);
  const jul = new Date(now.getFullYear(), 6, 1);
  const isDST = now.getTimezoneOffset() < Math.max(jan.getTimezoneOffset(), jul.getTimezoneOffset());

  const offset = isDST ? edtOffset : estOffset;
  const localOffset = now.getTimezoneOffset();
  const estTime = new Date(now.getTime() + (localOffset - offset) * 60 * 1000);

  // If before 2 AM EST, use previous day
  if (estTime.getHours() < 2) {
    estTime.setDate(estTime.getDate() - 1);
  }

  return estTime.toDateString();
};

/**
 * Prune old challenge entries to prevent unbounded document growth
 * Keeps only the last 30 days of challenge history
 * @param {Object} challenges - Current challenges object keyed by date string
 * @returns {Object} - Pruned challenges object
 */
const pruneOldChallenges = (challenges) => {
  if (!challenges || typeof challenges !== 'object') return challenges;

  const entries = Object.entries(challenges);
  if (entries.length <= 30) return challenges;

  // Sort by date (most recent first) and keep only last 30
  const sortedEntries = entries
    .map(([dateStr, data]) => ({ dateStr, data, date: new Date(dateStr) }))
    .sort((a, b) => b.date - a.date)
    .slice(0, 30);

  return Object.fromEntries(sortedEntries.map(({ dateStr, data }) => [dateStr, data]));
};

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
            // Profile doesn't exist, create a basic one with all required fields
            const newProfile = {
              uid: user.uid,
              username: null,
              displayName: user.displayName || 'Director',
              createdAt: new Date(),
              // XP & Progression
              xp: 0,
              xpLevel: 1,
              userTitle: 'Rookie',
              // Currency
              corpsCoin: 1000,
              // Unlocks
              unlockedClasses: ['soundSport'],
              // Corps data
              corps: {},
              // Stats
              stats: {
                seasonsPlayed: 0,
                championships: 0,
                topTenFinishes: 0,
                leagueWins: 0,
              },
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
        username: username,
        displayName: username,
        createdAt: new Date(),
        // XP & Progression
        xp: 0,
        xpLevel: 1,
        userTitle: 'Rookie',
        // Currency
        corpsCoin: 1000,
        // Unlocks
        unlockedClasses: ['soundSport'],
        // Corps data
        corps: {},
        // Stats
        stats: {
          seasonsPlayed: 0,
          championships: 0,
          topTenFinishes: 0,
          leagueWins: 0,
        },
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

  // Complete a daily challenge
  completeDailyChallenge: async (challengeId) => {
    const { user, loggedInProfile } = get();

    if (!user || !loggedInProfile) {
      return false;
    }

    try {
      const today = getGameDay(); // Uses 2 AM EST reset time
      const currentChallenges = loggedInProfile.challenges || {};
      let todayChallenges = currentChallenges[today] || [];

      // Challenge definitions for creating if not exists
      const challengeDefinitions = {
        check_leaderboard: {
          id: 'check_leaderboard',
          title: 'Scout the Competition',
          description: 'Visit the leaderboard page',
          progress: 1,
          target: 1,
          reward: '25 XP',
          icon: 'trophy',
          completed: true
        },
        maintain_equipment: {
          id: 'maintain_equipment',
          title: 'Equipment Care',
          description: 'Check your equipment status',
          progress: 1,
          target: 1,
          reward: '30 XP',
          icon: 'wrench',
          completed: true
        }
      };

      // Check if challenge exists
      const existingChallenge = todayChallenges.find(c => c.id === challengeId);

      let updatedChallenges;
      let challengeTitle;
      let challengeReward;

      if (existingChallenge) {
        // Challenge exists - update it if not already completed
        if (existingChallenge.completed) {
          return false; // Already completed
        }

        updatedChallenges = todayChallenges.map(challenge => {
          if (challenge.id === challengeId) {
            return { ...challenge, progress: challenge.target, completed: true };
          }
          return challenge;
        });

        challengeTitle = existingChallenge.title;
        challengeReward = existingChallenge.reward;
      } else if (challengeDefinitions[challengeId]) {
        // Challenge doesn't exist but we have a definition - create it
        const newChallenge = challengeDefinitions[challengeId];
        updatedChallenges = [...todayChallenges, newChallenge];
        challengeTitle = newChallenge.title;
        challengeReward = newChallenge.reward;
      } else {
        // Unknown challenge
        return false;
      }

      const profileRef = doc(
        db,
        'artifacts',
        dataNamespace,
        'users',
        user.uid,
        'profile',
        'data'
      );

      // Prune old entries to prevent unbounded growth (keep last 30 days)
      const newChallengesData = pruneOldChallenges({
        ...currentChallenges,
        [today]: updatedChallenges
      });

      await updateDoc(profileRef, { challenges: newChallengesData });

      set({
        loggedInProfile: {
          ...loggedInProfile,
          challenges: newChallengesData
        }
      });

      // Show toast with reward if available (consistent with rehearsal toast)
      const rewardText = challengeReward ? ` +${challengeReward}` : '';
      toast.success(`${challengeTitle} complete!${rewardText}`);
      return true;
    } catch (error) {
      console.error('Error completing challenge:', error);
      return false;
    }
  },

  // Save daily challenges to profile
  saveDailyChallenges: async (challenges) => {
    const { user, loggedInProfile } = get();

    if (!user || !loggedInProfile) {
      return false;
    }

    try {
      const today = getGameDay(); // Uses 2 AM EST reset time
      const currentChallenges = loggedInProfile.challenges || {};

      // Don't overwrite if we already have challenges for today
      if (currentChallenges[today] && currentChallenges[today].length > 0) {
        return false;
      }

      const profileRef = doc(
        db,
        'artifacts',
        dataNamespace,
        'users',
        user.uid,
        'profile',
        'data'
      );

      // Prune old entries to prevent unbounded growth (keep last 30 days)
      const newChallengesData = pruneOldChallenges({
        ...currentChallenges,
        [today]: challenges
      });

      await updateDoc(profileRef, { challenges: newChallengesData });

      set({
        loggedInProfile: {
          ...loggedInProfile,
          challenges: newChallengesData
        }
      });

      return true;
    } catch (error) {
      console.error('Error saving challenges:', error);
      return false;
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