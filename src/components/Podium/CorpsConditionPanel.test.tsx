// The condition panel renders the clinician residency from the server's
// balance-tunable terms (no hard-coded "+30% for 3 days").
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
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

describe('CorpsConditionPanel clinician terms', () => {
  it('offers the residency on the server terms', () => {
    renderPanel(podiumWith({ clinicianTerms: { cost: 120, durationDays: 5, boostPct: 50 } }));
    expect(screen.getByText(/one block rehearses at \+50% for 5 days/)).toBeTruthy();
    expect(screen.getByText('Hire · 120 Budget / 5 days')).toBeTruthy();
  });

  it('shows an active residency with its boost', () => {
    renderPanel(
      podiumWith(
        { clinicianTerms: { cost: 120, durationDays: 5, boostPct: 50 } },
        { clinician: { block: 'fullEnsemble', hiredDay: 10, expiresDay: 14 } }
      )
    );
    expect(screen.getByText(/active through day 14 \(\+50%/)).toBeTruthy();
  });
});
