import { describe, it, expect } from 'vitest';
import {
  showCalendarDay,
  formatDayKey,
  transformCompetitionToShow,
  getPerformanceStatus,
  getMyPerformanceSlots,
  pickMyNextPerformance,
} from './scheduleUtils';

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

  it('exposes the encore corps', () => {
    const encore = {
      uid: 'u2',
      corpsClass: 'worldClass',
      corps: 'Local Corps',
      reason: 'proximity',
    };
    const show = transformCompetitionToShow({ ...heritage, encore });
    expect(show.encore).toBe(encore);
    expect(transformCompetitionToShow(heritage).encore).toBe(null);
  });

  it('carries the backend-produced show-time weather through to the card', () => {
    const weather = { summary: 'clear skies, 61°F', tempF: 61, code: 0, hour: 20 };
    const show = transformCompetitionToShow({ ...heritage, weather });
    expect(show.weather).toBe(weather);
    expect(transformCompetitionToShow(heritage).weather).toBe(null);
  });
});

describe('personal performance status (the "my corps right now" element)', () => {
  // A 3-corps show; scores read at 9:00 PM, corps 17 min apart before that.
  const show = {
    scoresAt: '2026-06-18T21:00:00Z',
    startsAt: '2026-06-18T20:00:00Z',
    timezone: 'UTC',
    lineup: [
      { order: 1, uid: 'u2', corps: 'First', performsAt: '2026-06-18T20:00:00Z' },
      { order: 2, uid: 'me', corps: 'My Corps', performsAt: '2026-06-18T20:20:00Z' },
      { order: 3, uid: 'u1', corps: 'Headliner', performsAt: '2026-06-18T20:40:00Z' },
    ],
  };

  it('reports minutes until my corps takes the field', () => {
    const now = new Date('2026-06-18T20:16:00Z'); // 4 min before my 20:20 slot
    const s = getPerformanceStatus(show, show.lineup[1], now);
    expect(s.state).toBe('upcoming');
    expect(s.minutesUntil).toBe(4);
  });

  it('reports on-field while my corps holds the field', () => {
    const now = new Date('2026-06-18T20:25:00Z'); // between my 20:20 and next 20:40
    const s = getPerformanceStatus(show, show.lineup[1], now);
    expect(s.state).toBe('onNow');
    expect(s.minutesUntil).toBe(0);
  });

  it('reports done after my corps and the next have gone on', () => {
    const now = new Date('2026-06-18T20:45:00Z');
    const s = getPerformanceStatus(show, show.lineup[1], now);
    expect(s.state).toBe('done');
  });

  it('finds only my own corps slots (by uid)', () => {
    const now = new Date('2026-06-18T20:00:00Z');
    const slots = getMyPerformanceSlots(show, 'me', now);
    expect(slots).toHaveLength(1);
    expect(slots[0].entry.corps).toBe('My Corps');
  });

  it('picks the on-field slot over an upcoming one across shows', () => {
    const now = new Date('2026-06-18T20:25:00Z');
    const otherShow = {
      scoresAt: '2026-06-18T22:00:00Z',
      startsAt: '2026-06-18T21:30:00Z',
      timezone: 'UTC',
      lineup: [
        { order: 1, uid: 'me', corps: 'My Other Corps', performsAt: '2026-06-18T21:40:00Z' },
      ],
    };
    const best = pickMyNextPerformance([show, otherShow], 'me', now);
    expect(best?.state).toBe('onNow');
    expect(best?.entry.corps).toBe('My Corps');
  });

  it('returns null when the director has no corps in any field', () => {
    expect(pickMyNextPerformance([show], 'nobody', new Date('2026-06-18T20:00:00Z'))).toBe(null);
  });
});
