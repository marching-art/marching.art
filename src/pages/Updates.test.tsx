import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import Updates from './Updates';
import { ROADMAP, type ChangelogEntry } from '../data/changelog';
import rawEntries from '../data/changelogEntries.json';

const CHANGELOG = rawEntries as ChangelogEntry[];
const INITIAL_VISIBLE = 8;

// The changelog content loads lazily (dynamic import), so the entry assertions
// wait for it to arrive; the header and roadmap render synchronously.
describe('Updates page', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('renders the header, recent updates, and the roadmap', async () => {
    render(<Updates />);
    expect(screen.getByRole('heading', { name: /What’s New/i, level: 1 })).toBeInTheDocument();
    // A roadmap item renders immediately (static data).
    expect(screen.getByRole('heading', { name: ROADMAP[0].title })).toBeInTheDocument();
    // The most recent changelog entry renders once the lazy chunk resolves.
    expect(await screen.findByRole('heading', { name: CHANGELOG[0].title })).toBeInTheDocument();
  });

  it('marks updates seen once loaded so the badge clears', async () => {
    expect(window.localStorage.getItem('ma:lastSeenUpdateId')).toBeNull();
    render(<Updates />);
    await waitFor(() =>
      expect(window.localStorage.getItem('ma:lastSeenUpdateId')).toBe(CHANGELOG[0].id)
    );
  });

  it('lazy-loads the changelog: renders an initial batch and reveals more on demand', async () => {
    // This assertion only means something when the log outgrows the first batch.
    expect(CHANGELOG.length).toBeGreaterThan(INITIAL_VISIBLE);
    render(<Updates />);

    // The first batch is in the DOM once loaded; the entry just past it is not yet.
    expect(
      await screen.findByRole('heading', { name: CHANGELOG[INITIAL_VISIBLE - 1].title })
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('heading', { name: CHANGELOG[INITIAL_VISIBLE].title })
    ).not.toBeInTheDocument();

    // Clicking "Show more" reveals the next batch.
    fireEvent.click(screen.getByRole('button', { name: /show more updates/i }));
    expect(
      screen.getByRole('heading', { name: CHANGELOG[INITIAL_VISIBLE].title })
    ).toBeInTheDocument();
  });
});
