import { describe, it, expect } from 'vitest';
import { showCalendarDay, formatDayKey } from './scheduleUtils';

// Regression: "Drums Across Nebraska" starts Wed 2026-07-01 8:46 PM CDT, which
// is Thu 2026-07-02 01:46 UTC. Reading startsAt with UTC getters labeled the
// show as Thursday, so Wednesday's picks spotlighted a day late on the
// dashboard's "your picks are on tour today" panel.
describe('showCalendarDay', () => {
  const nebraska = {
    name: 'Drums Across Nebraska',
    date: '2026-07-01T00:00:00.000Z', // list scraper stores calendar date at UTC midnight
    startsAt: '2026-07-02T01:46:00.000Z', // 8:46 PM CDT on July 1
    timezone: 'America/Chicago',
  };

  it('prefers the stored calendar date, read in UTC', () => {
    expect(showCalendarDay(nebraska)).toBe('2026-07-01');
  });

  it('reads startsAt in the show timezone when date is missing', () => {
    expect(showCalendarDay({
      startsAt: nebraska.startsAt,
      timezone: nebraska.timezone,
    })).toBe('2026-07-01');
  });

  it('keeps a west-coast evening show on its own calendar day', () => {
    expect(showCalendarDay({
      name: 'MidCal Showcase',
      startsAt: '2026-07-03T02:50:00.000Z', // 7:50 PM PDT on July 2
      timezone: 'America/Los_Angeles',
    })).toBe('2026-07-02');
  });

  it('falls back to startsAt when date is unparseable, and null when nothing usable', () => {
    expect(showCalendarDay({ date: 'not-a-date', startsAt: nebraska.startsAt, timezone: nebraska.timezone }))
      .toBe('2026-07-01');
    expect(showCalendarDay({})).toBe(null);
  });

  it('survives an invalid timezone via the local-zone fallback', () => {
    expect(showCalendarDay({ startsAt: nebraska.startsAt, timezone: 'Not/AZone' })).not.toBe(null);
  });
});

describe('formatDayKey', () => {
  it('formats as YYYY-MM-DD in the given timezone', () => {
    const d = new Date('2026-07-02T01:46:00.000Z');
    expect(formatDayKey(d, 'UTC')).toBe('2026-07-02');
    expect(formatDayKey(d, 'America/Chicago')).toBe('2026-07-01');
  });
});
