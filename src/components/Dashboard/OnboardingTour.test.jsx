// Render tests for the first-run tour. The step content lives in
// tourSteps.test.ts; this pins the behaviour that used to be broken on
// phones — a fixed-width tooltip doing off-screen positioning math, and
// (after the dashboard gained zone tabs) steps pointing into hidden zones.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';

let mobile = false;
vi.mock('../../hooks/useIsMobile', () => ({ useIsMobile: () => mobile }));

import OnboardingTour from './OnboardingTour';
import { MOBILE_TOUR_STEPS, DESKTOP_TOUR_STEPS, PODIUM_TOUR_STEPS } from './tourSteps';

const onClose = vi.fn();
const onComplete = vi.fn();
const onRequestZone = vi.fn();

const renderTour = (props = {}) =>
  render(
    <OnboardingTour
      isOpen
      onClose={onClose}
      onComplete={onComplete}
      onRequestZone={onRequestZone}
      {...props}
    />
  );

/** Advance past the rAF the positioning effect waits on. */
const flushFrame = async () => {
  await act(async () => {
    await new Promise((resolve) => requestAnimationFrame(() => resolve(null)));
  });
};

describe('OnboardingTour', () => {
  beforeEach(() => {
    mobile = false;
    onClose.mockReset();
    onComplete.mockReset();
    onRequestZone.mockReset();
    document.body.innerHTML = '';
  });

  it('renders nothing when closed', () => {
    const { container } = render(
      <OnboardingTour
        isOpen={false}
        onClose={onClose}
        onComplete={onComplete}
        onRequestZone={onRequestZone}
      />
    );
    expect(container.firstChild).toBeNull();
  });

  it('walks the desktop list on desktop', () => {
    renderTour();
    expect(screen.getByText(DESKTOP_TOUR_STEPS[0].title)).toBeInTheDocument();
    expect(screen.getByText(`Step 1 of ${DESKTOP_TOUR_STEPS.length}`)).toBeInTheDocument();
  });

  it('walks the mobile list on a phone', () => {
    mobile = true;
    renderTour();
    expect(screen.getByText(MOBILE_TOUR_STEPS[0].title)).toBeInTheDocument();
    expect(screen.getByText(`Step 1 of ${MOBILE_TOUR_STEPS.length}`)).toBeInTheDocument();
  });

  it('docks the card above the bottom nav on mobile instead of sizing it to 320px', () => {
    // The old tooltip was a fixed w-80 box on a 360px screen, positioned by
    // math that computed off-screen and got clamped into a corner.
    mobile = true;
    renderTour();
    const card = screen.getByRole('dialog');
    expect(card.className).toContain('left-3');
    expect(card.className).toContain('right-3');
    expect(card.className).not.toContain('w-80');
    expect(card.className).toContain('above-bottom-nav');
  });

  it('keeps the anchored tooltip on desktop', () => {
    renderTour();
    expect(screen.getByRole('dialog').className).toContain('w-80');
  });

  it('asks for the zone a mobile step lives in before pointing at it', async () => {
    // Without this the tour highlights a display:none element.
    mobile = true;
    renderTour();
    fireEvent.click(screen.getByRole('button', { name: /Next/ })); // -> next-action
    fireEvent.click(screen.getByRole('button', { name: /Next/ })); // -> lineup
    await flushFrame();
    expect(onRequestZone).toHaveBeenCalledWith('corps');
  });

  it('never asks for a zone on desktop, where nothing is hidden', async () => {
    renderTour();
    for (let i = 0; i < DESKTOP_TOUR_STEPS.length - 1; i++) {
      fireEvent.click(screen.getByRole('button', { name: /Next/ }));
    }
    await flushFrame();
    expect(onRequestZone).not.toHaveBeenCalled();
  });

  it('moves forward and back through the steps', () => {
    renderTour();
    expect(screen.queryByRole('button', { name: /Back/ })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Next/ }));
    expect(screen.getByText(DESKTOP_TOUR_STEPS[1].title)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Back/ }));
    expect(screen.getByText(DESKTOP_TOUR_STEPS[0].title)).toBeInTheDocument();
  });

  it('completes on the last step', () => {
    renderTour();
    for (let i = 0; i < DESKTOP_TOUR_STEPS.length - 1; i++) {
      fireEvent.click(screen.getByRole('button', { name: /Next/ }));
    }
    fireEvent.click(screen.getByRole('button', { name: /Get Started/ }));
    expect(onComplete).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('can be skipped without completing', () => {
    renderTour();
    fireEvent.click(screen.getByRole('button', { name: 'Skip tour' }));
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onComplete).not.toHaveBeenCalled();
  });

  it('highlights a target that is on the page, and cleans up after itself', async () => {
    const target = document.createElement('div');
    target.setAttribute('data-tour', 'control-bar');
    target.scrollIntoView = vi.fn();
    document.body.appendChild(target);

    // The control bar is the desktop tour's first stop (no welcome card).
    const { unmount } = renderTour();
    await flushFrame();
    expect(target.classList.contains('tour-highlight')).toBe(true);

    unmount();
    expect(target.classList.contains('tour-highlight')).toBe(false);
  });

  it('falls back to a centred card when the target is missing', async () => {
    // A step can outlive the element it names; the tour must never point at
    // nothing or crash trying.
    renderTour();
    fireEvent.click(screen.getByRole('button', { name: /Next/ }));
    await flushFrame();
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('walks the Podium list when asked, on either device', () => {
    // Podium's daily-loop tour is device-agnostic — one list for desktop and
    // mobile alike, because PodiumZone is the same single column either way.
    renderTour({ variant: 'podium' });
    expect(screen.getByText(PODIUM_TOUR_STEPS[0].title)).toBeInTheDocument();
    expect(screen.getByText(`Step 1 of ${PODIUM_TOUR_STEPS.length}`)).toBeInTheDocument();
  });

  it('reveals the Podium panel zone before pointing at it', async () => {
    // The Podium panels live in the corps zone; on a phone the tour must switch
    // there or it highlights a hidden element.
    mobile = true;
    renderTour({ variant: 'podium' });
    fireEvent.click(screen.getByRole('button', { name: /Next/ })); // -> podium-rehearsal
    await flushFrame();
    expect(onRequestZone).toHaveBeenCalledWith('corps');
  });
});
