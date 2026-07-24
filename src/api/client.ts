// Firebase client configuration and base utilities
// This module initializes Firebase and provides the base client instances

import { initializeApp, FirebaseApp } from 'firebase/app';
import {
  getAuth,
  Auth,
  connectAuthEmulator,
  signInWithEmailAndPassword,
  signInAnonymously,
  signInWithCustomToken,
  createUserWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  User as FirebaseUser,
  sendPasswordResetEmail,
  updateProfile as updateAuthProfile,
} from 'firebase/auth';
import {
  initializeFirestore,
  Firestore,
  connectFirestoreEmulator,
  persistentLocalCache,
  persistentMultipleTabManager,
} from 'firebase/firestore';
import {
  getFunctions,
  Functions,
  connectFunctionsEmulator,
  httpsCallable,
  HttpsCallableResult,
} from 'firebase/functions';
// Storage is lazy-loaded since it's rarely used (only for file uploads)
// This defers ~30KB from the initial bundle
import type { FirebaseStorage } from 'firebase/storage';

// Import centralized configuration
import { FIREBASE_CONFIG, DATA_CONFIG, AUTH_CONFIG, DEV_CONFIG, APP_CHECK_CONFIG } from '../config';

// =============================================================================
// CONFIGURATION
// =============================================================================

// Use centralized Firebase config
const firebaseConfig = FIREBASE_CONFIG;

// Data namespace for Firestore paths (exported for backwards compatibility)
export const DATA_NAMESPACE = DATA_CONFIG.namespace;

// =============================================================================
// FIREBASE INSTANCES
// =============================================================================

let app: FirebaseApp;
let auth: Auth;
let db: Firestore;
let functions: Functions;
let storage: FirebaseStorage | null = null;

// Initialize Firebase (singleton pattern)
function initializeFirebase(): void {
  if (app) return;

  app = initializeApp(firebaseConfig);
  // App Check attestation — opt-in via a reCAPTCHA site key (see
  // APP_CHECK_CONFIG). Dynamically imported so the SDK stays out of the bundle
  // entirely when no key is configured, and initialized right after the app so
  // tokens attach to subsequent Firestore/Functions/Storage calls.
  initializeAppCheckIfConfigured();
  auth = getAuth(app);
  db = initializeFirestore(app, {
    ignoreUndefinedProperties: true,
    localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
  });
  functions = getFunctions(app);
  // Note: Storage is lazy-loaded via getStorageInstance() to reduce initial bundle

  // Connect to emulators in development (using centralized config)
  if (DEV_CONFIG.useEmulators) {
    const { emulators } = DEV_CONFIG;
    connectAuthEmulator(auth, `http://localhost:${emulators.auth}`, { disableWarnings: true });
    connectFirestoreEmulator(db, 'localhost', emulators.firestore);
    connectFunctionsEmulator(functions, 'localhost', emulators.functions);
    // Storage emulator connected lazily in getStorageInstance()
  }
}

/**
 * Initialize App Check when (and only when) a reCAPTCHA site key is configured.
 * A no-op otherwise, so builds without the key are unaffected. Fire-and-forget:
 * a failure here must never block app startup (App Check is not enforced until
 * the backend rollout flips it on).
 */
function initializeAppCheckIfConfigured(): void {
  if (!APP_CHECK_CONFIG.enabled) return;
  import('firebase/app-check')
    .then(({ initializeAppCheck, ReCaptchaV3Provider }) => {
      // Debug token for local/emulator dev — must be set before initialize.
      if (APP_CHECK_CONFIG.debugToken) {
        (globalThis as Record<string, unknown>).FIREBASE_APPCHECK_DEBUG_TOKEN =
          APP_CHECK_CONFIG.debugToken;
      }
      initializeAppCheck(app, {
        provider: new ReCaptchaV3Provider(APP_CHECK_CONFIG.recaptchaSiteKey),
        isTokenAutoRefreshEnabled: true,
      });
    })
    .catch((error) => {
      // Never fatal: log and continue. Until enforcement is on, missing tokens
      // only surface in the console's App Check metrics.
      console.error('App Check initialization failed:', error);
    });
}

/**
 * Lazy-load Firebase Storage instance
 * Only initializes storage when first called, reducing initial bundle size by ~30KB
 */
export async function getStorageInstance(): Promise<FirebaseStorage> {
  if (storage) return storage;

  const { getStorage, connectStorageEmulator } = await import('firebase/storage');
  storage = getStorage(app);

  // Connect to emulator in development
  if (DEV_CONFIG.useEmulators) {
    connectStorageEmulator(storage, 'localhost', DEV_CONFIG.emulators.storage);
  }

  return storage;
}

