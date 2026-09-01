import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('react-hot-toast', () => ({
  default: { success: vi.fn(), error: vi.fn() },
}));
vi.mock('../api/functions', () => ({
  saveLineup: vi.fn(),
}));

import toast from 'react-hot-toast';
import { saveLineup } from '../api/functions';
import {
  hasQueuedLineupSaves,
  isDecisiveSaveError,
  queueLineupSave,
  replayQueuedLineupSaves,
} from './offlineLineupQueue';

const LINEUP = { GE1: 'Blue Devils' };
const fnError = (code: string, message = code) => Object.assign(new Error(message), { code });

describe('offlineLineupQueue replay', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
    Object.defineProperty(navigator, 'onLine', { value: true, configurable: true });
  });
  afterEach(() => localStorage.clear());

  it('dequeues on success', async () => {
    queueLineupSave('u1', 'worldClass', LINEUP);
    vi.mocked(saveLineup).mockResolvedValue({ data: undefined } as never);
    await replayQueuedLineupSaves('u1');
    expect(saveLineup).toHaveBeenCalledWith({ lineup: LINEUP, corpsClass: 'worldClass' });
    expect(hasQueuedLineupSaves('u1')).toBe(false);
    expect(toast.success).toHaveBeenCalled();
  });

  it('dequeues on a decisive backend rejection and tells the user', async () => {
    queueLineupSave('u1', 'worldClass', LINEUP);
    vi.mocked(saveLineup).mockRejectedValue(
      fnError('functions/failed-precondition', 'Lineup changes are closed.')
    );
    await replayQueuedLineupSaves('u1');
    expect(hasQueuedLineupSaves('u1')).toBe(false);
    expect(toast.error).toHaveBeenCalledWith(
      expect.stringContaining('Lineup changes are closed.'),
      expect.anything()
    );
  });

  it('keeps the save queued on a transient failure while online (timeout, unavailable, internal)', async () => {
    queueLineupSave('u1', 'worldClass', LINEUP);
    for (const code of [
      'functions/deadline-exceeded',
      'functions/unavailable',
      'functions/internal',
    ]) {
      vi.mocked(saveLineup).mockRejectedValueOnce(fnError(code));
      await replayQueuedLineupSaves('u1');
      expect(hasQueuedLineupSaves('u1')).toBe(true);
    }
    expect(toast.error).not.toHaveBeenCalled();
  });

  it('gives up after repeated transient failures', async () => {
    queueLineupSave('u1', 'worldClass', LINEUP);
    vi.mocked(saveLineup).mockRejectedValue(fnError('functions/internal', 'boom'));
    for (let i = 0; i < 4; i += 1) {
      await replayQueuedLineupSaves('u1');
      expect(hasQueuedLineupSaves('u1')).toBe(true);
    }
    await replayQueuedLineupSaves('u1');
    expect(hasQueuedLineupSaves('u1')).toBe(false);
    expect(toast.error).toHaveBeenCalledTimes(1);
  });

  it('keeps the save when the connection drops mid-replay', async () => {
    queueLineupSave('u1', 'worldClass', LINEUP);
    vi.mocked(saveLineup).mockImplementation(async () => {
      Object.defineProperty(navigator, 'onLine', { value: false, configurable: true });
      throw fnError('functions/unavailable');
    });
    await replayQueuedLineupSaves('u1');
    expect(hasQueuedLineupSaves('u1')).toBe(true);
  });

  it('classifies codes', () => {
    expect(isDecisiveSaveError(fnError('functions/invalid-argument'))).toBe(true);
    expect(isDecisiveSaveError(fnError('functions/permission-denied'))).toBe(true);
    expect(isDecisiveSaveError(fnError('functions/unavailable'))).toBe(false);
    expect(isDecisiveSaveError(new Error('TypeError: fetch failed'))).toBe(false);
  });
});
