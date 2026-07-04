// Tests for profileStore.completeDailyChallenge — the store half of the
// daily game loop. The heavy lifting (validation, XP award, ledger write)
// lives in the completeDailyChallenge callable; the store's job is the
// local short-circuit, the callable delegation, and the success feedback.
import { describe, test, expect, vi, beforeEach } from 'vitest';

const { mockCallable, mockToastSuccess, mockTriggerXPFeedback } = vi.hoisted(() => ({
  mockCallable: vi.fn(),
  mockToastSuccess: vi.fn(),
  mockTriggerXPFeedback: vi.fn(),
}));

vi.mock('../api', () => ({
  db: {},
  functions: {},
  paths: {
    userProfile: (uid) => `artifacts/test-ns/users/${uid}/profile/data`,
  },
}));

vi.mock('../api/functions', () => ({
  completeDailyChallenge: mockCallable,
}));

vi.mock('../components/xpFeedbackTrigger', () => ({
  triggerXPFeedback: mockTriggerXPFeedback,
}));

vi.mock('firebase/firestore', () => ({
  doc: vi.fn((db, path) => ({ path })),
  onSnapshot: vi.fn(() => () => {}),
  updateDoc: vi.fn(async () => {}),
}));

vi.mock('firebase/functions', () => ({
  httpsCallable: vi.fn(() => vi.fn(async () => ({ data: {} }))),
}));

vi.mock('react-hot-toast', () => ({
  default: { success: mockToastSuccess, error: vi.fn() },
}));

import { useProfileStore } from './profileStore';
import { getGameDay } from '../utils/dailyChallenges';

const seedStore = (profile, uid = 'user-1') => {
  useProfileStore.setState({ profile, _currentUid: uid });
};

describe('profileStore.completeDailyChallenge', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useProfileStore.setState({ profile: null, _currentUid: null });
  });

  test('returns false when no user is signed in', async () => {
    const ok = await useProfileStore.getState().completeDailyChallenge('visit-scores');
    expect(ok).toBe(false);
    expect(mockCallable).not.toHaveBeenCalled();
  });

  test('returns false when the profile has not loaded', async () => {
    useProfileStore.setState({ profile: null, _currentUid: 'user-1' });
    const ok = await useProfileStore.getState().completeDailyChallenge('visit-scores');
    expect(ok).toBe(false);
    expect(mockCallable).not.toHaveBeenCalled();
  });

  test('short-circuits without a call when today already shows completion', async () => {
    seedStore({
      challenges: { [getGameDay()]: [{ id: 'visit-scores', completed: true }] },
    });

    const ok = await useProfileStore.getState().completeDailyChallenge('visit-scores');
    expect(ok).toBe(false);
    expect(mockCallable).not.toHaveBeenCalled();
  });

  test('awards via the callable and surfaces the XP feedback', async () => {
    mockCallable.mockResolvedValueOnce({
      data: {
        success: true,
        xpAwarded: 10,
        challenge: { id: 'visit-scores', label: 'Check the leaderboard', xp: 10 },
      },
    });
    seedStore({ challenges: {} });

    const ok = await useProfileStore.getState().completeDailyChallenge('visit-scores');
    expect(ok).toBe(true);
    expect(mockCallable).toHaveBeenCalledWith({ challengeId: 'visit-scores' });
    expect(mockToastSuccess).toHaveBeenCalledWith(expect.stringContaining('+10 XP'));
    expect(mockTriggerXPFeedback).toHaveBeenCalledWith(10, 'xp');
  });

  test('returns false quietly when the challenge is not in rotation', async () => {
    mockCallable.mockResolvedValueOnce({
      data: { success: false, notInRotation: true, xpAwarded: 0 },
    });
    seedStore({ challenges: {} });

    const ok = await useProfileStore.getState().completeDailyChallenge('visit-hall');
    expect(ok).toBe(false);
    expect(mockToastSuccess).not.toHaveBeenCalled();
    expect(mockTriggerXPFeedback).not.toHaveBeenCalled();
  });

  test('returns false when the server reports an earlier completion', async () => {
    mockCallable.mockResolvedValueOnce({
      data: { success: true, alreadyCompleted: true, xpAwarded: 0 },
    });
    seedStore({ challenges: {} });

    const ok = await useProfileStore.getState().completeDailyChallenge('visit-scores');
    expect(ok).toBe(false);
    expect(mockToastSuccess).not.toHaveBeenCalled();
  });

  test('returns false and does not throw when the callable fails', async () => {
    mockCallable.mockRejectedValueOnce(new Error('unavailable'));
    seedStore({ challenges: {} });

    const ok = await useProfileStore.getState().completeDailyChallenge('visit-scores');
    expect(ok).toBe(false);
    expect(mockTriggerXPFeedback).not.toHaveBeenCalled();
  });
});
