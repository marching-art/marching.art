// The client-side historical_scores union must hand every consumer a
// chronological event list — the same guarantee the backend read layer gives
// (functions/src/helpers/historicalScores.js), so the dashboard, lineup
// simulator, landing ticker and admin views never depend on the hash order a
// subcollection read returns.

import { describe, it, expect } from 'vitest';
import { compareEventsChronologically, mergeHistoricalEventLists } from './historicalEvents';

const ev = (eventName: string, date: unknown, offSeasonDay?: number) => ({
  eventName,
  date,
  offSeasonDay,
  scores: [],
});

describe('mergeHistoricalEventLists', () => {
  it('returns events in date order regardless of input order', () => {
    const sub = [
      ev('Late', '2024-08-10', 49),
      ev('Mid', '2024-07-15', 23),
      ev('Early', '2024-06-22', 1),
    ];
    const merged = mergeHistoricalEventLists([], sub);
    expect(merged.map((e) => e.eventName)).toEqual(['Early', 'Mid', 'Late']);
  });

  it('lets the sharded copy win on a conflict and still sorts the union', () => {
    const legacy = [
      { ...ev('Shared', '2024-07-15', 23), scores: [{ corps: 'Old' }] },
      ev('LegacyOnly', '2024-06-30', 8),
    ];
    const sub = [{ ...ev('Shared', '2024-07-15T00:00:00.000Z', 23), scores: [{ corps: 'New' }] }];
    const merged = mergeHistoricalEventLists(legacy, sub);
    expect(merged.map((e) => e.eventName)).toEqual(['LegacyOnly', 'Shared']);
    expect(merged[1].scores).toEqual([{ corps: 'New' }]);
  });

  it('understands Firestore Timestamp-shaped dates', () => {
    const stamp = (iso: string) => ({ toMillis: () => new Date(iso).getTime() });
    const merged = mergeHistoricalEventLists(
      [],
      [ev('B', stamp('2024-07-02'), 10), ev('A', stamp('2024-07-01'), 9)]
    );
    expect(merged.map((e) => e.eventName)).toEqual(['A', 'B']);
  });
});

describe('compareEventsChronologically', () => {
  it('sorts unparseable dates last, then by day, then by name', () => {
    const events = [
      ev('B', 'nope', 5),
      ev('Z', '2024-07-04', 3),
      ev('A', 'nope', 5),
      ev('Y', '2024-07-04', 3),
      ev('Early', '2024-07-04', 2),
    ];
    const names = [...events].sort(compareEventsChronologically).map((e) => e.eventName);
    expect(names).toEqual(['Early', 'Y', 'Z', 'A', 'B']);
  });
});
