// src/utils/lazyWithRetry.js
import { lazy } from 'react';

const RETRY_FLAG_PREFIX = 'chunk-reload:';

/**
 * Detects the "stale chunk after deploy" family of dynamic-import errors.
 *
 * After a new deploy, Vite emits new hashed chunk filenames. A browser still
 * running the previous build requests an old chunk (e.g. Admin-B5uJcsw-.js)
 * that no longer exists. Vercel responds with its HTML 404 page, so the
 * dynamic import() rejects with one of these messages:
 *   - "Failed to fetch dynamically imported module"
 *   - "error loading dynamically imported module"
 *   - "Expected a JavaScript-or-Wasm module script but the server responded
 *      with a MIME type of 'text/html'"
 */
function isChunkLoadError(error) {
  if (!error) return false;
  const message = String(error.message || error);
  return (
    error.name === 'ChunkLoadError' ||
    /Failed to fetch dynamically imported module/i.test(message) ||
    /error loading dynamically imported module/i.test(message) ||
    /Importing a module script failed/i.test(message) ||
    /expected a javascript/i.test(message) ||
    /text\/html/i.test(message)
  );
}

function readFlag(key) {
  try {
    return window.sessionStorage?.getItem(key);
  } catch {
    return null;
  }
}

function writeFlag(key, value) {
  try {
    if (value === null) window.sessionStorage?.removeItem(key);
    else window.sessionStorage?.setItem(key, value);
  } catch {
    /* sessionStorage unavailable (private mode / SSR) - reload still works */
  }
}

/**
 * Drop-in replacement for React.lazy() that recovers from stale-chunk errors.
 *
 * On the first chunk-load failure for a given chunk, it forces a single full
 * page reload so the browser fetches the fresh index.html (with the new chunk
 * hashes). A per-chunk sessionStorage flag prevents an infinite reload loop:
 * if the import still fails after one reload, the error is genuine and is
 * re-thrown so the surrounding error boundary can render its fallback.
 *
 * @param {() => Promise<{ default: React.ComponentType<any> }>} importFn
 * @param {string} chunkName - stable identifier used for the reload guard.
 */
export function lazyWithRetry(importFn, chunkName) {
  return lazy(async () => {
    const flagKey = `${RETRY_FLAG_PREFIX}${chunkName || importFn.toString()}`;

    try {
      const module = await importFn();
      // Loaded successfully - clear any leftover reload guard for this chunk.
      writeFlag(flagKey, null);
      return module;
    } catch (error) {
      if (!readFlag(flagKey) && isChunkLoadError(error)) {
        // First stale-chunk failure: reload once to pick up the new build.
        writeFlag(flagKey, '1');
        window.location.reload();
        // Resolve never, so nothing renders in the moment before reload.
        return new Promise(() => {});
      }
      // Already retried once, or not a chunk error - surface to error boundary.
      throw error;
    }
  });
}

export default lazyWithRetry;
