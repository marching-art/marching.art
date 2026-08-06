// Focused on the optimistic block queue (queueAllocate), the one-thumb entry
// path: taps are accepted instantly, drained strictly one-at-a-time so the
// server's blockIndex check never sees a gap, and a bounce clears the queue
// and resyncs.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';

const getPodiumState = vi.fn();
const allocateRehearsalBlock = vi.fn();
vi.mock('../api/podium', () => ({
  getPodiumState: (...a: unknown[]) => getPodiumState(...a),
  allocateRehearsalBlock: (...a: unknown[]) => allocateRehearsalBlock(...a),
  // Unused by these tests, but the hook imports them.
  getPodiumRegistrationPreview: vi.fn(),
  setPodiumRestDay: vi.fn(),
  registerPodiumCorps: vi.fn(),
  setPodiumShows: vi.fn(),
  setPodiumFoodPlan: vi.fn(),
  setPodiumPlanTemplate: vi.fn(),
  commitPodiumBudget: vi.fn(),
  hirePodiumClinician: vi.fn(),
  acknowledgePodiumStaffOutlook: vi.fn(),
}));

import { usePodium } from './usePodium';

/** A getPodiumState payload with `used` blocks in. */
const stateWith = (used: number) => ({
  data: {
    exists: true,
    calendarDay: 10,
    competitionDay: 10,
    blocksUsedToday: used,
    maxBlocksToday: 12,
    blocksRemainingToday: 12 - used,
    state: { today: { calendarDay: 10, blocksUsed: used, blocks: [] }, condition: { stamina: 80 } },
  },
});

async function mountLoaded() {
  getPodiumState.mockResolvedValue(stateWith(0));
  const hook = renderHook(() => usePodium(true));
  await waitFor(() => expect(hook.result.current.data?.exists).toBe(true));
  return hook;
}

describe('usePodium — optimistic block queue', () => {
  beforeEach(() => {
    getPodiumState.mockReset();
    allocateRehearsalBlock.mockReset();
  });
  afterEach(() => vi.useRealTimers());

  it('accepts a tap instantly as pending, then confirms it', async () => {
    allocateRehearsalBlock.mockResolvedValue({
      data: {
        panel: {},
        today: { calendarDay: 10, blocksUsed: 1, blocks: ['brass'] },
        condition: { stamina: 79 },
        blocksRemaining: 11,
      },
    });
    const { result } = await mountLoaded();

    act(() => result.current.queueAllocate('brass'));
    // Optimistic: pending shows immediately.
    expect(result.current.pending.brass).toBe(1);

    await waitFor(() => expect(result.current.pending.brass ?? 0).toBe(0));
    expect(result.current.data.blocksUsedToday).toBe(1);
  });

  it('drains rapid taps strictly one at a time, in order', async () => {
    // Record the order allocations are SENT, and the concurrency.
    let inFlight = 0;
    let maxConcurrent = 0;
    const sent: string[] = [];
    allocateRehearsalBlock.mockImplementation(async ({ blockType }) => {
      inFlight += 1;
      maxConcurrent = Math.max(maxConcurrent, inFlight);
      sent.push(blockType);
      await new Promise((r) => setTimeout(r, 5));
      inFlight -= 1;
      return {
        data: {
          panel: {},
          today: { calendarDay: 10, blocksUsed: sent.length, blocks: sent.slice() },
          condition: { stamina: 80 },
          blocksRemaining: 12 - sent.length,
        },
      };
    });
    const { result } = await mountLoaded();

    act(() => {
      result.current.queueAllocate('brass');
      result.current.queueAllocate('perc');
      result.current.queueAllocate('brass');
    });
    // All three are visible as pending at once.
    expect(result.current.pending.brass).toBe(2);
    expect(result.current.pending.perc).toBe(1);

    await waitFor(() => expect(sent.length).toBe(3));
    expect(maxConcurrent).toBe(1); // never two in flight — the blockIndex guard
    expect(sent).toEqual(['brass', 'perc', 'brass']);
  });

  it('reads the blockIndex the previous confirmation advanced', async () => {
    const indices: number[] = [];
    allocateRehearsalBlock.mockImplementation(async ({ blockIndex }) => {
      indices.push(blockIndex);
      const used = indices.length;
      return {
        data: {
          panel: {},
          today: { calendarDay: 10, blocksUsed: used, blocks: [] },
          condition: { stamina: 80 },
          blocksRemaining: 12 - used,
        },
      };
    });
    const { result } = await mountLoaded();

    act(() => {
      result.current.queueAllocate('brass');
      result.current.queueAllocate('perc');
    });
    await waitFor(() => expect(indices.length).toBe(2));
    // Each allocate saw the index the prior one advanced to (0 then 1).
    expect(indices).toEqual([0, 1]);
  });

  it('clears the queue and resyncs when a block bounces', async () => {
    allocateRehearsalBlock
      .mockResolvedValueOnce({
        data: {
          panel: {},
          today: { calendarDay: 10, blocksUsed: 1, blocks: ['brass'] },
          condition: { stamina: 80 },
          blocksRemaining: 11,
        },
      })
      .mockRejectedValueOnce(new Error('All 12 blocks are used for today.'));
    // The resync after the bounce refetches a clean state.
    getPodiumState.mockResolvedValue(stateWith(1));

    const { result } = await mountLoaded();
    getPodiumState.mockClear();

    act(() => {
      result.current.queueAllocate('brass');
      result.current.queueAllocate('perc'); // this one will bounce
    });

    await waitFor(() => expect(result.current.error).toMatch(/12 blocks/));
    // The optimistic queue is abandoned and the truth reloaded.
    expect(result.current.pending).toEqual({});
    expect(getPodiumState).toHaveBeenCalled();
  });
});
