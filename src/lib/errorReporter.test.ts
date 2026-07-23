import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { reportError, initErrorReporting } from './errorReporter';

describe('errorReporter', () => {
  let consoleSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleSpy.mockRestore();
  });

  it('logs with the source tag and coerces non-Error values', () => {
    reportError('boom', { source: 'unit-test' });
    expect(consoleSpy).toHaveBeenCalledTimes(1);
    const [tag, err] = consoleSpy.mock.calls[0];
    expect(tag).toBe('[unit-test]');
    // A raw string is coerced into a real Error so a stack is always present.
    expect(err).toBeInstanceOf(Error);
    expect((err as Error).message).toBe('boom');
  });

  it('passes an Error through unchanged', () => {
    const original = new Error('kaboom');
    reportError(original, { source: 'unit-test' });
    expect(consoleSpy.mock.calls[0][1]).toBe(original);
  });

  it('does not contact any endpoint when none is configured (default build)', () => {
    const beacon = vi.fn(() => true);
    navigator.sendBeacon = beacon as typeof navigator.sendBeacon;
    reportError(new Error('x'), { source: 'unit-test' });
    expect(beacon).not.toHaveBeenCalled();
  });

  it('installs a global error handler that funnels into reportError', () => {
    initErrorReporting();
    initErrorReporting(); // idempotent — second call must not double-install
    window.dispatchEvent(new ErrorEvent('error', { error: new Error('uncaught') }));
    const call = consoleSpy.mock.calls.find((c: unknown[]) => c[0] === '[window.onerror]');
    expect(call).toBeTruthy();
  });
});
