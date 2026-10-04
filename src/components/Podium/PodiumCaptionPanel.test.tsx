// The caption panel names the judges' tapes from the latest show and marks
// the two captions they cleaned.
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { ComponentType } from 'react';
import PodiumCaptionPanel from './PodiumCaptionPanel';

const Panel = PodiumCaptionPanel as unknown as ComponentType<Record<string, unknown>>;
const CAPS = ['GE1', 'GE2', 'VP', 'VA', 'CG', 'B', 'MA', 'P'];

const podiumWith = (
  stateOverrides: Record<string, unknown> = {},
  dataOverrides: Record<string, unknown> = {}
) => ({
  data: {
    competitionDay: 25,
    ...dataOverrides,
    state: {
      repTier: 2,
      captions: Object.fromEntries(
        CAPS.map((c) => [c, { content: 0.6, clean: 0.4, challenge: 5, lastRehearsedDay: 24 }])
      ),
      ...stateOverrides,
    },
  },
});

describe('PodiumCaptionPanel judges’ tapes', () => {
  it('names the flagged captions from the latest show', () => {
    render(<Panel podium={podiumWith({ lastTapes: { day: 24, captions: ['CG', 'VA'] } })} />);
    expect(screen.getByText(/Judges’ tapes, Day 24/)).toBeTruthy();
    expect(screen.getAllByText('Worked from the judges’ tapes')).toHaveLength(2);
  });

  it('stays quiet before the first show', () => {
    render(<Panel podium={podiumWith()} />);
    expect(screen.queryByText(/Judges’ tapes/)).toBeNull();
  });
});
