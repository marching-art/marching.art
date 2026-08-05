import { describe, it, expect } from 'vitest';
import { DASHBOARD_ZONES, DEFAULT_DASHBOARD_ZONE, zoneForPanel } from './dashboardZones';

describe('DASHBOARD_ZONES', () => {
  it('opens on My Corps, where the lineup is', () => {
    // A new director who lands on a tab bar and sees their eight caption slots
    // has learned what the game is; one who lands on a checklist has not.
    expect(DEFAULT_DASHBOARD_ZONE).toBe('corps');
    expect(DASHBOARD_ZONES[0].id).toBe('corps');
  });

  it('names three zones with unique ids and element targets', () => {
    expect(DASHBOARD_ZONES).toHaveLength(3);
    expect(new Set(DASHBOARD_ZONES.map((z) => z.id)).size).toBe(3);
    expect(new Set(DASHBOARD_ZONES.map((z) => z.elementId)).size).toBe(3);
    for (const zone of DASHBOARD_ZONES) {
      expect(zone.label.length).toBeGreaterThan(0);
    }
  });

  it('includes the default in the tab list', () => {
    expect(DASHBOARD_ZONES.some((z) => z.id === DEFAULT_DASHBOARD_ZONE)).toBe(true);
  });
});

describe('zoneForPanel', () => {
  it('locates the panels the Next Action hero can point at', () => {
    // Both live under Today, which is not the default tab — without this the
    // hero's Claim button would scroll to a display:none element.
    expect(zoneForPanel('directors-report')).toBe('today');
    expect(zoneForPanel('journey-panel')).toBe('today');
  });

  it('returns null for a panel that is not inside a zone', () => {
    expect(zoneForPanel('unknown-panel')).toBeNull();
  });

  it('only ever names a real zone', () => {
    const ids = new Set(DASHBOARD_ZONES.map((z) => z.id));
    for (const panel of ['directors-report', 'journey-panel']) {
      expect(ids.has(zoneForPanel(panel)!)).toBe(true);
    }
  });
});
