import { describe, it, expect } from 'vitest';
import {
  resolveNextAction,
  type NextActionInput,
  type CaptionWindowState,
  type NextActionCorps,
} from './nextAction';

// A director mid-season with nothing outstanding. Individual tests override
// only the field under test so the priority ladder is what's being asserted.
const FULL_LINEUP = {
  GE1: 'Blue Devils|2014',
  GE2: 'Carolina Crown|2013',
  VP: 'Santa Clara Vanguard|2018',
  VA: 'Bluecoats|2016',
  CG: 'Cadets|2005',
  B: 'Phantom Regiment|2008',
  MA: 'Boston Crusaders|2022',
  P: 'Cavaliers|2002',
};

const OPEN_WINDOW: CaptionWindowState = { phase: 'weekly', status: 'open' };

function baseInput(overrides: Partial<NextActionInput> = {}): NextActionInput {
  return {
    corps: {
      lineup: { ...FULL_LINEUP },
      selectedShows: { week3: [{ eventName: 'Show A' }] },
      showConcept: { theme: 'Fire and Ice' },
    },
    corpsClass: 'worldClass',
    currentDay: 17,
    currentWeek: 3,
    captionWindow: OPEN_WINDOW,
    dailyDone: 5,
    dailyTotal: 5,
    claimable: null,
    scoresPending: false,
    scoresInMs: 4 * 60 * 60 * 1000,
    ...overrides,
  };
}

function corpsWith(overrides: Partial<NextActionCorps>): NextActionCorps {
  return {
    lineup: { ...FULL_LINEUP },
    selectedShows: { week3: [{ eventName: 'Show A' }] },
    showConcept: { theme: 'Fire and Ice' },
    ...overrides,
  };
}

describe('resolveNextAction — Podium', () => {
  // Podium is a separate director-simulation game with its own founding flow
  // and journey panel; a fantasy-shaped imperative is wrong in every branch.
  it('returns null for podiumClass regardless of state', () => {
    expect(resolveNextAction(baseInput({ corpsClass: 'podiumClass' }))).toBeNull();
    expect(resolveNextAction(baseInput({ corpsClass: 'podiumClass', corps: null }))).toBeNull();
  });
});

describe('resolveNextAction — no corps', () => {
  it('asks for registration before anything else', () => {
    const action = resolveNextAction(
      baseInput({ corps: null, claimable: { count: 3, label: 'Tier 2', targetId: 'x' } })
    );
    expect(action?.id).toBe('register_corps');
    expect(action?.target).toEqual({ type: 'register' });
    expect(action?.tone).toBe('blocked');
  });
});

describe('resolveNextAction — season complete', () => {
  it('reports the season as over once the caption window closes out', () => {
    const action = resolveNextAction(
      baseInput({ captionWindow: { phase: 'complete', status: 'closed' } })
    );
    expect(action?.id).toBe('season_complete');
    expect(action?.target).toEqual({ type: 'route', to: '/scores' });
  });

  it('outranks an incomplete lineup — nothing can be fixed after Finals', () => {
    const action = resolveNextAction(
      baseInput({
        corps: corpsWith({ lineup: { GE1: 'Blue Devils|2014' } }),
        captionWindow: { phase: 'complete', status: 'closed' },
      })
    );
    expect(action?.id).toBe('season_complete');
  });
});

describe('resolveNextAction — incomplete lineup', () => {
  // scoring.js gates every show on hasCompleteLineup(); one empty slot scores
  // nothing at all, so this outranks shows, rewards, concept, and the report.
  it('counts the missing captions', () => {
    const action = resolveNextAction(
      baseInput({
        corps: corpsWith({
          lineup: { GE1: 'Blue Devils|2014', GE2: 'Carolina Crown|2013', VP: 'SCV|2018' },
        }),
      })
    );
    expect(action?.id).toBe('complete_lineup');
    expect(action?.title).toBe('Draft 5 more captions');
    expect(action?.progress).toEqual({ done: 3, total: 8 });
    expect(action?.target).toEqual({ type: 'lineup' });
    expect(action?.tone).toBe('blocked');
  });

  it('singularizes a one-slot gap', () => {
    const lineup = { ...FULL_LINEUP } as Record<string, string>;
    delete lineup.P;
    const action = resolveNextAction(baseInput({ corps: corpsWith({ lineup }) }));
    expect(action?.title).toBe('Draft 1 more caption');
    expect(action?.progress).toEqual({ done: 7, total: 8 });
  });

  it('uses build-from-scratch wording for an empty lineup', () => {
    const action = resolveNextAction(baseInput({ corps: corpsWith({ lineup: {} }) }));
    expect(action?.id).toBe('complete_lineup');
    expect(action?.title).toBe('Build your lineup');
    expect(action?.cta).toBe('Build Lineup');
  });

  it('ignores stray non-caption keys when counting slots', () => {
    const action = resolveNextAction(
      baseInput({
        corps: corpsWith({
          lineup: { ...FULL_LINEUP, bogusCaption: 'Something|1999' },
        }),
      })
    );
    // Still complete at 8 real captions — the stray key must not inflate it,
    // and must not make a short lineup look full either.
    expect(action?.id).not.toBe('complete_lineup');
  });

  it('does not count empty-string slots as filled', () => {
    const action = resolveNextAction(
      baseInput({ corps: corpsWith({ lineup: { ...FULL_LINEUP, P: '' } }) })
    );
    expect(action?.id).toBe('complete_lineup');
    expect(action?.progress).toEqual({ done: 7, total: 8 });
  });

  it('outranks missing shows, rewards, concept, and the daily report', () => {
    const action = resolveNextAction(
      baseInput({
        corps: { lineup: {}, selectedShows: {}, showConcept: null },
        claimable: { count: 2, label: 'Season Ladder Tier 1', targetId: 'directors-report' },
        dailyDone: 0,
        dailyTotal: 5,
      })
    );
    expect(action?.id).toBe('complete_lineup');
  });
});

