// firebase.js - Enhanced Firebase Configuration for Ultimate Fantasy Drum Corps Game
import { initializeApp } from 'firebase/app';
import { 
  getAuth, 
  connectAuthEmulator, 
  setPersistence, 
  browserLocalPersistence,
  onAuthStateChanged 
} from 'firebase/auth';
import { 
  getFirestore, 
  connectFirestoreEmulator, 
  enableIndexedDbPersistence,
  enableNetwork,
  disableNetwork
} from 'firebase/firestore';
import { 
  getFunctions, 
  connectFunctionsEmulator 
} from 'firebase/functions';
import { 
  getStorage, 
  connectStorageEmulator 
} from 'firebase/storage';
import { 
  getAnalytics, 
  isSupported,
  logEvent 
} from 'firebase/analytics';
import { 
  getPerformance,
  trace
} from 'firebase/performance';
import { 
  getMessaging,
  getToken,
  onMessage 
} from 'firebase/messaging';

// Enhanced Firebase configuration with environment validation
const requiredEnvVars = [
  'REACT_APP_FIREBASE_API_KEY',
  'REACT_APP_FIREBASE_AUTH_DOMAIN',
  'REACT_APP_FIREBASE_PROJECT_ID',
  'REACT_APP_FIREBASE_STORAGE_BUCKET',
  'REACT_APP_FIREBASE_MESSAGING_SENDER_ID',
  'REACT_APP_FIREBASE_APP_ID'
];

// Validate environment variables
const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);
if (missingVars.length > 0) {
  console.error('Missing required environment variables:', missingVars);
  throw new Error(`Missing Firebase configuration: ${missingVars.join(', ')}`);
}

const firebaseConfig = {
  apiKey: process.env.REACT_APP_FIREBASE_API_KEY,
  authDomain: process.env.REACT_APP_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.REACT_APP_FIREBASE_PROJECT_ID,
  storageBucket: process.env.REACT_APP_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.REACT_APP_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.REACT_APP_FIREBASE_APP_ID,
  measurementId: process.env.REACT_APP_FIREBASE_MEASUREMENT_ID
};

// Initialize Firebase app
const app = initializeApp(firebaseConfig);

// Initialize Firebase services with enhanced configuration
export const auth = getAuth(app);
export const db = getFirestore(app);
export const functions = getFunctions(app);
export const storage = getStorage(app);

// Enhanced data namespace for multi-tenancy and environment separation
export const dataNamespace = process.env.REACT_APP_DATA_NAMESPACE || 'prod';
export const isDevelopment = process.env.NODE_ENV === 'development';
export const isProduction = process.env.NODE_ENV === 'production';

// Performance monitoring
let performance = null;
let messaging = null;
let analytics = null;

// Initialize Performance Monitoring (production only)
if (isProduction) {
  try {
    performance = getPerformance(app);
    console.log('Firebase Performance monitoring initialized');
  } catch (error) {
    console.warn('Firebase Performance monitoring failed to initialize:', error);
  }
}

// Initialize Analytics (production only)
if (isProduction) {
  isSupported().then(yes => {
    if (yes) {
      analytics = getAnalytics(app);
      console.log('Firebase Analytics initialized');
    }
  }).catch(error => {
    console.warn('Firebase Analytics failed to initialize:', error);
  });
}

// Initialize Messaging for push notifications
if (isProduction && 'serviceWorker' in navigator) {
  try {
    messaging = getMessaging(app);
    console.log('Firebase Messaging initialized');
  } catch (error) {
    console.warn('Firebase Messaging failed to initialize:', error);
  }
}

// Enhanced authentication configuration
try {
  setPersistence(auth, browserLocalPersistence);
} catch (error) {
  console.warn('Failed to set auth persistence:', error);
}

// Enhanced Firestore configuration with offline persistence
if (!isDevelopment) {
  enableIndexedDbPersistence(db).catch((error) => {
    if (error.code === 'failed-precondition') {
      console.warn('Multiple tabs open, persistence can only be enabled in one tab at a time.');
    } else if (error.code === 'unimplemented') {
      console.warn('The current browser does not support offline persistence');
    }
  });
}

// Connect to emulators in development
if (isDevelopment) {
  const authHost = 'localhost';
  const authPort = 9099;
  const firestoreHost = 'localhost';
  const firestorePort = 8080;
  const functionsHost = 'localhost';
  const functionsPort = 5001;
  const storageHost = 'localhost';
  const storagePort = 9199;

  try {
    connectAuthEmulator(auth, `http://${authHost}:${authPort}`, {
      disableWarnings: true
    });
    connectFirestoreEmulator(db, firestoreHost, firestorePort);
    connectFunctionsEmulator(functions, functionsHost, functionsPort);
    connectStorageEmulator(storage, storageHost, storagePort);
    
    console.log('Connected to Firebase emulators');
  } catch (error) {
    console.warn('Failed to connect to emulators:', error);
  }
}

