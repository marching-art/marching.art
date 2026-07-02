import { create } from 'zustand';
import { db, functions } from '../firebase';
import { doc, onSnapshot, updateDoc } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { AUTH_CONFIG } from '../config';
import { mergeTimeUnlockedClasses } from '../utils/classUnlockTime';
import { getGameDay, pruneOldChallenges, CHALLENGE_DEFINITIONS } from '../utils/dailyChallenges';
import toast from 'react-hot-toast';

// All corps classes for admin override
// Note: Uses 'worldClass'/'openClass' format which matches CORPS_CLASS_ORDER in utils/corps.ts
const ALL_CORPS_CLASSES = ['worldClass', 'openClass', 'aClass', 'soundSport'];

// Guard to prevent duplicate time-based unlock writes per session
let _timeUnlockProcessed = false;

/**
 * Global Profile Store
 *
 * This store maintains a SINGLE Firestore listener for the current user's profile,
 * preventing duplicate reads across components that need profile/corps data.
 *
 * Components should use this store via useProfileStore() instead of creating
 * their own onSnapshot listeners.
 *
 * Pattern matches seasonStore.js for consistency.
 */
export const useProfileStore = create((set, get) => ({
  // Core profile data from Firestore
  profile: null,
  corps: null,
  loading: true,
  error: null,

  // Admin status (checked on init)
  isAdmin: false,

  // Current user ID being tracked
  _currentUid: null,

  // Unsubscribe function for cleanup
  _unsubscribe: null,

  /**
   * Initialize the profile listener for a specific user
   * Should be called when user authenticates
   * Returns unsubscribe function for cleanup
   *
   * @param {string} uid - User ID to track
   */
  initProfileListener: (uid) => {
    const { _unsubscribe, _currentUid } = get();

    // If already listening to this user, return existing unsubscribe
    if (_currentUid === uid && _unsubscribe) {
      return _unsubscribe;
    }

    // Clean up existing listener if switching users
    if (_unsubscribe) {
      _unsubscribe();
    }

    if (!uid) {
      set({
        profile: null,
        corps: null,
        loading: false,
        error: null,
        isAdmin: false,
        _currentUid: null,
        _unsubscribe: null,
      });
      return () => {};
    }

    // Check admin status synchronously from config
    const isAdmin = AUTH_CONFIG.isAdminUid(uid);

    set({ loading: true, _currentUid: uid, isAdmin });

    const profileRef = doc(db, 'artifacts/marching-art/users', uid, 'profile/data');

    // Reset time-unlock guard when initializing a new listener
    _timeUnlockProcessed = false;

    const unsubscribe = onSnapshot(
      profileRef,
      (docSnapshot) => {
        if (docSnapshot.exists()) {
          const data = docSnapshot.data();
          set({
            profile: data,
            corps: data.corps || null,
            loading: false,
            error: null,
          });

          // Check for time-based class unlocks (once per session).
          // The local check is only a cheap eligibility test — security rules
          // make unlockedClasses read-only for clients, so the actual unlock
          // is computed and written server-side by the syncClassUnlocks
          // callable. The listener picks up the resulting profile update.
          if (!_timeUnlockProcessed && !isAdmin && data.createdAt) {
            _timeUnlockProcessed = true;
            const currentUnlocked = data.unlockedClasses || ['soundSport'];
            if (mergeTimeUnlockedClasses(currentUnlocked, data.createdAt)) {
              httpsCallable(functions, 'syncClassUnlocks')().catch((err) => {
                console.error('Error syncing time-based class unlocks:', err);
              });
            }
          }
        } else {
          // No profile yet. Do NOT auto-create one here — profile creation is
          // owned by the onboarding flow via the `createUserProfile` callable,
          // which atomically reserves the username. Auto-creating a minimal,
          // username-less doc here used to race that flow and leave users with
          // broken profiles. The routing guard sends profile-less users to
          // onboarding.
          set({
            profile: null,
            corps: null,
            loading: false,
            error: null,
          });
        }
      },
      (err) => {
        console.error('Profile subscription error:', err);
        toast.error('Unable to load your profile. Please refresh the page.');
        set({
          loading: false,
          error: err.message,
        });
      }
    );

    set({ _unsubscribe: unsubscribe });
    return unsubscribe;
  },

  /**
   * Cleanup the listener - call on user sign out or app unmount
   */
  cleanup: () => {
    const { _unsubscribe } = get();
    if (_unsubscribe) {
      _unsubscribe();
    }
    set({
      profile: null,
      corps: null,
      loading: false,
      error: null,
      isAdmin: false,
      _currentUid: null,
      _unsubscribe: null,
    });
  },

  /**
   * Update profile data (optimistic update + Firestore write)
   * @param {Object} updates - Fields to update
   */
  updateProfile: async (updates) => {
    const { _currentUid, profile } = get();
    if (!_currentUid) return;

    // Optimistic update
    set({
      profile: { ...profile, ...updates },
    });

    try {
      const profileRef = doc(db, 'artifacts/marching-art/users', _currentUid, 'profile/data');
      await updateDoc(profileRef, updates);
    } catch (err) {
      console.error('Error updating profile:', err);
      toast.error('Failed to save changes. Please try again.');
      // Revert on error (the listener will sync correct data)
    }
  },

  /**
   * Mark a daily challenge as complete for the current game day.
   *
   * Writes only the client-owned `challenges` field; the onSnapshot listener
   * syncs the store afterwards, so no optimistic set is needed. Returns true
   * when a challenge was newly completed, false otherwise.
   *
   * @param {string} challengeId - Challenge key (see CHALLENGE_DEFINITIONS)
   */
  completeDailyChallenge: async (challengeId) => {
    const { _currentUid, profile } = get();
    if (!_currentUid || !profile) return false;

    try {
      const today = getGameDay(); // 2 AM ET reset, matches score processing
      const currentChallenges = profile.challenges || {};
      const todayChallenges = currentChallenges[today] || [];

      const existingChallenge = todayChallenges.find((c) => c.id === challengeId);

      let updatedChallenges;
      let challengeTitle;
      let challengeReward;

      if (existingChallenge) {
        if (existingChallenge.completed) {
          return false; // Already completed
        }
        updatedChallenges = todayChallenges.map((challenge) =>
          challenge.id === challengeId
            ? { ...challenge, progress: challenge.target, completed: true }
            : challenge
        );
        challengeTitle = existingChallenge.title;
        challengeReward = existingChallenge.reward;
      } else if (CHALLENGE_DEFINITIONS[challengeId]) {
        // Challenge wasn't seeded for today yet - create it completed
        const newChallenge = CHALLENGE_DEFINITIONS[challengeId];
        updatedChallenges = [...todayChallenges, newChallenge];
        challengeTitle = newChallenge.title;
        challengeReward = newChallenge.reward;
      } else {
        return false; // Unknown challenge
      }

      // Prune old entries to prevent unbounded document growth (keep last 30 days)
      const newChallengesData = pruneOldChallenges({
        ...currentChallenges,
        [today]: updatedChallenges,
      });

      const profileRef = doc(db, 'artifacts/marching-art/users', _currentUid, 'profile/data');
      await updateDoc(profileRef, { challenges: newChallengesData });

      const rewardText = challengeReward ? ` +${challengeReward}` : '';
      toast.success(`${challengeTitle} complete!${rewardText}`);
      return true;
    } catch (error) {
      console.error('Error completing challenge:', error);
      return false;
    }
  },

  /**
   * Get engagement data from profile
   */
  getEngagement: () => {
    const { profile } = get();
    return profile?.engagement || {
      loginStreak: 0,
      lastLogin: null,
      totalLogins: 0,
      recentActivity: [],
      weeklyProgress: [],
    };
  },

  /**
   * Get unlocked classes (admins have all classes unlocked)
   */
  getUnlockedClasses: () => {
    const { profile, isAdmin } = get();
    if (isAdmin) return ALL_CORPS_CLASSES;
    return profile?.unlockedClasses || ['soundSport'];
  },

  /**
   * Check if a class is unlocked (admins have all classes unlocked)
   */
  isClassUnlocked: (classId) => {
    const { profile, isAdmin } = get();
    if (isAdmin) return true;
    return (profile?.unlockedClasses || ['soundSport']).includes(classId);
  },
}));

export default useProfileStore;