// Initialize on module load
initializeFirebase();

// Export instances
// Note: storage is null until getStorageInstance() is called (lazy-loaded)
export { app, auth, db, functions, storage };

// =============================================================================
// AUTH API
// =============================================================================

export const authApi = {
  /**
   * Sign in with email and password
   */
  signInWithEmail: async (email: string, password: string) => {
    return signInWithEmailAndPassword(auth, email, password);
  },

  /**
   * Create a new account with email and password.
   * When a display name is given it is stored on the Firebase Auth user so
   * onboarding can prefill it instead of asking again.
   */
  signUpWithEmail: async (email: string, password: string, displayName?: string) => {
    const credential = await createUserWithEmailAndPassword(auth, email, password);
    if (displayName) {
      try {
        await updateAuthProfile(credential.user, { displayName });
      } catch {
        // Non-blocking: onboarding still lets the user enter their name.
      }
    }
    return credential;
  },

  /**
   * Sign in anonymously
   */
  signInAnonymously: async () => {
    return signInAnonymously(auth);
  },

  /**
   * Sign in with a custom token
   */
  signInWithToken: async (token: string) => {
    return signInWithCustomToken(auth, token);
  },

  /**
   * Sign out the current user
   */
  signOut: async () => {
    return signOut(auth);
  },

  /**
   * Send password reset email
   */
  sendPasswordReset: async (email: string) => {
    return sendPasswordResetEmail(auth, email);
  },

  /**
   * Get the current authenticated user
   */
  getCurrentUser: (): FirebaseUser | null => {
    return auth.currentUser;
  },

  /**
   * Subscribe to auth state changes
   */
  onAuthStateChange: (callback: (user: FirebaseUser | null) => void) => {
    return onAuthStateChanged(auth, callback);
  },

  /**
   * Check if user is admin
   * Uses centralized AUTH_CONFIG for admin UID list
   */
  isAdmin: async (): Promise<boolean> => {
    const user = auth.currentUser;
    if (!user) return false;

    // Check against configured admin UIDs
    if (AUTH_CONFIG.isAdminUid(user.uid)) return true;

    // Also check custom claims
    const tokenResult = await user.getIdTokenResult();
    return tokenResult.claims.admin === true;
  },
};

// =============================================================================
// CLOUD FUNCTIONS API
// =============================================================================

type CloudFunctionName =
  | 'registerCorps'
  | 'retireCorps'
  | 'deleteCorps'
  | 'transferCorps'
  | 'renameCorps'
  | 'detectMyDuplicateCorps'
  | 'sweepDuplicateCorps'
  | 'createLeague'
  | 'joinLeague'
  | 'joinLeagueByCode'
  | 'leaveLeague'
  | 'postLeagueMessage'
  | 'selectShows'
  | 'updateLineup';

/**
 * Call a Firebase Cloud Function with type safety
 */
export async function callFunction<TData = unknown, TResult = unknown>(
  name: CloudFunctionName,
  data?: TData
): Promise<HttpsCallableResult<TResult>> {
  const callable = httpsCallable<TData, TResult>(functions, name);
  return callable(data as TData);
}

// =============================================================================
// PATH HELPERS
// =============================================================================

/**
 * Build Firestore paths with the data namespace
 */