// Enhanced utility functions
export const firebaseUtils = {
  // Analytics tracking
  trackEvent: (eventName, parameters = {}) => {
    if (analytics && isProduction) {
      logEvent(analytics, eventName, {
        ...parameters,
        timestamp: new Date().toISOString(),
        user_namespace: dataNamespace
      });
    }
  },

  // Performance tracing
  startTrace: (traceName) => {
    if (performance && isProduction) {
      return trace(performance, traceName);
    }
    return null;
  },

  // Network status management
  enableFirestore: async () => {
    try {
      await enableNetwork(db);
      console.log('Firestore network enabled');
    } catch (error) {
      console.error('Failed to enable Firestore network:', error);
    }
  },

  disableFirestore: async () => {
    try {
      await disableNetwork(db);
      console.log('Firestore network disabled');
    } catch (error) {
      console.error('Failed to disable Firestore network:', error);
    }
  },

  // Push notification utilities
  requestNotificationPermission: async () => {
    if (!messaging || !isProduction) return null;
    
    try {
      const permission = await Notification.requestPermission();
      if (permission === 'granted') {
        const token = await getToken(messaging, {
          vapidKey: process.env.REACT_APP_FIREBASE_VAPID_KEY
        });
        console.log('FCM token:', token);
        return token;
      }
      return null;
    } catch (error) {
      console.error('Failed to get FCM token:', error);
      return null;
    }
  },

  // Listen for foreground messages
  onMessageListener: (callback) => {
    if (!messaging || !isProduction) return () => {};
    
    return onMessage(messaging, callback);
  },

  // Connection status monitoring
  monitorConnectionStatus: (onOnline, onOffline) => {
    const handleOnline = () => {
      firebaseUtils.enableFirestore();
      onOnline && onOnline();
    };

    const handleOffline = () => {
      firebaseUtils.disableFirestore();
      onOffline && onOffline();
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  },

  // Enhanced error handling
  handleFirebaseError: (error, context = '') => {
    console.error(`Firebase error${context ? ` in ${context}` : ''}:`, error);
    
    // Track errors in production
    if (analytics && isProduction) {
      logEvent(analytics, 'firebase_error', {
        error_code: error.code,
        error_message: error.message,
        context,
        timestamp: new Date().toISOString()
      });
    }

    // Return user-friendly error messages
    const errorMessages = {
      'auth/user-not-found': 'No account found with this email address.',
      'auth/wrong-password': 'Incorrect password. Please try again.',
      'auth/email-already-in-use': 'An account with this email already exists.',
      'auth/weak-password': 'Password is too weak. Please use at least 6 characters.',
      'auth/invalid-email': 'Please enter a valid email address.',
      'auth/too-many-requests': 'Too many attempts. Please try again later.',
      'permission-denied': 'You do not have permission to perform this action.',
      'unavailable': 'Service is temporarily unavailable. Please try again.',
      'deadline-exceeded': 'Request timed out. Please check your connection.',
      'resource-exhausted': 'Rate limit exceeded. Please try again later.',
      'unauthenticated': 'Please sign in to continue.',
      'not-found': 'The requested data was not found.',
      'already-exists': 'This resource already exists.',
      'failed-precondition': 'Operation failed due to invalid state.',
      'cancelled': 'Operation was cancelled.',
      'data-loss': 'Data corruption detected. Please refresh and try again.',
      'unknown': 'An unexpected error occurred. Please try again.',
      'internal': 'Internal server error. Please try again later.',
      'invalid-argument': 'Invalid data provided. Please check your input.',
      'out-of-range': 'Value is outside the valid range.'
    };

    return errorMessages[error.code] || error.message || 'An unexpected error occurred.';
  }
};

// Enhanced authentication state management
export const authStateManager = {
  currentUser: null,
  authStateListeners: new Set(),

  // Subscribe to auth state changes
  onAuthStateChange: (callback) => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      authStateManager.currentUser = user;
      callback(user);
    });

    authStateManager.authStateListeners.add(unsubscribe);
    return unsubscribe;
  },

  // Clean up all auth listeners
  cleanup: () => {
    authStateManager.authStateListeners.forEach(unsubscribe => unsubscribe());
    authStateManager.authStateListeners.clear();
  },

  // Get current user safely
  getCurrentUser: () => {
    return authStateManager.currentUser || auth.currentUser;
  }
};

// Export analytics and performance for conditional use
export { analytics, performance, messaging };

// CORRECTION: Renamed 'firebaseConfig' to 'firebaseBundle' to avoid redeclaration error.
// This object bundles all Firebase services and utilities for easy import.
export const firebaseBundle = {
  app,
  services: {
    auth,
    db,
    functions,
    storage,
    analytics,
    performance,
    messaging
  },
  utils: firebaseUtils,
  config: {
    dataNamespace,
    isDevelopment,
    isProduction,
    projectId: process.env.REACT_APP_FIREBASE_PROJECT_ID
  }
};

// Default export for backward compatibility
export default app;