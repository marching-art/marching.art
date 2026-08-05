// Component tests for the Podium Class standings sheet: the division split
// (World / Open / A, each ranked on its own — the same shape the fantasy class
// standings have) and the movement arrows that ride on it.
//
// Movement is the part worth pinning. Splitting the field means a corps' rank is
// its rank INSIDE its division, so the arrow has to be measured there too: an
// overall delta would report a climb a corps earned only because someone in
// another division dropped past it.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { ComponentType, ReactElement } from 'react';

// The sheet reads podium-recaps directly; api/client initializes Firebase at
// module load, so both the client and the query layer are mocked out.
vi.mock('firebase/firestore', () => ({
  collection: vi.fn(() => ({})),
  getDocs: vi.fn(),
}));
vi.mock('../../api', () => ({ db: {} }));

import { getDocs } from 'firebase/firestore';
import PodiumReportSheet from './PodiumReportSheet';

// The sheet is untyped .jsx, so TS reads every destructured prop as required.
const ReportSheet = PodiumReportSheet as unknown as ComponentType<Record<string, unknown>>;

const mockedGetDocs = getDocs as unknown as ReturnType<typeof vi.fn>;

const wrap = (ui: ReactElement) => render(<MemoryRouter>{ui}</MemoryRouter>);

/**
 * One standings line as the processor writes it (powerRankings.toEntry). Pass
 * `null` for the division to get an archived-season line, written before the
 * standings doc carried one.
 */
const entry = (
  corpsName: string,
  rank: number,
  total: number,
  division: string | null = 'worldClass'
) => ({
  rank,
  uid: corpsName,
  corpsName,
  ...(division ? { division } : {}),
  total,
  ge: 30,
  vis: 30,
  mus: 30,
  delta: null,
});

type Entry = ReturnType<typeof entry>;

/** Stand up the collection read with one daily standings doc per day. */
const withStandings = (days: Array<{ day: number; entries: Entry[] }>) => {
  mockedGetDocs.mockResolvedValue({
    docs: days.map(({ day, entries }) => ({
      id: String(day),
      data: () => ({ day, fieldSize: entries.length, entries }),
    })),
  });
};

/** The section a division's header sits in. */
const sectionOf = (label: string) => screen.getByText(label).closest('[class*="space-y-1.5"]');

/** One corps' row, as rendered. */
const rowOf = (corpsName: string) => screen.getByText(corpsName).closest('[class*="py-1.5"]');

beforeEach(() => {
  vi.clearAllMocks();
});

describe('PodiumReportSheet — division split', () => {
  it('splits the field into World / Open / A, each ranked from first', async () => {
    withStandings([
      {
        day: 12,
        entries: [
          entry('World One', 1, 95),
          entry('World Two', 2, 94),
          entry('Open One', 3, 85, 'openClass'),
          entry('Open Two', 4, 84, 'openClass'),
          entry('A One', 5, 75, 'aClass'),
        ],
      },
    ]);

    wrap(<ReportSheet seasonUid="season-1" />);
    await screen.findByText('World Class');

    expect(sectionOf('Open Class')).toContainElement(screen.getByText('Open One'));
    expect(sectionOf('Open Class')).not.toContainElement(screen.getByText('World One'));
    // Each division counts from 1 — Open's leader is 1st in Open, not 3rd.
    expect(rowOf('Open One')?.textContent).toMatch(/^1\./);
    expect(rowOf('Open Two')?.textContent).toMatch(/^2\./);
    expect(rowOf('A One')?.textContent).toMatch(/^1\./);
  });

  it('measures movement inside the division, not across the whole field', async () => {
    withStandings([
      {
        day: 11,
        entries: [
          entry('World One', 1, 95),
          entry('Open One', 2, 85, 'openClass'),
          entry('Open Two', 3, 84, 'openClass'),
        ],
      },
      {
        day: 12,
        entries: [
          // Open Two overtakes Open One — the only move that happened in Open.
          entry('Open Two', 1, 96, 'openClass'),
          entry('World One', 2, 95),
          entry('Open One', 3, 85, 'openClass'),
        ],
      },
    ]);

    wrap(<ReportSheet seasonUid="season-1" />);
    await screen.findByText('Open Class');

    expect(rowOf('Open Two')).toContainElement(screen.getByLabelText('Up 1 place'));
    expect(rowOf('Open One')).toContainElement(screen.getByLabelText('Down 1 place'));
    // World One slipped a place overall but is still World Class's leader, so
    // its sheet says nothing moved.
    expect(rowOf('World One')?.querySelector('[aria-label]')).toBeNull();
  });

  it('renders an archived column that carries no divisions as one sheet', async () => {
    withStandings([
      { day: 4, entries: [entry('Alpha', 1, 90, null), entry('Beta', 2, 88, null)] },
      { day: 5, entries: [entry('Beta', 1, 92, null), entry('Alpha', 2, 90, null)] },
    ]);

    wrap(<ReportSheet seasonUid="season-1" />);
    await screen.findByText('Alpha');

    expect(screen.queryByText('World Class')).not.toBeInTheDocument();
    expect(rowOf('Beta')?.textContent).toMatch(/^1\./);
    expect(rowOf('Beta')).toContainElement(screen.getByLabelText('Up 1 place'));
  });
});
