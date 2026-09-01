import { describe, expect, it } from 'vitest';
import { createRequire } from 'node:module';
import { checkBirthDate, latestEligibleBirthDate, MIN_AGE_YEARS } from './ageGate';

const require = createRequire(import.meta.url);
const server = require('../../functions/src/helpers/ageGate.js');

const NOW = new Date('2026-09-01T12:00:00Z');

describe('ageGate (client mirror)', () => {
  it('matches the server helper on the boundary cases', () => {
    for (const value of [
      '2013-09-01',
      '2013-09-02',
      '2010-02-30',
      'garbage',
      '2027-01-01',
      '1800-01-01',
    ]) {
      expect(checkBirthDate(value, NOW)).toEqual(server.checkBirthDate(value, NOW));
    }
    expect(MIN_AGE_YEARS).toBe(server.MIN_AGE_YEARS);
  });

  it('the input max is the latest eligible birth date', () => {
    expect(latestEligibleBirthDate(NOW)).toBe('2013-09-01');
    expect(checkBirthDate(latestEligibleBirthDate(NOW), NOW).ok).toBe(true);
  });
});
