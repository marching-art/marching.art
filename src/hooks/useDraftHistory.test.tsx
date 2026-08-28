import { describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useDraftHistory } from './useDraftHistory';

describe('useDraftHistory', () => {
  it('arms undo after an edit and walks back/forward', () => {
    const { result } = renderHook(() => useDraftHistory<{ n: string }>());
    act(() => result.current.reset({ n: 'a' }));
    expect(result.current.canUndo).toBe(false);
    act(() => result.current.set({ n: 'b' }));
    expect(result.current.canUndo).toBe(true);
    act(() => result.current.undo());
    expect(result.current.present).toEqual({ n: 'a' });
    expect(result.current.canRedo).toBe(true);
    act(() => result.current.redo());
    expect(result.current.present).toEqual({ n: 'b' });
  });

  it('coalesces rapid bursts (a color-picker drag) into one undo step', () => {
    vi.useFakeTimers();
    try {
      const { result } = renderHook(() => useDraftHistory<{ n: number }>());
      act(() => result.current.reset({ n: 0 }));
      act(() => result.current.set({ n: 1 }));
      vi.advanceTimersByTime(1000);
      // a burst: three edits inside the coalesce window
      act(() => result.current.set({ n: 2 }));
      act(() => result.current.set({ n: 3 }));
      act(() => result.current.set({ n: 4 }));
      act(() => result.current.undo());
      // one undo unwinds the whole burst back to the pre-burst state
      expect(result.current.present).toEqual({ n: 1 });
    } finally {
      vi.useRealTimers();
    }
  });

  it('reset clears both stacks (context switch, not an edit)', () => {
    const { result } = renderHook(() => useDraftHistory<{ n: string }>());
    act(() => result.current.reset({ n: 'a' }));
    act(() => result.current.set({ n: 'b' }));
    act(() => result.current.undo());
    expect(result.current.canRedo).toBe(true);
    act(() => result.current.reset({ n: 'z' }));
    expect(result.current.canUndo).toBe(false);
    expect(result.current.canRedo).toBe(false);
    expect(result.current.present).toEqual({ n: 'z' });
  });
});
