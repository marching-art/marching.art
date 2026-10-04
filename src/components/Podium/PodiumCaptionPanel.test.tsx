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

describe('PodiumCaptionPanel book learned', () => {
  const realization = (learned: string[]) =>
    Object.fromEntries(CAPS.map((c) => [c, learned.includes(c) ? 1 : 0.8]));

  it('badges each fully learned caption', () => {
    render(<Panel podium={podiumWith({}, { captionRealization: realization(['B', 'P']) })} />);
    expect(screen.getAllByText('Whole book learned')).toHaveLength(2);
    expect(screen.queryByText(/more rehearsal won’t/)).toBeNull();
  });

  it('nudges toward a harder book when most captions max out early', () => {
    render(
      <Panel
        podium={podiumWith(
          { bookLearnedDay: { B: 20 } },
          { captionRealization: realization(['B', 'P', 'MA', 'GE1']) }
        )}
      />
    );
    expect(screen.getByText(/4 of 8 captions have learned their whole book/)).toBeTruthy();
  });

  it('stays quiet in Championship Week', () => {
    render(
      <Panel
        podium={podiumWith(
          {},
          { competitionDay: 47, captionRealization: realization(['B', 'P', 'MA', 'GE1']) }
        )}
      />
    );
    expect(screen.queryByText(/captions have learned their whole book/)).toBeNull();
  });
});