describe('resolveNextAction — lineup locked', () => {
  const shortLineup = corpsWith({ lineup: { GE1: 'Blue Devils|2014' } });

  it('explains the overnight lock instead of offering a dead button', () => {
    const reopensAt = new Date('2026-07-12T06:00:00Z');
    const action = resolveNextAction(
      baseInput({
        corps: shortLineup,
        captionWindow: { phase: 'weekly', status: 'locked', reopensAt },
      })
    );
    expect(action?.id).toBe('lineup_locked');
    expect(action?.title).toBe('Lineup is 7 short');
    expect(action?.cta).toBeNull();
    expect(action?.target).toBeNull();
    expect(action?.tone).toBe('waiting');
    expect(action?.detail).toContain('reopen');
    // Still tells them how short they are.
    expect(action?.progress).toEqual({ done: 1, total: 8 });
  });

  it('names the Days 43-44 blackout', () => {
    const action = resolveNextAction(
      baseInput({
        corps: shortLineup,
        currentDay: 43,
        captionWindow: {
          phase: 'blackout',
          status: 'closed',
          reopensAt: new Date('2026-07-14T06:00:00Z'),
        },
      })
    );
    expect(action?.id).toBe('lineup_locked');
    expect(action?.detail).toContain('Days 43-44');
  });

  it('says the class is finished when Championship Week has passed it by', () => {
    const action = resolveNextAction(
      baseInput({
        corps: shortLineup,
        currentDay: 48,
        // Days 48-49 are World/SoundSport Finals — Open and A are done.
        captionWindow: { phase: 'championship', status: 'closed' },
      })
    );
    expect(action?.id).toBe('lineup_locked');
    expect(action?.detail).toContain('finished competing');
  });

  it('treats an unhydrated season (null window) as editable', () => {
    // The server is the real gate and surfaces its own message on save;
    // blocking the button here would strand a director who can actually edit.
    const action = resolveNextAction(baseInput({ corps: shortLineup, captionWindow: null }));
    expect(action?.id).toBe('complete_lineup');
  });
});

describe('resolveNextAction — show registration', () => {
  it('raises an empty week once the lineup is complete', () => {
    const action = resolveNextAction(
      baseInput({ corps: corpsWith({ selectedShows: {} }), currentWeek: 3 })
    );
    expect(action?.id).toBe('register_shows');
    expect(action?.detail).toContain('Week 3');
    // Regular weeks allow 4 (captionPricing.getMaxShowsForWeek).
    expect(action?.detail).toContain('4');
    expect(action?.target).toEqual({ type: 'route', to: '/schedule' });
  });

  it('quotes the tighter Week 7 cap', () => {
    const action = resolveNextAction(
      baseInput({
        corps: corpsWith({ selectedShows: {} }),
        currentDay: 44,
        currentWeek: 7,
      })
    );
    expect(action?.id).toBe('register_shows');
    expect(action?.detail).toContain('up to 2');
  });

  it('stays silent during Championship Week, which auto-enrolls', () => {
    const action = resolveNextAction(
      baseInput({
        corps: corpsWith({ selectedShows: {} }),
        currentDay: 47,
        currentWeek: 7,
      })
    );
    expect(action?.id).not.toBe('register_shows');
  });

  it('does not second-guess a partially filled week', () => {
    // totalSeasonScore is the latest daily total, not a cumulative sum, so
    // "enter more shows" is a strategy call the game must not make for them.
    const action = resolveNextAction(
      baseInput({ corps: corpsWith({ selectedShows: { week3: [{ eventName: 'Show A' }] } }) })
    );
    expect(action?.id).not.toBe('register_shows');
  });

  it('ignores other weeks when judging the current one', () => {
    const action = resolveNextAction(
      baseInput({
        corps: corpsWith({ selectedShows: { week2: [{ eventName: 'Old Show' }] } }),
        currentWeek: 3,
      })
    );
    expect(action?.id).toBe('register_shows');
  });

  it('stays silent before the season store hydrates the week', () => {
    const action = resolveNextAction(
      baseInput({ corps: corpsWith({ selectedShows: {} }), currentWeek: null, currentDay: null })
    );
    expect(action?.id).not.toBe('register_shows');
  });
});

