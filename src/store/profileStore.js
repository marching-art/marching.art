import { create } from 'zustand';
import { db, functions, paths } from '../api';
import { doc, onSnapshot, updateDoc } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { AUTH_CONFIG } from '../config';
import { mergeTimeUnlockedClasses } from '../utils/classUnlockTime';
import { getGameDay } from '../utils/dailyChallenges';
import { completeDailyChallenge as completeDailyChallengeFn } from '../api/functions';
import { triggerXPFeedback } from '../components/XPFeedback';
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

    const profileRef = doc(db, paths.userProfile(uid));

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
      const profileRef = doc(db, paths.userProfile(_currentUid));
      await updateDoc(profileRef, updates);
    } catch (err) {
      console.error('Error updating profile:', err);
      toast.error('Failed to save changes. Please try again.');
      // Revert on error (the listener will sync correct data)
    }
  },

  /**
   * Complete a daily challenge for the current game day.
   *
   * Delegates to the completeDailyChallenge callable so XP is awarded
   * server-side (the `challenges` field is server-only in firestore.rules).
   * The onSnapshot listener syncs the store afterwards, so no optimistic set
   * is needed. Returns true when a challenge was newly completed.
   *
   * @param {string} challengeId - Challenge key (see CHALLENGE_POOL)
   */
  completeDailyChallenge: async (challengeId) => {
    const { _currentUid, profile } = get();
    if (!_currentUid || !profile) return false;

    // Skip the round trip when today's bucket already shows completion
    const todayBucket = profile.challenges?.[getGameDay()] || [];
    if (todayBucket.some((c) => c.id === challengeId && c.completed)) {
      return false;
    }

    try {
      const { data } = await completeDailyChallengeFn({ challengeId });
      if (!data?.success || data.alreadyCompleted || !data.xpAwarded) {
        return false;
      }

      const label = data.challenge?.label || 'Challenge';
      toast.success(`${label} complete! +${data.xpAwarded} XP`);
      triggerXPFeedback(data.xpAwarded, 'xp');
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
    return (
      profile?.engagement || {
        loginStreak: 0,
        lastLogin: null,
        totalLogins: 0,
        recentActivity: [],
        weeklyProgress: [],
      }
    );
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
