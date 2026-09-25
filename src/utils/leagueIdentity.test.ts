import { describe, expect, it } from 'vitest';
import {
  getLeagueGameMode,
  getLeagueRoleplayLevel,
  matchesGameFilter,
  matchesRoleplayFilter,
} from './leagueIdentity';

describe('getLeagueGameMode', () => {
  it('reads an absent or unknown mode as both games', () => {
    expect(getLeagueGameMode(null)).toBe('both');
    expect(getLeagueGameMode({ settings: {} })).toBe('both');
    expect(getLeagueGameMode({ settings: { gameMode: 'podium' } })).toBe('podium');
  });
});

describe('getLeagueRoleplayLevel', () => {
  it('prefers the explicit level and reads the retired tag as encouraged', () => {
    expect(getLeagueRoleplayLevel({ roleplay: { level: 'none' }, tag: 'roleplay' })).toBe('none');
    expect(getLeagueRoleplayLevel({ tag: 'roleplay' })).toBe('encouraged');
    expect(getLeagueRoleplayLevel({ tag: 'casual' })).toBeNull();
  });
});

describe('discovery filters', () => {
  it('a both-games league matches either game filter', () => {
    expect(matchesGameFilter({}, 'podium')).toBe(true);
    expect(matchesGameFilter({ settings: { gameMode: 'fantasy' } }, 'podium')).toBe(false);
    expect(matchesGameFilter({ settings: { gameMode: 'fantasy' } }, null)).toBe(true);
  });

  it('groups roleplay levels, and an unstated level matches no roleplay filter', () => {
    expect(matchesRoleplayFilter({ roleplay: { level: 'none' } }, 'none')).toBe(true);
    expect(matchesRoleplayFilter({ roleplay: { level: 'optional' } }, 'light')).toBe(true);
    expect(matchesRoleplayFilter({ roleplay: { level: 'immersive' } }, 'heavy')).toBe(true);
    expect(matchesRoleplayFilter({ roleplay: { level: 'encouraged' } }, 'light')).toBe(false);
    expect(matchesRoleplayFilter({}, 'none')).toBe(false);
    expect(matchesRoleplayFilter({}, null)).toBe(true);
  });
});
