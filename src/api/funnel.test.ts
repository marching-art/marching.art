// Tests for the product-funnel instrumentation.
//
// Instrumentation that silently lies is worse than none — a wrong number gets
// acted on. These pin the behaviors that would corrupt a funnel report:
// unmapped callables staying silent, dry-run calls not counting as the real
// action, parameter names matching the callables' actual payload shapes, and
// analytics failures never reaching the caller.

import { describe, it, expect, vi, beforeEach } from 'vitest';

const logEvent = vi.fn();

vi.mock('./analytics', () => ({
  analytics: {
    logEvent: (...args: unknown[]) => logEvent(...args),
  },
}));

const { trackCallable, trackFunnelEvent, errorCodeOf, FUNNEL_EVENTS, CLIENT_FUNNEL_EVENTS } =
  await import('./funnel');

/** The (event, params) of the single logged call. */
function lastCall(): [string, Record<string, unknown>] {
  expect(logEvent).toHaveBeenCalledTimes(1);
  const [event, params] = logEvent.mock.calls[0];
  return [event as string, params as Record<string, unknown>];
}

beforeEach(() => {
  logEvent.mockReset();
});

describe('trackCallable', () => {
  it('emits the mapped event name with outcome and duration', () => {
    trackCallable('saveLineup', 'success', {
      data: { corpsClass: 'worldClass' },
      durationMs: 123.7,
    });

    const [event, params] = lastCall();
    expect(event).toBe('lineup_saved');
    expect(params).toMatchObject({
      callable: 'saveLineup',
      outcome: 'success',
      corps_class: 'worldClass',
      duration_ms: 124, // rounded — GA4 has no use for fractional millis
    });
  });

  it('stays silent for callables that are not funnel steps', () => {
    // Reads and polling must not burn GA4's 500-event-name budget.
    trackCallable('getPublicProfile', 'success', { data: { uid: 'abc' } });
    trackCallable('validateLineup', 'success', { data: { corpsClass: 'aClass' } });
    expect(logEvent).not.toHaveBeenCalled();
  });

  it('records the error code, not the message, on failure', () => {
    trackCallable('unlockClassWithCorpsCoin', 'error', {
      data: { classToUnlock: 'openClass' },
      // Firebase callable errors are `functions/<status>`; the status is the
      // part worth segmenting on, and messages can carry interpolated user data.
      errorCode: 'failed-precondition',
    });

    const [event, params] = lastCall();
    expect(event).toBe('class_unlocked');
    expect(params).toMatchObject({
      outcome: 'error',
      error_code: 'failed-precondition',
      corps_class: 'openClass',
    });
    expect(JSON.stringify(params)).not.toContain('Not enough CorpsCoin');
  });

  it('does not count a retireCorps dry run as a retirement', () => {
    // The confirm dialog calls retireCorps({ checkOnly: true }) to ask whether
    // retirement is allowed. Counting those would report several times the real
    // retirements.
    trackCallable('retireCorps', 'success', {
      data: { corpsClass: 'worldClass', checkOnly: true },
    });
    expect(logEvent).not.toHaveBeenCalled();

    trackCallable('retireCorps', 'success', { data: { corpsClass: 'worldClass' } });
    const [event] = lastCall();
    expect(event).toBe('corps_retired');
  });

  it('omits params it cannot resolve rather than sending "undefined"', () => {
    // GA4 records the key with a literal "undefined" string otherwise, which
    // then shows up as a real dimension value in reports.
    trackCallable('registerCorps', 'success', { data: {} });

    const [, params] = lastCall();
    expect(params).not.toHaveProperty('corps_class');
    expect(params).not.toHaveProperty('error_code');
    expect(params).not.toHaveProperty('duration_ms');
  });

  it('tolerates a non-object payload', () => {
    expect(() => trackCallable('saveLineup', 'success', { data: undefined })).not.toThrow();
    expect(() => trackCallable('saveLineup', 'success', { data: 'nope' })).not.toThrow();
  });

  it('truncates long string params to GA4 limits', () => {
    trackCallable('purchaseShopItem', 'success', { data: { itemId: 'x'.repeat(250) } });
    const [, params] = lastCall();
    expect((params.item_id as string).length).toBe(100);
  });

  it('never lets an analytics failure escape to the caller', () => {
    logEvent.mockImplementation(() => {
      throw new Error('ad blocker');
    });
    expect(() => trackCallable('saveLineup', 'success', { data: {} })).not.toThrow();
  });

  it('disambiguates events shared by several callables', () => {
    // shop and prestige purchases share `shop_purchase`/`prestige_purchase`;
    // `callable` is what tells them apart in a report.
    trackCallable('purchaseHallBanner', 'success', { data: {} });
    const [event, params] = lastCall();
    expect(event).toBe('prestige_purchase');
    expect(params.callable).toBe('purchaseHallBanner');
  });
});

