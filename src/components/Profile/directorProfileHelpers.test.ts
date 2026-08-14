// Standing display — the profile's "how good right now" number. Pins the
// SoundSport medal-safety rule (never a numeric placement) and the flagship
// class selection that replaced the retired Influence/Rating aggregates.
import { describe, it, expect } from 'vitest';
import {
  getStandingDisplay,
  getSeasonHistory,
  getCorpsJourneys,
  getCompetitionTrophies,
  getFanFavoriteTrophies,
} from './directorProfileHelpers';
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

// Season history + class journeys — a corps carries its seasonHistory with it
// when it moves classes, and each archived season records the class it was
// competed in. These pin that past seasons stay labeled with the class they
// were earned in, and that the climb itself is surfaced as a journey.
describe('getSeasonHistory', () => {
  it('labels each season with the class it was competed in, not the current slot', () => {
    const history = getSeasonHistory(
      profile({
        worldClass: {
          corpsName: 'Myrmidons',
          seasonHistory: [
            { seasonId: 's1', corpsClass: 'soundSport', totalSeasonScore: 80 },
            { seasonId: 's2', corpsClass: 'aClass', totalSeasonScore: 70 },
            { seasonId: 's3', corpsClass: 'worldClass', totalSeasonScore: 85 },
          ],
        },
      })
    );
    expect(history.map((h) => h.classKey)).toEqual(['worldClass', 'aClass', 'soundSport']);
  });

  it('normalizes legacy short class keys and falls back to the slot key', () => {
    const history = getSeasonHistory(
      profile({
        worldClass: {
          corpsName: 'Aurora',
          seasonHistory: [
            { seasonId: 's1', corpsClass: 'open' }, // legacy short key
            { seasonId: 's2' }, // pre-corpsClass archive record
          ],
        },
      })
    );
    expect(history.map((h) => h.classKey)).toEqual(['worldClass', 'openClass']);
  });
});

describe('getCorpsJourneys', () => {
  it('celebrates a corps that climbed, ending at its current class', () => {
    const journeys = getCorpsJourneys(
      profile({
        worldClass: {
          corpsName: 'Myrmidons',
          seasonHistory: [
            { seasonId: 's1', corpsClass: 'soundSport' },
            { seasonId: 's2', corpsClass: 'soundSport' },
            { seasonId: 's3', corpsClass: 'aClass' },
          ],
        },
      })
    );
    expect(journeys).toEqual([
      {
        corpsName: 'Myrmidons',
        classes: ['soundSport', 'aClass', 'worldClass'],
        climbed: true,
      },
    ]);
  });

  it('reports no journey for a corps that has stayed in one class', () => {
    const journeys = getCorpsJourneys(
      profile({
        soundSport: {
          corpsName: 'Sunrisers',
          seasonHistory: [{ seasonId: 's1', corpsClass: 'soundSport' }],
        },
      })
    );
    expect(journeys).toEqual([]);
  });

  it('shows a downward move without marking it as a climb', () => {
    const journeys = getCorpsJourneys(
      profile({
        aClass: {
          corpsName: 'Regulars',
          seasonHistory: [{ seasonId: 's1', corpsClass: 'openClass' }],
        },
      })
    );
    expect(journeys).toEqual([
      { corpsName: 'Regulars', classes: ['openClass', 'aClass'], climbed: false },
    ]);
  });
});

// Fan Favorite — the community-voted Podium crown, written to
// profile.trophies.fanFavorites. It gets its own unique mark in the trophy
// case (the pink Heart), distinct from every competitive medal.
describe('getFanFavoriteTrophies', () => {
  const withTrophies = (trophies: unknown): UserProfile =>
    ({ trophies }) as unknown as UserProfile;

  it('renders a crowned corps as a pink Heart with its corps, season, and votes', () => {
    const [trophy, ...rest] = getFanFavoriteTrophies(
      withTrophies({
        fanFavorites: [
          {
            type: 'fanFavorite',
            corpsClass: 'podiumClass',
            seasonName: 'live_2026_summer',
            corpsName: 'Aurora Guard',
            votes: 47,
          },
        ],
      })
    );
    expect(rest).toEqual([]);
    expect(trophy.title).toBe('Fan Favorite');
    expect(trophy.color).toBe('text-pink-400');
    expect(trophy.description).toBe('Aurora Guard · LIVE 2026 · 47 votes');
  });

  it('singularizes a one-vote crown and tolerates missing fields', () => {
    const [trophy] = getFanFavoriteTrophies(
      withTrophies({ fanFavorites: [{ type: 'fanFavorite', corpsName: 'Lone Star', votes: 1 }] })
    );
    expect(trophy.description).toBe('Lone Star · 1 vote');
  });

  it('returns nothing when the director has never been crowned', () => {
    expect(getFanFavoriteTrophies(withTrophies({}))).toEqual([]);
    expect(getFanFavoriteTrophies({} as UserProfile)).toEqual([]);
  });

  it('surfaces the Fan Favorite in the competition trophy case', () => {
    const trophies = getCompetitionTrophies(
      withTrophies({
        fanFavorites: [{ type: 'fanFavorite', corpsName: 'Aurora Guard', seasonName: 'live_2026' }],
      })
    );
    expect(trophies.map((t) => t.title)).toContain('Fan Favorite');
  });
});
