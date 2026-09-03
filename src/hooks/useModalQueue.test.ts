// The dashboard's automated-interrupt queue: one on screen at a time, and
// one per visit — the rest stay queued for the next mount (site review U-H4).
import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import {
  useModalQueue,
  MODAL_PRIORITY,
  MAX_INTERRUPTS_PER_VISIT,
  INTERRUPT_SHOWN_KEY,
  wasInterruptShownThisSession,
} from './useModalQueue';

beforeEach(() => sessionStorage.clear());

describe('useModalQueue', () => {
  it('shows the highest-priority modal first', () => {
    const { result } = renderHook(() => useModalQueue());
    act(() => {
      result.current.enqueue('onboarding', MODAL_PRIORITY.ONBOARDING);
      result.current.enqueue('seasonRecap', MODAL_PRIORITY.SEASON_RECAP);
    });
    expect(result.current.isActive('seasonRecap')).toBe(true);
    expect(result.current.isActive('onboarding')).toBe(false);
  });

  it('shows at most one interrupt per visit and leaves the rest queued', () => {
    const { result } = renderHook(() => useModalQueue());
    act(() => {
      result.current.enqueue('seasonRecap', MODAL_PRIORITY.SEASON_RECAP);
      result.current.enqueue('seasonSetup', MODAL_PRIORITY.SEASON_SETUP);
    });
    expect(result.current.isActive('seasonRecap')).toBe(true);

    act(() => result.current.dequeue());
    expect(result.current.currentModal).toBeNull();
    expect(result.current.isActive('seasonSetup')).toBe(false);
    expect(result.current.shownThisVisit).toBe(MAX_INTERRUPTS_PER_VISIT);

    // A later enqueue on the same visit is held too.
    act(() => result.current.enqueue('onboarding', MODAL_PRIORITY.ONBOARDING));
    expect(result.current.currentModal).toBeNull();
  });

  it('a fresh mount (the next visit) shows the next pending interrupt', () => {
    const first = renderHook(() => useModalQueue());
    act(() => {
      first.result.current.enqueue('seasonRecap', MODAL_PRIORITY.SEASON_RECAP);
    });
    act(() => first.result.current.dequeue());
    first.unmount();

    const second = renderHook(() => useModalQueue());
    act(() => second.result.current.enqueue('seasonSetup', MODAL_PRIORITY.SEASON_SETUP));
    expect(second.result.current.isActive('seasonSetup')).toBe(true);
  });

  it('stamps the session so other nudges can yield', () => {
    expect(wasInterruptShownThisSession()).toBe(false);
    const { result } = renderHook(() => useModalQueue());
    act(() => result.current.enqueue('seasonRecap', MODAL_PRIORITY.SEASON_RECAP));
    expect(wasInterruptShownThisSession()).toBe(true);
    expect(sessionStorage.getItem(INTERRUPT_SHOWN_KEY)).not.toBeNull();
  });

  it('a paused queue shows nothing until resumed', () => {
    const { result } = renderHook(() => useModalQueue());
    act(() => result.current.pauseQueue());
    act(() => result.current.enqueue('seasonRecap', MODAL_PRIORITY.SEASON_RECAP));
    expect(result.current.currentModal).toBeNull();
    act(() => result.current.resumeQueue());
    expect(result.current.isActive('seasonRecap')).toBe(true);
  });

  it('never re-shows a dismissed modal', () => {
    const { result } = renderHook(() => useModalQueue());
    act(() => result.current.enqueue('seasonRecap', MODAL_PRIORITY.SEASON_RECAP));
    act(() => result.current.dequeue());
    act(() => result.current.enqueue('seasonRecap', MODAL_PRIORITY.SEASON_RECAP));
    expect(result.current.currentModal).toBeNull();
  });
});
