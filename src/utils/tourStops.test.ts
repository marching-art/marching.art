import { describe, it, expect } from 'vitest';
import { buildTourStops, tourDistance, tourRegions, type TourSource } from './tourStops';
import { locationPoint, projectLatLng, legPath, legMidpoint, placeLabels } from './tourMap';

const CHAMPIONSHIP_EVENTS: TourSource[] = [
  {
    day: 45,
    eventName: 'Open and A Class Prelims',
    location: 'Marion, IN',
    eligibleClasses: ['openClass', 'aClass'],
    isChampionship: true,
  },
  {
    day: 47,
    eventName: 'marching.art World Championship Prelims',
    location: 'Indianapolis, IN',
    eligibleClasses: ['worldClass', 'openClass', 'aClass'],
    isChampionship: true,
  },
  {
    day: 49,
    eventName: 'SoundSport International Music & Food Festival',
    location: 'Indianapolis, IN',
    eligibleClasses: ['soundSport'],
    isChampionship: true,
  },
];

const competitions: TourSource[] = [
  { eventName: 'DCI Dubuque', location: 'Dubuque, IA', day: 8, week: 2 },
  { eventName: 'DCI Atlanta', location: 'Atlanta, GA', day: 15, week: 3 },
  {
    eventName: 'DCI Eastern Classic',
    location: 'Allentown, PA',
    day: 30,
    week: 5,
    eventTier: 'regional',
    multiNight: { nights: [30, 31] },
  },
];

