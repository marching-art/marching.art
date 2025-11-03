import { getFunctions, httpsCallable } from 'firebase/functions';
import { functions } from '../firebase'; // Assuming 'functions' is exported from firebase.js

/**
 * Task 2.4: Creates a new corps for the user.
 *
 */
export const registerCorps = httpsCallable(functions, 'registerCorps');

/**
 * Task 2.7: Saves the user's selected caption lineup.
 *
 */
export const saveLineup = httpsCallable(functions, 'saveLineup');

/**
 * Task 2.8 (Implied): Saves the user's show concept.
 */
export const saveShowConcept = httpsCallable(functions, 'saveShowConcept');