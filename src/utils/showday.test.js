import { describe, it, expect } from 'vitest';
import {
  joinFantasyShows,
  joinPodiumShows,
  projectPodiumShow,
  buildShowdayModel,
  buildPicksSpotlight,
} from './showday';
import { formatDayKey } from './scheduleUtils';

// A live evening: the show runs 8:00–10:00 PM ET on season day 10.
const NOW_PRE = new Date('2026-06-10T23:00:00.000Z'); // 7:00 PM ET, gates not open
const NOW_LIVE = new Date('2026-06-11T00:50:00.000Z'); // 8:50 PM ET, mid-show
const NOW_DONE = new Date('2026-06-11T02:30:00.000Z'); // 10:30 PM ET, scores read

const fantasyLineup = [
  {
    order: 1,
    uid: 'rival-1',
    corps: 'Delta Brigade',
    corpsClass: 'aClass',
    performsAt: '2026-06-11T00:15:00.000Z',
    performanceTime: '8:15 PM',
  },
  {
    order: 2,
    uid: 'me',
    corps: 'Star United',
    corpsClass: 'worldClass',
    performsAt: '2026-06-11T01:00:00.000Z',
    performanceTime: '9:00 PM',
  },
  {
    order: 3,
    uid: 'rival-2',
    corps: 'North Winds',
    corpsClass: 'worldClass',
    performsAt: '2026-06-11T01:15:00.000Z',
    performanceTime: '9:15 PM',
  },
];

const tonightComp = {
  name: 'Tonight Classic',
  location: 'Akron, OH',
  day: 10,
  week: 2,
  timezone: 'America/New_York',
  fantasySchedule: {
    startsAt: '2026-06-11T00:00:00.000Z',
    scoresAt: '2026-06-11T02:00:00.000Z',
    timezone: 'America/New_York',
    lineup: fantasyLineup,
  },
};

const laterComp = {
  name: 'Later Invitational',
  location: 'Erie, PA',
  day: 12,
  week: 2,
};

const selectedShows = {
  week2: [
    { day: 10, eventName: 'Tonight Classic' },
    { day: 12, eventName: 'Later Invitational' },
  ],
};

describe('joinFantasyShows', () => {
  it('joins registered shows to competitions by day + event name', () => {
    const shows = joinFantasyShows([tonightComp, laterComp], selectedShows);
    expect(shows.map((s) => s.eventName)).toEqual(['Tonight Classic', 'Later Invitational']);
    expect(shows[0].startsAt).toBe('2026-06-11T00:00:00.000Z');
  });

  it('skips selections with no matching competition', () => {
    const shows = joinFantasyShows([tonightComp], {
      week3: [{ day: 20, eventName: 'Ghost Show' }],
    });
    expect(shows).toEqual([]);
  });
});

describe('buildShowdayModel — fantasy', () => {
  const shows = joinFantasyShows([tonightComp, laterComp], selectedShows);

  it('is live mid-show, with my slot and the on-field ticker', () => {
    const model = buildShowdayModel({
      shows,
      currentDay: 10,
      myUid: 'me',
      corpsClass: 'worldClass',
      now: NOW_LIVE,
    });
    expect(model.phase).toBe('live');
    expect(model.show?.eventName).toBe('Tonight Classic');
    // 8:50 PM: Delta Brigade holds the field until my 9:00 slot.
    expect(model.onNow?.corps).toBe('Delta Brigade');
    expect(model.upNext?.corps).toBe('Star United');
    expect(model.mySlot?.entry.corps).toBe('Star United');
    expect(model.mySlot?.state).toBe('upcoming');
    expect(model.mySlot?.minutesUntil).toBe(10);
  });

  it('is today before gates, with my timed slot', () => {
    const model = buildShowdayModel({
      shows,
      currentDay: 10,
      myUid: 'me',
      corpsClass: 'worldClass',
      now: NOW_PRE,
    });
    expect(model.phase).toBe('today');
    expect(model.onNow).toBeNull();
    expect(model.mySlot?.state).toBe('upcoming');
  });

  it('is done after scores, and my slot reads done', () => {
    const model = buildShowdayModel({
      shows,
      currentDay: 10,
      myUid: 'me',
      corpsClass: 'worldClass',
      now: NOW_DONE,
    });
    expect(model.phase).toBe('done');
    expect(model.mySlot?.state).toBe('done');
  });

  it('restricts slot matching to the active class', () => {
    // Same director fields an A-Class corps at the same show.
    const model = buildShowdayModel({
      shows: joinFantasyShows(
        [
          {
            ...tonightComp,
            fantasySchedule: {
              ...tonightComp.fantasySchedule,
              lineup: [
                { ...fantasyLineup[0], uid: 'me', corpsClass: 'aClass' },
                fantasyLineup[1],
                fantasyLineup[2],
              ],
            },
          },
        ],
        selectedShows
      ),
      currentDay: 10,
      myUid: 'me',
      corpsClass: 'worldClass',
      now: NOW_PRE,
    });
    expect(model.mySlot?.entry.corpsClass).toBe('worldClass');
  });

  it('falls forward to the next registered show on an off day', () => {
    const model = buildShowdayModel({ shows, currentDay: 11, myUid: 'me', now: NOW_PRE });
    expect(model.phase).toBe('upcoming');
    expect(model.show?.eventName).toBe('Later Invitational');
    expect(model.mySlot).toBeNull(); // day 12 has no materialized order
  });

  it('treats an untimed show on the current day as pending today', () => {
    const model = buildShowdayModel({
      shows: joinFantasyShows([laterComp], selectedShows),
      currentDay: 12,
      myUid: 'me',
      now: NOW_PRE,
    });
    expect(model.phase).toBe('today');
    expect(model.show?.eventName).toBe('Later Invitational');
  });

  it('is none with nothing scheduled ahead', () => {
    const model = buildShowdayModel({ shows, currentDay: 30, myUid: 'me', now: NOW_PRE });
    expect(model.phase).toBe('none');
    expect(model.show).toBeNull();
  });
});