describe('buildTourStops', () => {
  it('orders a fantasy corps’ registered shows by day', () => {
    const stops = buildTourStops({
      corps: {
        selectedShows: {
          week3: [{ eventName: 'DCI Atlanta', day: 15, location: 'Atlanta, GA' }],
          week2: [{ eventName: 'DCI Dubuque', day: 8, location: 'Dubuque, IA' }],
        },
      },
      corpsClass: 'worldClass',
      competitions,
    });

    expect(stops.map((s) => s.eventName)).toEqual(['DCI Dubuque', 'DCI Atlanta']);
    expect(stops.map((s) => s.day)).toEqual([8, 15]);
    expect(stops[0].week).toBe(2);
  });

  it('plots each stop through the venue gazetteer', () => {
    const [stop] = buildTourStops({
      corps: { selectedShows: { week2: [{ eventName: 'DCI Dubuque', day: 8 }] } },
      corpsClass: 'worldClass',
      competitions,
    });

    // Location falls back to the schedule when the stored selection lacks one.
    expect(stop.location).toBe('Dubuque, IA');
    expect(stop.point).toMatchObject({ city: 'Dubuque', region: 'IA' });
    expect(stop.point?.x).toBeGreaterThan(0);
    expect(stop.point?.y).toBeGreaterThan(0);
  });

  it('keeps a stop whose city is not in the gazetteer, unplotted', () => {
    const [stop] = buildTourStops({
      corps: {
        selectedShows: {
          week2: [{ eventName: 'Backyard Invitational', day: 8, location: 'Nowhere, ZZ' }],
        },
      },
      corpsClass: 'worldClass',
      competitions,
    });

    expect(stop.eventName).toBe('Backyard Invitational');
    expect(stop.point).toBeNull();
  });

  it('enriches a registered stop with schedule metadata it was not stored with', () => {
    const [stop] = buildTourStops({
      corps: {
        selectedShows: {
          week5: [{ eventName: 'DCI Eastern Classic', day: 30, location: 'Allentown, PA' }],
        },
      },
      corpsClass: 'worldClass',
      competitions,
    });

    expect(stop.kind).toBe('major');
    expect(stop.multiNight).toBe(true);
  });

  it('adds Championship Week for the eligible classes only', () => {
    const world = buildTourStops({
      corps: { selectedShows: {} },
      corpsClass: 'worldClass',
      competitions,
      championshipEvents: CHAMPIONSHIP_EVENTS,
    });
    expect(world.map((s) => s.day)).toEqual([47]);
    expect(world[0]).toMatchObject({ kind: 'championship', auto: true });

    const aClass = buildTourStops({
      corps: { selectedShows: {} },
      corpsClass: 'aClass',
      competitions,
      championshipEvents: CHAMPIONSHIP_EVENTS,
    });
    expect(aClass.map((s) => s.day)).toEqual([45, 47]);

    const soundSport = buildTourStops({
      corps: { selectedShows: {} },
      corpsClass: 'soundSport',
      competitions,
      championshipEvents: CHAMPIONSHIP_EVENTS,
    });
    expect(soundSport.map((s) => s.day)).toEqual([49]);
  });

  it('matches legacy short class keys against championship eligibility', () => {
    const stops = buildTourStops({
      corps: { selectedShows: {} },
      corpsClass: 'world',
      competitions,
      championshipEvents: CHAMPIONSHIP_EVENTS,
    });
    expect(stops.map((s) => s.day)).toEqual([47]);
  });

  it('skips Championship Week when the director has no corps in the class', () => {
    const stops = buildTourStops({
      corps: null,
      corpsClass: 'worldClass',
      competitions,
      championshipEvents: CHAMPIONSHIP_EVENTS,
    });
    expect(stops).toEqual([]);
  });

  it('never lists the same event twice', () => {
    const stops = buildTourStops({
      corps: {
        selectedShows: {
          week2: [
            { eventName: 'DCI Dubuque', day: 8, location: 'Dubuque, IA' },
            { eventName: 'DCI Dubuque', day: 8, location: 'Dubuque, IA' },
          ],
        },
      },
      corpsClass: 'worldClass',
      competitions,
    });
    expect(stops).toHaveLength(1);
  });

  describe('podium corps', () => {
    it('uses the picked events and the auto-attended anchors', () => {
      const stops = buildTourStops({
        corps: null,
        corpsClass: 'podiumClass',
        competitions,
        championshipEvents: CHAMPIONSHIP_EVENTS,
        podiumAttendance: {
          events: new Set(['DCI Atlanta']),
          autoDays: new Set([30, 47]),
        },
      });

      expect(stops.map((s) => s.eventName)).toEqual([
        'DCI Atlanta',
        'DCI Eastern Classic',
        'marching.art World Championship Prelims',
      ]);
      expect(stops.find((s) => s.day === 30)?.auto).toBe(true);
    });

    it('ignores a pool show that merely shares an auto-attended day', () => {
      const stops = buildTourStops({
        corps: null,
        corpsClass: 'podiumClass',
        competitions: [
          ...competitions,
          { eventName: 'Small Town Classic', location: 'Marion, IN', day: 30, week: 5 },
        ],
        podiumAttendance: { events: new Set(), autoDays: new Set([30]) },
      });

      expect(stops.map((s) => s.eventName)).toEqual(['DCI Eastern Classic']);
    });

    it('books one championship stop when the schedule names it differently', () => {
      // Regression: the season schedule can carry a championship-week show under
      // a scraped/historical name ("…Division I World Championship Prelims")
      // while championshipEvents carries the canonical "…World Championship
      // Prelims". Both land on the same auto-day; the corps must not be double
      // booked, and the surviving stop is the canonical one.
      const stops = buildTourStops({
        corps: null,
        corpsClass: 'podiumClass',
        competitions: [
          ...competitions,
          {
            eventName: 'marching.art Division I World Championship Prelims',
            location: 'Indianapolis, IN',
            day: 47,
            week: 7,
            isChampionship: true,
          },
        ],
        championshipEvents: CHAMPIONSHIP_EVENTS,
        podiumAttendance: { events: new Set(), autoDays: new Set([47]) },
      });

      expect(stops).toHaveLength(1);
      expect(stops[0]).toMatchObject({
        day: 47,
        eventName: 'marching.art World Championship Prelims',
        auto: true,
      });
    });

    it('never auto-attends the SoundSport festival', () => {
      const stops = buildTourStops({
        corps: null,
        corpsClass: 'podiumClass',
        competitions,
        championshipEvents: CHAMPIONSHIP_EVENTS,
        podiumAttendance: { events: new Set(), autoDays: new Set([49]) },
      });
      expect(stops).toEqual([]);
    });

    it('ignores the fantasy selectedShows map', () => {
      const stops = buildTourStops({
        corps: { selectedShows: { week2: [{ eventName: 'DCI Dubuque', day: 8 }] } },
        corpsClass: 'podiumClass',
        competitions,
        podiumAttendance: { events: new Set(), autoDays: new Set() },
      });
      expect(stops).toEqual([]);
    });
  });
});

describe('tourDistance', () => {
  it('measures the legs between plotted stops', () => {
    const stops = buildTourStops({
      corps: {
        selectedShows: {
          week2: [{ eventName: 'DCI Dubuque', day: 8, location: 'Dubuque, IA' }],
          week3: [{ eventName: 'DCI Atlanta', day: 15, location: 'Atlanta, GA' }],
        },
      },
      corpsClass: 'worldClass',
      competitions,
    });

    // Dubuque -> Atlanta is ~660 miles great-circle.
    expect(tourDistance(stops)).toBeGreaterThan(600);
    expect(tourDistance(stops)).toBeLessThan(720);
  });

  it('is zero for a single stop and skips unplaceable ones', () => {
    expect(tourDistance([{ point: null }])).toBe(0);
    expect(tourDistance([])).toBe(0);
  });
});

