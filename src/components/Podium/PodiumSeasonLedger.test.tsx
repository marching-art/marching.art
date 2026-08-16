// Tests for the Podium season recap ledger: the community-requested "running
// ledger of your stats, show to show." It reads the same public podium-recaps
// collection the recap sheet does, then keeps ONLY the viewer's own row from
// each show — so these tests pin the filtering (mine vs. everyone else), the
// chronological one-line-per-outing shape, the season aggregates, and the
// divisional placement it derives.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { ComponentType, ReactElement } from 'react';

// The ledger reads podium-recaps directly; api/client initializes Firebase at
// module load, so both the client and the query layer are mocked out.
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

/** One corps' row as the Podium processor writes it. */
const row = (
  uid: string,
  totalScore: number,
  division = 'worldClass',
  overrides: Record<string, unknown> = {}
) => ({
  uid,
  corpsName: uid,
  division,
  totalScore,
  geScore: 30,
  visualScore: 30,
  musicScore: 30,
  captions: { GE1: 18, GE2: 18, VP: 18, VA: 18, CG: 18, B: 18, MA: 18, P: 18 },
  ...overrides,
});

/** Stand up the collection read with a set of day recaps. */
const withDays = (days: Array<{ day: number; recap: object }>) => {
  mockedGetDocs.mockResolvedValue({
    docs: days.map(({ day, recap }) => ({ id: String(day), data: () => recap })),
  });
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe('PodiumSeasonLedger', () => {
  it('keeps only the viewer’s row from each show, oldest first', async () => {
    withDays([
      {
        day: 12,
        recap: {
          shows: [{ eventName: 'DCI Broken Arrow', results: [row('me', 70), row('rival', 80)] }],
        },
      },
      {
        day: 20,
        recap: {
          shows: [{ eventName: 'DCI Atlanta', results: [row('rival', 85), row('me', 78)] }],
        },
      },
    ]);

    const { container } = wrap(<Ledger seasonUid="s1" uid="me" userCorpsName="me" />);
    await screen.findByText(/broken arrow/i);

    // Two outings, mine only — the rival is never listed as an outing row.
    const bodyRows = container.querySelectorAll('tbody tr');
    expect(bodyRows).toHaveLength(2);
    expect(bodyRows[0].textContent).toContain('Broken Arrow'); // day 12 first
    expect(bodyRows[1].textContent).toContain('Atlanta');
    expect(screen.queryByText('rival')).not.toBeInTheDocument();
  });

  it('summarizes the season: outings, best, and average', async () => {
    withDays([
      { day: 10, recap: { shows: [{ eventName: 'Show A', results: [row('me', 70)] }] } },
      { day: 20, recap: { shows: [{ eventName: 'Show B', results: [row('me', 80)] }] } },
    ]);

    wrap(<Ledger seasonUid="s1" uid="me" userCorpsName="me" />);
    await screen.findByText(/show a/i);

    expect(screen.getByText('Outings').parentElement).toHaveTextContent('2');
    // Best 80.00, average (70+80)/2 = 75.00 both surface in the summary strip.
    expect(screen.getByText('Season Best').parentElement).toHaveTextContent('80.00');
    expect(screen.getByText('Average').parentElement).toHaveTextContent('75.00');
  });

  it('places the corps within its OWN division, not the mixed field', async () => {
    // A mixed show: two World corps score above me, but I am in Open Class and
    // win it, so my line must read 1/2 — my division — not 3/4.
    withDays([
      {
        day: 15,
        recap: {
          shows: [
            {
              eventName: 'Mixed Classic',
              results: [
                row('w1', 95, 'worldClass'),
                row('w2', 90, 'worldClass'),
                row('me', 85, 'openClass'),
                row('o2', 80, 'openClass'),
              ],
            },
          ],
        },
      },
    ]);

    const { container } = wrap(<Ledger seasonUid="s1" uid="me" userCorpsName="me" />);
    await screen.findAllByText(/mixed classic/i);

    const outing = container.querySelector('tbody tr') as HTMLElement;
    expect(within(outing).getByText('1')).toBeInTheDocument();
    expect(outing.textContent).toContain('/2');
  });

  it('falls back to matching by corps name when uid is absent', async () => {
    withDays([
      {
        day: 5,
        recap: { shows: [{ eventName: 'Opener', results: [row('Blue Stars', 72)] }] },
      },
    ]);

    const { container } = wrap(<Ledger seasonUid="s1" userCorpsName="blue stars" />);
    await screen.findAllByText(/opener/i);
    // Matched by name despite the missing uid: exactly one outing row.
    expect(container.querySelectorAll('tbody tr')).toHaveLength(1);
  });

  it('shows the empty state before any scored outing', async () => {
    withDays([]);
    wrap(<Ledger seasonUid="s1" uid="me" userCorpsName="me" />);
    expect(await screen.findByText(/no scored outings yet/i)).toBeInTheDocument();
  });
});
