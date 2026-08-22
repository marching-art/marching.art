import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import Updates from './Updates';
import { CHANGELOG, ROADMAP } from '../data/changelog';

const INITIAL_VISIBLE = 8;

describe('Updates page', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('renders the header, recent updates, and the roadmap', () => {
    render(<Updates />);
    expect(screen.getByRole('heading', { name: /What’s New/i, level: 1 })).toBeInTheDocument();
    // The most recent changelog entry renders.
    expect(screen.getByRole('heading', { name: CHANGELOG[0].title })).toBeInTheDocument();
    // A roadmap item renders.
    expect(screen.getByRole('heading', { name: ROADMAP[0].title })).toBeInTheDocument();
  });

  it('marks updates seen on mount so the badge clears', () => {
    expect(window.localStorage.getItem('ma:lastSeenUpdateId')).toBeNull();
    render(<Updates />);
    expect(window.localStorage.getItem('ma:lastSeenUpdateId')).toBe(CHANGELOG[0].id);
  });

  it('lazy-loads the changelog: renders an initial batch and reveals more on demand', () => {
    // This assertion only means something when the log outgrows the first batch.
    expect(CHANGELOG.length).toBeGreaterThan(INITIAL_VISIBLE);
    render(<Updates />);

    // The first batch is in the DOM; the entry just past it is not yet.
    expect(
      screen.getByRole('heading', { name: CHANGELOG[INITIAL_VISIBLE - 1].title })
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
