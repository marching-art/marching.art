// Tests for the route sheet's origin — the corps' current location (design
// §5.12). The route legs themselves are covered by the simulation harness;
// this is the pure display resolution the Upcoming Route module reads.
//
// Uses Node's built-in test runner (node:test). Run with `npm test`.
const { test, describe } = require('node:test');
const assert = require('node:assert/strict');

const { buildCurrentLocation, buildRouteLegs, buildShowTravel } = require('./podiumRoute');
const venues = require('../helpers/podium/venues');
const store = require('../helpers/podium/store');

const UID = 'director-1';
// A show the corps self-picked on day 12 — enough for isShowDayFor to agree
// the corps competed that night.
const baseState = {
  seasonUid: 'season-1',
  division: 'worldClass',
  location: 'Allentown, Pennsylvania',
  selectedShows: { 12: { eventName: 'A Show', location: 'Allentown, PA' } },
};

describe('buildCurrentLocation', () => {
  test('before the first show the corps sits at its hometown', () => {
    const result = buildCurrentLocation(baseState, UID, 5, null);
    assert.equal(result.atHome, true);
    assert.equal(result.mapped, true);
    assert.equal(result.city, 'Allentown, PA');
    assert.equal(result.sinceDay, null);
  });

  test('after a show it reports that venue and the day it moved there', () => {
    const state = {
      ...baseState,
      lastVenue: { venueId: 'indianapolis-in', city: 'Indianapolis', region: 'IN' },
    };
    const result = buildCurrentLocation(state, UID, 14, null);
    assert.equal(result.atHome, false);
    assert.equal(result.city, 'Indianapolis, IN');
    assert.equal(result.venueId, 'indianapolis-in');
    assert.equal(result.sinceDay, 12);
  });

  test('an unmapped hometown keeps the raw text and flags itself unmapped', () => {
    const result = buildCurrentLocation(
      { ...baseState, location: 'Atlantis, Ocean' },
      UID,
      5,
      null
    );
    assert.equal(result.mapped, false);
    assert.equal(result.city, 'Atlantis, Ocean');
    assert.equal(result.venueId, null);
  });

  test('no hometown and no show leaves every field empty rather than guessing', () => {
    const result = buildCurrentLocation({ seasonUid: 'season-1' }, UID, 3, null);
    assert.equal(result.mapped, false);
    assert.equal(result.city, null);
    assert.equal(result.stadium, null);
  });
});

describe('buildRouteLegs — joint rehearsals never relocate the tour (design §5.12)', () => {
  // The corps is at Canton, OH. A joint on day 10 is hosted a long way off in
  // Dallas, TX (the frozen host city — set by the OTHER director's tour
  // position); a self-picked show follows on day 12 in Akron, OH, a day-trip
  // (25 mi) from Canton.
  const cantonState = () => ({
    seasonUid: 'season-1',
    division: 'worldClass',
    location: 'Canton, Ohio',
    lastVenue: venues.venueFor('Canton, Ohio'),
  });
  const upcoming = [10, 12];
  const locations = { 12: 'Akron, Ohio' };

  test('the accepting director (free joint) is not charged travel onward from the host city', () => {
    const jointByDay = {
      10: {
        day: 10,
        city: 'Dallas, Texas',
        // The acceptor's copy carries no travel tier — they host, they pay
        // nothing to get to the joint.
        travelTier: null,
        partnerCorpsName: 'Sun Devils',
        bonusMult: 1.25,
      },
    };
    const legs = buildRouteLegs(cantonState(), upcoming, { jointByDay, locations });
    assert.equal(legs.length, 2);

    const [jointLeg, showLeg] = legs;
    assert.equal(jointLeg.isJoint, true);
    assert.equal(jointLeg.coinCost, 0, 'acceptor pays no coin for the joint');
    assert.equal(jointLeg.staminaCost, 0, 'acceptor pays no stamina for the joint');

    // The bug: with the cursor relocated to Dallas, this show leg would be
    // priced Dallas→Akron (1222 mi, 15 stamina). It must be priced from the
    // corps' real position, Canton→Akron (25 mi, a free local day trip).
    assert.equal(showLeg.day, 12);
    assert.ok(!showLeg.isJoint);
    assert.equal(showLeg.miles, 25, "onward show is routed from Canton, not the joint's host city");
    assert.equal(showLeg.tier, 'local');
    assert.equal(showLeg.staminaCost, 0, 'no phantom onward-travel penalty from the joint');
  });

  test('even a priced (proposer) joint leg does not move the tour cursor', () => {
    // The proposer's copy carries the frozen day-trip tier — shown on the joint
    // leg — but the corps still rehearses and returns to its own position, so
    // the onward show is unaffected.
    const jointByDay = {
      10: {
        day: 10,
        city: 'Dallas, Texas',
        travelTier: 'crossCountry',
        partnerCorpsName: 'Sun Devils',
        bonusMult: 1.25,
      },
    };
    const tierCfg = store.balance.travel.tiers.find((t) => t.key === 'crossCountry');
    const legs = buildRouteLegs(cantonState(), upcoming, { jointByDay, locations });

    const [jointLeg, showLeg] = legs;
    assert.equal(
      jointLeg.staminaCost,
      tierCfg.staminaCost,
      'joint leg shows the frozen day-trip cost'
    );
    // Onward show is still Canton→Akron, not Dallas→Akron.
    assert.equal(showLeg.miles, 25);
    assert.equal(showLeg.staminaCost, 0);
  });

  test('a Tour Manager cuts the joint leg stamina the route shows, as the nightly run charges it', () => {
    const jointByDay = {
      10: { day: 10, city: 'Dallas, Texas', travelTier: 'crossCountry', bonusMult: 1.25 },
    };
    const state = { ...cantonState(), staff: { tourManager: { tier: 'legend' } } };
    const [jointLeg] = buildRouteLegs(state, upcoming, { jointByDay, locations });
    const tierCfg = store.balance.travel.tiers.find((t) => t.key === 'crossCountry');
    assert.equal(jointLeg.staminaCost, Math.round(tierCfg.staminaCost * 0.7 * 10) / 10);
  });
});