describe('resolveNextAction — claimable rewards', () => {
  it('surfaces a single claim with its label', () => {
    const action = resolveNextAction(
      baseInput({
        claimable: { count: 1, label: 'Season Ladder Tier 2', targetId: 'directors-report' },
      })
    );
    expect(action?.id).toBe('claim_reward');
    expect(action?.title).toBe('A reward is ready');
    expect(action?.detail).toBe('Season Ladder Tier 2.');
    expect(action?.target).toEqual({ type: 'scroll', to: 'directors-report' });
    expect(action?.tone).toBe('reward');
  });

  it('counts the rest when several are waiting', () => {
    const action = resolveNextAction(
      baseInput({ claimable: { count: 3, label: 'Field a Full Corps', targetId: 'journey-panel' } })
    );
    expect(action?.title).toBe('3 rewards ready');
    expect(action?.detail).toBe('Field a Full Corps and 2 more.');
  });

  it('yields to an unregistered week — scoring beats collecting', () => {
    const action = resolveNextAction(
      baseInput({
        corps: corpsWith({ selectedShows: {} }),
        claimable: { count: 1, label: 'Tier 1', targetId: 'directors-report' },
      })
    );
    expect(action?.id).toBe('register_shows');
  });

  it('ignores an empty claim bundle', () => {
    const action = resolveNextAction(
      baseInput({ claimable: { count: 0, label: 'none', targetId: 'x' } })
    );
    expect(action?.id).not.toBe('claim_reward');
  });
});

describe('resolveNextAction — show concept', () => {
  it('prompts when no concept is set', () => {
    const action = resolveNextAction(baseInput({ corps: corpsWith({ showConcept: null }) }));
    expect(action?.id).toBe('set_concept');
    expect(action?.target).toEqual({ type: 'concept' });
    expect(action?.tone).toBe('action');
  });

  it('treats a concept object with no theme as unset', () => {
    const action = resolveNextAction(baseInput({ corps: corpsWith({ showConcept: {} }) }));
    expect(action?.id).toBe('set_concept');
  });

  it('yields to claimable rewards', () => {
    const action = resolveNextAction(
      baseInput({
        corps: corpsWith({ showConcept: null }),
        claimable: { count: 1, label: 'Tier 1', targetId: 'directors-report' },
      })
    );
    expect(action?.id).toBe('claim_reward');
  });
});

describe("resolveNextAction — today's report", () => {
  it('reports the outstanding count', () => {
    const action = resolveNextAction(baseInput({ dailyDone: 2, dailyTotal: 5 }));
    expect(action?.id).toBe('daily_report');
    expect(action?.progress).toEqual({ done: 2, total: 5 });
    expect(action?.target).toEqual({ type: 'scroll', to: 'directors-report' });
    expect(action?.tone).toBe('routine');
  });

  it('stays silent when the set is empty (nothing offered today)', () => {
    const action = resolveNextAction(baseInput({ dailyDone: 0, dailyTotal: 0 }));
    expect(action?.id).toBe('all_clear');
  });
});

describe('resolveNextAction — all clear', () => {
  it('counts down to the drop when everything is done', () => {
    const action = resolveNextAction(baseInput({ scoresInMs: 4 * 60 * 60 * 1000 + 12 * 60000 }));
    expect(action?.id).toBe('all_clear');
    expect(action?.title).toBe("You're set for tonight");
    expect(action?.detail).toContain('4h 12m');
    expect(action?.target).toEqual({ type: 'route', to: '/scores' });
  });

  it('never counts down while the drop is pending on DCI', () => {
    // scoresAt is in the past here; a countdown would show "now" forever.
    const action = resolveNextAction(baseInput({ scoresPending: true, scoresInMs: -5000 }));
    expect(action?.id).toBe('all_clear');
    expect(action?.title).toBe('Scores are processing');
    expect(action?.cta).toBeNull();
  });
});
