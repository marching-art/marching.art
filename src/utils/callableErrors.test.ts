import { describe, expect, test } from 'vitest';
import { friendlyCallableError } from './callableErrors';

const fbError = (code: string, message: string) => Object.assign(new Error(message), { code });

describe('friendlyCallableError', () => {
  test('passes a server-authored HttpsError message through', () => {
    const err = fbError('functions/failed-precondition', 'Caption changes are locked tonight.');
    expect(friendlyCallableError(err, 'Fallback')).toBe('Caption changes are locked tonight.');
  });

  test('collapses transport codes to the connectivity line', () => {
    expect(friendlyCallableError(fbError('functions/unavailable', 'unavailable'), 'F')).toMatch(
      /connection/i
    );
    expect(friendlyCallableError(fbError('functions/deadline-exceeded', 'x'), 'F')).toMatch(
      /connection/i
    );
  });

  test('never shows a raw infrastructure code', () => {
    expect(friendlyCallableError(fbError('functions/internal', 'internal'), 'Fallback')).toBe(
      'Fallback'
    );
    expect(friendlyCallableError(fbError('functions/unknown', 'INTERNAL'), 'Fallback')).toBe(
      'Fallback'
    );
  });

  test('falls back when the message is empty or just a code word', () => {
    expect(friendlyCallableError(fbError('functions/not-found', ''), 'Fallback')).toBe('Fallback');
    expect(friendlyCallableError(fbError('functions/not-found', 'not-found'), 'Fallback')).toBe(
      'Fallback'
    );
    expect(friendlyCallableError(null, 'Fallback')).toBe('Fallback');
    expect(friendlyCallableError('boom', 'Fallback')).toBe('Fallback');
  });

  test('accepts plain objects with a message', () => {
    expect(friendlyCallableError({ message: 'Only commissioners can do that.' }, 'F')).toBe(
      'Only commissioners can do that.'
    );
  });
});
