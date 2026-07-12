import { create } from 'zustand';
import { doc, onSnapshot, updateDoc } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { db, functions, paths } from '../api';
import { AUTH_CONFIG } from '../config';
import { normalizeUnlockedClasses } from '../utils/classUnlocks';
import { getGameDay } from '../utils/dailyChallenges';
import {
  completeDailyChallenge as completeDailyChallengeFn,
  submitPrediction as submitPredictionFn,
  resolvePredictions as resolvePredictionsFn,
} from '../api/functions';
import { triggerXPFeedback } from '../components/xpFeedbackTrigger';
import toast from 'react-hot-toast';

// All corps classes for admin override
// Note: Uses 'worldClass'/'openClass' format which matches CORPS_CLASS_ORDER in utils/corps.ts
const ALL_CORPS_CLASSES = ['worldClass', 'openClass', 'aClass', 'soundSport'];

// Guard to prevent duplicate time-based unlock writes per session
let _timeUnlockProcessed = false;

/** A single daily-challenge completion entry within a day bucket. */
interface ChallengeCompletion {
  id: string;
  completed?: boolean;
  [key: string]: unknown;
}

/** A day's prediction bucket keyed under the game day. */
interface PredictionBucket {
  resolved?: boolean;
  picks?: Record<string, unknown>;
  [key: string]: unknown;
}

/** Engagement/streak block on the profile. */
export interface Engagement {
  loginStreak: number;
  lastLogin: unknown;
  totalLogins: number;
  recentActivity: unknown[];
  weeklyProgress: unknown[];
}

/**
 * The user profile document (`paths.userProfile(uid)`) as this store reads it.
 * The Firestore doc carries more fields than are listed here; the index
 * signature preserves them.
 */
export interface ProfileDoc {
  corps?: Record<string, unknown> | null;
  unlockedClasses?: string[];
  createdAt?: unknown;
  challenges?: Record<string, ChallengeCompletion[]>;
  predictions?: Record<string, PredictionBucket>;
  engagement?: Engagement;
  [key: string]: unknown;
}

interface ProfileState {
  // Core profile data from Firestore
  profile: ProfileDoc | null;
  corps: Record<string, unknown> | null;
  loading: boolean;
  error: string | null;

  // Admin status (checked on init)
  isAdmin: boolean;

  // Current user ID being tracked
  _currentUid: string | null;

  // Unsubscribe function for cleanup
  _unsubscribe: (() => void) | null;

  // Guard against overlapping resolvePredictions calls
  _resolvingPredictions: boolean;

  initProfileListener: (uid: string | null | undefined) => () => void;
  cleanup: () => void;
  updateProfile: (updates: Record<string, unknown>) => Promise<void>;
  completeDailyChallenge: (challengeId: string) => Promise<boolean>;
  submitPrediction: (
    questionId: string,
    pick: string,
    threshold: number | null,
    corpsClass: string,
    snapshotEvent: string | null
  ) => Promise<boolean>;
  resolvePredictions: () => Promise<void>;
  getEngagement: () => Engagement;
  getUnlockedClasses: () => string[];
  isClassUnlocked: (classId: string) => boolean;
}

/**
 * Global Profile Store
 *
 * This store maintains a SINGLE Firestore listener for the current user's profile,
 * preventing duplicate reads across components that need profile/corps data.
 *
 * Components should use this store via useProfileStore() instead of creating
 * their own onSnapshot listeners.
 *
 * Pattern matches seasonStore.ts for consistency.
 */
