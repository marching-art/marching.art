import { create } from 'zustand';
import { doc, onSnapshot } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { adminHelpers, db, functions, paths } from '../api';
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
// The last profile payload handed to the store, serialized. With
// includeMetadataChanges on, the listener also fires for cache→server
// transitions whose DATA is identical; publishing a new `profile` object for
// those re-renders every consumer and re-fires every profile-keyed effect
// (daily login, recap modals) for nothing.
let _lastProfileJson: string | null = null;

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
  /**
   * Declared explicitly despite the index signature below: every consumer
   * treats it as a string, and under a bare `[key: string]: unknown` it read
   * as `unknown` and could not be passed to anything that wanted a uid.
   */
  uid?: string;
  corps?: Record<string, unknown> | null;
  /** Corps Identity Shop state (server-written): owned ids + equipped slots. */
  cosmetics?: { owned?: string[]; equipped?: Record<string, string | null> } | null;
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

    // Admin status comes solely from the server-set `admin` custom claim on
    // the auth token; resolve it asynchronously. The uid guard prevents a
    // stale result from landing after a user switch.
    set({ loading: true, _currentUid: uid, isAdmin: false });
    adminHelpers
      .isAdmin()
      .then((isAdmin) => {
        if (get()._currentUid === uid) set({ isAdmin });
      })
      .catch(() => {
        // Leave isAdmin false — admin-only UI simply stays hidden.
      });

    const profileRef = doc(db, paths.userProfile(uid));

    // Reset time-unlock guard when initializing a new listener
    _timeUnlockProcessed = false;
    _lastProfileJson = null;

    const unsubscribe = onSnapshot(
      profileRef,
      // includeMetadataChanges so we receive the fromCache:true -> false
      // transition even when the doc's *data* is unchanged. That transition is
      // the only signal that a "no such profile" result came from the server
      // rather than the local cache, and the not-exists branch below depends on
      // it (see the comment there).
      { includeMetadataChanges: true },
      (docSnapshot) => {
        if (docSnapshot.exists()) {
          const data = docSnapshot.data() as ProfileDoc;
          const serialized = JSON.stringify(data);
          if (serialized !== _lastProfileJson || get().profile === null) {
            _lastProfileJson = serialized;
            set({
              profile: data,
              corps: data.corps || null,
              loading: false,
              error: null,
            });
          }

          // Sync class unlocks once per session. Security rules make
          // unlockedClasses read-only for clients, so eligibility is computed
          // and written server-side by the syncClassUnlocks callable (it
          // covers the account-age backstop, any missed archival-time
          // seasons-completed grant, and legacy key canonicalization). The
          // listener picks up the resulting profile update. Cheap local
          // pre-check: skip the call when every class is already unlocked and
          // the stored keys are canonical. (isAdmin resolves asynchronously
          // from the auth claim; if it hasn't landed yet this may run for an
          // admin too, which is harmless — the callable is idempotent and
          // server-authoritative.)
          if (!_timeUnlockProcessed && !get().isAdmin && data.createdAt) {
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
          // The profile doc does not exist in this snapshot. Two very different
          // situations produce that, and telling them apart is critical:
          //
          //   1. A genuinely new user with no profile yet. This is server
          //      truth: the routing guard should send them to onboarding.
          //   2. An established user whose profile simply is not in THIS
          //      device's local cache (fresh install, cleared storage, private
          //      mode, a new phone). On mobile the Firestore transport
          //      frequently stalls, so onSnapshot serves an initial
          //      cache-sourced snapshot in which the uncached doc reports
          //      exists() === false with metadata.fromCache === true. This is
          //      NOT a real "no profile" — the server just has not answered
          //      yet.
          //
          // Concluding "no profile" from case 2 is what bounced established
          // mobile users into onboarding. So only treat a not-exists snapshot
          // as authoritative when it came from the server (fromCache === false).
          // While it is still cache-sourced, keep loading (the ProtectedRoute
          // guard holds on the loading screen) and wait for the server snapshot
          // — which arrives thanks to includeMetadataChanges above.
          //
          // Do NOT auto-create a profile here either way — profile creation is
          // owned by onboarding's `createUserProfile` callable, which atomically
          // reserves the username; a minimal doc written here would race it.
          _lastProfileJson = null;
          if (docSnapshot.metadata.fromCache) {
            set({ loading: true, error: null });
          } else {
            set({
              profile: null,
              corps: null,
              loading: false,
              error: null,
            });
          }
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
        const tiers = data.weeklyArcBonus.tiers;
        const label = tiers && tiers.length ? `${tiers.join(' & ')}-day weekly arc` : 'Weekly arc';
        toast.success(`${label} — +${data.weeklyArcBonus.coin} CC bonus!`);
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