describe('projectPodiumShow / joinPodiumShows', () => {
  const podiumComp = {
    name: 'Podium Night',
    location: 'Dayton, OH',
    day: 10,
    timezone: 'America/New_York',
    fantasySchedule: {
      startsAt: '2026-06-11T00:00:00.000Z',
      scoresAt: '2026-06-11T02:00:00.000Z',
      timezone: 'America/New_York',
      lineup: fantasyLineup,
    },
    podiumSchedule: {
      startsAt: '2026-06-10T22:00:00.000Z',
      scoresAt: '2026-06-10T23:30:00.000Z',
      timezone: 'America/New_York',
      lineup: [
        {
          order: 1,
          uid: 'me',
          corps: 'Founders Corps',
          performsAt: '2026-06-10T22:20:00.000Z',
          performanceTime: '6:20 PM',
        },
      ],
    },
  };

  it('projects podium times and lineup over the common show shape', () => {
    const show = projectPodiumShow(podiumComp);
    expect(show.startsAt).toBe('2026-06-10T22:00:00.000Z');
    expect(show.lineup?.[0].corps).toBe('Founders Corps');
    expect(show.encore).toBeNull();
  });

  it("projects the podium field's own encore, never the fantasy one", () => {
    const show = projectPodiumShow({
      ...podiumComp,
      encore: { uid: 'fantasy-director', corps: 'Fantasy Corps', reason: 'proximity' },
      podiumEncore: { uid: 'me', corps: 'Founders Corps', reason: 'host' },
    });
    expect(show.encore?.uid).toBe('me');
    expect(show.encore?.corps).toBe('Founders Corps');
    // Without a podium encore the fantasy encore must NOT leak through.
    expect(
      projectPodiumShow({ ...podiumComp, encore: { uid: 'x', corps: 'X' } }).encore
    ).toBeNull();
  });

  it('never presents the fantasy field as a podium running order', () => {
    const show = projectPodiumShow({ ...podiumComp, podiumSchedule: null });
    expect(show.lineup).toBeNull();
    // Base times remain a fair "when" for the same evening/venue.
    expect(show.startsAt).toBe('2026-06-11T00:00:00.000Z');
  });

  it('joins self-picked shows by day + event name and majors by auto day', () => {
    const major = { name: 'Regional Major', location: 'Indy, IN', day: 14 };
    const other = { name: 'Elsewhere Open', location: 'Ames, IA', day: 11 };
    const shows = joinPodiumShows([podiumComp, major, other], {
      selectedShows: { 10: { eventName: 'Podium Night' } },
      autoDays: [14],
    });
    expect(shows.map((s) => s.eventName)).toEqual(['Podium Night', 'Regional Major']);
  });

  it('resolves the podium model live on the podium clock', () => {
    const shows = joinPodiumShows([podiumComp], {
      selectedShows: { 10: { eventName: 'Podium Night' } },
      autoDays: [],
    });
    const model = buildShowdayModel({
      shows,
      currentDay: 10,
      myUid: 'me',
      now: new Date('2026-06-10T22:25:00.000Z'), // 6:25 PM ET — podium field is live
    });
    expect(model.phase).toBe('live');
    expect(model.mySlot?.state).toBe('onNow');
  });
});

describe('buildPicksSpotlight', () => {
  const now = new Date('2026-06-11T00:50:00.000Z');
  const todayComp = {
    name: 'Real Field Classic',
    date: `${formatDayKey(now)}T00:00:00.000Z`,
    timezone: 'America/Chicago',
    lineup: [
      { order: 1, corps: 'Bluecoats', performsAt: '2026-06-11T01:16:00.000Z' },
      { order: 2, corps: 'Blue Devils', performsAt: '2026-06-11T01:32:00.000Z' },
    ],
  };

  it('surfaces picked corps performing today, in field order', () => {
    const entries = buildPicksSpotlight(
      [todayComp],
      {
        B: 'Bluecoats|2019',
        GE1: 'Blue Devils|2017',
        P: 'Unlisted Corps|2015',
      },
      now
    );
    expect(entries.map((e) => e.corps)).toEqual(['Bluecoats', 'Blue Devils']);
    expect(entries[0].captions).toEqual(['Brass']);
  });

  it('is empty with no picks or no shows today', () => {
    expect(buildPicksSpotlight([todayComp], {}, now)).toEqual([]);
    expect(buildPicksSpotlight([], { B: 'Bluecoats|2019' }, now)).toEqual([]);
  });
});
