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
import {
  getStorage,
  FirebaseStorage,
  connectStorageEmulator,
} from 'firebase/storage';

// =============================================================================
// CONFIGURATION
// =============================================================================

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSyA4Qhjpp2MVwo0h0t2dNtznSIDMjlKQ5JE",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "marching-art.firebaseapp.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "marching-art",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "marching-art.firebasestorage.app",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "278086562126",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:278086562126:web:f7737ee897774c3d9a6e1f",
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || "G-H0KE8GJS7M"
};

// Data namespace for Firestore paths
export const DATA_NAMESPACE = 'marching-art';

// =============================================================================
// FIREBASE INSTANCES
// =============================================================================

let app: FirebaseApp;
let auth: Auth;
let db: Firestore;
let functions: Functions;
let storage: FirebaseStorage;

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
  storage = getStorage(app);

  // Connect to emulators in development
  if (import.meta.env.DEV && import.meta.env.VITE_USE_EMULATORS === 'true') {
    connectAuthEmulator(auth, 'http://localhost:9099', { disableWarnings: true });
    connectFirestoreEmulator(db, 'localhost', 8080);
    connectFunctionsEmulator(functions, 'localhost', 5001);
    connectStorageEmulator(storage, 'localhost', 9199);
  }
}

// Initialize on module load
initializeFirebase();

// Export instances
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
   */
  isAdmin: async (): Promise<boolean> => {
    const user = auth.currentUser;
    if (!user) return false;

    const ADMIN_UID = 'o8vfRCOevjTKBY0k2dISlpiYiIH2';
    if (user.uid === ADMIN_UID) return true;

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
  | 'moveCorps'
  | 'createLeague'
  | 'joinLeague'
  | 'leaveLeague'
  | 'proposeStaffTrade'
  | 'respondToStaffTrade'
  | 'postLeagueMessage'
  | 'purchaseEquipment'
  | 'repairEquipment'
  | 'hireStaff'
  | 'fireStaff'
  | 'bidOnStaff'
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

  // Fantasy recaps
  fantasyRecaps: (seasonUid: string) => `fantasy_recaps/${seasonUid}`,

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

  // Staff paths
  staffMarketplace: () => `artifacts/${DATA_NAMESPACE}/staff_marketplace`,
  staffAuctions: () => `artifacts/${DATA_NAMESPACE}/staff_auctions`,

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
