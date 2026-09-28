import { describe, it, expect } from 'vitest';
import { HOSTABLE_VENUES } from './venues';

describe('HOSTABLE_VENUES', () => {
  it('every hostable city carries a "City, ST" label', () => {
    expect(HOSTABLE_VENUES.length).toBeGreaterThan(0);
    for (const v of HOSTABLE_VENUES.slice(0, 20)) {
      expect(v.label).toBe(`${v.city}, ${v.region}`);
    }
  });
});