export const useProfileStore = create<ProfileState>()((set, get) => ({
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

  // Guard against overlapping resolvePredictions calls (the panel re-triggers
  // as results change; the callable is idempotent but the round trip is not
  // free).
  _resolvingPredictions: false,

  /**
   * Initialize the profile listener for a specific user
   * Should be called when user authenticates
   * Returns unsubscribe function for cleanup
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
          const data = docSnapshot.data() as ProfileDoc;
          set({
            profile: data,
            corps: data.corps || null,
            loading: false,
            error: null,
          });

          // Sync class unlocks once per session. Security rules make
          // unlockedClasses read-only for clients, so eligibility is computed
          // and written server-side by the syncClassUnlocks callable (it
          // covers the account-age backstop, any missed archival-time
          // seasons-completed grant, and legacy key canonicalization). The
          // listener picks up the resulting profile update. Cheap local
          // pre-check: skip the call when every class is already unlocked and
          // the stored keys are canonical.
          if (!_timeUnlockProcessed && !isAdmin && data.createdAt) {
            _timeUnlockProcessed = true;
            const { normalized, changed } = normalizeUnlockedClasses(
              data.unlockedClasses || ['soundSport']
            );
            const allUnlocked = ['aClass', 'openClass', 'worldClass'].every((c) =>
              normalized.includes(c)
            );
            if (changed || !allUnlocked) {
              httpsCallable(functions, 'syncClassUnlocks')().catch((err) => {
                console.error('Error syncing class unlocks:', err);
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
      if (data.weeklyArcBonus) {
        toast.success(`Weekly arc complete — +${data.weeklyArcBonus.coin} CC bonus!`);
        triggerXPFeedback(data.weeklyArcBonus.coin, 'coin', 'Weekly arc');
      }
      return true;
    } catch (error) {
      console.error('Error completing challenge:', error);
      return false;
    }
  },

  /**
   * Submit a daily prediction pick for the current game day.
   *
   * Delegates to the submitPrediction callable so the pick is saved to the
   * profile's server-only `predictions` ledger (client-writes are blocked by
   * firestore.rules). The onSnapshot listener syncs the store afterwards, so
   * no optimistic set is needed. Returns true when the pick was accepted.
   */
  submitPrediction: async (questionId, pick, threshold, corpsClass, snapshotEvent) => {
    const { _currentUid, profile } = get();
    if (!_currentUid || !profile) return false;

    // Skip the round trip when the day is closed or the question is answered.
    const bucket = profile.predictions?.[getGameDay()];
    if (bucket?.resolved || bucket?.picks?.[questionId]) {
      return false;
    }

    try {
      const { data } = await submitPredictionFn({
        questionId,
        pick,
        threshold: threshold ?? null,
        corpsClass,
        snapshotEvent: snapshotEvent ?? null,
      });
      return !!data?.success && !data.alreadyPicked && !data.locked;
    } catch (error) {
      console.error('Error submitting prediction:', error);
      return false;
    }
  },

  /**
   * Resolve outstanding daily predictions and collect any bonuses.
   *
   * Delegates to the resolvePredictions callable, which reads the
   * authoritative recaps to score each pending prediction and awards XP + a
   * CorpsCoin bonus for correct picks. Fire-and-forget: the profile listener
   * syncs the resolved state; here we just surface the XP float and a toast.
   */
  resolvePredictions: async () => {
    const { _currentUid, profile, _resolvingPredictions } = get();
    if (!_currentUid || !profile || _resolvingPredictions) return;

    set({ _resolvingPredictions: true });
    try {
      const { data } = await resolvePredictionsFn();
      if (data?.resolvedDays > 0) {
        const xpAwarded = data.xpAwarded ?? 0;
        const coinAwarded = data.coinAwarded ?? 0;
        if (xpAwarded > 0) {
          triggerXPFeedback(xpAwarded, 'xp');
        }
        const bits = [`${data.correct}/${data.total} predictions correct`];
        if (xpAwarded > 0) bits.push(`+${xpAwarded} XP`);
        if (coinAwarded > 0) bits.push(`+${coinAwarded} CC`);
        toast.success(bits.join(' · '));
      }
    } catch (error) {
      console.error('Error resolving predictions:', error);
    } finally {
      set({ _resolvingPredictions: false });
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