describe('FUNNEL_EVENTS', () => {
  it('uses names GA4 accepts', () => {
    for (const [callable, event] of Object.entries(FUNNEL_EVENTS)) {
      expect(event, `${callable} -> ${event}`).toMatch(/^[a-z][a-z0-9_]*$/);
      expect(event.length, `${callable} -> ${event}`).toBeLessThanOrEqual(40);
      // GA4 reserves these prefixes and silently drops the event.
      expect(event).not.toMatch(/^(firebase_|google_|ga_)/);
    }
  });

  it('keeps the client-side event names valid too', () => {
    for (const event of Object.values(CLIENT_FUNNEL_EVENTS)) {
      expect(event).toMatch(/^[a-z][a-z0-9_]*$/);
      expect(event.length).toBeLessThanOrEqual(40);
    }
  });

  it('is frozen so a stray write cannot orphan historical reports', () => {
    expect(Object.isFrozen(FUNNEL_EVENTS)).toBe(true);
    expect(Object.isFrozen(CLIENT_FUNNEL_EVENTS)).toBe(true);
  });
});

describe('trackFunnelEvent', () => {
  it('passes params through, dropping empty ones', () => {
    trackFunnelEvent(CLIENT_FUNNEL_EVENTS.SCORE_DROP_RETURN, {
      day: 12,
      days_missed: undefined,
      src: 'push',
    });

    const [event, params] = lastCall();
    expect(event).toBe('score_drop_return');
    expect(params).toEqual({ day: 12, src: 'push' });
  });

  it('keeps a legitimate zero', () => {
    // `days_missed: 0` is the most important value in the series — it means the
    // announcement worked. Dropping falsy values would erase it.
    trackFunnelEvent(CLIENT_FUNNEL_EVENTS.SCORE_DROP_RETURN, { days_missed: 0, competed: false });
    const [, params] = lastCall();
    expect(params).toEqual({ days_missed: 0, competed: false });
  });

  it('swallows analytics errors', () => {
    logEvent.mockImplementation(() => {
      throw new Error('blocked');
    });
    expect(() => trackFunnelEvent('score_drop_return', {})).not.toThrow();
  });
});

describe('errorCodeOf', () => {
  it('strips the functions/ prefix Firebase adds', () => {
    expect(errorCodeOf({ code: 'functions/failed-precondition' })).toBe('failed-precondition');
    expect(errorCodeOf({ code: 'functions/unauthenticated' })).toBe('unauthenticated');
  });

  it('passes through codes that carry no prefix', () => {
    expect(errorCodeOf({ code: 'permission-denied' })).toBe('permission-denied');
  });

  it('falls back to "unknown" for anything unrecognizable', () => {
    expect(errorCodeOf(new Error('boom'))).toBe('unknown');
    expect(errorCodeOf(null)).toBe('unknown');
    expect(errorCodeOf(undefined)).toBe('unknown');
    expect(errorCodeOf('a string')).toBe('unknown');
    expect(errorCodeOf({ code: 42 })).toBe('unknown');
  });

  it('bounds the code length', () => {
    expect(errorCodeOf({ code: 'z'.repeat(400) }).length).toBe(100);
  });
});
