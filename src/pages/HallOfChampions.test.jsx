// Verifies:
//   1. A SoundSport "Best in Show" class is surfaced in the Hall of Champions.
//   2. The season list stays reachable — selecting a season and then going
//      "back" no longer bounces straight back into the detail view (the mobile
//      navigation regression).
//   3. Both divisions show their classes — Fantasy: World, Open, A, SoundSport;
//      Podium: World, Open, A — and the Podium row is data-driven.
//   4. `?class=` / `?season=` deep links (the /share/champion landing) open
//      that champion.
import React from 'react';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import HallOfChampions from './HallOfChampions';

vi.mock('../api/season', () => ({
  getSeasonChampions: vi.fn(),
}));

// The banner purchase path pulls in api/functions, which initializes
// Firebase at module load — mock it out like every other component test.
vi.mock('../api/functions', () => ({
  purchaseHallBanner: vi.fn(),
}));

import { getSeasonChampions } from '../api/season';
import { queryClient } from '../lib/queryClient';

/** @type {import('../api/season').SeasonChampions[]} */
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
      // Podium Division — World (whole field), Open, A.
      podiumClass: [
        {
          rank: 1,
          uid: 'p1',
          username: 'pat',
          corpsName: 'Crimson',
          score: 95.1,
          corpsClass: 'worldClass',
        },
        {
          rank: 2,
          uid: 'p2',
          username: 'ona',
          corpsName: 'Onyx',
          score: 94.2,
          corpsClass: 'openClass',
        },
      ],
      podiumOpenClass: [
        {
          rank: 1,
          uid: 'p2',
          username: 'ona',
          corpsName: 'Onyx',
          score: 94.2,
          corpsClass: 'openClass',
        },
      ],
      podiumAClass: [
        {
          rank: 1,
          uid: 'p3',
          username: 'amy',
          corpsName: 'Amber',
          score: 88.4,
          corpsClass: 'aClass',
        },
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

/** @param {string} [path] */
const renderPage = (path = '/hall-of-champions') =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <HallOfChampions />
    </MemoryRouter>
  );

/** @returns {HTMLElement} */
const getSidebar = () => {
  const el = screen.getByText('Hall of Champions').closest('.border-r');
  if (!(el instanceof HTMLElement)) throw new Error('sidebar not rendered');
  return el;
};

/** @param {HTMLElement} scope @param {RegExp} re */
const findSeasonButton = (scope, re) => {
  const btn = within(scope)
    .getAllByRole('button')
    .find((b) => re.test(b.textContent || ''));
  if (!btn) throw new Error(`no season button matching ${re}`);
  return btn;
};

/** The class tab row (the second tablist when the Division row is shown). */
const classTabs = () => within(screen.getByRole('tablist', { name: /class$/i }));
const divisionTabs = () => within(screen.getByRole('tablist', { name: 'Division' }));

beforeEach(() => {
  // The page reads through the shared react-query cache — clear it so each
  // test's mock value is actually fetched instead of served from a previous
  // test's cache entry.
  queryClient.clear();
  vi.mocked(getSeasonChampions).mockResolvedValue(SEASONS);
});

