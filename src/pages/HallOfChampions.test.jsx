// Verifies the two behaviors changed for the SoundSport / mobile-nav work:
//   1. A SoundSport "Best in Show" division is surfaced in the Hall of Champions.
//   2. The season list stays reachable — selecting a season and then going
//      "back" no longer bounces straight back into the detail view (the mobile
//      navigation regression).
import React from 'react';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import HallOfChampions from './HallOfChampions';

vi.mock('../api/season', () => ({
  getSeasonChampionDocs: vi.fn(),
}));

import { getSeasonChampionDocs } from '../api/season';

const SEASONS = [
  {
    id: 'live_2025',
    seasonName: 'live_2025',
    seasonType: 'live',
    archivedAt: new Date('2025-08-01'),
    classes: {
      worldClass: [
        { rank: 1, uid: 'w1', username: 'alice', corpsName: 'Blue Devils', score: 98.5 },
        { rank: 2, uid: 'w2', username: 'bob', corpsName: 'Bluecoats', score: 97.1 },
      ],
      soundSport: [
        { rank: 1, uid: 's1', username: 'sam', corpsName: 'Sunrisers', score: 92.3 },
        { rank: 2, uid: 's2', username: 'sara', corpsName: 'Night Owls', score: 78.0 },
        { rank: 3, uid: 's3', username: 'sid', corpsName: 'Cadenza', score: 60.0 },
      ],
    },
  },
  {
    id: 'starlight_2024',
    seasonName: 'starlight_2024',
    seasonType: 'offSeason',
    archivedAt: new Date('2024-08-01'),
    classes: {
      worldClass: [
        { rank: 1, uid: 'x1', username: 'carol', corpsName: 'Carolina Crown', score: 96.0 },
      ],
    },
  },
];

const renderPage = () =>
  render(
    <MemoryRouter>
      <HallOfChampions />
    </MemoryRouter>
  );

const getSidebar = () => screen.getByText('Hall of Champions').closest('.border-r');

beforeEach(() => {
  getSeasonChampionDocs.mockResolvedValue(SEASONS);
});

describe('HallOfChampions — SoundSport division', () => {
  it('surfaces a SoundSport division with a Best in Show ensemble', async () => {
    renderPage();
    // Division switcher includes a SoundSport tab.
    const soundTab = await screen.findByRole('button', { name: 'Sound' });
    fireEvent.click(soundTab);

    // Best in Show framing + the top ensemble + its rating badge.
    await waitFor(() => expect(screen.getAllByText(/Best in Show/i).length).toBeGreaterThan(0));
    expect(screen.getAllByText('Sunrisers').length).toBeGreaterThan(0);
    // 92.3 maps to a Gold rating.
    expect(screen.getAllByText('Gold').length).toBeGreaterThan(0);
    // Rating-based framing, not "Champion".
    expect(screen.queryByText(/2025 Champion/i)).not.toBeInTheDocument();

    // SoundSport is ratings-only: the raw numeric scores must NEVER be rendered
    // (plaque, stats strip, finalists table, or the season sidebar row).
    expect(screen.queryByText(/92\.3/)).not.toBeInTheDocument();
    expect(screen.queryByText(/78\.0/)).not.toBeInTheDocument();
    expect(screen.queryByText(/60\.0/)).not.toBeInTheDocument();
  });
});

describe('HallOfChampions — mobile season navigation', () => {
  it('keeps the season list reachable after going back', async () => {
    renderPage();
    await screen.findByText('Hall of Champions');

    // With nothing explicitly selected the sidebar is full-width (list mode),
    // never collapsed to the detail-only "hidden" state.
    expect(getSidebar().className).toContain('w-full');
    expect(getSidebar().className).not.toContain('hidden');

    // Selecting a season collapses the sidebar (mobile shows the detail view).
    const sidebar = getSidebar();
    const seasonBtn = within(sidebar)
      .getAllByRole('button')
      .find((b) => /Blue Devils/.test(b.textContent));
    fireEvent.click(seasonBtn);
    await waitFor(() => expect(getSidebar().className).toContain('hidden'));

    // Tapping the mobile "Seasons" back control returns to the list — and it
    // MUST stay there (the bug: it snapped straight back to the detail view).
    fireEvent.click(screen.getByText('Seasons'));
    await waitFor(() => expect(getSidebar().className).toContain('w-full'));
    expect(getSidebar().className).not.toContain('hidden');

    // The list is genuinely browsable: a different season can now be opened.
    const crownSeasonBtn = within(getSidebar())
      .getAllByRole('button')
      .find((b) => /Carolina Crown/.test(b.textContent));
    expect(crownSeasonBtn).toBeTruthy();
    fireEvent.click(crownSeasonBtn);
    await waitFor(() => expect(getSidebar().className).toContain('hidden'));
    expect(screen.getAllByText('Carolina Crown').length).toBeGreaterThan(0);
  });
});
