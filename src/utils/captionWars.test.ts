import { describe, expect, it } from 'vitest';

import {
  CAPTION_CATEGORIES,
  CAPTION_WARS_SEASON_COST,
  captionsWonBy,
  formatTally,
  hasCaptionRecords,
  isSweep,
  type CaptionsBlock,
} from './captionWars';

// Backend source of truth. helpers/captionWars.js is dependency-free CommonJS,
// so vitest can load it directly — the same trick progressionGuide.test.js uses
// to pin the XP tables.
import {
  CAPTION_WARS_SEASON_COST as SERVER_SEASON_COST,
  CAPTION_CATEGORIES as SERVER_CATEGORIES,
} from '../../functions/src/helpers/captionWars.js';

// The block the backend stores on a resolved Caption Wars matchup.
const decided: CaptionsBlock = {
  ge: { scores: { alice: 30, bob: 40 }, winner: 'bob' },
  visual: { scores: { alice: 28, bob: 27 }, winner: 'alice' },
  music: { scores: { alice: 28, bob: 27 }, winner: 'alice' },
  tally: { alice: 2, bob: 1 },
};

const sweep: CaptionsBlock = {
  ge: { winner: 'alice' },
  visual: { winner: 'alice' },
  music: { winner: 'alice' },
  tally: { alice: 3, bob: 0 },
};

// The one case a category can go undecided: tied caption AND tied weekly total.
const partlyUndecided: CaptionsBlock = {
  ge: { winner: 'tie' },
  visual: { winner: 'alice' },
  music: { winner: 'bob' },
  tally: { alice: 1, bob: 1 },
};

describe('CAPTION_CATEGORIES', () => {
  it('is the three groups the scorer persists, in stored order', () => {
    expect(CAPTION_CATEGORIES.map((c) => c.key)).toEqual(['ge', 'visual', 'music']);
  });

  // The client reads a block the server wrote; a category the server stores
  // under a key the client does not know would silently render as undecided.
  it('mirrors the server category keys and their order', () => {
    expect(CAPTION_CATEGORIES.map((c) => c.key)).toEqual(
      SERVER_CATEGORIES.map((c: { key: string }) => c.key)
    );
  });
});

describe('CAPTION_WARS_SEASON_COST', () => {
  // The purchase card and the game guide both quote this. A price a commissioner
  // reads in one place and is charged in another must be the same number.
  it('is the price the server actually charges', () => {
    expect(CAPTION_WARS_SEASON_COST).toBe(SERVER_SEASON_COST);
  });
});

describe('captionsWonBy', () => {
  it('reads both sides of a 2-1', () => {
    expect(captionsWonBy(decided, 'alice')).toEqual({ won: 2, lost: 1 });
    expect(captionsWonBy(decided, 'bob')).toEqual({ won: 1, lost: 2 });
  });

  it('counts an undecided category for neither director', () => {
    expect(captionsWonBy(partlyUndecided, 'alice')).toEqual({ won: 1, lost: 1 });
    expect(captionsWonBy(partlyUndecided, 'bob')).toEqual({ won: 1, lost: 1 });
  });

  // A matchup from a `total` league, a bye, or a week resolved before the
  // format existed carries no block at all.
  it('is all zeros with no block', () => {
    expect(captionsWonBy(undefined, 'alice')).toEqual({ won: 0, lost: 0 });
    expect(captionsWonBy({}, 'alice')).toEqual({ won: 0, lost: 0 });
  });
});

describe('formatTally', () => {
  it('reads as a record', () => {
    expect(formatTally(decided, 'alice')).toBe('2–1');
    expect(formatTally(sweep, 'alice')).toBe('3–0');
  });
});

describe('isSweep', () => {
  it('is only every contested category', () => {
    expect(isSweep(sweep, 'alice')).toBe(true);
    expect(isSweep(sweep, 'bob')).toBe(false);
    expect(isSweep(decided, 'alice')).toBe(false);
  });

  // 1-0 with two undecided is not a sweep — nothing was swept.
  it('is not a lone category won while the rest went undecided', () => {
    const thin: CaptionsBlock = {
      ge: { winner: 'alice' },
      visual: { winner: 'tie' },
      music: { winner: 'tie' },
      tally: { alice: 1, bob: 0 },
    };
    expect(isSweep(thin, 'alice')).toBe(false);
  });
});

describe('hasCaptionRecords', () => {
  it('is false for a league on the default format', () => {
    expect(hasCaptionRecords([{ captionsWon: 0, captionsLost: 0 }, {}])).toBe(false);
  });

  it('is true as soon as one week has resolved', () => {
    expect(hasCaptionRecords([{ captionsWon: 2, captionsLost: 1 }, {}])).toBe(true);
  });

  // A director who has dropped categories without taking any still counts —
  // otherwise a winless member would hide the column from their own table.
  it('counts categories dropped, not just taken', () => {
    expect(hasCaptionRecords([{ captionsWon: 0, captionsLost: 3 }])).toBe(true);
  });

  it('is false for an empty table', () => {
    expect(hasCaptionRecords([])).toBe(false);
  });
});
