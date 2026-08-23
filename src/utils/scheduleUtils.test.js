import { describe, it, expect } from 'vitest';
import { showCalendarDay, formatDayKey, transformCompetitionToShow } from './scheduleUtils';

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
    expect(
      showCalendarDay({
        startsAt: nebraska.startsAt,
        timezone: nebraska.timezone,
      })
    ).toBe('2026-07-01');
  });

  it('keeps a west-coast evening show on its own calendar day', () => {
    expect(
      showCalendarDay({
        name: 'MidCal Showcase',
        startsAt: '2026-07-03T02:50:00.000Z', // 7:50 PM PDT on July 2
        timezone: 'America/Los_Angeles',
      })
    ).toBe('2026-07-02');
  });

  it('falls back to startsAt when date is unparseable, and null when nothing usable', () => {
    expect(
      showCalendarDay({
        date: 'not-a-date',
        startsAt: nebraska.startsAt,
        timezone: nebraska.timezone,
      })
    ).toBe('2026-07-01');
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

describe('transformCompetitionToShow — fantasy schedule preference', () => {
  const heritage = {
    name: 'Show A',
    location: 'Allentown, PA',
    day: 18,
    lineup: [{ order: 1, corps: 'Historical Corps', performsAt: '2026-06-18T23:00:00Z' }],
    startsAt: '2026-06-18T22:00:00Z',
    scoresAt: '2026-06-18T23:30:00Z',
    timezone: 'America/New_York',
  };

  it('prefers the materialized real-field order over the heritage/scraped fields', () => {
    const fantasySchedule = {
      startsAt: '2026-06-18T20:00:00Z',
      scoresAt: '2026-06-19T01:00:00Z',
      gatesAt: '2026-06-18T18:40:00Z',
      timezone: 'America/New_York',
      fieldSize: 2,
      overflow: [{ uid: 'u9', corpsClass: 'aClass', corps: 'Overflow Corps' }],
      lineup: [
        {
          order: 1,
          uid: 'u2',
          corpsClass: 'worldClass',
          corps: 'My Corps',
          performsAt: '2026-06-19T00:20:00Z',
        },
        {
          order: 2,
          uid: 'u1',
          corpsClass: 'worldClass',
          corps: 'Top Corps',
          performsAt: '2026-06-19T00:37:00Z',
        },
      ],
    };
    const show = transformCompetitionToShow({ ...heritage, fantasySchedule });
    expect(show.lineup).toBe(fantasySchedule.lineup);
    expect(show.scoresAt).toBe('2026-06-19T01:00:00Z');
    expect(show.startsAt).toBe('2026-06-18T20:00:00Z');
    expect(show.fieldSize).toBe(2);
    expect(show.overflow).toHaveLength(1);
    expect(show.fantasySchedule).toBe(fantasySchedule);
  });

  it('falls back to heritage/scraped enrichment when no fantasy schedule yet', () => {
    const show = transformCompetitionToShow(heritage);
    expect(show.lineup).toBe(heritage.lineup);
    expect(show.scoresAt).toBe('2026-06-18T23:30:00Z');
    expect(show.fantasySchedule).toBe(null);
    expect(show.overflow).toBe(null);
  });

  it('exposes the podium schedule for the Fantasy/Podium toggle', () => {
    const podiumSchedule = { lineup: [{ order: 1, corps: 'Podium Corps' }], fieldSize: 1 };
    const show = transformCompetitionToShow({ ...heritage, podiumSchedule });
    expect(show.podiumSchedule).toBe(podiumSchedule);
  });
});
