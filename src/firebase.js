import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { 
  initializeFirestore, 
  persistentLocalCache, 
  persistentMultipleTabManager,
  CACHE_SIZE_UNLIMITED
} from "firebase/firestore";
import { getFunctions } from "firebase/functions";
import { getPerformance, trace as perfTrace } from "firebase/performance";
import { getAnalytics, logEvent as logAnalyticsEvent } from "firebase/analytics";

const firebaseConfig = {
  apiKey: process.env.REACT_APP_API_KEY,
  authDomain: process.env.REACT_APP_AUTH_DOMAIN,
  projectId: process.env.REACT_APP_PROJECT_ID,
  storageBucket: process.env.REACT_APP_STORAGE_BUCKET,
  messagingSenderId: process.env.REACT_APP_MESSAGING_SENDER_ID,
  appId: process.env.REACT_APP_APP_ID,
  measurementId: process.env.REACT_APP_MEASUREMENT_ID
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Auth
const auth = getAuth(app);

// Initialize Firestore with optimized caching
const db = initializeFirestore(app, {
  localCache: persistentLocalCache({
    tabManager: persistentMultipleTabManager(),
    cacheSizeBytes: CACHE_SIZE_UNLIMITED // Allow unlimited cache
  }),
  experimentalForceLongPolling: false, // Use WebChannel (faster)
  experimentalAutoDetectLongPolling: true // Auto-detect best connection method
});

// Initialize Functions
const functions = getFunctions(app);

// Initialize Performance Monitoring (production only)
let perf = null;
if (process.env.NODE_ENV === 'production') {
  perf = getPerformance(app);
}

// Initialize Analytics (production only)
let analytics = null;
if (process.env.NODE_ENV === 'production' && process.env.REACT_APP_FIREBASE_MEASUREMENT_ID) {
  analytics = getAnalytics(app);
}

// Data namespace for environment separation
export const dataNamespace = process.env.REACT_APP_DATA_NAMESPACE || 'marching-art';

// Log initialization in development only
if (process.env.NODE_ENV === 'development') {
  console.log('🔥 Firebase initialized');
  console.log('📦 dataNamespace:', dataNamespace);
  console.log('🌐 Environment:', process.env.NODE_ENV);
}

export { auth, db, functions, perf, analytics };

// Performance tracing helper
export const trace = (traceName) => {
  if (perf) {
    return perfTrace(perf, traceName);
  }
  // Return mock trace for development
  return {
    start: () => {},
    stop: () => {},
    putAttribute: () => {},
    putMetric: () => {}
  };
};

// Analytics event helper
export const logEvent = (eventName, eventParams = {}) => {
  if (analytics) {
    logAnalyticsEvent(analytics, eventName, eventParams);
  }
};