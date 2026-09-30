import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import type { User } from 'firebase/auth';

const { claimDailyLogin, fakeStore } = vi.hoisted(() => ({
  claimDailyLogin: vi.fn(),
  // Zustand hooks are called with a selector; apply it to a fixed state.
  fakeStore:
    (state: Record<string, unknown>) => (selector: (s: Record<string, unknown>) => unknown) =>
      selector(state),
}));
vi.mock('../api/functions', () => ({ claimDailyLogin: () => claimDailyLogin() }));
vi.mock('../utils/dailyLoginPayoff', () => ({ surfaceDailyLoginPayoff: vi.fn() }));
vi.mock('../lib/offlineLineupQueue', () => ({ initOfflineLineupReplay: () => () => {} }));
vi.mock('../lib/pendingRedirect', () => ({ clearPendingRedirect: vi.fn() }));
vi.mock('../lib/queryClient', () => ({ queryClient: { clear: vi.fn() } }));

vi.mock('../store/seasonStore', () => ({
  useSeasonStore: fakeStore({ initSeasonListener: () => {}, cleanup: () => {}, seasonUid: null }),
}));
vi.mock('../store/scheduleStore', () => ({
  useScheduleStore: fakeStore({ initScheduleListener: () => {}, cleanup: () => {} }),
}));
vi.mock('../store/profileStore', () => ({
  useProfileStore: fakeStore({
    initProfileListener: () => {},
    cleanup: () => {},
    profile: { uid: 'u1' },
  }),
}));

import { useAppBootstrap } from './useAppBootstrap';

const user = { uid: 'u1' } as User;
const flush = () => act(async () => {});

describe('useAppBootstrap daily login claim', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    window.localStorage.clear();
    claimDailyLogin.mockReset().mockResolvedValue({ data: { alreadyClaimed: false } });
  });
  afterEach(() => vi.useRealTimers());

  it('claims the next game day even when the UTC date has not changed', async () => {
    // 9 PM EDT Sep 29 — already Sep 30 in UTC, still the Sep 29 game day.
    vi.setSystemTime(new Date('2026-09-30T01:00:00Z'));
    const first = renderHook(() => useAppBootstrap(user));
    await flush();
    expect(claimDailyLogin).toHaveBeenCalledTimes(1);
    first.unmount();

    // Noon EDT Sep 30 — same UTC date as the evening visit, but a NEW game
    // day. The old UTC-keyed guard skipped this claim.
    vi.setSystemTime(new Date('2026-09-30T16:00:00Z'));
    renderHook(() => useAppBootstrap(user));
    await flush();
    expect(claimDailyLogin).toHaveBeenCalledTimes(2);
  });

  it('does not re-claim within the same game day', async () => {
    vi.setSystemTime(new Date('2026-09-30T16:00:00Z'));
    renderHook(() => useAppBootstrap(user)).unmount();
    await flush();
    // 1 AM EDT Oct 1 — before the 2 AM ET rollover, still the Sep 30 game day.
    vi.setSystemTime(new Date('2026-10-01T05:00:00Z'));
    renderHook(() => useAppBootstrap(user));
    await flush();
    expect(claimDailyLogin).toHaveBeenCalledTimes(1);
  });

  it('claims the new game day when an open tab regains focus after 2 AM ET', async () => {
    vi.setSystemTime(new Date('2026-10-01T05:00:00Z')); // 1 AM EDT
    renderHook(() => useAppBootstrap(user));
    await flush();
    expect(claimDailyLogin).toHaveBeenCalledTimes(1);

    vi.setSystemTime(new Date('2026-10-01T12:00:00Z')); // 8 AM EDT
    act(() => {
      window.dispatchEvent(new Event('focus'));
    });
    await flush();
    expect(claimDailyLogin).toHaveBeenCalledTimes(2);

    // A second focus the same game day is a no-op.
    act(() => {
      window.dispatchEvent(new Event('focus'));
    });
    await flush();
    expect(claimDailyLogin).toHaveBeenCalledTimes(2);
  });
});
