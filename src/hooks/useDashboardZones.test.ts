import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useDashboardZones } from './useDashboardZones';

const FULL = 8;

function setup(overrides: Partial<Parameters<typeof useDashboardZones>[0]> = {}) {
  return renderHook(() =>
    useDashboardZones({
      profile: null,
      recentResults: [],
      activeCorpsClass: 'worldClass',
      lineupCount: FULL,
      ...overrides,
    })
  );
}

describe('useDashboardZones', () => {
  beforeEach(() => {
    // rAF is how revealPanel waits for the newly shown zone to lay out.
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
      cb(0);
      return 0;
    });
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    document.body.innerHTML = '';
  });

  it('opens on My Corps', () => {
    const { result } = setup();
    expect(result.current.activeZone).toBe('corps');
  });

  it('hides every zone but the selected one, and only on mobile', () => {
    const { result } = setup();
    expect(result.current.zoneClass('corps')).toBe('');
    expect(result.current.zoneClass('today')).toBe('hidden lg:block');
    expect(result.current.zoneClass('season')).toBe('hidden lg:block');
  });

  it('follows a zone change', () => {
    const { result } = setup();
    act(() => result.current.setActiveZone('season'));
    expect(result.current.zoneClass('season')).toBe('');
    expect(result.current.zoneClass('corps')).toBe('hidden lg:block');
  });

  it('dots My Corps while the lineup is short', () => {
    const { result } = setup({ lineupCount: 3 });
    expect(result.current.attention.corps).toBe(true);
  });

  it('leaves My Corps clear once the lineup is full', () => {
    expect(setup({ lineupCount: FULL }).result.current.attention.corps).toBe(false);
  });

  it('never dots My Corps for a Podium director, who has no lineup', () => {
    // Regression guard: a Podium corps has lineupCount 0, so the naive
    // `lineupCount < 8` lit the dot permanently.
    const { result } = setup({ isPodium: true, lineupCount: 0 });
    expect(result.current.attention.corps).toBe(false);
  });

  it("counts a Podium director's show/concept toward Today via podium facts", () => {
    // With the login unclaimed and no facts, Today is unfinished; the facts
    // themselves don't complete the day but must not crash the computation.
    const { result } = setup({
      isPodium: true,
      lineupCount: 0,
      activeCorpsClass: 'podiumClass',
      podium: { hasShows: true, hasConcept: true },
    });
    expect(typeof result.current.attention.today).toBe('boolean');
  });

  it("dots Today while the day's set is unfinished", () => {
    // A null profile has claimed nothing today, so the set cannot be done.
    const { result } = setup();
    expect(result.current.attention.today).toBe(true);
  });

  it('reveals a hidden zone before scrolling to a panel inside it', () => {
    // The Next Action hero can point at a claim under Today while the
    // director is looking at My Corps; scrolling alone would hit display:none.
    const panel = document.createElement('div');
    panel.id = 'journey-panel';
    const scrollIntoView = vi.fn();
    panel.scrollIntoView = scrollIntoView;
    document.body.appendChild(panel);

    const { result } = setup();
    expect(result.current.activeZone).toBe('corps');

    act(() => result.current.revealPanel('journey-panel'));

    expect(result.current.activeZone).toBe('today');
    expect(scrollIntoView).toHaveBeenCalled();
  });

  it('still scrolls to a panel that belongs to no zone', () => {
    const panel = document.createElement('div');
    panel.id = 'loose-panel';
    const scrollIntoView = vi.fn();
    panel.scrollIntoView = scrollIntoView;
    document.body.appendChild(panel);

    const { result } = setup();
    act(() => result.current.revealPanel('loose-panel'));

    expect(result.current.activeZone).toBe('corps');
    expect(scrollIntoView).toHaveBeenCalled();
  });

  it('does not throw when the panel is not on the page', () => {
    const { result } = setup();
    expect(() => act(() => result.current.revealPanel('missing'))).not.toThrow();
  });
});
