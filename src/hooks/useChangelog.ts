// =============================================================================
// CHANGELOG STORE — one lazy load, shared by every consumer
// =============================================================================
// The changelog content is dynamic-imported (src/data/changelog.ts) so it stays
// out of the main bundle. Two things need it — the unseen-updates badge in the
// header and the /updates page — and neither should trigger its own fetch. This
// tiny external store loads the log once, caches it, and notifies subscribers
// when it arrives, so both consumers share a single request via useSyncExternalStore.
//
// Snapshot is `null` until the load resolves; consumers treat null as "not ready
// yet" (the badge shows nothing, the page shows a loading state). A failed load
// falls open to an empty array rather than leaving the app stuck on null.

import { useSyncExternalStore } from 'react';
import { loadChangelog, type ChangelogEntry } from '../data/changelog';

let entries: ChangelogEntry[] | null = null;
let loadStarted = false;
const listeners = new Set<() => void>();

function emitChange(): void {
  for (const listener of listeners) listener();
}

/** Kick off the (cached) load the first time anyone subscribes. */
function ensureLoadStarted(): void {
  if (loadStarted) return;
  loadStarted = true;
  loadChangelog()
    .then((loaded) => {
      entries = loaded;
      emitChange();
    })
    .catch(() => {
      // Fail open: an empty log is better than a permanently-pending badge/page.
      entries = [];
      emitChange();
    });
}

function subscribe(onStoreChange: () => void): () => void {
  listeners.add(onStoreChange);
  ensureLoadStarted();
  return () => {
    listeners.delete(onStoreChange);
  };
}

function getSnapshot(): ChangelogEntry[] | null {
  return entries;
}

// No changelog on the server / first paint; report "not ready" deterministically.
function getServerSnapshot(): ChangelogEntry[] | null {
  return null;
}

/** The loaded changelog entries, or `null` while the lazy chunk is still loading. */
export function useChangelog(): ChangelogEntry[] | null {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

/** The already-loaded entries without subscribing, or `null` if not loaded yet.
 *  For imperative callers (e.g. marking updates seen) outside a render. */
export function getLoadedChangelog(): ChangelogEntry[] | null {
  return entries;
}
