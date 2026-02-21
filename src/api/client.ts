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
import { FIREBASE_CONFIG, DATA_CONFIG, AUTH_CONFIG, DEV_CONFIG } from '../config';

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
  auth = getAuth(app);
  db = initializeFirestore(app, {
    ignoreUndefinedProperties: true,
    localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() })
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
   * Create a new account with email and password
   */
  signUpWithEmail: async (email: string, password: string) => {
    return createUserWithEmailAndPassword(auth, email, password);
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
  | 'dailyRehearsal'
  | 'getExecutionStatus'
  | 'registerCorps'
  | 'retireCorps'
  | 'deleteCorps'
  | 'transferCorps'
  | 'createLeague'
  | 'joinLeague'
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
  userCorps: (uid: string, corpsClass: string) =>
    `artifacts/${DATA_NAMESPACE}/users/${uid}/corps/${corpsClass}`,

  // Season paths
  season: () => `game-settings/season`,

  // Fantasy recaps (parent doc for metadata)
  fantasyRecaps: (seasonUid: string) => `fantasy_recaps/${seasonUid}`,
  // Fantasy recaps daily subcollection (OPTIMIZATION: one doc per day)
  fantasyRecapsDays: (seasonUid: string) => `fantasy_recaps/${seasonUid}/days`,
  fantasyRecapsDay: (seasonUid: string, day: number | string) => `fantasy_recaps/${seasonUid}/days/${day}`,

  // Leaderboard paths
  leaderboard: (type: string, corpsClass: string) =>
    `artifacts/${DATA_NAMESPACE}/leaderboard/${type}/${corpsClass}`,
  lifetimeLeaderboard: (view: string) =>
    `artifacts/${DATA_NAMESPACE}/leaderboard/lifetime_${view}/data`,

  // League paths
  leagues: () => `artifacts/${DATA_NAMESPACE}/leagues`,
  league: (leagueId: string) => `artifacts/${DATA_NAMESPACE}/leagues/${leagueId}`,
  leagueStandings: (leagueId: string) =>
    `artifacts/${DATA_NAMESPACE}/leagues/${leagueId}/standings/current`,
  leagueTrades: (leagueId: string) =>
    `artifacts/${DATA_NAMESPACE}/leagues/${leagueId}/trades`,
  leagueChat: (leagueId: string) =>
    `artifacts/${DATA_NAMESPACE}/leagues/${leagueId}/chat`,
  leagueActivity: (leagueId: string) =>
    `artifacts/${DATA_NAMESPACE}/leagues/${leagueId}/activity`,

  // User notification paths
  userNotifications: (uid: string) =>
    `artifacts/${DATA_NAMESPACE}/users/${uid}/notifications`,
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
      throw new ApiError(
        error.message || errorMessage,
        (error as { code?: string }).code,
        error
      );
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
