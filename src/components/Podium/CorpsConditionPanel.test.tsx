// The condition panel renders clinician bookings (1 / 3 / 5 days) from the
// server's balance-tunable terms (no hard-coded lengths or prices).
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { ComponentType } from 'react';
import CorpsConditionPanel from './CorpsConditionPanel';

const Panel = CorpsConditionPanel as unknown as ComponentType<Record<string, unknown>>;

const podiumWith = (dataOverrides: Record<string, unknown> = {}, stateOverrides = {}) => ({
  data: {
    competitionDay: 12,
    calendarDay: 12,
    routePreview: [],
    currentLocation: null,
    blockCaps: { rehearsal: 12, showDay: 8, springTraining: 20 },
    state: {
      condition: { stamina: 80, morale: 70 },
      budget: { balance: 400, committed: 400, earned: 0, spent: 0, log: [] },
      foodTier: 'standard',
      ...stateOverrides,
    },
    ...dataOverrides,
  },
  commitBudget: vi.fn(),
  hireClinician: vi.fn(),
  setFoodTier: vi.fn(),
  saveTemplate: vi.fn(),
  reload: vi.fn(),
});

const renderPanel = (podium: unknown) =>
  render(
    <MemoryRouter>
      <Panel podium={podium} />
    </MemoryRouter>
  );

const terms = {
  bookings: [
    { days: 1, cost: 40 },
    { days: 3, cost: 90 },
    { days: 5, cost: 120 },
  ],
  boostPct: 50,
};

describe('CorpsConditionPanel clinician terms', () => {
  it('offers every booking length on the server terms, defaulting to the longest', () => {
    renderPanel(podiumWith({ clinicianTerms: terms }));
    expect(
      screen.getByText(/one block rehearses at \+50% for as many days as you book/)
    ).toBeTruthy();
    expect(screen.getByText('40 Budget')).toBeTruthy();
    expect(screen.getByText('90 Budget')).toBeTruthy();
    expect(screen.getByText('120 Budget')).toBeTruthy();
    expect(screen.getByRole('button', { name: /^5 days/ }).getAttribute('aria-pressed')).toBe(
      'true'
    );
    expect(screen.getByText('Hire · 120 Budget / 5 days')).toBeTruthy();
  });

  it('hires the picked length', () => {
    const podium = podiumWith({ clinicianTerms: terms });
    renderPanel(podium);
    fireEvent.click(screen.getByRole('button', { name: /^1 day/ }));
    fireEvent.click(screen.getByText('Hire · 40 Budget / 1 day'));
    expect(podium.hireClinician).toHaveBeenCalledWith('brassSectionals', 1);
  });

  it('reads a pre-2026-10 single-residency payload', () => {
    renderPanel(podiumWith({ clinicianTerms: { cost: 120, durationDays: 5, boostPct: 50 } }));
    expect(screen.getByText('Hire · 120 Budget / 5 days')).toBeTruthy();
  });

  it('shows an active booking with its length and boost', () => {
    renderPanel(
      podiumWith(
        { clinicianTerms: terms },
        { clinician: { block: 'fullEnsemble', days: 3, hiredDay: 10, expiresDay: 12 } }
      )
    );
    expect(screen.getByText(/3-day session active through day 12 \(\+50%/)).toBeTruthy();
  });

  it('names a legacy residency (no recorded length) from its dates', () => {
    renderPanel(
      podiumWith(
        { clinicianTerms: terms },
        { clinician: { block: 'fullEnsemble', hiredDay: 10, expiresDay: 14 } }
      )
    );
    expect(screen.getByText(/5-day residency active through day 14/)).toBeTruthy();
  });
});
