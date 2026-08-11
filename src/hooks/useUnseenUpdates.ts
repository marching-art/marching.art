// =============================================================================
// UNSEEN UPDATES — the "the game is alive" signal
// =============================================================================
// Tracks which game updates (src/data/changelog.ts) a director has seen, so the
// site links menu can show an unseen-count badge and clear it the moment they
// open /updates. The watermark is the latest CHANGELOG entry id they've seen.
//
// Storage is per-device localStorage, mirroring useScoreDropReturn: this is a
// "have you looked at this yet" flag, not account state worth a Firestore write
// on every page view, and it's fine for it to reset on a reinstall.
//
// A tiny external store (useSyncExternalStore) backs it so every hook instance —
// the menu badge and the page that marks updates seen — stays in sync within the
// tab without prop-drilling or a context provider.

import { useCallback, useSyncExternalStore } from 'react';
import { countUnseenUpdates, latestUpdateId } from '../data/changelog';

const STORAGE_KEY = 'ma:lastSeenUpdateId';

const listeners = new Set<() => void>();

function readWatermark(): string | null {
  try {
    return window.localStorage.getItem(STORAGE_KEY);
  } catch {
    // Private mode / disabled storage: treat as "never seen" so the badge still
    // points a first-time visitor at the updates page.
    return null;
  }
}

function writeWatermark(id: string | null): void {
  try {
    if (id === null) window.localStorage.removeItem(STORAGE_KEY);
    else window.localStorage.setItem(STORAGE_KEY, id);
  } catch {
    // Best-effort; the badge simply won't clear across reloads.
  }
}

function emitChange(): void {
  for (const listener of listeners) listener();
}

function subscribe(onStoreChange: () => void): () => void {
  listeners.add(onStoreChange);
  // Another tab marking updates seen writes the same key; reflect it here too.
  const onStorage = (e: StorageEvent) => {
    if (e.key === STORAGE_KEY) onStoreChange();
  };
  window.addEventListener('storage', onStorage);
  return () => {
    listeners.delete(onStoreChange);
    window.removeEventListener('storage', onStorage);
  };
}

// getSnapshot returns a primitive string|null, compared by Object.is — stable
// across reads, so useSyncExternalStore won't loop even though we hit storage.
function getSnapshot(): string | null {
  return readWatermark();
}

// Server render (and the very first client paint before hydration) has no
// storage; report "never seen" so markup is deterministic.
function getServerSnapshot(): string | null {
  return null;
}

/** Persist that the director has seen every update up to the latest, and notify
 *  every live badge in the tab. Exported for direct use where a hook can't run. */
export function markUpdatesSeen(): void {
  writeWatermark(latestUpdateId());
  emitChange();
}

export interface UnseenUpdates {
  /** Count of changelog entries newer than the director's watermark. */
  unseenCount: number;
  hasUnseen: boolean;
  /** Mark all current updates as seen (clears the badge everywhere at once). */
  markAllSeen: () => void;
}

export function useUnseenUpdates(): UnseenUpdates {
  const lastSeenId = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const unseenCount = countUnseenUpdates(lastSeenId);

  const markAllSeen = useCallback(() => {
    markUpdatesSeen();
  }, []);

  return { unseenCount, hasUnseen: unseenCount > 0, markAllSeen };
}

export default useUnseenUpdates;
