import { initializeApp } from "firebase/app";
import { getAuth, setPersistence, browserLocalPersistence } from "firebase/auth";
import { 
  getFirestore, 
  persistentLocalCache,
  persistentMultipleTabManager,
  initializeFirestore
} from "firebase/firestore";
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

// Modern cache configuration - replaces deprecated enableIndexedDbPersistence
const db = initializeFirestore(app, {
  localCache: persistentLocalCache({
    tabManager: persistentMultipleTabManager()
  })
});

const functions = getFunctions(app);

export const dataNamespace = process.env.REACT_APP_DATA_NAMESPACE;

// Set auth persistence
setPersistence(auth, browserLocalPersistence).catch((err) => {
  console.error('Auth persistence error:', err);
});

export { auth, db, functions };