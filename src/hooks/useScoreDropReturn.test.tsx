// Tests for the score-drop return event.
//
// This is the conversion metric for the whole announcement stack (Discord
// embed, morning push, in-app). The failure modes that matter are over-counting
// (firing on every render or every mount would report phantom returns and make
// the notifications look effective when they are not) and under-counting a
// genuinely new day.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook } from '@testing-library/react';

const trackFunnelEvent = vi.fn();

vi.mock('../api/funnel', () => ({
  trackFunnelEvent: (...args: unknown[]) => trackFunnelEvent(...args),
  CLIENT_FUNNEL_EVENTS: { SCORE_DROP_RETURN: 'score_drop_return' },
}));

const { useScoreDropReturn } = await import('./useScoreDropReturn');

const SEASON = 'adagio_2026-27';
const KEY = `ma:lastSeenScoredDay:${SEASON}`;

/** The params of the single reported event. */
function reportedParams(): Record<string, unknown> {
  expect(trackFunnelEvent).toHaveBeenCalledTimes(1);
  return trackFunnelEvent.mock.calls[0][1] as Record<string, unknown>;
}

function setSearch(search: string) {
  window.history.replaceState({}, '', `/scores${search}`);
}

beforeEach(() => {
  trackFunnelEvent.mockReset();
  window.localStorage.clear();
  setSearch('');
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('useScoreDropReturn', () => {
  it('reports the first view of a day and records the watermark', () => {
    renderHook(() => useScoreDropReturn({ seasonUid: SEASON, scoredDay: 5, competed: true }));

    const params = reportedParams();
    expect(trackFunnelEvent.mock.calls[0][0]).toBe('score_drop_return');
    expect(params).toMatchObject({ day: 5, first_view: true, competed: true });
    // No previous watermark means "missed" is unknowable; reporting 0 would
    // understate the metric, so the hook leaves it undefined. Stripping the key
    // is funnel.compact()'s job, covered in funnel.test.ts — this mock stands in
    // for the funnel module, so the assertion is on the value, not the key.
    expect(params.days_missed).toBeUndefined();
    expect(window.localStorage.getItem(KEY)).toBe('5');
  });

  it('does not report the same day twice across mounts', () => {
    const { unmount } = renderHook(() => useScoreDropReturn({ seasonUid: SEASON, scoredDay: 5 }));
    unmount();
    trackFunnelEvent.mockReset();

    renderHook(() => useScoreDropReturn({ seasonUid: SEASON, scoredDay: 5 }));
    expect(trackFunnelEvent).not.toHaveBeenCalled();
  });

  it('does not report again when unrelated props change within one mount', () => {
    const { rerender } = renderHook((props: { competed?: boolean }) =>
      useScoreDropReturn({ seasonUid: SEASON, scoredDay: 5, competed: props?.competed })
    );
    // `competed` resolves after the recap query settles — a second fire here
    // would double-count every visit.
    rerender({ competed: true });
    expect(trackFunnelEvent).toHaveBeenCalledTimes(1);
  });

  it('counts the drops missed since the last visit', () => {
    window.localStorage.setItem(KEY, '5');
    renderHook(() => useScoreDropReturn({ seasonUid: SEASON, scoredDay: 8 }));

    // Saw day 5, now seeing day 8: days 6 and 7 went unseen.
    expect(reportedParams()).toMatchObject({ day: 8, days_missed: 2, first_view: false });
  });

  it('reports days_missed 0 for a same-night return', () => {
    window.localStorage.setItem(KEY, '7');
    renderHook(() => useScoreDropReturn({ seasonUid: SEASON, scoredDay: 8 }));
    expect(reportedParams().days_missed).toBe(0);
  });

  it('reports a newer day after an earlier one was seen', () => {
    const { rerender } = renderHook((props: { day: number }) =>
      useScoreDropReturn({ seasonUid: SEASON, scoredDay: props?.day ?? 5 })
    );
    expect(trackFunnelEvent).toHaveBeenCalledTimes(1);

    rerender({ day: 6 });
    expect(trackFunnelEvent).toHaveBeenCalledTimes(2);
    expect(window.localStorage.getItem(KEY)).toBe('6');
  });

  it('ignores a day at or below the watermark', () => {
    window.localStorage.setItem(KEY, '9');
    renderHook(() => useScoreDropReturn({ seasonUid: SEASON, scoredDay: 9 }));
    renderHook(() => useScoreDropReturn({ seasonUid: SEASON, scoredDay: 4 }));
    expect(trackFunnelEvent).not.toHaveBeenCalled();
  });

  it('scopes the watermark per season so a new season reports again', () => {
    window.localStorage.setItem(KEY, '49');
    renderHook(() => useScoreDropReturn({ seasonUid: 'allegro_2027-28', scoredDay: 1 }));
    expect(reportedParams()).toMatchObject({ day: 1, first_view: true });
  });

  it('stays idle until the season and day are known', () => {
    renderHook(() => useScoreDropReturn({ seasonUid: null, scoredDay: 5 }));
    renderHook(() => useScoreDropReturn({ seasonUid: SEASON, scoredDay: null }));
    renderHook(() => useScoreDropReturn({ seasonUid: SEASON, scoredDay: undefined }));
    // Pre-competition and pre-2 AM days must not count as a drop.
    renderHook(() => useScoreDropReturn({ seasonUid: SEASON, scoredDay: 0 }));
    renderHook(() => useScoreDropReturn({ seasonUid: SEASON, scoredDay: Number.NaN }));
    expect(trackFunnelEvent).not.toHaveBeenCalled();
  });

  it('attributes the arrival to a known announcement channel', () => {
    setSearch('?src=push');
    renderHook(() => useScoreDropReturn({ seasonUid: SEASON, scoredDay: 3 }));
    expect(reportedParams().src).toBe('push');
  });

  it('ignores an unrecognized src so a hand-edited URL cannot inject values', () => {
    setSearch('?src=<script>');
    renderHook(() => useScoreDropReturn({ seasonUid: SEASON, scoredDay: 3 }));
    expect(reportedParams().src).toBeUndefined();
  });

  it('still reports when localStorage is unavailable', () => {
    // Private browsing throws on both read and write. Losing the watermark is
    // acceptable; losing the event is not.
    vi.spyOn(window.localStorage, 'getItem').mockImplementation(() => {
      throw new Error('denied');
    });
    vi.spyOn(window.localStorage, 'setItem').mockImplementation(() => {
      throw new Error('denied');
    });

    expect(() =>
      renderHook(() => useScoreDropReturn({ seasonUid: SEASON, scoredDay: 5 }))
    ).not.toThrow();
    expect(reportedParams()).toMatchObject({ day: 5, first_view: true });
  });

  it('treats a corrupt watermark as never seen', () => {
    window.localStorage.setItem(KEY, 'not-a-number');
    renderHook(() => useScoreDropReturn({ seasonUid: SEASON, scoredDay: 5 }));
    expect(reportedParams()).toMatchObject({ first_view: true });
  });
});
