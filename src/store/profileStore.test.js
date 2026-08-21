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

const { mockOnSnapshot, mockIsAdmin } = vi.hoisted(() => ({
  mockOnSnapshot: vi.fn(),
  mockIsAdmin: vi.fn(async () => false),
}));

vi.mock('../api', () => ({
  db: {},
  functions: {},
  paths: {
    userProfile: (/** @type {string} */ uid) => `artifacts/test-ns/users/${uid}/profile/data`,
  },
  adminHelpers: { isAdmin: mockIsAdmin },
}));

vi.mock('../api/functions', () => ({
  completeDailyChallenge: mockCallable,
  submitPrediction: vi.fn(),
  resolvePredictions: vi.fn(),
}));

vi.mock('../components/xpFeedbackTrigger', () => ({
  triggerXPFeedback: mockTriggerXPFeedback,
}));

vi.mock('firebase/firestore', () => ({
  doc: vi.fn((db, path) => ({ path })),
  onSnapshot: mockOnSnapshot,
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

/**
 * @param {any} profile
 * @param {string} [uid]
 */
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

describe('profileStore.initProfileListener — cache vs. server not-exists', () => {
  /**
   * Grab the snapshot handler passed to onSnapshot. It is the first function
   * argument after the doc ref and the { includeMetadataChanges } options.
   * @returns {(snap: any) => void}
   */
  const getSnapshotHandler = () => {
    const call = mockOnSnapshot.mock.calls[mockOnSnapshot.mock.calls.length - 1];
    const handler = call.find((arg) => typeof arg === 'function');
    return handler;
  };

  /**
   * @param {boolean} exists
   * @param {boolean} fromCache
   * @param {any} [data]
   */
  const makeSnap = (exists, fromCache, data = {}) => ({
    exists: () => exists,
    data: () => data,
    metadata: { fromCache },
  });

  beforeEach(() => {
    vi.clearAllMocks();
    mockOnSnapshot.mockReturnValue(() => {});
    mockIsAdmin.mockResolvedValue(false);
    useProfileStore.getState().cleanup();
  });

  test('subscribes with includeMetadataChanges so server confirmation arrives', () => {
    useProfileStore.getState().initProfileListener('user-1');
    const call = mockOnSnapshot.mock.calls[0];
    expect(call).toEqual(
      expect.arrayContaining([expect.objectContaining({ includeMetadataChanges: true })])
    );
  });

  test('does NOT treat a cache-sourced not-exists snapshot as "no profile"', () => {
    useProfileStore.getState().initProfileListener('user-1');
    const onNext = getSnapshotHandler();

    // Established user whose profile is not in this device's local cache: the
    // first snapshot is empty AND fromCache. Concluding "no profile" here is
    // exactly what wrongly bounced mobile users into onboarding.
    onNext(makeSnap(false, true));

    const state = useProfileStore.getState();
    expect(state.profile).toBe(null);
    // loading stays true, so ProtectedRoute holds the loading screen rather
    // than redirecting to /onboarding.
    expect(state.loading).toBe(true);
  });

  test('treats a server-confirmed not-exists snapshot as "no profile"', () => {
    useProfileStore.getState().initProfileListener('user-1');
    const onNext = getSnapshotHandler();

    // Cache miss first...
    onNext(makeSnap(false, true));
    // ...then the server confirms there is genuinely no profile.
    onNext(makeSnap(false, false));

    const state = useProfileStore.getState();
    expect(state.profile).toBe(null);
    expect(state.loading).toBe(false);
  });

  test('loads the profile from a cache-sourced snapshot when it exists', () => {
    useProfileStore.getState().initProfileListener('user-1');
    const onNext = getSnapshotHandler();

    // Returning user with a cached profile: load immediately, even fromCache.
    onNext(makeSnap(true, true, { uid: 'user-1', corps: { soundSport: { name: 'Cadets' } } }));

    const state = useProfileStore.getState();
    expect(state.profile).toEqual(expect.objectContaining({ uid: 'user-1' }));
    expect(state.loading).toBe(false);
  });

  test('recovers when the server snapshot arrives after an empty cache read', () => {
    useProfileStore.getState().initProfileListener('user-1');
    const onNext = getSnapshotHandler();

    // Stalled mobile transport: empty cache read, still loading...
    onNext(makeSnap(false, true));
    expect(useProfileStore.getState().loading).toBe(true);

    // ...transport recovers and the real profile lands.
    onNext(makeSnap(true, false, { uid: 'user-1' }));

    const state = useProfileStore.getState();
    expect(state.profile).toEqual(expect.objectContaining({ uid: 'user-1' }));
    expect(state.loading).toBe(false);
  });
});
