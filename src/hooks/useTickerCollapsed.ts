// =============================================================================
// useTickerCollapsed — remembers whether the desktop score ticker is collapsed
// =============================================================================
// The ticker is a fixed strip that animates on every page, permanently. Some
// directors want it; some want the vertical room and the quiet back. This hook
// owns that preference and persists it across sessions, so GameShell can both
// skip rendering the ticker and reclaim its 32px from the main content offset.
//
// Extracted from GameShell so the persistence rule is unit-testable without
// mounting the whole shell (which pulls in every app-wide listener).

import { useCallback, useEffect, useState } from 'react';

const STORAGE_KEY = 'marching.art:tickerCollapsed';

function readInitial(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === '1';
  } catch {
    // Storage can throw in private mode or when disabled — default to expanded.
    return false;
  }
}

/**
 * @returns a `[collapsed, toggle]` tuple. `collapsed` is the persisted
 * preference; `toggle` flips and re-persists it.
 */
export function useTickerCollapsed(): readonly [boolean, () => void] {
  const [collapsed, setCollapsed] = useState<boolean>(readInitial);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, collapsed ? '1' : '0');
    } catch {
      // Non-fatal: the toggle still works for the current session.
    }
  }, [collapsed]);

  const toggle = useCallback(() => setCollapsed((value) => !value), []);

  return [collapsed, toggle] as const;
}
