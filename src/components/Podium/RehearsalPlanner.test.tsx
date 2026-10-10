// Discovery over disclosure (PODIUM.md decision 47): the planner reports what
// each tap added, never the hidden repeat / readiness multipliers behind it.
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
  lastPanel: null as unknown,
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

describe('RehearsalPlanner keeps the mechanics hidden', () => {
  it('shows no per-block value hints', () => {
    render(<Planner podium={podiumWith()} />);
    expect(blockButton('Full Ensemble').textContent).not.toMatch(/Next tap|ready|×0/);
  });

  it('reports what a tap added, without repeat or readiness multipliers', () => {
    const podium = podiumWith();
    podium.lastPanel = {
      blockType: 'fullEnsemble',
      gains: { GE1: { content: 0.012, clean: 0.004 } },
      repeatMult: 0.8,
      readinessMult: 0.65,
    };
    render(<Planner podium={podium} />);
    expect(screen.getByText(/Action complete/)).toBeTruthy();
    expect(screen.getByText('+1.2%')).toBeTruthy();
    expect(screen.queryByText(/repeat yield|ensemble readiness/)).toBeNull();
  });

  it('names the joint rehearsal partner on a sharpened Full Ensemble, without the bonus size', () => {
    const podium = podiumWith();
    podium.lastPanel = {
      blockType: 'fullEnsemble',
      gains: { GE1: { content: 0.015, clean: 0.005 } },
      jointBoost: 0.25,
      jointPartner: 'Blue Stars',
    };
    render(<Planner podium={podium} />);
    expect(screen.getByText(/Joint rehearsal with Blue Stars/)).toBeTruthy();
    expect(screen.queryByText(/25%|×1\.25/)).toBeNull();
  });
});

describe('RehearsalPlanner morale: outcomes, not thresholds', () => {
  const withMorale = (morale: number, extra: Record<string, unknown> = {}) => {
    const podium = podiumWith();
    const data = podium.data as Record<string, unknown>;
    data.state = { ...(data.state as object), condition: { stamina: 80, morale }, ...extra };
    return podium;
  };

  it('gives no sustainable-load or attrition-line warnings, even at low morale', () => {
    render(<Planner podium={withMorale(20)} />);
    expect(screen.queryByText(/sustainable|near the line|may quit|Rest the corps/)).toBeNull();
  });

  it('reports a recent departure after it happens', () => {
    render(<Planner podium={withMorale(25, { lastAttrition: { day: 11, caption: 'B' } })} />);
    expect(screen.getByText(/member quit on Day 11/)).toBeTruthy();
  });

  it('keeps the show-day banner free of block values', () => {
    render(<Planner podium={podiumWith({ isShowDay: true })} />);
    expect(screen.getByText('Light run-through before the show')).toBeTruthy();
  });
});