describe('HallOfChampions — SoundSport class', () => {
  it('surfaces a SoundSport class with a Best in Show ensemble', async () => {
    renderPage();
    // Fantasy class switcher includes a SoundSport tab.
    const soundTab = await screen.findByRole('tab', { name: 'Sound' });
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

describe('HallOfChampions — both divisions, each with its classes', () => {
  it('shows Fantasy (World, Open, A, Sound) and Podium (World, Open, A)', async () => {
    renderPage();
    await screen.findByRole('tablist', { name: 'Division' });

    expect(
      divisionTabs()
        .getAllByRole('tab')
        .map((t) => t.textContent)
    ).toEqual(['Fantasy', 'Podium']);
    expect(
      classTabs()
        .getAllByRole('tab')
        .map((t) => t.textContent)
    ).toEqual(['World', 'Open', 'A Class', 'Sound']);
    // The Fantasy World podium is the World Championship.
    expect(screen.getAllByText('World Championship').length).toBeGreaterThan(0);

    fireEvent.click(divisionTabs().getByRole('tab', { name: 'Podium' }));
    await waitFor(() =>
      expect(
        classTabs()
          .getAllByRole('tab')
          .map((t) => t.textContent)
      ).toEqual(['World', 'Open', 'A Class'])
    );
    // Switching division lands on that division's World Championship.
    expect(divisionTabs().getByRole('tab', { name: 'Podium' })).toHaveAttribute(
      'aria-selected',
      'true'
    );
    expect(screen.getAllByText('Podium World Championship').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Crimson').length).toBeGreaterThan(0);

    // Podium A Class crowns its own champion.
    fireEvent.click(classTabs().getByRole('tab', { name: 'A Class' }));
    await waitFor(() => expect(screen.getAllByText('Amber').length).toBeGreaterThan(0));
    expect(screen.getAllByText('Podium A Class').length).toBeGreaterThan(0);
    expect(screen.queryByText('Crimson')).not.toBeInTheDocument();

    // Podium Open Class too.
    fireEvent.click(classTabs().getByRole('tab', { name: 'Open' }));
    await waitFor(() => expect(screen.getAllByText('Podium Open Class').length).toBeGreaterThan(0));
    expect(screen.getAllByText('Onyx').length).toBeGreaterThan(0);

    // Back to Fantasy: its World Championship again, SoundSport tab restored.
    fireEvent.click(divisionTabs().getByRole('tab', { name: 'Fantasy' }));
    await waitFor(() => expect(screen.getAllByText('Blue Devils').length).toBeGreaterThan(0));
    expect(classTabs().getByRole('tab', { name: 'Sound' })).toBeInTheDocument();
  });

  it('hides the Podium division until an archived season has a Podium podium', async () => {
    vi.mocked(getSeasonChampions).mockResolvedValue(
      SEASONS.map((s) => ({
        ...s,
        classes: Object.fromEntries(
          Object.entries(s.classes).filter(([key]) => !key.startsWith('podium'))
        ),
      }))
    );
    renderPage();
    await screen.findByRole('tab', { name: 'Sound' });
    expect(screen.queryByRole('tablist', { name: 'Division' })).not.toBeInTheDocument();
    expect(screen.queryByRole('tab', { name: 'Podium' })).not.toBeInTheDocument();
  });

  it('opens the class and season a /share/champion deep link names', async () => {
    renderPage('/hall-of-champions?class=podiumAClass&season=live_2025');
    await waitFor(() => expect(screen.getAllByText('Amber').length).toBeGreaterThan(0));
    expect(classTabs().getByRole('tab', { name: 'A Class' })).toHaveAttribute(
      'aria-selected',
      'true'
    );
    expect(divisionTabs().getByRole('tab', { name: 'Podium' })).toHaveAttribute(
      'aria-selected',
      'true'
    );
    // The season was selected (mobile detail view), not merely defaulted.
    expect(getSidebar().className).toContain('hidden');
  });

  it('falls back to the World Championship for an unknown class', async () => {
    renderPage('/hall-of-champions?class=megaClass');
    await screen.findByRole('tablist', { name: 'Division' });
    expect(classTabs().getByRole('tab', { name: 'World' })).toHaveAttribute(
      'aria-selected',
      'true'
    );
    expect(screen.getAllByText('Blue Devils').length).toBeGreaterThan(0);
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
    fireEvent.click(findSeasonButton(getSidebar(), /Blue Devils/));
    await waitFor(() => expect(getSidebar().className).toContain('hidden'));

    // Tapping the mobile "Seasons" back control returns to the list — and it
    // MUST stay there (the bug: it snapped straight back to the detail view).
    fireEvent.click(screen.getByText('Seasons'));
    await waitFor(() => expect(getSidebar().className).toContain('w-full'));
    expect(getSidebar().className).not.toContain('hidden');

    // The list is genuinely browsable: a different season can now be opened.
    fireEvent.click(findSeasonButton(getSidebar(), /Carolina Crown/));
    await waitFor(() => expect(getSidebar().className).toContain('hidden'));
    expect(screen.getAllByText('Carolina Crown').length).toBeGreaterThan(0);
  });
});
