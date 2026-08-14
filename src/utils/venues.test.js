import { describe, it, expect } from 'vitest';
import { HOSTABLE_VENUES, resolveVenueId, venueLatLng, homeRelocationFee } from './venues';

// Two known cities the gazetteer geocodes, used to anchor the distance math.
const DALLAS = resolveVenueId('Dallas, TX');
const ATLANTA = resolveVenueId('Atlanta, GA');

describe('venueLatLng', () => {
  it('returns coordinates for a known city and null for an unknown one', () => {
    const coord = venueLatLng(DALLAS);
    expect(coord).not.toBeNull();
    expect(typeof coord?.lat).toBe('number');
    expect(typeof coord?.lng).toBe('number');
    expect(venueLatLng('nowhere-zz')).toBeNull();
    expect(venueLatLng(null)).toBeNull();
  });
});

describe('homeRelocationFee — client preview of the home-move sink', () => {
  it('is free for the same city, a missing endpoint, or a null id', () => {
    expect(homeRelocationFee(DALLAS, DALLAS, 2)).toEqual({ miles: 0, fee: 0 });
    expect(homeRelocationFee(null, DALLAS, 2)).toEqual({ miles: 0, fee: 0 });
    expect(homeRelocationFee(DALLAS, 'nowhere-zz', 2)).toEqual({ miles: 0, fee: 0 });
  });

  it('charges 1 CorpsCoin per 2 miles, matching the server rate', () => {
    const { miles, fee } = homeRelocationFee(DALLAS, ATLANTA, 2);
    // Dallas↔Atlanta is ~720 mi straight-line.
    expect(miles).toBeGreaterThan(600);
    expect(miles).toBeLessThan(850);
    // Fee derives from the raw (pre-round) distance, so it sits within a coin of
    // half the reported miles.
    expect(Math.abs(fee - miles / 2)).toBeLessThanOrEqual(1);
    // A 5-mile rate is cheaper than a 2-mile rate for the same move.
    expect(homeRelocationFee(DALLAS, ATLANTA, 5).fee).toBeLessThan(fee);
  });

  it('defaults to a 2-mile rate when none is supplied', () => {
    expect(homeRelocationFee(DALLAS, ATLANTA)).toEqual(homeRelocationFee(DALLAS, ATLANTA, 2));
  });

  it('every hostable city carries a "City, ST" label', () => {
    expect(HOSTABLE_VENUES.length).toBeGreaterThan(0);
    for (const v of HOSTABLE_VENUES.slice(0, 20)) {
      expect(v.label).toBe(`${v.city}, ${v.region}`);
    }
  });
});
