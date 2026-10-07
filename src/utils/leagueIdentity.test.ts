import { describe, expect, it } from 'vitest';
import {
  gameModeCoversClass,
  getLeagueAbbreviation,
  getLeagueGameMode,
  getLeagueRoleplayLevel,
  matchesGameFilter,
  matchesRoleplayFilter,
  isValidLeagueTag,
  normalizeLeagueTagInput,
  suggestLeagueTag,
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

describe('league tag', () => {
  it('keeps only uppercase letters and digits, capped at five', () => {
    expect(normalizeLeagueTagInput('dc-fl')).toBe('DCFL');
    expect(normalizeLeagueTagInput('a b c 1 2 3')).toBe('ABC12');
  });

  it('accepts blank (clears) or 2–5 characters', () => {
    expect(isValidLeagueTag('')).toBe(true);
    expect(isValidLeagueTag('A')).toBe(false);
    expect(isValidLeagueTag('AB')).toBe(true);
    expect(isValidLeagueTag('ABCDE')).toBe(true);
  });

  it('suggests initials, or the head of a one-word name', () => {
    expect(suggestLeagueTag('Drum Corps Fantasy League')).toBe('DCFL');
    expect(suggestLeagueTag('Legends')).toBe('LEGE');
    expect(suggestLeagueTag('The Big Six Brass Line Society')).toBe('TBSBL');
    expect(suggestLeagueTag('X')).toBe('');
    expect(suggestLeagueTag('')).toBe('');
  });

  it('reads a stored tag, or null', () => {
    expect(getLeagueAbbreviation({ abbreviation: 'DCFL' })).toBe('DCFL');
    expect(getLeagueAbbreviation({})).toBeNull();
    expect(getLeagueAbbreviation(null)).toBeNull();
  });

  it('pairs a class with the leagues whose game covers it', () => {
    expect(gameModeCoversClass('both', 'podiumClass')).toBe(true);
    expect(gameModeCoversClass('podium', 'podiumClass')).toBe(true);
    expect(gameModeCoversClass('podium', 'worldClass')).toBe(false);
    expect(gameModeCoversClass('fantasy', 'soundSport')).toBe(true);
    expect(gameModeCoversClass('fantasy', 'podiumClass')).toBe(false);
  });
});
