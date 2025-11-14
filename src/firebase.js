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
  getFirestore, 
  connectFirestoreEmulator,
  enableIndexedDbPersistence
} from 'firebase/firestore';
import { 
  getFunctions, 
  connectFunctionsEmulator 
} from 'firebase/functions';
import { 
  getStorage, 
  connectStorageEmulator 
} from 'firebase/storage';
import { getAnalytics, logEvent } from 'firebase/analytics';

// Firebase configuration from development guidelines
const firebaseConfig = {
  apiKey: process.env.REACT_APP_FIREBASE_API_KEY || "AIzaSyA4Qhjpp2MVwo0h0t2dNtznSIDMjlKQ5JE",
  authDomain: process.env.REACT_APP_FIREBASE_AUTH_DOMAIN || "marching-art.firebaseapp.com",
  projectId: process.env.REACT_APP_FIREBASE_PROJECT_ID || "marching-art",
  storageBucket: process.env.REACT_APP_FIREBASE_STORAGE_BUCKET || "marching-art.firebasestorage.app",
  messagingSenderId: process.env.REACT_APP_FIREBASE_MESSAGING_SENDER_ID || "278086562126",
  appId: process.env.REACT_APP_FIREBASE_APP_ID || "1:278086562126:web:f7737ee897774c3d9a6e1f",
  measurementId: process.env.REACT_APP_FIREBASE_MEASUREMENT_ID || "G-H0KE8GJS7M"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize services
export const auth = getAuth(app);
export const db = getFirestore(app);
export const functions = getFunctions(app);
export const storage = getStorage(app);
export const analytics = getAnalytics(app);
export const dataNamespace = 'marching-art';

// Enable offline persistence
if (typeof window !== 'undefined') {
  enableIndexedDbPersistence(db).catch((err) => {
    if (err.code === 'failed-precondition') {
      console.warn('Multiple tabs open, persistence can only be enabled in one tab at a time.');
    } else if (err.code === 'unimplemented') {
      console.warn('The current browser does not support offline persistence.');
    }
  });
}

// Connect to emulators if in development
if (process.env.NODE_ENV === 'development' && process.env.REACT_APP_USE_EMULATORS === 'true') {
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
      logEvent(analytics, 'login', { method: 'email' });
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
      logEvent(analytics, 'sign_up', { method: 'email' });
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
      logEvent(analytics, 'login', { method: 'anonymous' });
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
      logEvent(analytics, 'login', { method: 'custom_token' });
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
      logEvent(analytics, 'logout');
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
    logEvent(analytics, 'page_view', { page_name: pageName });
  },
  
  logButtonClick: (buttonName) => {
    logEvent(analytics, 'button_click', { button_name: buttonName });
  },
 
  logCorpsCreated: (corpsClass) => {
    logEvent(analytics, 'corps_created', { corps_class: corpsClass });
  },
 
  logLeagueJoined: (leagueId) => {
    logEvent(analytics, 'league_joined', { league_id: leagueId });
  },
 
  logCaptionSelected: (caption, corps) => {
    logEvent(analytics, 'caption_selected', { caption, corps });
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
