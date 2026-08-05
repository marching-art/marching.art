// Component tests for the Podium Class recap sheet's championship-week cut
// markers. Podium runs the fantasy finals-week bracket in parallel on its own
// board, so Prelims and Semifinals nights have to answer the same question the
// fantasy sheets do: who marches tomorrow.
//
// The cut itself is decided server-side and published with the recap
// (helpers/podium/store.championshipCutFor), so these tests pin the RENDERING
// of that field — the sheet must never invent a cut of its own.

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
import PodiumRecapSheet from './PodiumRecapSheet';

// The sheet is untyped .jsx, so TS reads every destructured prop as required —
// cast to a loose prop map (the same shim ScoresParts.test.tsx uses).
const RecapSheet = PodiumRecapSheet as unknown as ComponentType<Record<string, unknown>>;

const mockedGetDocs = getDocs as unknown as ReturnType<typeof vi.fn>;

const wrap = (ui: ReactElement) => render(<MemoryRouter>{ui}</MemoryRouter>);

/** One corps' row as the Podium processor writes it. */
const row = (uid: string, place: number, totalScore: number, division = 'worldClass') => ({
  uid,
  corpsName: uid,
  division,
  place,
  totalScore,
  geScore: 30,
  visualScore: 30,
  musicScore: 30,
  captions: {},
});

/** `count` corps ranked from `top` down, named `${prefix}-N`. */
const field = (count: number, top: number, division = 'worldClass', prefix = 'Corps') =>
  Array.from({ length: count }, (_, i) =>
    row(`${prefix}-${i + 1}`, i + 1, top - i * 0.5, division)
  );

/** Stand up the collection read with a single day's recap. */
const withRecap = (day: number, recap: object) => {
  mockedGetDocs.mockResolvedValue({
    docs: [{ id: String(day), data: () => recap }],
  });
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe('PodiumRecapSheet — championship-week cuts', () => {
  it('marks the corps the processor said advance, and only those', async () => {
    const results = field(30, 95);
    withRecap(47, {
      competitionDay: 47,
      shows: [{ eventName: 'marching.art World Championship Prelims', results }],
      championshipCut: {
        toDay: 48,
        eventName: 'marching.art World Championship Semifinals',
        roundName: 'Semifinals',
        rule: 'Top 25 advance to Semifinals',
        perDivision: false,
        uids: results.slice(0, 25).map((r) => r.uid),
        advancingCount: 25,
        fieldCount: 30,
        missedCount: 5,
        cutLine: 83,
      },
    });

    wrap(<RecapSheet seasonUid="season-1" seasonName="Scherzo 2026" />);

    // Stated in the banner over the sheet and again in the card's footer legend.
    expect((await screen.findAllByText(/top 25 advance to semifinals/i)).length).toBeGreaterThan(0);
    expect(screen.getByText(/25 advance to day 48/i)).toBeInTheDocument();
    expect(screen.getByText(/5 miss the cut at/i)).toBeInTheDocument();
    expect(screen.getAllByText('Adv')).toHaveLength(25);
  });

  it('renders the per-division cut on the Open & A night', async () => {
    const open = field(10, 80, 'openClass', 'Open');
    const aClass = field(6, 70, 'aClass', 'A');
    withRecap(45, {
      competitionDay: 45,
      shows: [{ eventName: 'Open and A Class Prelims', results: [...open, ...aClass] }],
      championshipCut: {
        toDay: 46,
        eventName: 'Open and A Class Finals',
        roundName: 'Open & A Class Finals',
        rule: 'Top 8 Open Class · Top 4 A Class advance',
        perDivision: true,
        uids: [...open.slice(0, 8), ...aClass.slice(0, 4)].map((r) => r.uid),
        advancingCount: 12,
        fieldCount: 16,
        missedCount: 4,
        cutLine: 68.5,
      },
    });

    wrap(<RecapSheet seasonUid="season-1" />);

    expect(
      (await screen.findAllByText(/top 8 open class · top 4 a class advance/i)).length
    ).toBeGreaterThan(0);
    expect(screen.getAllByText('Adv')).toHaveLength(12);
  });

  it('says nothing about advancement on an ordinary night', async () => {
    withRecap(20, {
      competitionDay: 20,
      shows: [{ eventName: 'Midwest Classic', results: field(12, 80) }],
    });

    wrap(<RecapSheet seasonUid="season-1" />);

    expect(await screen.findByText(/midwest classic/i)).toBeInTheDocument();
    expect(screen.queryAllByText('Adv')).toHaveLength(0);
    expect(screen.queryByText(/advance to day/i)).not.toBeInTheDocument();
  });
});
