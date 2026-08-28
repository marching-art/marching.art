// =============================================================================
// useDraftHistory — undo/redo stack for the Uniform Studio draft
// =============================================================================
// The Studio's draft is a small JSON design, and every edit already flows
// through one onChange — so full-state history is nearly free and makes the
// destructive actions (Surprise me, preset loads, fat-fingered toggles) safe
// to explore. Rapid successive edits (a native color-picker drag fires
// continuously) coalesce into one undo step; context switches (corps change,
// wardrobe load, code import) call reset() and clear both stacks.

import { useCallback, useRef, useState } from 'react';

export interface DraftHistory<T> {
  /** The current draft (null before the first init). */
  present: T | null;
  /** Record a user edit as an undoable step (coalesced when rapid). */
  set: (next: T) => void;
  /** Replace the draft wholesale and clear history (context switch). */
  reset: (next: T | null) => void;
  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;
}

interface Stacks<T> {
  past: T[];
  present: T | null;
  future: T[];
}

export function useDraftHistory<T>(coalesceMs = 300, cap = 100): DraftHistory<T> {
  const [stacks, setStacks] = useState<Stacks<T>>({ past: [], present: null, future: [] });
  const lastEditAt = useRef(0);

  const set = useCallback(
    (next: T) => {
      const now = Date.now();
      // Capture the previous edit time *before* updating the ref — the state
      // updater runs later (and possibly twice under StrictMode), so it must
      // only read captured values.
      const prevEditAt = lastEditAt.current;
      lastEditAt.current = now;
      setStacks((s) => {
        if (s.present === null) return { past: [], present: next, future: [] };
        // Coalesce a burst (color-picker drag) into the step that started it.
        const coalesce = now - prevEditAt < coalesceMs;
        const past = coalesce ? s.past : [...s.past, s.present].slice(-cap);
        return { past, present: next, future: [] };
      });
    },
    [coalesceMs, cap]
  );

  const reset = useCallback((next: T | null) => {
    lastEditAt.current = 0;
    setStacks({ past: [], present: next, future: [] });
  }, []);

  const undo = useCallback(() => {
    lastEditAt.current = 0;
    setStacks((s) => {
      if (s.past.length === 0 || s.present === null) return s;
      return {
        past: s.past.slice(0, -1),
        present: s.past[s.past.length - 1],
        future: [s.present, ...s.future],
      };
    });
  }, []);

  const redo = useCallback(() => {
    lastEditAt.current = 0;
    setStacks((s) => {
      if (s.future.length === 0 || s.present === null) return s;
      return {
        past: [...s.past, s.present],
        present: s.future[0],
        future: s.future.slice(1),
      };
    });
  }, []);

  return {
    present: stacks.present,
    set,
    reset,
    undo,
    redo,
    canUndo: stacks.past.length > 0,
    canRedo: stacks.future.length > 0,
  };
}