describe('buildRouteLegs — airfare on long legs (design §5.3)', () => {
  const cantonState = (overrides = {}) => ({
    seasonUid: 'season-1',
    division: 'worldClass',
    location: 'Canton, Ohio',
    lastVenue: venues.venueFor('Canton, Ohio'),
    ...overrides,
  });

  test('a long leg exposes an airfare fare (1 CC / 2 mi) and the halved stamina', () => {
    const legs = buildRouteLegs(cantonState(), [12], {
      jointByDay: {},
      locations: { 12: 'Dallas, Texas' },
    });
    const [leg] = legs;
    assert.ok(leg.miles > 600, 'Canton→Dallas is an over-600-mile leg');
    assert.equal(leg.airfareEligible, true);
    assert.equal(leg.airfareCost, Math.ceil(leg.miles / 2));
    assert.equal(leg.airfareStaminaCost, Math.round(leg.staminaCost * 0.5 * 10) / 10);
    assert.equal(leg.airfarePurchased, false);
  });

  test('a Tour Manager cuts the show leg stamina and the flown stamina with it', () => {
    const plain = buildRouteLegs(cantonState(), [12], {
      jointByDay: {},
      locations: { 12: 'Dallas, Texas' },
    })[0];
    const managed = buildRouteLegs(
      cantonState({ staff: { tourManager: { tier: 'legend' } } }),
      [12],
      { jointByDay: {}, locations: { 12: 'Dallas, Texas' } }
    )[0];
    assert.equal(managed.staminaCost, Math.round(plain.staminaCost * 0.7 * 10) / 10);
    assert.equal(
      managed.airfareStaminaCost,
      Math.round(managed.staminaCost * 0.5 * 10) / 10,
      'airfare halves the already-reduced leg, as the processor does'
    );
  });

  test('a short leg is not airfare-eligible', () => {
    const legs = buildRouteLegs(cantonState(), [12], {
      jointByDay: {},
      locations: { 12: 'Akron, Ohio' },
    });
    const [leg] = legs;
    assert.equal(leg.tier, 'local');
    assert.equal(leg.airfareEligible, false);
    assert.equal(leg.airfareStaminaCost, null);
  });

  test('a booked leg reports airfarePurchased', () => {
    const legs = buildRouteLegs(cantonState({ airfare: { 12: true } }), [12], {
      jointByDay: {},
      locations: { 12: 'Dallas, Texas' },
    });
    assert.equal(legs[0].airfarePurchased, true);
    assert.equal(legs[0].airfareStranded, false);
  });

  test('a fly intent left on a leg that rerouted short is flagged stranded, not charged', () => {
    // Booked to fly, but the leg is now a short local hop under the airfare
    // floor: the flag lingers harmlessly (the processor never charges a short
    // leg), so the portal marks it stranded instead of silently dropping it.
    const legs = buildRouteLegs(cantonState({ airfare: { 12: true } }), [12], {
      jointByDay: {},
      locations: { 12: 'Akron, Ohio' },
    });
    assert.equal(legs[0].airfareEligible, false);
    assert.equal(legs[0].airfarePurchased, false);
    assert.equal(legs[0].airfareStranded, true);
  });
});

