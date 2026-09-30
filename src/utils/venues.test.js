import { describe, it, expect } from 'vitest';
import { HOSTABLE_VENUES, collapseMultiCity, resolveVenueId } from './venues';

describe('HOSTABLE_VENUES', () => {
  it('every hostable city carries a "City, ST" label', () => {
    expect(HOSTABLE_VENUES.length).toBeGreaterThan(0);
    for (const v of HOSTABLE_VENUES.slice(0, 20)) {
      expect(v.label).toBe(`${v.city}, ${v.region}`);
    }
  });
});

describe('multi-city show locations', () => {
  it('collapse to the last city', () => {
    expect(collapseMultiCity('Lexington/Winchester, KY')).toBe('Winchester, KY');
    expect(collapseMultiCity('Allentown, PA')).toBe('Allentown, PA');
    expect(collapseMultiCity(null)).toBe('');
  });

  it("resolve to the last city's venue", () => {
    expect(resolveVenueId('Lexington/Winchester, KY')).toBe('winchester-ky');
    expect(resolveVenueId('Lexington/Winchester, Kentucky')).toBe('winchester-ky');
    expect(resolveVenueId('Winchester, KY')).toBe('winchester-ky');
    expect(resolveVenueId('Lexington, KY')).toBe('lexington-ky');
  });
});
