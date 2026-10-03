// The rehearsal grid shows what each block's NEXT tap is worth before the tap:
// the server's repeat ladder for that block today x its ensemble readiness.
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { ComponentType } from 'react';
import RehearsalPlanner from './RehearsalPlanner';

const Planner = RehearsalPlanner as unknown as ComponentType<Record<string, unknown>>;

const podiumWith = (overrides: Record<string, unknown> = {}) => ({
  data: {
    calendarDay: 12,
    competitionDay: 12,
    isShowDay: false,
    maxBlocksToday: 12,
    blocksUsedToday: 2,
    blocksRemainingToday: 10,
    rehearsalOpensAt: null,
    repeatLadder: [1, 1, 0.8, 0.65, 0.5],
    blockReadiness: { fullEnsemble: 0.65, visualEnsemble: 1 },
    state: {
      today: {
        calendarDay: 12,
        blocksUsed: 2,
        blocks: ['fullEnsemble', 'fullEnsemble'],
        restDay: false,
      },
      condition: { stamina: 80, morale: 80 },
      budget: { balance: 100 },
    },
    ...overrides,
  },
  lastPanel: null,
  queueAllocate: vi.fn(),
  declareRestDay: vi.fn(),
  reload: vi.fn(),
  pending: {},
});

// The label also appears in today's block log, so pick the copy inside a button.
const blockButton = (label: string) =>
  screen
    .getAllByText(label, { selector: 'span' })
    .map((el) => el.closest('button'))
    .find(Boolean) as HTMLButtonElement;

describe('RehearsalPlanner next-tap hint', () => {
  it('combines the repeat ladder with ensemble readiness', () => {
    render(<Planner podium={podiumWith()} />);
    // Third Full Ensemble today (ladder 0.8) at 65% readiness = 0.52.
    expect(blockButton('Full Ensemble').textContent).toContain('Next tap ×0.52');
    expect(blockButton('Full Ensemble').textContent).toContain('sections 65% ready');
    expect(blockButton('Full Ensemble').textContent).toContain('repeat');
  });

  it('stays quiet for a block whose next tap is full value', () => {
    render(<Planner podium={podiumWith()} />);
    expect(blockButton('Brass Sectionals').textContent).not.toContain('Next tap');
    expect(blockButton('Visual Ensemble').textContent).not.toContain('Next tap');
  });

  it('shows no hint when an older backend sends neither field', () => {
    render(<Planner podium={podiumWith({ repeatLadder: undefined, blockReadiness: undefined })} />);
    expect(blockButton('Full Ensemble').textContent).not.toContain('Next tap');
  });
});
