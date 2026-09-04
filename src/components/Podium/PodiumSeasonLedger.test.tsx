// The Podium season ledger derives each outing's medal from the corps'
// placement WITHIN ITS DIVISION that night — the same field the printed
// "place / field" reads against — at any show with a real field, never from
// a flag stored on the recap row.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { ComponentType, ReactElement } from 'react';

vi.mock('firebase/firestore', () => ({
  collection: vi.fn(() => ({})),
  getDocs: vi.fn(),
}));
vi.mock('../../api', () => ({ db: {} }));

import { getDocs } from 'firebase/firestore';
import PodiumSeasonLedger from './PodiumSeasonLedger';

const Ledger = PodiumSeasonLedger as unknown as ComponentType<Record<string, unknown>>;
const mockedGetDocs = getDocs as unknown as ReturnType<typeof vi.fn>;
const wrap = (ui: ReactElement) => render(<MemoryRouter>{ui}</MemoryRouter>);

const CAPS = ['GE1', 'GE2', 'VP', 'VA', 'CG', 'B', 'MA', 'P'];
const captions = (v: number) => Object.fromEntries(CAPS.map((c) => [c, v]));

const row = (uid: string, corpsName: string, division: string, totalScore: number, over = {}) => ({
  uid,
  corpsName,
  division,
  totalScore,
  geScore: totalScore / 2,
  visualScore: totalScore / 4,
  musicScore: totalScore / 4,
  captions: captions(totalScore / 8),
  ...over,
});

const withDays = (days: Array<{ day: number; recap: object }>) => {
  mockedGetDocs.mockResolvedValue({
    docs: days.map(({ day, recap }) => ({ id: String(day), data: () => recap })),
  });
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe('PodiumSeasonLedger', () => {
  it('medals follow the division placement, whatever the stored row says', async () => {
    withDays([
      {
        day: 26,
        recap: {
          shows: [
            {
              eventName: 'marching.art Houston',
              location: 'Houston, Texas',
              results: [
                row('w1', 'World One', 'worldClass', 80),
                row('w2', 'World Two', 'worldClass', 79),
                row('me', 'My Corps', 'aClass', 58.5, { medal: null, place: 3 }), // stale mixed-field rank
                row('a2', 'Second A', 'aClass', 57),
                row('a3', 'Third A', 'aClass', 56),
                row('a4', 'Fourth A', 'aClass', 55),
                row('a5', 'Fifth A', 'aClass', 54),
              ],
            },
          ],
        },
      },
      {
        day: 27,
        recap: {
          shows: [
            {
              eventName: 'Show of Shows',
              location: 'Rockford, IL',
              // A one-corps "show" is not a podium — even if a stale row says gold.
              results: [row('me', 'My Corps', 'aClass', 60, { medal: 'gold', place: 1 })],
            },
          ],
        },
      },
      {
        day: 28,
        recap: {
          shows: [
            {
              eventName: 'marching.art Denton',
              location: 'Denton, TX',
              // Second of a two-corps division at a six-corps show: a silver.
              results: [
                row('o1', 'Open One', 'openClass', 70),
                row('me', 'My Corps', 'aClass', 61),
                row('a2', 'Second A', 'aClass', 62),
                row('a3', 'Third A', 'aClass', 55),
                row('a4', 'Fourth A', 'aClass', 54),
                row('a5', 'Fifth A', 'aClass', 53),
              ],
            },
          ],
        },
      },
    ]);

    const { container } = wrap(<Ledger seasonUid="s1" uid="me" userCorpsName="My Corps" />);
    await screen.findAllByText(/Houston/);

    const rows = container.querySelectorAll('tbody tr');
    expect(rows).toHaveLength(3);
    expect(rows[0].textContent).toContain('1/5');
    expect(rows[0].querySelector('svg[aria-label="gold medal"]')).not.toBeNull();
    expect(rows[1].textContent).toContain('1/1');
    expect(rows[1].querySelector('svg[aria-label$="medal"]')).toBeNull();
    expect(rows[2].textContent).toContain('2/5');
    expect(rows[2].querySelector('svg[aria-label="silver medal"]')).not.toBeNull();
    // The summary strip counts the same medals.
    expect(screen.getByText('1G · 1S · 0B')).toBeTruthy();
  });
});
