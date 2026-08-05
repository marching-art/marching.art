// =============================================================================
// PODIUM NEXT ACTION RESOLVER
// =============================================================================
// The Podium equivalent of utils/nextAction — "what should this director do
// right now?" — but ranked on Podium's own rules, because Podium is a different
// game from the fantasy classes (docs/PODIUM.md). There is no lineup to fill
// and no caption budget; the daily verb is allocating rehearsal blocks, and the
// things that cost a director are missing a rehearsal day, running a corps into
// the ground, or never registering for a show.
//
// Priority order, most-costly first:
//
//   1. Season complete       — nothing is actionable until the next season.
//   2. Rest, exhausted       — stamina opened the day critically low and no
//                              blocks are in yet: resting recovers far more
//                              than grinding tired would earn. Surfaced before
//                              "rehearse" so the game doesn't push a director
//                              to dig the hole deeper.
//   3. Blocks to spend       — the daily habit. Unspent blocks are lost growth
//                              (the assistant plan only recovers a *missed*
//                              day at 85%; a day you're present for should be
//                              rehearsed deliberately).
//   4. No shows registered   — a corps that never competes never scores. Lower
//                              than the daily verb because majors/championship
//                              auto-enroll, so it's rarely a hard zero.
//   5. No assistant plan     — protective: without one, a day you miss is lost
//                              entirely. Worth prompting once the daily work is
//                              done.
//   6. All set               — blocks spent or resting; show the countdown.
//
// Pure and React-free so the whole ladder is unit-testable. Returns the same
// NextAction shape the fantasy resolver and the mobile hero already use.

import { formatCountdown } from './seasonClock';
import type { NextAction } from './nextAction';

/**
 * Stamina at or below which the day's block cap is already penalized and a rest
 * day is the better call. Mirrors balanceConfig.condition.lowStaminaThreshold
 * (functions/src/helpers/podium/balanceConfig.json) — kept in sync by the test
 * that pins it against the committed config.
 */
export const PODIUM_LOW_STAMINA = 30;

/** DOM id the hero scrolls to for the rehearsal planner. */
export const PODIUM_PLANNER_ID = 'podium-planner';
/** DOM id the hero scrolls to for the assistant-director plan editor. */
export const PODIUM_PLAN_EDITOR_ID = 'podium-plan-editor';

export interface PodiumNextActionInput {
  /** Whether a Podium corps exists for the active season. */
  exists: boolean;
  /** Competition day (1-49); < 1 is spring training, > 49 is over. */
  competitionDay: number;
  /** Tonight is a show night for this corps. */
  isShowDay: boolean;
  /** Server-authoritative block budget for today. */
  blocksRemainingToday: number;
  blocksUsedToday: number;
  /** A rest day was declared for today. */
  restDay: boolean;
  /** Start-of-day stamina (0-100). */
  stamina: number;
  /** Competition days this corps is registered/auto-enrolled for. */
  hasShows: boolean;
  hasAutoShows: boolean;
  /** An assistant-director rehearsal plan (planTemplate) is saved. */
  hasPlan: boolean;
  /** True while tonight's drop is past its planned instant, awaiting DCI. */
  scoresPending: boolean;
  /** Milliseconds until the next score drop. */
  scoresInMs: number;
}

/**
 * Resolve the single most important thing a Podium director should do next.
 * Returns null when there is nothing to say (no corps yet — the founding flow
 * owns that surface, not the hero).
 */
export function resolvePodiumNextAction(input: PodiumNextActionInput): NextAction | null {
  const {
    exists,
    competitionDay,
    isShowDay,
    blocksRemainingToday,
    blocksUsedToday,
    restDay,
    stamina,
    hasShows,
    hasAutoShows,
    hasPlan,
    scoresPending,
    scoresInMs,
  } = input;

  if (!exists) return null;

  // --- 1. Season over ----------------------------------------------------
  if (competitionDay > 49) {
    return {
      id: 'all_clear',
      title: 'Season complete',
      detail: 'Finals are scored. A new season — and a fresh corps to build — starts shortly.',
      cta: 'View Scores',
      target: { type: 'route', to: '/scores' },
      progress: null,
      tone: 'waiting',
    };
  }

  const blocksToSpend = !restDay && blocksRemainingToday > 0;

  // --- 2. Rest when the corps woke up exhausted --------------------------
  // Only before any blocks are in — once they've started, don't second-guess.
  if (blocksToSpend && blocksUsedToday === 0 && stamina <= PODIUM_LOW_STAMINA) {
    return {
      id: 'podium_rest',
      title: 'Your corps is exhausted',
      detail: `Stamina is at ${Math.round(stamina)}. A rest day recovers far more than rehearsing tired would earn — declare one in the planner, or push on if you're peaking for a show.`,
      cta: 'Open Planner',
      target: { type: 'scroll', to: PODIUM_PLANNER_ID },
      progress: null,
      tone: 'action',
    };
  }

  // --- 3. Spend today's blocks ------------------------------------------
  if (blocksToSpend) {
    const total = blocksRemainingToday + blocksUsedToday;
    return {
      id: 'podium_rehearse',
      title:
        blocksUsedToday === 0
          ? 'Rehearse your corps'
          : `${blocksRemainingToday} rehearsal block${blocksRemainingToday === 1 ? '' : 's'} left`,
      detail: isShowDay
        ? 'Show night — run your pre-performance blocks before the corps competes.'
        : 'Spend today’s blocks on the captions that need them. Unspent blocks are growth you don’t get back.',
      cta: 'Open Planner',
      target: { type: 'scroll', to: PODIUM_PLANNER_ID },
      progress: { done: blocksUsedToday, total },
      tone: 'blocked',
    };
  }

  // --- 4. Never registered for a show -----------------------------------
  if (!hasShows && !hasAutoShows) {
    return {
      id: 'register_shows',
      title: 'Register for shows',
      detail: 'A corps that never takes the field never scores. Pick your competition nights.',
      cta: 'View Schedule',
      target: { type: 'route', to: '/schedule' },
      progress: null,
      tone: 'blocked',
    };
  }

  // --- 5. No assistant plan to cover missed days ------------------------
  if (!hasPlan) {
    return {
      id: 'podium_plan',
      title: 'Set a rehearsal plan',
      detail:
        'The assistant director runs your saved plan on days you miss — without one, a missed day is lost entirely.',
      cta: 'Set a Plan',
      target: { type: 'scroll', to: PODIUM_PLAN_EDITOR_ID },
      progress: null,
      tone: 'action',
    };
  }

  // --- 6. Nothing outstanding -------------------------------------------
  if (scoresPending) {
    return {
      id: 'all_clear',
      title: 'Scores are processing',
      detail: "Tonight's results are being posted — check back in a few minutes.",
      cta: null,
      target: null,
      progress: null,
      tone: 'waiting',
    };
  }

  return {
    id: 'all_clear',
    title: restDay ? 'Resting today' : "You're set for today",
    detail: restDay
      ? `Your corps recovers overnight. Scores drop in ${formatCountdown(scoresInMs)}.`
      : `Blocks rehearsed, plan set. Scores drop in ${formatCountdown(scoresInMs)}.`,
    cta: 'View Scores',
    target: { type: 'route', to: '/scores' },
    progress: null,
    tone: 'waiting',
  };
}

export default resolvePodiumNextAction;
