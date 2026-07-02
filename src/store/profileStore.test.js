// Tests for profileStore.completeDailyChallenge — the store half of the
// daily game loop. Firebase modules are mocked; the store's challenge state
// machine (existing / already-complete / unseeded / unknown) and the shape
// of the Firestore write are the units under test.
import { describe, test, expect, vi, beforeEach } from 'vitest';

const { mockUpdateDoc, mockToastSuccess } = vi.hoisted(() => ({
  mockUpdateDoc: vi.fn(async () => {}),
  mockToastSuccess: vi.fn(),
}));

vi.mock('../api', () => ({
  db: {},
  functions: {},
  paths: {
    userProfile: (uid) => `artifacts/test-ns/users/${uid}/profile/data`,
  },
}));

vi.mock('firebase/firestore', () => ({
  doc: vi.fn((db, path) => ({ path })),
  onSnapshot: vi.fn(() => () => {}),
  updateDoc: mockUpdateDoc,
}));

vi.mock('firebase/functions', () => ({
  httpsCallable: vi.fn(() => vi.fn(async () => ({ data: {} }))),
}));

vi.mock('react-hot-toast', () => ({
  default: { success: mockToastSuccess, error: vi.fn() },
}));

import { useProfileStore } from './profileStore';
import { getGameDay, CHALLENGE_DEFINITIONS } from '../utils/dailyChallenges';

const seedStore = (profile, uid = 'user-1') => {
  useProfileStore.setState({ profile, _currentUid: uid });
};

describe('profileStore.completeDailyChallenge', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useProfileStore.setState({ profile: null, _currentUid: null });
  });

  test('returns false when no user is signed in', async () => {
    const ok = await useProfileStore.getState().completeDailyChallenge('check_leaderboard');
    expect(ok).toBe(false);
    expect(mockUpdateDoc).not.toHaveBeenCalled();
  });

  test('returns false when the profile has not loaded', async () => {
    useProfileStore.setState({ profile: null, _currentUid: 'user-1' });
    const ok = await useProfileStore.getState().completeDailyChallenge('check_leaderboard');
    expect(ok).toBe(false);
    expect(mockUpdateDoc).not.toHaveBeenCalled();
  });

  test('returns false for an unknown challenge id', async () => {
    seedStore({ challenges: {} });
    const ok = await useProfileStore.getState().completeDailyChallenge('not_a_challenge');
    expect(ok).toBe(false);
    expect(mockUpdateDoc).not.toHaveBeenCalled();
  });

  test('completes an existing incomplete challenge for today', async () => {
    const today = getGameDay();
    seedStore({
      challenges: {
        [today]: [
          {
            id: 'check_leaderboard',
            title: 'Scout',
            reward: '25 XP',
            progress: 0,
            target: 1,
            completed: false,
          },
        ],
      },
    });

    const ok = await useProfileStore.getState().completeDailyChallenge('check_leaderboard');
    expect(ok).toBe(true);

    const [ref, payload] = mockUpdateDoc.mock.calls[0];
    expect(ref.path).toBe('artifacts/test-ns/users/user-1/profile/data');
    // Only the client-owned challenges field may be written
    expect(Object.keys(payload)).toEqual(['challenges']);
    const written = payload.challenges[today].find((c) => c.id === 'check_leaderboard');
    expect(written.completed).toBe(true);
    expect(written.progress).toBe(written.target);
    expect(mockToastSuccess).toHaveBeenCalledWith(expect.stringContaining('+25 XP'));
  });

  test('is idempotent: an already-completed challenge returns false without a write', async () => {
    const today = getGameDay();
    seedStore({
      challenges: {
        [today]: [
          { id: 'check_leaderboard', title: 'Scout', progress: 1, target: 1, completed: true },
        ],
      },
    });

    const ok = await useProfileStore.getState().completeDailyChallenge('check_leaderboard');
    expect(ok).toBe(false);
    expect(mockUpdateDoc).not.toHaveBeenCalled();
  });

  test('creates a known challenge on the fly when today is unseeded', async () => {
    seedStore({ challenges: {} });

    const ok = await useProfileStore.getState().completeDailyChallenge('maintain_equipment');
    expect(ok).toBe(true);

    const [, payload] = mockUpdateDoc.mock.calls[0];
    const today = getGameDay();
    expect(payload.challenges[today]).toEqual([CHALLENGE_DEFINITIONS.maintain_equipment]);
  });

  test('prunes challenge history beyond 30 day-buckets on write', async () => {
    const oldChallenges = {};
    for (let i = 1; i <= 40; i++) {
      oldChallenges[new Date(2020, 0, i).toDateString()] = [{ id: 'old' }];
    }
    seedStore({ challenges: oldChallenges });

    await useProfileStore.getState().completeDailyChallenge('check_leaderboard');

    const [, payload] = mockUpdateDoc.mock.calls[0];
    expect(Object.keys(payload.challenges)).toHaveLength(30);
    // Today's bucket (the newest) must survive pruning
    expect(payload.challenges[getGameDay()]).toBeDefined();
  });

  test('returns false and does not throw when the write fails', async () => {
    mockUpdateDoc.mockRejectedValueOnce(new Error('permission-denied'));
    seedStore({ challenges: {} });

    const ok = await useProfileStore.getState().completeDailyChallenge('check_leaderboard');
    expect(ok).toBe(false);
  });
});