describe("today's show is on the route (the nightly run hasn't ridden it yet)", () => {
  // Day 45 of an Open Class tour. Last night's show (day 44) was in
  // Centerville, OH, so that is where the nightly processor left the corps;
  // today's Open & A Prelims and tomorrow's Finals are both in Marion, IN.
  const centervilleState = () => ({
    seasonUid: 'season-1',
    division: 'openClass',
    location: 'Canton, Ohio',
    selectedShows: { 44: { eventName: 'Soaring Sounds 35', location: 'Centerville, OH' } },
    lastVenue: venues.venueFor('Centerville, OH'),
  });

  test("the origin is dated by the show that moved the corps there, never today's", () => {
    const result = buildCurrentLocation(centervilleState(), UID, 45, null);
    assert.equal(result.city, 'Centerville, OH');
    assert.equal(
      result.sinceDay,
      44,
      "day 45 hasn't been processed, so it can't have moved anyone"
    );
    assert.equal(result.showToday, true);
  });

  test('a rehearsal day reports no pending show', () => {
    const result = buildCurrentLocation(centervilleState(), UID, 30, null);
    assert.equal(
      result.sinceDay,
      28,
      'the Southwestern major on day 28 is the last show behind it'
    );
    assert.equal(result.showToday, false);
  });

  test("today's leg leads the route and tomorrow is priced from where it lands", () => {
    // The Open & A rounds route through the schedule's venue for the day (the
    // World rounds in Indianapolis are fixed majors).
    const locations = { 45: 'Marion, IN', 46: 'Marion, IN' };
    const legs = buildRouteLegs(centervilleState(), [45, 46, 47], {
      jointByDay: {},
      locations,
      today: 45,
    });
    const [today, tomorrow, indy] = legs;
    assert.equal(today.day, 45);
    assert.equal(today.isToday, true);
    assert.equal(today.city, 'Marion, IN');
    assert.ok(today.miles > 0, 'Centerville→Marion is the leg the nightly run charges tonight');

    // The bug: without today's leg the cursor stayed at Centerville and day 46
    // was priced Centerville→Marion again — a 122-mile day trip to a city the
    // corps would already be in.
    assert.equal(tomorrow.day, 46);
    assert.equal(tomorrow.isToday, false);
    assert.equal(tomorrow.tier, 'local');
    assert.equal(tomorrow.miles, 0, 'Finals are in the same venue as prelims — no travel');
    assert.equal(tomorrow.staminaCost, 0);
    assert.equal(indy.day, 47);
    assert.ok(indy.miles > 0, 'the World rounds are routed Marion→Indianapolis');
  });

  test('with no today given, no leg is flagged', () => {
    const legs = buildRouteLegs(centervilleState(), [46], { jointByDay: {}, locations: {} });
    assert.equal(legs[0].isToday, false);
  });
});

describe('buildRouteLegs — towns off the tour map are real stops', () => {
  // Home in Brownsburg, IN and a director-hosted show in Noblesville, IN:
  // neither is a historical show city, both resolve from the place index.
  const home = venues.venueFor('Brownsburg, IN');
  const state = {
    seasonUid: 'season-1',
    division: 'worldClass',
    home,
    location: 'Brownsburg, IN',
    selectedShows: {
      5: { eventName: 'Noblesville Invitational', location: 'Noblesville, IN' },
      12: { eventName: 'Dallas Show', location: 'Dallas, Texas' },
    },
  };

  test('the tour starts at the hometown and chains through the hosted town', () => {
    assert.equal(venues.tourVenueFor('Brownsburg, IN'), null);
    assert.equal(venues.tourVenueFor('Noblesville, IN'), null);
    const legs = buildRouteLegs(state, [5, 12], { jointByDay: {}, locations: {} });
    assert.equal(legs.length, 2);
    const [toHosted, onward] = legs;
    // Brownsburg -> Noblesville is a short, priced hop (not a free unmapped leg).
    assert.ok(toHosted.miles > 15 && toHosted.miles < 60, `hop was ${toHosted.miles} mi`);
    // The next leg departs FROM the hosted town: Noblesville -> Dallas.
    const expected = venues.travelLeg(venues.venueFor('Noblesville, IN'), venues.venueFor('Dallas, Texas'), store.balance);
    assert.equal(onward.miles, expected.miles);
    assert.equal(onward.tier, expected.tier);
  });

  test('the current-location row shows the mapped hometown before the first show', () => {
    const where = buildCurrentLocation(state, UID, 1, null);
    assert.equal(where.city, 'Brownsburg, IN');
    assert.equal(where.mapped, true);
    assert.equal(where.atHome, true);
  });
});

