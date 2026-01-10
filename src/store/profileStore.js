import { create } from 'zustand';
import { db } from '../firebase';
import { doc, onSnapshot, setDoc, updateDoc } from 'firebase/firestore';
import { AUTH_CONFIG } from '../config';

// All corps classes for admin override
// Note: Uses 'worldClass'/'openClass' format which matches CORPS_CLASS_ORDER in utils/corps.ts
const ALL_CORPS_CLASSES = ['worldClass', 'openClass', 'aClass', 'soundSport'];

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
   * @param {Object} user - Firebase user object (for initial profile creation)
   */
  initProfileListener: (uid, user) => {
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
        } else {
          // Create initial profile for new users with all required fields
          const initialProfile = {
            uid: uid,
            displayName: user?.displayName || 'Director',
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
            achievements: [],
          };

          setDoc(profileRef, initialProfile)
            .then(() => {
              set({
                profile: initialProfile,
                corps: null,
                loading: false,
                error: null,
              });
            })
            .catch((err) => {
              console.error('Error creating initial profile:', err);
              set({
                loading: false,
                error: err.message,
              });
            });
        }
      },
      (err) => {
        console.error('Profile subscription error:', err);
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
      // Revert on error (the listener will sync correct data)
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
