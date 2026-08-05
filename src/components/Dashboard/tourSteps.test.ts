import { describe, it, expect } from 'vitest';
import { DESKTOP_TOUR_STEPS, MOBILE_TOUR_STEPS } from './tourSteps';
import { DASHBOARD_ZONES } from '../../utils/dashboardZones';

const ALL = [['desktop', DESKTOP_TOUR_STEPS] as const, ['mobile', MOBILE_TOUR_STEPS] as const];

describe.each(ALL)('%s tour steps', (_name, steps) => {
  it('opens on a welcome card with no target', () => {
    expect(steps[0].id).toBe('welcome');
    expect(steps[0].target).toBeNull();
  });

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
  it('is unchanged — it walks the grid that is already on screen', () => {
    expect(DESKTOP_TOUR_STEPS.map((s) => s.id)).toEqual([
      'welcome',
      'control-bar',
      'lineup',
      'recent-results',
      'scorecard',
    ]);
  });

  it('needs no zone reveals, because desktop hides nothing', () => {
    expect(DESKTOP_TOUR_STEPS.every((s) => s.zone === undefined)).toBe(true);
  });
});
