// @ts-nocheck -- grandfathered before checkJs; remove when this file is typed or cleaned up
// Smoke test for the consolidated Game Guide (/guide). Verifies the document
// mounts, renders every section, surfaces the consolidated SoundSport ratings
// and Podium Class content, and that search filters the flat index.
import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import HowToPlay from './HowToPlay';

const renderGuide = () =>
  render(
    <MemoryRouter>
      <HowToPlay />
    </MemoryRouter>
  );

describe('HowToPlay (/guide)', () => {
  it('renders the full document with every section heading', () => {
    renderGuide();
    // Section navigator (desktop rail + mobile chips both render the labels).
    expect(screen.getAllByText('Overview').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Podium Class').length).toBeGreaterThan(0);
    // Section bodies. (Labels like "How Scoring Works" also appear in the nav,
    // so assert at least one match rather than a unique one.)
    expect(screen.getByText('What is marching.art?')).toBeInTheDocument();
    expect(screen.getAllByText('How Scoring Works').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Classes & Ratings').length).toBeGreaterThan(0);
  });

  it('surfaces the consolidated SoundSport medal ratings', () => {
    renderGuide();
    expect(screen.getByText('SoundSport is scored differently')).toBeInTheDocument();
    // Gold / Silver / Bronze tiers appear with their thresholds.
    expect(screen.getByText('Gold')).toBeInTheDocument();
    expect(screen.getByText('85+')).toBeInTheDocument();
    expect(screen.getByText('75+')).toBeInTheDocument();
    expect(screen.getByText('65+')).toBeInTheDocument();
  });

  it('presents Podium Class inline with a link to the full guide', () => {
    renderGuide();
    expect(screen.getByText('Community Corps')).toBeInTheDocument();
    expect(screen.getByText('Champion Status')).toBeInTheDocument();
    const link = screen.getByRole('link', { name: /full podium guide/i });
    expect(link).toHaveAttribute('href', '/podium-guide');
  });

  it('filters to search results when typing a query', () => {
    renderGuide();
    fireEvent.change(screen.getByLabelText('Search the game guide'), {
      target: { value: 'gold' },
    });
    // A result card for the Gold rating shows up in the search list.
    expect(screen.getByText('Gold rating')).toBeInTheDocument();
  });

  it('jumps to a section from the desktop navigator', () => {
    renderGuide();
    // The rail button and the section heading share the label; clicking should
    // not throw (scrollTo is a no-op in jsdom but the handler must run cleanly).
    const rail = screen.getByText('Sections').closest('nav');
    fireEvent.click(within(rail).getByText('Podium Class'));
    expect(screen.getByText('Reputation: the climb to Champion Status')).toBeInTheDocument();
  });
});