describe('tourRegions', () => {
  it('lists distinct regions in first-visit order', () => {
    const point = (region: string) => ({ x: 0, y: 0, city: '', region, venueId: '' });
    const stops = [
      { point: point('IA') },
      { point: null },
      { point: point('GA') },
      { point: point('IA') },
    ];
    expect(tourRegions(stops)).toEqual(['IA', 'GA']);
  });
});

describe('tourMap geometry', () => {
  it('projects known cities to their expected place on the poster', () => {
    // Sanity anchors: the projection must agree with the pre-projected paths.
    const west = projectLatLng(-122.3321, 47.6062); // Seattle
    const east = projectLatLng(-71.0589, 42.3601); // Boston
    const south = projectLatLng(-80.1918, 25.7617); // Miami
    const north = projectLatLng(-93.265, 44.9778); // Minneapolis

    expect(west.x).toBeLessThan(east.x);
    expect(north.y).toBeLessThan(south.y);
    // Everything lands inside the 960x600 canvas.
    for (const p of [west, east, south, north]) {
      expect(p.x).toBeGreaterThanOrEqual(0);
      expect(p.x).toBeLessThanOrEqual(960);
      expect(p.y).toBeGreaterThanOrEqual(0);
      expect(p.y).toBeLessThanOrEqual(600);
    }
  });

  it('resolves a location string to a point', () => {
    expect(locationPoint('Indianapolis, IN')).toMatchObject({
      city: 'Indianapolis',
      region: 'IN',
    });
    expect(locationPoint('Atlantis, XX')).toBeNull();
    expect(locationPoint('')).toBeNull();
  });

  it('draws a curved leg and finds its midpoint heading', () => {
    const d = legPath({ x: 0, y: 0 }, { x: 100, y: 0 });
    expect(d).toMatch(/^M0\.0 0\.0Q/);

    const mid = legMidpoint({ x: 0, y: 0 }, { x: 100, y: 0 });
    expect(mid?.x).toBeCloseTo(50, 5);
    expect(mid?.angle).toBeCloseTo(0, 5); // heading due east

    // Degenerate legs (the same venue twice) draw nothing rather than NaN.
    expect(legPath({ x: 10, y: 10 }, { x: 10, y: 10 })).toBe('');
    expect(legMidpoint({ x: 10, y: 10 }, { x: 10, y: 10 })).toBeNull();
  });

  describe('placeLabels', () => {
    it('prefers the right side when nothing is in the way', () => {
      const placements = placeLabels([{ x: 300, y: 300 }], [60]);
      expect(placements[0]).toMatchObject({ anchor: 'start', dy: 0, placed: true });
      expect(placements[0].dx).toBeGreaterThan(0);
    });

    it('moves a label out of a close neighbour’s way instead of overstriking', () => {
      const placements = placeLabels(
        [
          { x: 100, y: 100 },
          { x: 118, y: 102 },
        ],
        [60, 60]
      );

      // Neither may keep the default right-side slot: each sits where the
      // other's marker isn't.
      expect(placements[0].placed).toBe(true);
      expect(placements[0].anchor).toBe('end');
      expect(placements[1].placed).toBe(true);
      expect(placements[1].anchor === 'start' || placements[1].dy !== 0).toBe(true);
    });

    it('never places a label over another marker', () => {
      // Two markers ~30px apart horizontally: a right-side label on the first
      // would run straight through the second.
      const points = [
        { x: 200, y: 200 },
        { x: 232, y: 200 },
      ];
      const placements = placeLabels(points, [80, 80]);
      const first = placements[0];
      if (first.placed && first.anchor === 'start') {
        expect(200 + first.dx + 80).toBeLessThanOrEqual(232 - 10);
      } else {
        expect(first.anchor === 'end' || first.dy !== 0 || !first.placed).toBe(true);
      }
    });

    it('drops a label with nowhere clear rather than stacking it', () => {
      // A dense pile of markers at one spot: only the first few can be labelled.
      const points = Array.from({ length: 10 }, (_, i) => ({ x: 300 + i, y: 300 + i }));
      const placements = placeLabels(
        points,
        points.map(() => 120)
      );
      expect(placements.some((p) => !p.placed)).toBe(true);
    });

    it('keeps labels inside the canvas', () => {
      // Hard against the right edge: the label has to flip to the left side.
      const placements = placeLabels([{ x: 950, y: 300 }], [80], { width: 960, height: 600 });
      expect(placements[0]).toMatchObject({ anchor: 'end', placed: true });
    });
  });
});
