/**
 * Runtime feature flags — client hook (Phase 1.5, PODIUM.md).
 *
 * Mirrors functions/src/helpers/features.js: flags live in the Firestore doc
 * `game-settings/features`, a missing doc or field means OFF, and flipping a
 * flag is a config write, never a deploy. One shared listener backs every
 * hook consumer (same pattern as seasonStore).
 */

import { useSyncExternalStore } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db, paths } from '../api';

/** @type {Record<string, unknown>} */
let features = {};
/** @type {null | (() => void)} */
let unsubscribe = null;
/** @type {Set<() => void>} */
const listeners = new Set();

function ensureListener() {
  if (unsubscribe) return;
  unsubscribe = onSnapshot(
    doc(db, paths.features()),
    (snapshot) => {
      features = snapshot.exists() ? snapshot.data() : {};
      listeners.forEach((notify) => notify());
    },
    () => {
      // Permission/network errors read as "all flags off" — the safe default.
      features = {};
      listeners.forEach((notify) => notify());
    }
  );
}

/** @param {() => void} notify */
function subscribe(notify) {
  ensureListener();
  listeners.add(notify);
  return () => {
    listeners.delete(notify);
    // Last consumer gone (e.g. sign-out unmounts the game shell): drop the
    // Firestore listener instead of holding it open for the page's lifetime.
    // The next subscriber re-attaches and receives a fresh snapshot.
    if (listeners.size === 0 && unsubscribe) {
      unsubscribe();
      unsubscribe = null;
    }
  };
}

/** All feature flags ({} until the doc loads or when it doesn't exist). */
export function useFeatures() {
  return useSyncExternalStore(subscribe, () => features);
}

/** True only while game-settings/features.podiumClass === true. */
export function usePodiumEnabled() {
  return useFeatures().podiumClass === true;
}
