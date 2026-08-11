import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useUnseenUpdates, markUpdatesSeen } from './useUnseenUpdates';
import { CHANGELOG } from '../data/changelog';

describe('useUnseenUpdates', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('reports every update as unseen on a fresh device', () => {
    const { result } = renderHook(() => useUnseenUpdates());
    expect(result.current.unseenCount).toBe(CHANGELOG.length);
    expect(result.current.hasUnseen).toBe(true);
  });

  it('clears the badge after marking updates seen', () => {
    const { result } = renderHook(() => useUnseenUpdates());
    act(() => result.current.markAllSeen());
    expect(result.current.unseenCount).toBe(0);
    expect(result.current.hasUnseen).toBe(false);
  });

  it('keeps two hook instances in sync when one marks seen', () => {
    const a = renderHook(() => useUnseenUpdates());
    const b = renderHook(() => useUnseenUpdates());
    expect(b.result.current.hasUnseen).toBe(true);

    act(() => a.result.current.markAllSeen());

    // The badge (instance b) reflects instance a's mark without its own action.
    expect(b.result.current.unseenCount).toBe(0);
  });

  it('markUpdatesSeen persists the latest id to storage', () => {
    markUpdatesSeen();
    expect(window.localStorage.getItem('ma:lastSeenUpdateId')).toBe(CHANGELOG[0].id);
  });
});