describe('buildRouteLegs — over-ocean legs are mandatory flights', () => {
  const state = {
    seasonUid: 'season-1',
    division: 'worldClass',
    location: 'Canton, Ohio',
    lastVenue: venues.venueFor('Canton, Ohio'),
  };

  test('a Hawaii show and the leg back are required flights at full stamina', () => {
    const legs = buildRouteLegs(state, [12, 14], {
      jointByDay: {},
      locations: { 12: 'Honolulu, HI', 14: 'Dallas, Texas' },
    });
    for (const leg of legs) {
      const fare = Math.ceil(leg.miles / store.balance.travel.airfare.milesPerCoin);
      assert.equal(leg.mandatoryFlight, true, leg.city);
      assert.equal(leg.coinCost, fare, 'the fare replaces the bus fare');
      assert.equal(leg.airfareEligible, false, 'nothing to opt into');
      assert.equal(leg.airfareStaminaCost, null, 'no flight discount');
      assert.ok(leg.staminaCost > 30, `${leg.city}: ${leg.staminaCost}`);
    }
  });

  test('a stale airfare flag on a mandatory leg is not reported as stranded', () => {
    const [leg] = buildRouteLegs({ ...state, airfare: { 12: true } }, [12], {
      jointByDay: {},
      locations: { 12: 'Honolulu, HI' },
    });
    assert.equal(leg.airfareStranded, false);
  });

  test('a mainland leg is not a mandatory flight', () => {
    const [leg] = buildRouteLegs(state, [12], {
      jointByDay: {},
      locations: { 12: 'Dallas, Texas' },
    });
    assert.equal(leg.mandatoryFlight, false);
  });
});

describe('buildRouteLegs — each leg names where it departs', () => {
  test('fromCity chains through the previous stop (the route sheet labels A → B)', () => {
    const state = {
      seasonUid: 'season-1',
      division: 'worldClass',
      location: 'San Francisco, California',
      lastVenue: venues.venueFor('San Francisco, California'),
    };
    const legs = buildRouteLegs(state, [12, 15], {
      jointByDay: {},
      locations: { 12: 'San Diego, California', 15: 'Honolulu, HI' },
    });
    assert.equal(legs[0].fromCity, 'San Francisco, CA');
    assert.equal(legs[1].fromCity, legs[0].city);
    assert.equal(legs[1].mandatoryFlight, true);
  });
});

describe('buildShowTravel — per-show legs for the Schedule page', () => {
  const state = {
    seasonUid: 'season-1',
    division: 'worldClass',
    location: 'San Francisco, California',
    lastVenue: venues.venueFor('San Francisco, California'),
    selectedShows: { 10: { eventName: 'Booked', location: 'San Diego, California' } },
  };
  const competitions = [
    { day: 8, name: 'Near', location: 'Stanford, California' },
    { day: 8, name: 'Far', location: 'Riverside, California' },
    { day: 10, name: 'Booked', location: 'San Diego, California' },
    { day: 12, name: 'After', location: 'Escondido, California' },
    { day: 12, name: 'Island', location: 'Honolulu, HI' },
    { day: 28, name: 'Major', location: 'San Antonio, Texas' },
    { day: 3, name: 'Past', location: 'Stanford, California' },
  ];
  const legs = buildShowTravel(state, {
    tourDays: [10, 28],
    autoDays: [28],
    competitions,
    locations: {},
    today: 5,
  });

  test('a show before the first booked stop is routed from the current location', () => {
    assert.equal(legs['8|Near'].fromDay, null);
    assert.equal(legs['8|Near'].fromCity, 'San Francisco, CA');
    assert.equal(legs['8|Near'].fromHome, false);
    assert.equal(legs['8|Near'].onward.day, 10, 'and shows the hop on to the next stop');
  });

  test('a show after a booked stop is routed from that stop', () => {
    assert.equal(legs['12|After'].fromDay, 10);
    assert.equal(legs['12|After'].fromCity, 'San Diego, CA');
    assert.ok(legs['12|After'].miles < legs['12|Island'].miles);
  });

  test("each day's nearest show is marked closest", () => {
    assert.equal(legs['8|Near'].closest, true);
    assert.equal(legs['8|Far'].closest, false);
    assert.equal(legs['12|After'].closest, true);
    assert.equal(legs['10|Booked'].closest, false, 'a lone show is never "closest"');
  });

  test('over-ocean picks are mandatory flights; auto days and past days are skipped', () => {
    assert.equal(legs['12|Island'].mandatoryFlight, true);
    assert.equal(legs['12|Island'].airfareEligible, false);
    assert.equal(legs['28|Major'], undefined);
    assert.equal(legs['3|Past'], undefined);
  });

  test('matches the route sheet leg once the show is added', () => {
    const [, leg] = buildRouteLegs(
      { ...state, selectedShows: { ...state.selectedShows, 12: { eventName: 'After', location: 'Escondido, California' } } },
      [10, 12],
      { jointByDay: {}, locations: {} }
    );
    assert.equal(leg.miles, legs['12|After'].miles);
    assert.equal(leg.staminaCost, legs['12|After'].staminaCost);
    assert.equal(leg.heat, legs['12|After'].heat);
  });
});
