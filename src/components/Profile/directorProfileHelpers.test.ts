// Standing display — the profile's "how good right now" number. Pins the
// SoundSport medal-safety rule (never a numeric placement) and the flagship
// class selection that replaced the retired Influence/Rating aggregates.
import { describe, it, expect } from 'vitest';
import { getStandingDisplay } from './directorProfileHelpers';
import type { UserProfile } from '../../types';

const profile = (corps: Record<string, unknown>): UserProfile =>
  ({ corps }) as unknown as UserProfile;

describe('getStandingDisplay', () => {
  it('shows the live class rank with field size', () => {
    const standing = getStandingDisplay(
      profile({
        worldClass: { corpsName: 'Aurora', totalSeasonScore: 88, seasonRank: 14, seasonRankOf: 43 },
      })
    );
    expect(standing).toEqual({
      label: 'World Class',
      value: '#14',
      of: 43,
      soundSport: false,
    });
  });

  it('picks the highest competitive class as the flagship', () => {
    const standing = getStandingDisplay(
      profile({
        aClass: { corpsName: 'Little Corps', seasonRank: 1, seasonRankOf: 5 },
        worldClass: { corpsName: 'Big Corps', seasonRank: 30, seasonRankOf: 40 },
      })
    );
    expect(standing?.label).toBe('World Class');
    expect(standing?.value).toBe('#30');
  });

  it('shows an em dash before the first scored night', () => {
    const standing = getStandingDisplay(
      profile({ openClass: { corpsName: 'Fresh Corps', totalSeasonScore: 0 } })
    );
    expect(standing?.value).toBe('—');
    expect(standing?.of).toBeNull();
  });

  it('gives SoundSport-only directors a medal rating, never a placement', () => {
    const standing = getStandingDisplay(
      profile({ soundSport: { corpsName: 'Sunrisers', totalSeasonScore: 88 } })
    );
    expect(standing).toEqual({
      label: 'SoundSport',
      value: 'Gold', // 88 ≥ 85 — the canonical rating table
      of: null,
      soundSport: true,
    });
    expect(standing?.value).not.toMatch(/#|\d/);
  });

  it('returns null with no corps at all', () => {
    expect(getStandingDisplay(profile({}))).toBeNull();
    expect(getStandingDisplay({} as UserProfile)).toBeNull();
  });
});
