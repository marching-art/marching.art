import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getFunctions } from 'firebase/functions';

// These global variables are provided by the environment.
// eslint-disable-next-line no-undef
export const appId = typeof __app_id !== 'undefined' ? __app_id : 'marching-art';
// eslint-disable-next-line no-undef
const firebaseConfig = typeof __firebase_config !== 'undefined' ? JSON.parse(__firebase_config) : {
    apiKey: "AIzaSyA4Qhjpp2MVwo0h0t2dNtznSIDMjlKQ5JE",
    authDomain: "marching-art.firebaseapp.com",
    projectId: "marching-art",
    storageBucket: "marching-art.firebasestorage.app",
    messagingSenderId: "278086562126",
    appId: "1:278086562126:web:f7737ee897774c3d9a6e1f",
    measurementId: "G-H0KE8GJS7M"
};

// Initialize Firebase and export the services
const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const functions = getFunctions(app);
