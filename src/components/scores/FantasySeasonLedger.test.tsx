// Tests for the fantasy season caption ledger. Unlike the public Scores tab
// (GE/VIS/MUS only, to keep lineups unharvestable), this private dashboard
// module shows the director their OWN full 8-caption breakdown. It reads the
// owner-only captionLedger day docs the nightly scorer writes, filters to the
// active class, and joins placement in from the public class recaps. These
// tests pin the class filter, the per-caption rendering, and the placement join.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { ComponentType, ReactElement } from 'react';

vi.mock('firebase/firestore', () => ({
  collection: vi.fn(() => ({})),
  getDocs: vi.fn(),
}));
// The component reads db + paths from the api barrel; stub both.
vi.mock('../../api', () => ({
  db: {},
  paths: { userCaptionLedgerDays: (uid: string, s: string) => `u/${uid}/${s}` },
}));

import { getDocs } from 'firebase/firestore';
import FantasySeasonLedger from './FantasySeasonLedger';

const Ledger = FantasySeasonLedger as unknown as ComponentType<Record<string, unknown>>;
const mockedGetDocs = getDocs as unknown as ReturnType<typeof vi.fn>;
const wrap = (ui: ReactElement) => render(<MemoryRouter>{ui}</MemoryRouter>);

const CAPS = ['GE1', 'GE2', 'VP', 'VA', 'CG', 'B', 'MA', 'P'];

/** A full 8-caption breakdown where every caption equals `v`. */
const captions = (v: number) => Object.fromEntries(CAPS.map((c) => [c, v]));

/** One outing as the scorer writes it into a caption-ledger day doc. */
const outing = (corpsClass: string, eventName: string, cap: number, over = {}) => ({
  corpsClass,
  corpsName: 'My Corps',
  eventName,
  location: 'Anywhere, USA',
  captions: captions(cap),
  geScore: cap * 2,
  visualScore: (cap * 3) / 2,
  musicScore: (cap * 3) / 2,
  totalScore: cap * 2 + cap * 3,
  ...over,
});

const withDays = (days: Array<{ day: number; outings: object[] }>) => {
  mockedGetDocs.mockResolvedValue({
    docs: days.map(({ day, outings: o }) => ({
      id: String(day),
      data: () => ({ day, outings: o }),
    })),
  });
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe('FantasySeasonLedger', () => {
  it('shows only the active class, oldest first, with individual captions', async () => {
    withDays([
      {
        day: 20,
        outings: [outing('worldClass', 'DCI Atlanta', 15), outing('openClass', 'DCI Atlanta', 12)],
      },
      { day: 12, outings: [outing('worldClass', 'DCI Broken Arrow', 14)] },
    ]);

    const { container } = wrap(
      <Ledger seasonUid="s1" uid="me" corpsClass="worldClass" userCorpsName="My Corps" />
    );
    await screen.findAllByText(/broken arrow/i);

    const rows = container.querySelectorAll('tbody tr');
    expect(rows).toHaveLength(2); // world class only — the open-class outing is filtered out
    expect(rows[0].textContent).toContain('Broken Arrow'); // day 12 sorts before day 20
    expect(rows[1].textContent).toContain('Atlanta');

    // The whole point: individual caption values are rendered — all 8 caption
    // cells on day 12 read 14.00 (the public recap would show only GE/VIS/MUS).
    expect(within(rows[0] as HTMLElement).getAllByText('14.00')).toHaveLength(CAPS.length);
  });

  it('joins placement within class from the public recaps', async () => {
    withDays([{ day: 12, outings: [outing('worldClass', 'DCI Broken Arrow', 15)] }]);
    // Public class recap: a rival outscored me at the same show, so I place 2/2.
    const publicShows = [
      {
        offSeasonDay: 12,
        eventName: 'DCI Broken Arrow',
        scores: [
          { uid: 'rival', score: 95 },
          { uid: 'me', score: 75 },
        ],
      },
    ];

    const { container } = wrap(
      <Ledger
        seasonUid="s1"
        uid="me"
        corpsClass="worldClass"
        userCorpsName="My Corps"
        publicShows={publicShows}
      />
    );
    await screen.findAllByText(/broken arrow/i);

    const row = container.querySelector('tbody tr') as HTMLElement;
    expect(within(row).getByText('2')).toBeInTheDocument();
    expect(row.textContent).toContain('/2');
  });

  it('shows the empty state before any scored outing', async () => {
    withDays([]);
    wrap(<Ledger seasonUid="s1" uid="me" corpsClass="worldClass" userCorpsName="My Corps" />);
    expect(await screen.findByText(/no scored outings yet/i)).toBeInTheDocument();
  });
});
