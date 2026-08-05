import { describe, it, expect } from 'vitest';
import {
  resolvePodiumNextAction,
  PODIUM_LOW_STAMINA,
  PODIUM_PLANNER_ID,
  PODIUM_PLAN_EDITOR_ID,
  type PodiumNextActionInput,
} from './podiumNextAction';

// A founded corps, mid-season, rested, everything set, nothing outstanding.
function baseInput(overrides: Partial<PodiumNextActionInput> = {}): PodiumNextActionInput {
  return {
    exists: true,
    competitionDay: 20,
    isShowDay: false,
    blocksRemainingToday: 0,
    blocksUsedToday: 12,
    restDay: false,
    stamina: 80,
    hasShows: true,
    hasAutoShows: true,
    hasPlan: true,
    scoresPending: false,
    scoresInMs: 4 * 60 * 60 * 1000,
    ...overrides,
  };
}

describe('resolvePodiumNextAction — no corps', () => {
  it('says nothing (the founding flow owns that surface)', () => {
    expect(resolvePodiumNextAction(baseInput({ exists: false }))).toBeNull();
  });
});

describe('resolvePodiumNextAction — season over', () => {
  it('reports completion once past Day 49', () => {
    const action = resolvePodiumNextAction(baseInput({ competitionDay: 50 }));
    expect(action?.id).toBe('all_clear');
    expect(action?.title).toBe('Season complete');
  });

  it('outranks unspent blocks — nothing can be rehearsed after Finals', () => {
    const action = resolvePodiumNextAction(
      baseInput({ competitionDay: 50, blocksRemainingToday: 8, blocksUsedToday: 0 })
    );
    expect(action?.id).toBe('all_clear');
  });
});

describe('resolvePodiumNextAction — the daily block verb', () => {
  it('prompts a rehearsal when blocks remain', () => {
    const action = resolvePodiumNextAction(
      baseInput({ blocksRemainingToday: 12, blocksUsedToday: 0 })
    );
    expect(action?.id).toBe('podium_rehearse');
    expect(action?.title).toBe('Rehearse your corps');
    expect(action?.target).toEqual({ type: 'scroll', to: PODIUM_PLANNER_ID });
    expect(action?.progress).toEqual({ done: 0, total: 12 });
    expect(action?.tone).toBe('blocked');
  });

  it('counts down the blocks left mid-day', () => {
    const action = resolvePodiumNextAction(
      baseInput({ blocksRemainingToday: 5, blocksUsedToday: 7 })
    );
    expect(action?.id).toBe('podium_rehearse');
    expect(action?.title).toBe('5 rehearsal blocks left');
    expect(action?.progress).toEqual({ done: 7, total: 12 });
  });

  it('singularizes one block', () => {
    const action = resolvePodiumNextAction(
      baseInput({ blocksRemainingToday: 1, blocksUsedToday: 7 })
    );
    expect(action?.title).toBe('1 rehearsal block left');
  });

  it('frames show night differently', () => {
    const action = resolvePodiumNextAction(
      baseInput({ isShowDay: true, blocksRemainingToday: 8, blocksUsedToday: 0 })
    );
    expect(action?.detail).toContain('Show night');
  });

  it('does not prompt rehearsal on a declared rest day', () => {
    const action = resolvePodiumNextAction(
      baseInput({ restDay: true, blocksRemainingToday: 12, blocksUsedToday: 0 })
    );
    expect(action?.id).not.toBe('podium_rehearse');
  });
});

describe('resolvePodiumNextAction — exhaustion', () => {
  it('recommends rest before rehearsing when the day opened critically low', () => {
    const action = resolvePodiumNextAction(
      baseInput({ stamina: PODIUM_LOW_STAMINA - 5, blocksRemainingToday: 8, blocksUsedToday: 0 })
    );
    expect(action?.id).toBe('podium_rest');
    expect(action?.target).toEqual({ type: 'scroll', to: PODIUM_PLANNER_ID });
  });

  it('stops second-guessing once the director has started rehearsing', () => {
    // They've committed to the day; don't flip-flop to "rest" mid-session.
    const action = resolvePodiumNextAction(
      baseInput({ stamina: PODIUM_LOW_STAMINA - 5, blocksRemainingToday: 4, blocksUsedToday: 4 })
    );
    expect(action?.id).toBe('podium_rehearse');
  });

  it('does not cry exhaustion at a healthy stamina', () => {
    const action = resolvePodiumNextAction(
      baseInput({ stamina: 60, blocksRemainingToday: 8, blocksUsedToday: 0 })
    );
    expect(action?.id).toBe('podium_rehearse');
  });
});

describe('resolvePodiumNextAction — periodic prompts', () => {
  it('asks for show registration only when there is truly no competition', () => {
    const action = resolvePodiumNextAction(baseInput({ hasShows: false, hasAutoShows: false }));
    expect(action?.id).toBe('register_shows');
    expect(action?.target).toEqual({ type: 'route', to: '/schedule' });
  });

  it('stays quiet about shows when majors auto-enroll the corps', () => {
    const action = resolvePodiumNextAction(baseInput({ hasShows: false, hasAutoShows: true }));
    expect(action?.id).not.toBe('register_shows');
  });

  it('nudges to set an assistant plan once the daily work is done', () => {
    const action = resolvePodiumNextAction(baseInput({ hasPlan: false }));
    expect(action?.id).toBe('podium_plan');
    expect(action?.target).toEqual({ type: 'scroll', to: PODIUM_PLAN_EDITOR_ID });
  });

  it('ranks the daily rehearsal above the plan nudge', () => {
    const action = resolvePodiumNextAction(
      baseInput({ hasPlan: false, blocksRemainingToday: 12, blocksUsedToday: 0 })
    );
    expect(action?.id).toBe('podium_rehearse');
  });
});

describe('resolvePodiumNextAction — all clear', () => {
  it('counts down to the drop when everything is handled', () => {
    const action = resolvePodiumNextAction(
      baseInput({ scoresInMs: 4 * 60 * 60 * 1000 + 12 * 60000 })
    );
    expect(action?.id).toBe('all_clear');
    expect(action?.title).toBe("You're set for today");
    expect(action?.detail).toContain('4h 12m');
  });

  it('acknowledges a rest day', () => {
    const action = resolvePodiumNextAction(baseInput({ restDay: true }));
    expect(action?.id).toBe('all_clear');
    expect(action?.title).toBe('Resting today');
  });

  it('never counts down while the drop is pending on DCI', () => {
    const action = resolvePodiumNextAction(baseInput({ scoresPending: true, scoresInMs: -5000 }));
    expect(action?.title).toBe('Scores are processing');
    expect(action?.cta).toBeNull();
  });
});

describe('PODIUM_LOW_STAMINA', () => {
  it('mirrors the server balance config threshold', async () => {
    const cfg = await import('../../functions/src/helpers/podium/balanceConfig.json');
    expect(PODIUM_LOW_STAMINA).toBe(cfg.default.condition.lowStaminaThreshold);
  });
});
