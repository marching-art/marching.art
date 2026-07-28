import { describe, it, expect } from 'vitest';

import { formatEventName, formatSeasonName } from './season';

describe('formatEventName', () => {
  it('rebrands DCI to marching.art', () => {
    expect(formatEventName('DCI Indianapolis')).toBe('marching.art Indianapolis');
    expect(formatEventName('DCI Eastern Classic')).toBe('marching.art Eastern Classic');
  });

  it('rebrands a director-hosted show named after DCI', () => {
    // The host callable brands at write, but shows booked before that (and any
    // other name reaching the client with "DCI" in it) still render branded.
    expect(formatEventName('DCI Cityname')).toBe('marching.art Cityname');
    expect(formatEventName('The DCI Invitational')).toBe('The marching.art Invitational');
    expect(formatEventName('DCI-East Showcase')).toBe('marching.art-East Showcase');
  });

  it('is idempotent, so branding twice is harmless', () => {
    expect(formatEventName(formatEventName('DCI Cityname'))).toBe('marching.art Cityname');
  });

  it('leaves names without the standalone word alone', () => {
    expect(formatEventName('Riverside Invitational')).toBe('Riverside Invitational');
    expect(formatEventName('DCIX Classic')).toBe('DCIX Classic');
  });

  it('returns an empty string for missing names', () => {
    expect(formatEventName(null)).toBe('');
    expect(formatEventName(undefined)).toBe('');
    expect(formatEventName('')).toBe('');
  });
});

describe('formatSeasonName', () => {
  it('collapses a live season to its competition year', () => {
    expect(formatSeasonName('live_2026-26')).toBe('LIVE 2026');
  });

  it('title-cases off-season names', () => {
    expect(formatSeasonName('off_season_2024')).toBe('Off Season 2024');
  });

  it('falls back when there is no season', () => {
    expect(formatSeasonName(null)).toBe('New Season');
  });
});
