// src/firebase.js
// =============================================================================
// LEGACY FIREBASE MODULE - For backwards compatibility
// =============================================================================
// This module re-exports from the new consolidated API layer while maintaining
// backwards compatibility with existing imports. New code should import from
// '@/api' instead.
//
// Migration: import { auth, db, authApi } from '@/api';

import { initializeApp } from 'firebase/app';
import {
  getAuth,
  connectAuthEmulator,
  signInWithEmailAndPassword,
  signInAnonymously,
  signInWithCustomToken,
  createUserWithEmailAndPassword,
  signOut,
  onAuthStateChanged
} from 'firebase/auth';
import {
  initializeFirestore,
  connectFirestoreEmulator,
  persistentLocalCache,
  persistentMultipleTabManager
} from 'firebase/firestore';
import {
  getFunctions,
  connectFunctionsEmulator
} from 'firebase/functions';
import {
  getStorage,
  connectStorageEmulator
} from 'firebase/storage';
import { getAnalytics, logEvent, isSupported } from 'firebase/analytics';

// Import centralized configuration
import { FIREBASE_CONFIG, DATA_CONFIG, AUTH_CONFIG, DEV_CONFIG } from './config';

// Use centralized Firebase configuration
const firebaseConfig = FIREBASE_CONFIG;

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize services
export const auth = getAuth(app);
export const db = initializeFirestore(app, {
  ignoreUndefinedProperties: true,
  localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() })
});
export const functions = getFunctions(app);
export const storage = getStorage(app);

// Use centralized data namespace
export const dataNamespace = DATA_CONFIG.namespace;

// Initialize analytics only if supported (handles ad blockers gracefully)
let analyticsInstance = null;
isSupported().then(supported => {
  if (supported) {
    analyticsInstance = getAnalytics(app);
  }
}).catch(() => {
  // Analytics not supported or blocked
});

// Safe analytics logging that silently fails when blocked
const safeLogEvent = (eventName, eventParams) => {
  if (analyticsInstance) {
    try {
      logEvent(analyticsInstance, eventName, eventParams);
    } catch (e) {
      // Silently ignore analytics errors (e.g., ad blockers)
    }
  }
};

// Export analytics for backward compatibility (may be null)
export const analytics = analyticsInstance;


// Connect to emulators if in development (using centralized config)
if (DEV_CONFIG.useEmulators) {
  const { emulators } = DEV_CONFIG;
  connectAuthEmulator(auth, `http://localhost:${emulators.auth}`, { disableWarnings: true });
  connectFirestoreEmulator(db, 'localhost', emulators.firestore);
  connectFunctionsEmulator(functions, 'localhost', emulators.functions);
  connectStorageEmulator(storage, 'localhost', emulators.storage);
}

// Auth helpers
export const authHelpers = {
  // Sign in with email and password
  signInWithEmail: async (email, password) => {
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      safeLogEvent('login', { method: 'email' });
      return userCredential;
    } catch (error) {
      console.error('Error signing in:', error);
      throw error;
    }
  },

  // Sign up with email and password
  signUpWithEmail: async (email, password) => {
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      safeLogEvent('sign_up', { method: 'email' });
      return userCredential;
    } catch (error) {
      console.error('Error signing up:', error);
      throw error;
    }
  },

  // Sign in anonymously
  signInAnon: async () => {
    try {
      const userCredential = await signInAnonymously(auth);
      safeLogEvent('login', { method: 'anonymous' });
      return userCredential;
    } catch (error) {
      console.error('Error signing in anonymously:', error);
      throw error;
    }
  },

  // Sign in with custom token
  signInWithToken: async (token) => {
    try {
      const userCredential = await signInWithCustomToken(auth, token);
      safeLogEvent('login', { method: 'custom_token' });
      return userCredential;
    } catch (error) {
      console.error('Error signing in with custom token:', error);
      throw error;
    }
  },

  // Sign out
  signOut: async () => {
    try {
      await signOut(auth);
      safeLogEvent('logout');
    } catch (error) {
      console.error('Error signing out:', error);
      throw error;
    }
  },

  // Get current user
  getCurrentUser: () => auth.currentUser,

  // Subscribe to auth state changes
  onAuthStateChange: (callback) => {
    return onAuthStateChanged(auth, callback);
  }
};

// Season helpers
export const seasonHelpers = {
  // Calculate current season based on date
  getCurrentSeason: () => {
    const now = new Date();
    const year = now.getFullYear();
    
    // Finals are always on the second Saturday of August
    const augustFirst = new Date(year, 7, 1);
    const firstSaturday = augustFirst.getDay() === 6 ? 1 : 7 - augustFirst.getDay() + 6;
    const finalsDate = new Date(year, 7, firstSaturday + 7);
    
    // Live season is 10 weeks before finals
    const liveSeasonStart = new Date(finalsDate);
    liveSeasonStart.setDate(liveSeasonStart.getDate() - 70);
    
    if (now >= liveSeasonStart && now <= finalsDate) {
      return {
        type: 'live',
        year: year,
        week: Math.floor((now - liveSeasonStart) / (7 * 24 * 60 * 60 * 1000)) + 1,
        daysRemaining: Math.floor((finalsDate - now) / (24 * 60 * 60 * 1000))
      };
    } else {
      // Off-season
      const offSeasonNumber = now < liveSeasonStart ? 
        Math.floor((liveSeasonStart - now) / (7 * 7 * 24 * 60 * 60 * 1000)) + 1 : 
        Math.floor((now - finalsDate) / (7 * 7 * 24 * 60 * 60 * 1000)) + 1;
      
      return {
        type: 'off',
        year: year,
        offSeasonNumber: Math.min(offSeasonNumber, 6),
        week: ((now - finalsDate) / (7 * 24 * 60 * 60 * 1000)) % 7 + 1
      };
    }
  },

  // Format season display name
  formatSeasonName: (season) => {
    if (season.type === 'live') {
      return `${season.year} Live Season - Week ${season.week}`;
    } else {
      return `${season.year} Off-Season ${season.offSeasonNumber} - Week ${Math.floor(season.week)}`;
    }
  }
};

// Analytics helpers
export const analyticsHelpers = {
  logPageView: (pageName) => {
    safeLogEvent('page_view', { page_name: pageName });
  },

  logButtonClick: (buttonName) => {
    safeLogEvent('button_click', { button_name: buttonName });
  },

  logCorpsCreated: (corpsClass) => {
    safeLogEvent('corps_created', { corps_class: corpsClass });
  },

  logLeagueJoined: (leagueId) => {
    safeLogEvent('league_joined', { league_id: leagueId });
  },

  logCaptionSelected: (caption, corps) => {
    safeLogEvent('caption_selected', { caption, corps });
  }
};
 
// Admin helpers (using centralized AUTH_CONFIG)
export const adminHelpers = {
  // Check if current user is admin
  isAdmin: async () => {
    const user = auth.currentUser;
    if (!user) return false;

    // Check against centralized admin UIDs config
    if (AUTH_CONFIG.isAdminUid(user.uid)) return true;

    // Also check custom claims
    const tokenResult = await user.getIdTokenResult();
    return tokenResult.claims.admin === true;
  },

  // Get current user's admin status and token claims
  getCurrentUserClaims: async () => {
    const user = auth.currentUser;
    if (!user) return null;

    const tokenResult = await user.getIdTokenResult();
    return tokenResult.claims;
  }
};

export default app;
