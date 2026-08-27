import { afterEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

vi.mock('../../api/showcase', () => ({
  getShowcase: vi.fn(),
  submitShowcaseEntry: vi.fn(),
  getShowcasePair: vi.fn(),
  castShowcaseVote: vi.fn(),
}));
vi.mock('../../api/uniformStudio', () => ({
  listWardrobe: vi.fn(),
}));

import ShowcaseCard from './ShowcaseCard';
import {
  castShowcaseVote,
  getShowcase,
  getShowcasePair,
  submitShowcaseEntry,
} from '../../api/showcase';
import { listWardrobe } from '../../api/uniformStudio';

const THEME = { id: 'gilded-age', title: 'Gilded Age', blurb: 'Maximum ornament.' };
const DESIGN = {
  schema: 2 as const,
  name: 'Look',
  colorway: { primary: '#6d1a26', secondary: '#d9a41c', accent: '#ece2cc', metal: 'gold' as const },
  figure: { skin: '#c9a074', jacket: '#6d1a26' },
};

function renderCard() {
  return render(
    <MemoryRouter>
      <ShowcaseCard uid="viewer-uid" />
    </MemoryRouter>
  );
}

describe('ShowcaseCard', () => {
  afterEach(() => vi.clearAllMocks());

  it('submissions phase: enters a wardrobe design against the theme', async () => {
    vi.mocked(getShowcase).mockResolvedValue({
      data: {
        cycle: { monthId: '2026-09', phase: 'submissions', votingOpensDay: 21, theme: THEME },
        entryCount: 3,
        myEntry: null,
        myVoteCount: 0,
        lastResults: null,
      },
    } as never);
    vi.mocked(listWardrobe).mockResolvedValue([{ id: 'd1', name: 'Finals Look' }] as never);
    vi.mocked(submitShowcaseEntry).mockResolvedValue({
      data: { message: "You're in", paid: true },
    } as never);
    renderCard();

    expect(await screen.findByText('“Gilded Age”')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /^Enter$/i }));
    await waitFor(() => expect(submitShowcaseEntry).toHaveBeenCalledWith({ designId: 'd1' }));
    // the "yours:" line now names the entered design (the select shows it too)
    expect((await screen.findAllByText('Finals Look')).length).toBeGreaterThanOrEqual(2);
  });

  it('voting phase: deals an anonymous pair and casts a vote on it', async () => {
    vi.mocked(getShowcase).mockResolvedValue({
      data: {
        cycle: { monthId: '2026-09', phase: 'voting', votingOpensDay: 21, theme: THEME },
        entryCount: 8,
        myEntry: { designName: 'Mine', submittedAt: 'x' },
        myVoteCount: 2,
        lastResults: null,
      },
    } as never);
    vi.mocked(listWardrobe).mockResolvedValue([] as never);
    vi.mocked(getShowcasePair).mockResolvedValue({
      data: {
        monthId: '2026-09',
        pair: [
          { key: 'a', design: DESIGN },
          { key: 'b', design: { ...DESIGN, name: 'Other' } },
        ],
      },
    } as never);
    vi.mocked(castShowcaseVote).mockResolvedValue({
      data: { message: 'Vote counted', paid: true, voteCount: 3 },
    } as never);
    renderCard();

    fireEvent.click(await screen.findByRole('button', { name: /Judge a pair/i }));
    const choiceA = await screen.findByRole('button', { name: 'Vote for design A' });
    // anonymity: the dealt pair shows figures only — neither design's name
    // appears ("Mine" in the summary is the caller's own entry, which is fine)
    expect(screen.queryByText('Look')).toBeNull();
    expect(screen.queryByText('Other')).toBeNull();
    fireEvent.click(choiceA);
    await waitFor(() => expect(castShowcaseVote).toHaveBeenCalledWith({ pick: 'a' }));
    expect(await screen.findByText(/Ballots cast: 3/)).toBeInTheDocument();
  });

  it('shows last month’s podium with attribution once finalized', async () => {
    vi.mocked(getShowcase).mockResolvedValue({
      data: {
        cycle: { monthId: '2026-09', phase: 'submissions', votingOpensDay: 21, theme: THEME },
        entryCount: 0,
        myEntry: null,
        myVoteCount: 0,
        lastResults: {
          monthId: '2026-08',
          theme: { id: 'storm-front', title: 'Storm Front', blurb: '' },
          winners: [
            {
              rank: 1,
              uid: 'w1',
              username: 'MaestroMax',
              designName: 'Downpour',
              colors: null,
              wins: 9,
              losses: 1,
              design: DESIGN,
            },
          ],
          entryCount: 12,
          finalizedAt: 'x',
        },
      },
    } as never);
    vi.mocked(listWardrobe).mockResolvedValue([] as never);
    renderCard();

    expect(await screen.findByText(/Last month — “Storm Front”/)).toBeInTheDocument();
    expect(screen.getByText(/Downpour/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'MaestroMax' })).toHaveAttribute('href', '/profile/w1');
  });
});
