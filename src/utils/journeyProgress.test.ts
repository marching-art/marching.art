import { describe, it, expect } from 'vitest';
import {
  JOURNEY_STEPS,
  JOURNEY_STEP_IDS,
  deriveJourneyState,
  getJourneySteps,
  getClaimableJourneySteps,
  type JourneyProfile,
} from './journeyProgress';

const FULL_LINEUP = {
  GE1: 'a|2014',
  GE2: 'b|2013',
  VP: 'c|2018',
  VA: 'd|2016',
  CG: 'e|2005',
  B: 'f|2008',
  MA: 'g|2022',
  P: 'h|2002',
};

describe('JOURNEY_STEPS', () => {
  it('covers exactly the declared step ids, in order', () => {
    expect(JOURNEY_STEPS.map((s) => s.id)).toEqual([...JOURNEY_STEP_IDS]);
  });
});

describe('deriveJourneyState', () => {
  it('reads a full lineup from any one corps in the portfolio', () => {
    const profile: JourneyProfile = {
      corps: {
        soundSport: { lineup: { GE1: 'a|2014' } },
        worldClass: { lineup: FULL_LINEUP },
      },
    };
    expect(deriveJourneyState(profile, 0).hasFullLineup).toBe(true);
  });

  it('does not treat a partial lineup as full', () => {
    const profile: JourneyProfile = { corps: { soundSport: { lineup: { GE1: 'a|2014' } } } };
    expect(deriveJourneyState(profile, 0).hasFullLineup).toBe(false);
  });

  it('requires a non-empty week to count as registered', () => {
    const empty: JourneyProfile = { corps: { soundSport: { selectedShows: { week1: [] } } } };
    expect(deriveJourneyState(empty, 0).hasShows).toBe(false);

    const registered: JourneyProfile = {
      corps: { soundSport: { selectedShows: { week1: [{ eventName: 'Show' }] } } },
    };
    expect(deriveJourneyState(registered, 0).hasShows).toBe(true);
  });

  it('requires a concept theme, not just a concept object', () => {
    expect(deriveJourneyState({ corps: { soundSport: { showConcept: {} } } }, 0).hasConcept).toBe(
      false
    );
    expect(
      deriveJourneyState({ corps: { soundSport: { showConcept: { theme: 'Ritual' } } } }, 0)
        .hasConcept
    ).toBe(true);
  });

  it('reads results from the passed count, not the profile', () => {
    expect(deriveJourneyState(null, 0).hasResults).toBe(false);
    expect(deriveJourneyState(null, 3).hasResults).toBe(true);
  });

  it('counts a spent weekly trade', () => {
    expect(
      deriveJourneyState({ corps: { soundSport: { weeklyTrades: { used: 0 } } } }, 0).hasTraded
    ).toBe(false);
    expect(
      deriveJourneyState({ corps: { soundSport: { weeklyTrades: { used: 1 } } } }, 0).hasTraded
    ).toBe(true);
  });

  it('tolerates a null profile', () => {
    const state = deriveJourneyState(null, 0);
    expect(Object.values(state).every((v) => v === false)).toBe(true);
  });

  it('ignores null corps slots', () => {
    const profile: JourneyProfile = {
      corps: { soundSport: null, worldClass: { lineup: FULL_LINEUP } },
    };
    expect(deriveJourneyState(profile, 0).hasFullLineup).toBe(true);
  });
});

describe('getJourneySteps', () => {
  it('marks a step claimable once earned and not yet claimed', () => {
    const steps = getJourneySteps({ corps: { worldClass: { lineup: FULL_LINEUP } } }, 0);
    const step = steps.find((s) => s.id === 'full_lineup');
    expect(step?.claimable).toBe(true);
    expect(step?.done).toBe(false);
  });

  it('stops offering a claim once the server has recorded it', () => {
    const steps = getJourneySteps(
      { corps: { worldClass: { lineup: FULL_LINEUP } }, journey: { full_lineup: true } },
      0
    );
    const step = steps.find((s) => s.id === 'full_lineup');
    expect(step?.done).toBe(true);
    expect(step?.claimable).toBe(false);
  });

  it('leaves unearned steps neither done nor claimable', () => {
    const steps = getJourneySteps(null, 0);
    expect(steps.every((s) => !s.done && !s.claimable)).toBe(true);
  });
});

describe('getClaimableJourneySteps', () => {
  it('returns earned, unclaimed steps in display order', () => {
    const profile: JourneyProfile = {
      corps: {
        worldClass: {
          lineup: FULL_LINEUP,
          selectedShows: { week1: [{ eventName: 'Show' }] },
          showConcept: { theme: 'Ritual' },
        },
      },
      // register_shows is already claimed, so it must drop out.
      journey: { register_shows: true },
    };
    expect(getClaimableJourneySteps(profile, 0).map((s) => s.id)).toEqual([
      'full_lineup',
      'show_concept',
    ]);
  });

  it('returns nothing for a director who has done nothing yet', () => {
    expect(getClaimableJourneySteps(null, 0)).toEqual([]);
  });
});
