// The once-a-season book rewrite card: collapsed by default, family presets,
// submits the picked captions + level, summarizes a used rewrite, and closes
// after the window.
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import type { ComponentType } from 'react';
import BookRewriteCard from './BookRewriteCard';

const Card = BookRewriteCard as unknown as ComponentType<Record<string, unknown>>;
const CAPS = ['GE1', 'GE2', 'VP', 'VA', 'CG', 'B', 'MA', 'P'];
const terms = {
  fee: 100,
  lastDay: 35,
  maxCaptions: 3,
  raiseKeepContentPct: 75,
  raiseKeepCleanPct: 70,
};

const podiumWith = (dataOverrides: Record<string, unknown> = {}, stateOverrides = {}) => ({
  data: {
    competitionDay: 10,
    bookRewriteTerms: terms,
    state: {
      captions: Object.fromEntries(
        CAPS.map((c) => [c, { content: 0.6, clean: 0.4, challenge: 5 }])
      ),
      ...stateOverrides,
    },
    ...dataOverrides,
  },
  rewriteBook: vi.fn().mockResolvedValue({ success: true }),
});

describe('BookRewriteCard', () => {
  it('starts collapsed and names the window', () => {
    render(<Card podium={podiumWith()} />);
    expect(screen.getByText(/Rewrite the book \(once a season, through Day 35\)/)).toBeTruthy();
  });

  it('rewrites a caption family to the chosen level', async () => {
    const podium = podiumWith();
    render(<Card podium={podium} />);
    fireEvent.click(screen.getByText(/Rewrite the book \(once a season/));
    expect(screen.getByText(/keep 75% of what’s installed/)).toBeTruthy();
    fireEvent.click(screen.getByText('Music'));
    fireEvent.click(screen.getByText('Rewrite · 100 Budget'));
    await waitFor(() => expect(podium.rewriteBook).toHaveBeenCalledWith(['B', 'MA', 'P'], 8));
  });

  it('summarizes a used rewrite', () => {
    render(
      <Card
        podium={podiumWith({}, { bookRewrite: { day: 9, toLevel: 8, from: { B: 5, P: 5 } } })}
      />
    );
    expect(screen.getByText(/Book rewritten on Day 9/)).toBeTruthy();
  });

  it('is gone after the window closes', () => {
    const { container } = render(<Card podium={podiumWith({ competitionDay: 36 })} />);
    expect(container.textContent).toBe('');
  });
});
