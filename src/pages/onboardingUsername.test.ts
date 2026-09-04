import { describe, it, expect } from 'vitest';
import { usernameFormatError, usernameCheckFailure } from './onboardingUsername';

describe('usernameFormatError', () => {
  it('accepts 3-15 characters of letters, digits and underscores', () => {
    expect(usernameFormatError('abc')).toBeNull();
    expect(usernameFormatError('drum_major_2026')).toBeNull();
  });

  it('names the rule that failed', () => {
    expect(usernameFormatError('ab')).toMatch(/at least 3/);
    expect(usernameFormatError('a'.repeat(16))).toMatch(/15 characters or less/);
    expect(usernameFormatError('bad name')).toMatch(/letters, numbers, and underscores/);
  });
});

describe('usernameCheckFailure', () => {
  it('maps the server verdicts to the director-facing message', () => {
    expect(usernameCheckFailure({ code: 'functions/already-exists' }).message).toMatch(/taken/);
    expect(
      usernameCheckFailure({ code: 'functions/invalid-argument', message: 'Reserved word' })
    ).toEqual({ checking: false, valid: false, message: 'Reserved word' });
    expect(usernameCheckFailure(new Error('network')).message).toMatch(/Could not verify/);
    expect(usernameCheckFailure(undefined).valid).toBe(false);
  });
});