export const paths = {
  // User paths
  users: () => `artifacts/${DATA_NAMESPACE}/users`,
  user: (uid: string) => `artifacts/${DATA_NAMESPACE}/users/${uid}`,
  userProfile: (uid: string) => `artifacts/${DATA_NAMESPACE}/users/${uid}/profile/data`,
  userPrivate: (uid: string) => `artifacts/${DATA_NAMESPACE}/users/${uid}/private/data`,
  userCorps: (uid: string, corpsClass: string) =>
    `artifacts/${DATA_NAMESPACE}/users/${uid}/corps/${corpsClass}`,

  // Season paths
  season: () => `game-settings/season`,

  // Fantasy recaps (parent doc for metadata)
  fantasyRecaps: (seasonUid: string) => `fantasy_recaps/${seasonUid}`,
  // Fantasy recaps daily subcollection (OPTIMIZATION: one doc per day)
  fantasyRecapsDays: (seasonUid: string) => `fantasy_recaps/${seasonUid}/days`,
  fantasyRecapsDay: (seasonUid: string, day: number | string) =>
    `fantasy_recaps/${seasonUid}/days/${day}`,

  // Podium Class recaps (separate pipeline — public, backend-written).
  // One doc per competition day under the season's `days` subcollection.
  podiumRecapsDays: (seasonUid: string) => `podium-recaps/${seasonUid}/days`,

  // Materialized season standings (nightly, backend-written by
  // helpers/standingsMaterializer.js): summary doc + per-class entries.
  fantasyStandings: (seasonUid: string) => `fantasy_standings/${seasonUid}`,
  fantasyStandingsClasses: (seasonUid: string) => `fantasy_standings/${seasonUid}/classes`,

  // Leaderboard paths
  leaderboard: (type: string, corpsClass: string) =>
    `artifacts/${DATA_NAMESPACE}/leaderboard/${type}/${corpsClass}`,
  lifetimeLeaderboard: (view: string) => `artifacts/${DATA_NAMESPACE}/leaderboard/lifetime_${view}`,

  // League paths
  leagues: () => `artifacts/${DATA_NAMESPACE}/leagues`,
  league: (leagueId: string) => `artifacts/${DATA_NAMESPACE}/leagues/${leagueId}`,
  leagueStandings: (leagueId: string) =>
    `artifacts/${DATA_NAMESPACE}/leagues/${leagueId}/standings/current`,
  leagueTrades: (leagueId: string) => `artifacts/${DATA_NAMESPACE}/leagues/${leagueId}/trades`,
  leagueChat: (leagueId: string) => `artifacts/${DATA_NAMESPACE}/leagues/${leagueId}/chat`,
  leagueActivity: (leagueId: string) => `artifacts/${DATA_NAMESPACE}/leagues/${leagueId}/activity`,
  leaguePool: (leagueId: string, gameDay: string) =>
    `artifacts/${DATA_NAMESPACE}/leagues/${leagueId}/pools/${gameDay}`,
  leagueMatchups: (leagueId: string) => `artifacts/${DATA_NAMESPACE}/leagues/${leagueId}/matchups`,
  leagueMatchupWeek: (leagueId: string, week: number | string) =>
    `artifacts/${DATA_NAMESPACE}/leagues/${leagueId}/matchups/week-${week}`,
  leagueWeekRecap: (leagueId: string, week: number | string) =>
    `artifacts/${DATA_NAMESPACE}/leagues/${leagueId}/recaps/week-${week}`,
  leagueMeta: (leagueId: string, docId: string) =>
    `artifacts/${DATA_NAMESPACE}/leagues/${leagueId}/meta/${docId}`,
  leagueInvitations: () => `artifacts/${DATA_NAMESPACE}/leagueInvitations`,

  // User notification paths
  userNotifications: (uid: string) => `artifacts/${DATA_NAMESPACE}/users/${uid}/notifications`,
  userLeagueNotifications: (uid: string) =>
    `artifacts/${DATA_NAMESPACE}/users/${uid}/notifications/leagues`,

  // Show paths
  shows: (seasonUid: string) => `seasons/${seasonUid}/shows`,
  show: (seasonUid: string, showId: string) => `seasons/${seasonUid}/shows/${showId}`,
};

// =============================================================================
// ERROR HANDLING
// =============================================================================

export class ApiError extends Error {
  constructor(
    message: string,
    public code?: string,
    public details?: unknown
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

/**
 * Wrap an async operation with error handling
 */
export async function withErrorHandling<T>(
  operation: () => Promise<T>,
  errorMessage = 'An error occurred'
): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    if (error instanceof Error) {
      throw new ApiError(error.message || errorMessage, (error as { code?: string }).code, error);
    }
    throw new ApiError(errorMessage, undefined, error);
  }
}

// =============================================================================
// ADMIN HELPERS (Backwards compatible)
// =============================================================================

export const adminHelpers = {
  /**
   * Check if current user is admin
   */
  isAdmin: async (): Promise<boolean> => {
    return authApi.isAdmin();
  },

  /**
   * Get current user's token claims
   */
  getCurrentUserClaims: async () => {
    const user = auth.currentUser;
    if (!user) return null;

    const tokenResult = await user.getIdTokenResult();
    return tokenResult.claims;
  },
};

// =============================================================================
// AUTH HELPERS (Backwards compatible alias)
// =============================================================================

export const authHelpers = {
  signInWithEmail: authApi.signInWithEmail,
  signUpWithEmail: authApi.signUpWithEmail,
  signInAnon: authApi.signInAnonymously,
  signInWithToken: authApi.signInWithToken,
  signOut: authApi.signOut,
  getCurrentUser: authApi.getCurrentUser,
  onAuthStateChange: authApi.onAuthStateChange,
};
