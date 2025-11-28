// src/firebase.js
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

// Firebase configuration from development guidelines
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSyA4Qhjpp2MVwo0h0t2dNtznSIDMjlKQ5JE",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "marching-art.firebaseapp.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "marching-art",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "marching-art.firebasestorage.app",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "278086562126",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:278086562126:web:f7737ee897774c3d9a6e1f",
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || "G-H0KE8GJS7M"
};

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
export const dataNamespace = 'marching-art';

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


// Connect to emulators if in development
if (import.meta.env.DEV && import.meta.env.VITE_USE_EMULATORS === 'true') {
  connectAuthEmulator(auth, 'http://localhost:9099', { disableWarnings: true });
  connectFirestoreEmulator(db, 'localhost', 8080);
  connectFunctionsEmulator(functions, 'localhost', 5001);
  connectStorageEmulator(storage, 'localhost', 9199);
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
 
// Admin helpers
export const adminHelpers = {
  // Check if current user is admin
  isAdmin: async () => {
    const user = auth.currentUser;
    if (!user) return false;
 
    // Admin UID from firestore path
    const ADMIN_UID = 'o8vfRCOevjTKBY0k2dISlpiYiIH2';
 
    if (user.uid === ADMIN_UID) return true;
 
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
