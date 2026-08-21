// Render tests for the Quick Start guide. The guide serves two games: the
// fantasy drafted-lineup walkthrough and the Podium director-sim daily loop.
// These pin that the variant selects the right steps and that Podium's in-page
// action targets route through onAction (not a dead <Link>).
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

import QuickStartGuide from './QuickStartGuide';
import { QUICK_START_STEPS, PODIUM_QUICK_START_STEPS } from './quickStartSteps';

const onClose = vi.fn();
const onAction = vi.fn();

const renderGuide = (props = {}) =>
  render(
    <MemoryRouter>
      <QuickStartGuide isOpen onClose={onClose} onAction={onAction} {...props} />
    </MemoryRouter>
  );

describe('QuickStartGuide step lists', () => {
  it('the two variants are distinct and non-empty', () => {
    expect(QUICK_START_STEPS.length).toBeGreaterThan(0);
    expect(PODIUM_QUICK_START_STEPS.length).toBeGreaterThan(0);
    const fantasyIds = QUICK_START_STEPS.map((s) => s.id);
    const podiumIds = PODIUM_QUICK_START_STEPS.map((s) => s.id);
    expect(fantasyIds).not.toEqual(podiumIds);
  });

  it('gives every step a title, description, and tips', () => {
    for (const step of [...QUICK_START_STEPS, ...PODIUM_QUICK_START_STEPS]) {
      expect(step.title.length, step.id).toBeGreaterThan(0);
      expect(step.description.length, step.id).toBeGreaterThan(0);
      expect(step.tips.length, step.id).toBeGreaterThan(0);
    }
  });

  it('Podium teaches the daily loop, not a drafted lineup', () => {
    expect(PODIUM_QUICK_START_STEPS.map((s) => s.id)).toEqual(['rehearse', 'shows', 'plan']);
    // No caption/lineup framing leaks into the Podium copy.
    const blob = JSON.stringify(PODIUM_QUICK_START_STEPS).toLowerCase();
    expect(blob).not.toContain('lineup');
    expect(blob).not.toContain('draft');
  });
});

describe('QuickStartGuide rendering', () => {
  beforeEach(() => {
    onClose.mockReset();
    onAction.mockReset();
  });

  it('renders nothing when closed', () => {
    const { container } = render(
      <MemoryRouter>
        <QuickStartGuide isOpen={false} onClose={onClose} onAction={onAction} />
      </MemoryRouter>
    );
    expect(container.firstChild).toBeNull();
  });

  it('walks the fantasy steps by default', () => {
    renderGuide();
    expect(screen.getByText(QUICK_START_STEPS[0].title)).toBeInTheDocument();
    expect(screen.getByText(`0/${QUICK_START_STEPS.length}`)).toBeInTheDocument();
  });

  it('walks the Podium steps when asked', () => {
    renderGuide({ variant: 'podium' });
    expect(screen.getByText(PODIUM_QUICK_START_STEPS[0].title)).toBeInTheDocument();
    expect(screen.getByText(`0/${PODIUM_QUICK_START_STEPS.length}`)).toBeInTheDocument();
  });

  it('reflects completed Podium steps in the progress count', () => {
    renderGuide({ variant: 'podium', completedSteps: ['rehearse', 'shows'] });
    expect(screen.getByText(`2/${PODIUM_QUICK_START_STEPS.length}`)).toBeInTheDocument();
  });

  it('routes a Podium in-page action through onAction, not a dead link', () => {
    renderGuide({ variant: 'podium' });
    // Expand the rehearse step (its action scrolls to the planner behind the guide).
    fireEvent.click(screen.getByText(PODIUM_QUICK_START_STEPS[0].title));
    fireEvent.click(screen.getByRole('button', { name: /Open Planner/ }));
    expect(onAction).toHaveBeenCalledWith('podium-planner');
  });
});
