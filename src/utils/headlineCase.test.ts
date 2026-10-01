import { describe, expect, it } from 'vitest';
import { createRequire } from 'node:module';
import { toApTitleCase } from './headlineCase';

const require = createRequire(import.meta.url);
const backend = require('../../functions/src/helpers/headlineCase.js') as {
  toApTitleCase: (h: unknown) => string;
};

/** [input, expected AP title case] */
const CASES: Array<[string, string]> = [
  // Principal words up, short articles/conjunctions/prepositions down
  ['blue devils lead the field at day 12', 'Blue Devils Lead the Field at Day 12'],
  ['Spirit Of Atlanta Climbs To 5th', 'Spirit of Atlanta Climbs to 5th'],
  // Four-letter prepositions are capitalized
  ['crown pulls away from the pack with a win', 'Crown Pulls Away From the Pack With a Win'],
  // First and last words always capitalized
  ['the corps to watch on', 'The Corps to Watch On'],
  ['what to look for', 'What to Look For'],
  // Subtitles: colon, question mark, dashes, pipes
  ['day 12 recap: the race tightens', 'Day 12 Recap: The Race Tightens'],
  ['boston vs. crown: who wins?', 'Boston vs. Crown: Who Wins?'],
  ['day 12 recap — the race is on', 'Day 12 Recap — The Race Is On'],
  ['finals preview | a three-way fight', 'Finals Preview | A Three-Way Fight'],
  ['crown—again', 'Crown—Again'],
  // Hyphenated compounds
  ['crown holds off the cadets head-to-head', 'Crown Holds Off the Cadets Head-to-Head'],
  ['mid-season report: top-ranked corps', 'Mid-Season Report: Top-Ranked Corps'],
  // Phrasal-verb particles stay up
  ['bluecoats move up as troopers sell out', 'Bluecoats Move Up as Troopers Sell Out'],
  ['blue devils hold on in toledo', 'Blue Devils Hold On in Toledo'],
  ['crown moves on to finals', 'Crown Moves On to Finals'],
  ['a look at the season on the road', 'A Look at the Season on the Road'],
  // Deliberate casing preserved
  ['SoundSport teams shine at the DCI finals', 'SoundSport Teams Shine at the DCI Finals'],
  ['carolina crown ↑ 0.35 in GE1', 'Carolina Crown ↑ 0.35 in GE1'],
  ['what is marching.art worth to you?', 'What Is marching.art Worth to You?'],
  ['the 2nd-place corps', 'The 2nd-Place Corps'],
  // "A Class" is a proper noun
  ['Open and A Class Prelims', 'Open and A Class Prelims'],
  ['a class act from a corps', 'A Class Act From a Corps'],
  // Quotes, possessives, whitespace
  ['“the best of the best” returns', '“The Best of the Best” Returns'],
  ["the director's cut: devils' night", "The Director's Cut: Devils' Night"],
  ['  too   many    spaces  ', 'Too Many Spaces'],
];

describe('toApTitleCase', () => {
  it.each(CASES)('%s', (input, expected) => {
    expect(toApTitleCase(input)).toBe(expected);
  });

  it('is idempotent', () => {
    for (const [input] of CASES) {
      const once = toApTitleCase(input);
      expect(toApTitleCase(once)).toBe(once);
    }
  });

  it('returns an empty string for non-strings and blanks', () => {
    expect(toApTitleCase(undefined)).toBe('');
    expect(toApTitleCase(null)).toBe('');
    expect(toApTitleCase(42)).toBe('');
    expect(toApTitleCase('   ')).toBe('');
    expect(toApTitleCase('↑ —')).toBe('↑ —');
  });

  it('matches the Cloud Functions twin on every case', () => {
    for (const [input] of CASES) {
      expect(backend.toApTitleCase(input)).toBe(toApTitleCase(input));
    }
    for (const odd of [undefined, null, 7, '', ' ', '↑ —']) {
      expect(backend.toApTitleCase(odd)).toBe(toApTitleCase(odd));
    }
  });
});
