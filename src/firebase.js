// src/firebase.js
// UPDATED VERSION with Offline Persistence

import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore, enableIndexedDbPersistence } from "firebase/firestore";
import { getFunctions } from "firebase/functions";

const firebaseConfig = {
  apiKey: process.env.REACT_APP_FIREBASE_API_KEY,
  authDomain: process.env.REACT_APP_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.REACT_APP_FIREBASE_PROJECT_ID,
  storageBucket: process.env.REACT_APP_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.REACT_APP_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.REACT_APP_FIREBASE_APP_ID,
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const functions = getFunctions(app);

// ✨ NEW: Enable offline persistence
// This automatically caches all Firestore reads
// Works across page refreshes and browser restarts
enableIndexedDbPersistence(db, {
  synchronizeTabs: true // Share cache across multiple tabs
}).then(() => {
  console.log('✅ Offline persistence enabled');
}).catch((err) => {
  if (err.code === 'failed-precondition') {
    // Multiple tabs open, persistence can only be enabled in one tab at a time
    console.warn('⚠️ Offline persistence: Multiple tabs open, using memory-only cache');
  } else if (err.code === 'unimplemented') {
    // The current browser doesn't support persistence
    console.warn('⚠️ Offline persistence: Not supported in this browser');
  } else {
    console.error('❌ Offline persistence error:', err);
  }
});

export const dataNamespace = process.env.REACT_APP_DATA_NAMESPACE;

export { auth, db, functions };