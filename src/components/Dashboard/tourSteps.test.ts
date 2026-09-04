import { describe, it, expect } from 'vitest';
import {
  DESKTOP_TOUR_STEPS,
  MOBILE_TOUR_STEPS,
  PODIUM_TOUR_STEPS,
  getTourSteps,
} from './tourSteps';
import { DASHBOARD_ZONES } from '../../utils/dashboardZones';

const ALL = [
  ['desktop', DESKTOP_TOUR_STEPS] as const,
  ['mobile', MOBILE_TOUR_STEPS] as const,
  ['podium', PODIUM_TOUR_STEPS] as const,
];

describe.each(ALL)('%s tour steps', (_name, steps) => {
  it('has unique step ids', () => {
    expect(new Set(steps.map((s) => s.id)).size).toBe(steps.length);
  });

  it('gives every step a title and a description', () => {
    for (const step of steps) {
      expect(step.title.length, step.id).toBeGreaterThan(0);
      expect(step.description.length, step.id).toBeGreaterThan(0);
    }
  });

  it('stays short enough that nobody skips it', () => {
    expect(steps.length).toBeLessThanOrEqual(5);
  });

  it('only names real zones', () => {
    const ids = new Set(DASHBOARD_ZONES.map((z) => z.id));
    for (const step of steps) {
      if (step.zone) expect(ids.has(step.zone), step.id).toBe(true);
    }
  });
});

describe('mobile tour', () => {
  it('opens on a welcome card with no target', () => {
    // The card sets up the four-stop structure the rest of the tour follows.
    expect(MOBILE_TOUR_STEPS[0].id).toBe('welcome');
    expect(MOBILE_TOUR_STEPS[0].target).toBeNull();
  });

  it('reveals the zone holding the lineup before pointing at it', () => {
    // My Corps happens to be the default zone, but the tour must not depend
    // on that — a director can switch tabs before the tour fires.
    const lineup = MOBILE_TOUR_STEPS.find((s) => s.id === 'lineup');
    expect(lineup?.zone).toBe('corps');
  });

  it('leads with the hero, which is where the answer lives', () => {
    expect(MOBILE_TOUR_STEPS[1].id).toBe('next-action');
  });

  it('teaches the controls rather than reading out a desktop layout', () => {
    const ids = MOBILE_TOUR_STEPS.map((s) => s.id);
    expect(ids).toContain('zone-tabs');
    expect(ids).toContain('bottom-nav');
    // The desktop-only sidebar walk has no meaning on a phone.
    expect(ids).not.toContain('recent-results');
  });
});

describe('desktop tour', () => {
  it('walks the grid that is already on screen, with no generic welcome card', () => {
    // The signup celebration already said welcome; a second "let's take a
    // tour" card in front of the dashboard was one interrupt too many.
    expect(DESKTOP_TOUR_STEPS.map((s) => s.id)).toEqual([
      'control-bar',
      'lineup',
      'recent-results',
      'scorecard',
    ]);
    expect(DESKTOP_TOUR_STEPS.every((s) => s.target)).toBe(true);
  });

  it('needs no zone reveals, because desktop hides nothing', () => {
    expect(DESKTOP_TOUR_STEPS.every((s) => s.zone === undefined)).toBe(true);
  });
});

describe('podium tour', () => {
  it('opens on a card that names the founded corps, with no target', () => {
    expect(PODIUM_TOUR_STEPS[0].id).toBe('welcome');
    expect(PODIUM_TOUR_STEPS[0].target).toBeNull();
  });

  it('teaches the director-sim daily loop, not a drafted lineup', () => {
    // The fantasy steps point at a caption table Podium doesn't have; the
    // Podium tour walks the four panels the sim actually loops on.
    expect(PODIUM_TOUR_STEPS.map((s) => s.id)).toEqual([
      'welcome',
      'podium-rehearsal',
      'podium-captions',
      'podium-condition',
      'podium-trajectory',
    ]);
  });

  it('reveals the My Corps zone before pointing at any panel', () => {
    // On mobile PodiumZone renders inside the corps zone; a panel step that
    // did not name it would highlight a hidden element.
    for (const step of PODIUM_TOUR_STEPS) {
      if (step.target) expect(step.zone, step.id).toBe('corps');
    }
  });

  it('anchors each panel step to a data-tour target that PodiumZone renders', () => {
    // These selectors must match the wrappers in components/Podium/PodiumZone.
    const targets = PODIUM_TOUR_STEPS.filter((s) => s.target).map((s) => s.target);
    expect(targets).toEqual([
      '[data-tour="podium-rehearsal"]',
      '[data-tour="podium-captions"]',
      '[data-tour="podium-condition"]',
      '[data-tour="podium-trajectory"]',
    ]);
  });
});

describe('getTourSteps', () => {
  it('splits fantasy by device', () => {
    expect(getTourSteps('fantasy', false)).toBe(DESKTOP_TOUR_STEPS);
    expect(getTourSteps('fantasy', true)).toBe(MOBILE_TOUR_STEPS);
  });

  it('serves one Podium list to both devices', () => {
    expect(getTourSteps('podium', false)).toBe(PODIUM_TOUR_STEPS);
    expect(getTourSteps('podium', true)).toBe(PODIUM_TOUR_STEPS);
  });
});
