import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useUnseenUpdates, markUpdatesSeen } from './useUnseenUpdates';
import type { ChangelogEntry } from '../data/changelog';
import rawEntries from '../data/changelogEntries.json';

const CHANGELOG = rawEntries as ChangelogEntry[];

// The changelog now loads lazily (dynamic import), so the badge count starts at
// 0 and settles once the chunk resolves — every assertion waits for that.
describe('useUnseenUpdates', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('reports every update as unseen on a fresh device', async () => {
    const { result } = renderHook(() => useUnseenUpdates());
    await waitFor(() => expect(result.current.unseenCount).toBe(CHANGELOG.length));
    expect(result.current.hasUnseen).toBe(true);
  });

  it('clears the badge after marking updates seen', async () => {
    const { result } = renderHook(() => useUnseenUpdates());
    await waitFor(() => expect(result.current.unseenCount).toBe(CHANGELOG.length));

    act(() => result.current.markAllSeen());
    await waitFor(() => expect(result.current.unseenCount).toBe(0));
    expect(result.current.hasUnseen).toBe(false);
  });

  it('keeps two hook instances in sync when one marks seen', async () => {
    const a = renderHook(() => useUnseenUpdates());
    const b = renderHook(() => useUnseenUpdates());
    await waitFor(() => expect(b.result.current.hasUnseen).toBe(true));

    act(() => a.result.current.markAllSeen());

    // The badge (instance b) reflects instance a's mark without its own action.
    await waitFor(() => expect(b.result.current.unseenCount).toBe(0));
  });

  it('markUpdatesSeen persists the latest id to storage', async () => {
    markUpdatesSeen();
    await waitFor(() =>
      expect(window.localStorage.getItem('ma:lastSeenUpdateId')).toBe(CHANGELOG[0].id)
    );
  });
});
