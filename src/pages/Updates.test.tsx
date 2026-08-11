import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import Updates from './Updates';
import { CHANGELOG, ROADMAP } from '../data/changelog';

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
});
