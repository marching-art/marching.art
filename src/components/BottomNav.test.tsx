// Render tests for the mobile bottom nav. The badge rules live in
// utils/navBadges.test.ts; this pins the bar's structure — that the loop is
// what's on it, that the Lineup tab really lands on the editor, and that the
// overflow destinations are still reachable.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({ user: { uid: 'u1' } }),
}));

const isAdmin = vi.fn().mockResolvedValue(false);
vi.mock('../api', () => ({ adminHelpers: { isAdmin: () => isAdmin() } }));
vi.mock('../lib/prefetch', () => ({ prefetchRoute: vi.fn() }));
vi.mock('../hooks/useHaptic', () => ({
  triggerHaptic: vi.fn(),
  useHaptic: () => ({ trigger: vi.fn() }),
}));

let mockBadges = { lineup: false, schedule: false };
vi.mock('../hooks/useNavBadges', () => ({
  useNavBadges: () => mockBadges,
}));

import BottomNav from './BottomNav';

const renderNav = (path = '/dashboard') =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <BottomNav />
    </MemoryRouter>
  );

describe('BottomNav', () => {
  beforeEach(() => {
    mockBadges = { lineup: false, schedule: false };
    isAdmin.mockResolvedValue(false);
  });

  it('puts the daily loop on the bar, in order', () => {
    renderNav();
    const nav = screen.getByRole('navigation', { name: 'Mobile navigation' });
    const labels = within(nav)
      .getAllByRole('link')
      .map((link) => link.textContent);
    expect(labels).toEqual(['Dashboard', 'Lineup', 'Schedule', 'Scores']);
    expect(within(nav).getByRole('button', { name: 'More' })).toBeInTheDocument();
  });

  it('sends the Lineup tab straight to the editor', () => {
    // The whole point: the game itself is one tap away, not three screens
    // down inside the dashboard.
    renderNav();
    expect(screen.getByRole('link', { name: 'Lineup' })).toHaveAttribute(
      'href',
      '/dashboard?panel=lineup'
    );
  });

  it('marks the dashboard tab current on the dashboard', () => {
    renderNav('/dashboard');
    expect(screen.getByRole('link', { name: 'Dashboard' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('link', { name: 'Lineup' })).not.toHaveAttribute('aria-current');
  });

  it('hands the current marker to Lineup while the editor is open', () => {
    // Two lit tabs for one screen reads as a bug.
    renderNav('/dashboard?panel=lineup');
    expect(screen.getByRole('link', { name: 'Lineup' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('link', { name: 'Dashboard' })).not.toHaveAttribute('aria-current');
  });

  it('marks a sub-route of a tab as current', () => {
    renderNav('/scores/2026');
    expect(screen.getByRole('link', { name: 'Scores' })).toHaveAttribute('aria-current', 'page');
  });

  it('badges the tabs that can cost a director score', () => {
    mockBadges = { lineup: true, schedule: true };
    renderNav();
    expect(screen.getByRole('link', { name: 'Lineup — needs attention' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Schedule — needs attention' })).toBeInTheDocument();
    // Scores has no badge rule — it must stay quiet.
    expect(screen.getByRole('link', { name: 'Scores' })).toBeInTheDocument();
  });

  it('says nothing when nothing needs attention', () => {
    renderNav();
    expect(screen.getByRole('link', { name: 'Lineup' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /needs attention/ })).not.toBeInTheDocument();
  });

  it('offers the Quick Start guide, which had no caller at all before', () => {
    renderNav();
    fireEvent.click(screen.getByRole('button', { name: 'More' }));
    const sheet = screen.getByRole('navigation', { name: 'More destinations' });
    expect(within(sheet).getByRole('link', { name: 'Quick Start' })).toHaveAttribute(
      'href',
      '/dashboard?panel=quickstart'
    );
  });

  it('keeps the moved destinations reachable in the More sheet', () => {
    renderNav();
    fireEvent.click(screen.getByRole('button', { name: 'More' }));
    const sheet = screen.getByRole('navigation', { name: 'More destinations' });
    expect(within(sheet).getByRole('link', { name: 'News' })).toHaveAttribute('href', '/');
    expect(within(sheet).getByRole('link', { name: 'Leagues' })).toHaveAttribute(
      'href',
      '/leagues'
    );
    expect(within(sheet).getByRole('link', { name: 'Profile' })).toHaveAttribute(
      'href',
      '/profile'
    );
  });

  it('leaves Admin out of the sheet for ordinary directors', () => {
    renderNav();
    fireEvent.click(screen.getByRole('button', { name: 'More' }));
    expect(screen.queryByRole('link', { name: 'Admin' })).not.toBeInTheDocument();
  });

  it('offers Admin in the sheet for staff, not on the bar', async () => {
    // Admin used to be a seventh tab, which is what pushed the bar to ~48px
    // targets on a 360px screen.
    isAdmin.mockResolvedValue(true);
    renderNav();
    fireEvent.click(await screen.findByRole('button', { name: 'More' }));
    expect(await screen.findByRole('link', { name: 'Admin' })).toHaveAttribute('href', '/admin');

    const nav = screen.getByRole('navigation', { name: 'Mobile navigation' });
    expect(within(nav).getAllByRole('link')).toHaveLength(4);
  });

  it('highlights More when the open page lives inside it', () => {
    renderNav('/leagues');
    expect(screen.getByRole('button', { name: 'More' })).toHaveAttribute('aria-expanded', 'false');
    // The bar's four links are all inactive; More carries the state instead.
    const nav = screen.getByRole('navigation', { name: 'Mobile navigation' });
    for (const link of within(nav).getAllByRole('link')) {
      expect(link).not.toHaveAttribute('aria-current');
    }
  });

  it('stays out of the desktop layout', () => {
    const { container } = renderNav();
    expect(container.querySelector('nav')).toHaveClass('lg:hidden');
  });
});
