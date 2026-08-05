// Render tests for the mobile Next Action hero. The ranking itself is covered
// by utils/nextAction.test.ts; this pins how each shape of action is presented
// and, more importantly, that the button actually does the right thing.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

const navigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return { ...actual, useNavigate: () => navigate };
});

import NextActionPanel from './NextActionPanel';
import type { NextAction } from '../../../utils/nextAction';

const handlers = {
  onOpenLineup: vi.fn(),
  onOpenConcept: vi.fn(),
  onRegisterCorps: vi.fn(),
};

function renderPanel(action: NextAction | null) {
  return render(
    <MemoryRouter>
      <NextActionPanel action={action} {...handlers} />
    </MemoryRouter>
  );
}

const lineupAction: NextAction = {
  id: 'complete_lineup',
  title: 'Draft 5 more captions',
  detail: 'A corps with an empty slot does not score at all — fill all 8 captions to compete.',
  cta: 'Open Lineup',
  target: { type: 'lineup' },
  progress: { done: 3, total: 8 },
  tone: 'blocked',
};

describe('NextActionPanel', () => {
  beforeEach(() => {
    navigate.mockReset();
    handlers.onOpenLineup.mockReset();
    handlers.onOpenConcept.mockReset();
    handlers.onRegisterCorps.mockReset();
  });

  it('renders nothing when there is no action (Podium, unhydrated state)', () => {
    const { container } = renderPanel(null);
    expect(container.firstChild).toBeNull();
  });

  it('leads with the imperative and the reason it matters', () => {
    renderPanel(lineupAction);
    expect(screen.getByText('Draft 5 more captions')).toBeInTheDocument();
    expect(screen.getByText(/does not score at all/)).toBeInTheDocument();
  });

  it('shows progress as a count and an accessible progressbar', () => {
    renderPanel(lineupAction);
    expect(screen.getByText('3 of 8')).toBeInTheDocument();
    const bar = screen.getByRole('progressbar');
    expect(bar).toHaveAttribute('aria-valuenow', '3');
    expect(bar).toHaveAttribute('aria-valuemax', '8');
  });

  it('omits the progress row for actions with no natural count', () => {
    renderPanel({ ...lineupAction, progress: null });
    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
  });

  it('opens the lineup modal rather than navigating', () => {
    renderPanel(lineupAction);
    fireEvent.click(screen.getByRole('button', { name: 'Open Lineup' }));
    expect(handlers.onOpenLineup).toHaveBeenCalledTimes(1);
    expect(navigate).not.toHaveBeenCalled();
  });

  it('opens the concept modal', () => {
    renderPanel({
      ...lineupAction,
      id: 'set_concept',
      cta: 'Set Concept',
      target: { type: 'concept' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Set Concept' }));
    expect(handlers.onOpenConcept).toHaveBeenCalledTimes(1);
  });

  it('starts corps registration', () => {
    renderPanel({
      ...lineupAction,
      id: 'register_corps',
      cta: 'Register Corps',
      target: { type: 'register' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Register Corps' }));
    expect(handlers.onRegisterCorps).toHaveBeenCalledTimes(1);
  });

  it('navigates for route targets', () => {
    renderPanel({
      ...lineupAction,
      id: 'register_shows',
      cta: 'View Schedule',
      target: { type: 'route', to: '/schedule' },
      progress: null,
    });
    fireEvent.click(screen.getByRole('button', { name: 'View Schedule' }));
    expect(navigate).toHaveBeenCalledWith('/schedule');
  });

  it('scrolls to the panel that owns a claim instead of duplicating it', () => {
    // The claim mutation belongs to JourneyPanel; the hero only moves you there.
    const target = document.createElement('div');
    target.id = 'journey-panel';
    const scrollIntoView = vi.fn();
    target.scrollIntoView = scrollIntoView;
    document.body.appendChild(target);

    renderPanel({
      id: 'claim_reward',
      title: 'A reward is ready',
      detail: 'Field a Full Corps.',
      cta: 'Claim',
      target: { type: 'scroll', to: 'journey-panel' },
      progress: null,
      tone: 'reward',
    });
    fireEvent.click(screen.getByRole('button', { name: 'Claim' }));
    expect(scrollIntoView).toHaveBeenCalled();
    expect(navigate).not.toHaveBeenCalled();

    document.body.removeChild(target);
  });

  it('asks the dashboard to reveal a panel when it can', () => {
    // On mobile the target may sit in a hidden zone; only the dashboard can
    // switch to it, so a plain scroll would land on display:none.
    const onRevealPanel = vi.fn();
    render(
      <MemoryRouter>
        <NextActionPanel
          action={{
            id: 'claim_reward',
            title: 'A reward is ready',
            detail: 'Field a Full Corps.',
            cta: 'Claim',
            target: { type: 'scroll', to: 'journey-panel' },
            progress: null,
            tone: 'reward',
          }}
          {...handlers}
          onRevealPanel={onRevealPanel}
        />
      </MemoryRouter>
    );
    fireEvent.click(screen.getByRole('button', { name: 'Claim' }));
    expect(onRevealPanel).toHaveBeenCalledWith('journey-panel');
  });

  it('renders no button when the action is only informational', () => {
    // A shut caption window must not offer a control that cannot work.
    renderPanel({
      id: 'lineup_locked',
      title: 'Lineup is 7 short',
      detail: 'Caption changes are locked overnight and reopen Sun 2:00 AM ET.',
      cta: null,
      target: null,
      progress: { done: 1, total: 8 },
      tone: 'waiting',
    });
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
    expect(screen.getByText('Lineup is 7 short')).toBeInTheDocument();
  });

  it('stays out of the desktop layout', () => {
    // Desktop's 2/3 + 1/3 grid answers this question spatially.
    const { container } = renderPanel(lineupAction);
    expect(container.querySelector('section')).toHaveClass('lg:hidden');
  });
});
