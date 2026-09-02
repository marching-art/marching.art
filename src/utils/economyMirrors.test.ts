// Parity test for the client-side mirrors of server economy constants. The
// server helpers require firebase-admin at module load, so instead of
// importing them this reads their source text and pins each `const NAME = N`
// literal to the mirror the UI quotes. A drift here means a director is being
// told a number the game does not actually pay.
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, test } from 'vitest';
import { NEW_DIRECTOR_CORPSCOIN } from './economyMirrors';
import { DEFAULT_FINALS_SIZE, LEAGUE_POOL_ANTE_CC, LEAGUE_WEEKLY_WIN_CC } from './leagueEconomy';

const serverConstant = (relativePath: string, name: string): number => {
  // vitest runs from the repo root (vite.config.js), so cwd-relative is stable.
  const file = path.resolve(process.cwd(), 'functions/src/helpers', relativePath);
  const source = readFileSync(file, 'utf8');
  const match = source.match(new RegExp(`^const ${name} = (\\d+);`, 'm'));
  if (!match) throw new Error(`${name} not found as a numeric const in ${relativePath}`);
  return Number(match[1]);
};

describe('economy mirrors match the server', () => {
  test('new-director CorpsCoin grant (onboarding copy)', () => {
    expect(NEW_DIRECTOR_CORPSCOIN).toBe(serverConstant('economy.js', 'NEW_DIRECTOR_CORPSCOIN'));
  });

  test('weekly league win reward', () => {
    expect(LEAGUE_WEEKLY_WIN_CC).toBe(serverConstant('economy.js', 'WEEKLY_LEAGUE_WIN_REWARD'));
  });

  test('league prediction-pool ante', () => {
    expect(LEAGUE_POOL_ANTE_CC).toBe(serverConstant('leaguePools.js', 'POOL_ANTE'));
  });

  test('default league Finals size', () => {
    expect(DEFAULT_FINALS_SIZE).toBe(serverConstant('leagueChampion.js', 'DEFAULT_FINALS_SIZE'));
  });
});
