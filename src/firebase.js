import { initializeApp } from 'firebase/app';
import { getAuth, connectAuthEmulator } from 'firebase/auth';
import { getFirestore, connectFirestoreEmulator } from 'firebase/firestore';
import { getStorage, connectStorageEmulator } from 'firebase/storage';
import { getFunctions, connectFunctionsEmulator } from 'firebase/functions';

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: process.env.REACT_APP_FIREBASE_API_KEY || "demo-key",
  authDomain: process.env.REACT_APP_FIREBASE_AUTH_DOMAIN || "marching-art.firebaseapp.com",
  projectId: process.env.REACT_APP_FIREBASE_PROJECT_ID || "marching-art",
  storageBucket: process.env.REACT_APP_FIREBASE_STORAGE_BUCKET || "marching-art.appspot.com",
  messagingSenderId: process.env.REACT_APP_FIREBASE_MESSAGING_SENDER_ID || "123456789",
  appId: process.env.REACT_APP_FIREBASE_APP_ID || "1:123456789:web:abcdef"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firebase services
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);
export const functions = getFunctions(app);

// Data namespace for production vs development
export const dataNamespace = process.env.REACT_APP_DATA_NAMESPACE || 'prod';

// Emulator connection for development
let emulatorsConnected = false;

if (process.env.NODE_ENV === 'development' && !emulatorsConnected && window.location.hostname === 'localhost') {
  try {
    // Only connect once
    if (!auth._delegate._config.emulator) {
      connectAuthEmulator(auth, 'http://localhost:9099');
    }
    if (!db._delegate._databaseId.projectId.includes('demo-')) {
      connectFirestoreEmulator(db, 'localhost', 8080);
    }
    if (!storage._delegate._location.bucket.includes('demo-')) {
      connectStorageEmulator(storage, 'localhost', 9199);
    }
    if (!functions._delegate.region) {
      connectFunctionsEmulator(functions, 'localhost', 5001);
    }
    emulatorsConnected = true;
    console.log('Firebase emulators connected for development');
  } catch (error) {
    console.log('Emulators already connected or not running:', error.message);
  }
}

// Firebase utilities for common operations
export const firebaseUtils = {
  // Batch write operations for efficiency
  createBatch: () => {
    const { writeBatch } = require('firebase/firestore');
    return writeBatch(db);
  },
  
  // Server timestamp
  serverTimestamp: () => {
    const { serverTimestamp } = require('firebase/firestore');
    return serverTimestamp();
  },
  
  // Array operations
  arrayUnion: (...elements) => {
    const { arrayUnion } = require('firebase/firestore');
    return arrayUnion(...elements);
  },
  
  arrayRemove: (...elements) => {
    const { arrayRemove } = require('firebase/firestore');
    return arrayRemove(...elements);
  },
  
  // Increment operations
  increment: (n) => {
    const { increment } = require('firebase/firestore');
    return increment(n);
  }
};

export default app;