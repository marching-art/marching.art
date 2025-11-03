import { getFunctions, httpsCallable } from 'firebase/functions';

const functions = getFunctions();

export const registerCorps = httpsCallable(functions, 'registerCorps');
export const saveLineup = httpsCallable(functions, 'saveLineup');