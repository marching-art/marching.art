import { describe, expect, it } from 'vitest';

import { ONE_NIGHT_SEASON_COST, bestScoreFor, type BestBlock } from './oneNightSlate';

// Backend source of truth. helpers/oneNightSlate.js is dependency-free
// CommonJS, so vitest can load it directly — the same drift pin
// captionWars.test.ts uses for its cost.
import { ONE_NIGHT_SEASON_COST as SERVER_SEASON_COST } from '../../functions/src/helpers/oneNightSlate.js';

describe('oneNightSlate client mirror', () => {
  it('quotes the same season cost the server charges', () => {
    expect(ONE_NIGHT_SEASON_COST).toBe(SERVER_SEASON_COST);
  });

  it('reads a stored best block defensively', () => {
    const best: BestBlock = { alice: { score: 84.5, showName: 'Saturday Regional' } };
    expect(bestScoreFor(best, 'alice')).toBe(84.5);
    expect(bestScoreFor(best, 'bob')).toBe(0);
    expect(bestScoreFor(undefined, 'alice')).toBe(0);
  });
});
