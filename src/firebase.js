// src/firebase.js - Minimal Firebase Configuration
import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

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

// Data namespace for production vs development
export const dataNamespace = process.env.REACT_APP_DATA_NAMESPACE || 'prod';

export default app;