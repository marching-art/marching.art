// =============================================================================
// NEXT ACTION RESOLVER
// =============================================================================
// Answers one question for a director: *what do I do right now?*
//
// The dashboard already surfaces every input to that answer — lineup slots,
// show registrations, the show concept, the Director's Report count, claimable
// rewards, tonight's drop — but on mobile they are spread across a ten-panel
// vertical scroll, so a new director has to assemble the answer themselves.
// This module collapses that state into a single ranked imperative.
//
// The ranking is gameplay-derived, not cosmetic. In priority order:
//
//   1. No corps            — nothing else in the game is reachable.
//   2. Season complete     — the competition calendar is over; nothing is
//                            actionable until rollover.
//   3. Incomplete lineup   — scoring.js gates every show on
//                            `hasCompleteLineup(corps.lineup)`. A corps one
//                            caption short scores NOTHING, not a reduced
//                            total. This is the most consequential omission
//                            in the game, so it outranks everything below.
//                            When the caption-change window is shut it
//                            degrades to a "reopens at ..." notice rather
//                            than a dead button.
//   4. No shows this week  — scoring only runs for corps registered at that
//                            night's event. Zero registrations for the
//                            current week means zero scores for the week.
//                            Deliberately NOT raised for a partially filled
//                            week: `totalSeasonScore` is the most recent
//                            daily total (scoring.js commitDailyScoring), not
//                            a cumulative sum, so "register for more shows"
//                            is a strategy call the game must not make for
//                            the director.
//   5. Claimable rewards   — already earned, one tap, pure upside.
//   6. No show concept     — real mechanic (nightly CorpsCoin style bonus)
//                            but never score-critical.
//   7. Daily report        — the recurring engagement loop.
//   8. All clear           — nothing outstanding; show the countdown.
//
// Pure and React-free so the whole priority ladder is unit-testable.

import { CAPTION_IDS } from '../data/captions';
import { CHAMPIONSHIP_START_DAY, formatCountdown, formatEtShort } from './seasonClock';
import { getMaxShowsForWeek } from './captionPricing';

/** Every caption slot the game requires before a corps is eligible to score. */
const REQUIRED_CAPTION_COUNT = CAPTION_IDS.length;

export type NextActionId =
  | 'register_corps'
  | 'season_complete'
  | 'complete_lineup'
  | 'lineup_locked'
  | 'register_shows'
  | 'claim_reward'
  | 'set_concept'
  | 'daily_report'
  | 'all_clear';

/**
 * What the primary button does.
 *  - `lineup` / `concept` open the dashboard's existing modals.
 *  - `route` navigates.
 *  - `scroll` jumps to a panel already on this page (used for claims, which
 *    are owned by the panel that knows how to call the server).
 */
export type NextActionTarget =
  | { type: 'lineup' }
  | { type: 'concept' }
  | { type: 'register' }
  | { type: 'route'; to: string }
  | { type: 'scroll'; to: string }
  | null;

/**
 * Visual weight, ordered by how much it should interrupt.
 *  - `blocked` — the director is not scoring until this is done.
 *  - `reward`  — something earned is waiting.
 *  - `action`  — worth doing, not urgent.
 *  - `routine` — the daily loop.
 *  - `waiting` — nothing to do; informational.
 */
export type NextActionTone = 'blocked' | 'reward' | 'action' | 'routine' | 'waiting';

export interface NextAction {
  id: NextActionId;
  /** Short imperative headline. */
  title: string;
  /** One line on why it matters, in game terms. */
  detail: string;
  /** Primary button label; null when there is nothing to tap. */
  cta: string | null;
  target: NextActionTarget;
  /** Step progress when the action has a natural count (slots, daily set). */
  progress: { done: number; total: number } | null;
  tone: NextActionTone;
}

/**
 * The subset of `getCaptionChangeInfo()` (utils/seasonClock) this resolver
 * consults. Kept structural so tests can build one without a season doc.
 */
export interface CaptionWindowState {
  phase: 'unlimited' | 'weekly' | 'blackout' | 'championship' | 'complete';
  status: 'open' | 'locked' | 'closed';
  reopensAt?: Date | null;
}

/** The per-class corps record, narrowed to what the resolver reads. */
export interface NextActionCorps {
  lineup?: Record<string, unknown> | null;
  selectedShows?: Record<string, unknown> | null;
  showConcept?: { theme?: string | null } | null;
}

/** A reward the director has earned but not yet claimed. */
export interface ClaimableReward {
  count: number;
  /** Human label for the first/most notable claim, e.g. "Season Ladder Tier 2". */
  label: string;
  /** DOM id of the panel that owns the claim button. */
  targetId: string;
}

export interface NextActionInput {
  /** Active corps for the selected class, or null when none exists yet. */
  corps: NextActionCorps | null;
  /** Canonical class key. `podiumClass` is not a fantasy class — see below. */
  corpsClass: string | null;
  /** Competition day (1-49), or null before the season store hydrates. */
  currentDay: number | null;
  /** Competition week (1-7), or null before the season store hydrates. */
  currentWeek: number | null;
  /** Caption-change window for this class; null before hydration. */
  captionWindow: CaptionWindowState | null;
  /** Director's Report completion for today. */
  dailyDone: number;
  dailyTotal: number;
  /** Earned-but-unclaimed rewards (journey steps, ladder tiers). */
  claimable: ClaimableReward | null;
  /** True while tonight's drop is past its planned instant, awaiting DCI. */
  scoresPending: boolean;
  /** Milliseconds until the next score drop. */
  scoresInMs: number;
}

/** Count the filled slots, ignoring any key that is not a real caption. */
function countFilledCaptions(lineup: Record<string, unknown> | null | undefined): number {
  if (!lineup) return 0;
  return CAPTION_IDS.filter((id) => {
    const value = lineup[id];
    return typeof value === 'string' && value.length > 0;
  }).length;
}

/** Shows the corps is registered for in a given competition week. */
function countShowsForWeek(
  selectedShows: Record<string, unknown> | null | undefined,
  week: number | null
): number {
  if (!selectedShows || week == null) return 0;
  const entry = selectedShows[`week${week}`];
  return Array.isArray(entry) ? entry.length : 0;
}

/**
 * Why the lineup cannot be edited right now, phrased for a player. Returns
 * null when the window is open (or unknown, which we treat as open — the
 * server is the real gate and surfaces its own message on save).
 */
function describeLineupLock(window: CaptionWindowState | null): string | null {
  if (!window) return null;
  if (window.status === 'open') return null;

  const reopens = window.reopensAt ? formatEtShort(window.reopensAt) : null;

  if (window.phase === 'blackout') {
    return reopens
      ? `Caption changes are closed on Days 43-44. Championship changes open ${reopens}.`
      : 'Caption changes are closed on Days 43-44.';
  }
  if (window.phase === 'championship' && window.status === 'closed') {
    return 'This class has finished competing for the season — its caption changes are closed.';
  }
  return reopens
    ? `Caption changes are locked overnight and reopen ${reopens}.`
    : 'Caption changes are locked while tonight’s scores are final.';
}

/**
 * Resolve the single most important thing this director should do next.
 *
 * Returns null when there is no meaningful answer to give:
 *  - `podiumClass`, which is a separate director-simulation game with its own
 *    guided surfaces (PodiumZone's founding flow and PodiumJourneyPanel). A
 *    fantasy-shaped imperative would be wrong there in every branch.
 */
export function resolveNextAction(input: NextActionInput): NextAction | null {
  const {
    corps,
    corpsClass,
    currentDay,
    currentWeek,
    captionWindow,
    dailyDone,
    dailyTotal,
    claimable,
    scoresPending,
    scoresInMs,
  } = input;

  if (corpsClass === 'podiumClass') return null;

  // --- 1. No corps -------------------------------------------------------
  if (!corps) {
    return {
      id: 'register_corps',
      title: 'Register your corps',
      detail: 'Name a corps to start competing — everything else in the game opens up from there.',
      cta: 'Register Corps',
      target: { type: 'register' },
      progress: null,
      tone: 'blocked',
    };
  }

  // --- 2. Season over ----------------------------------------------------
  // Nothing is actionable between the final day and rollover; the season
  // recap modal handles the payout ceremony on its own.
  if (captionWindow?.phase === 'complete') {
    return {
      id: 'season_complete',
      title: 'Season complete',
      detail: 'Finals are scored and the books are closed. A new season starts shortly.',
      cta: 'View Final Scores',
      target: { type: 'route', to: '/scores' },
      progress: null,
      tone: 'waiting',
    };
  }

  // --- 3. Incomplete lineup ---------------------------------------------
  const filled = countFilledCaptions(corps.lineup);
  const lineupComplete = filled >= REQUIRED_CAPTION_COUNT;

  if (!lineupComplete) {
    const missing = REQUIRED_CAPTION_COUNT - filled;
    const progress = { done: filled, total: REQUIRED_CAPTION_COUNT };
    const lockReason = describeLineupLock(captionWindow);

    if (lockReason) {
      return {
        id: 'lineup_locked',
        title: `Lineup is ${missing} short`,
        detail: lockReason,
        cta: null,
        target: null,
        progress,
        tone: 'waiting',
      };
    }

    return {
      id: 'complete_lineup',
      title:
        filled === 0
          ? 'Build your lineup'
          : `Draft ${missing} more caption${missing === 1 ? '' : 's'}`,
      detail: 'A corps with an empty slot does not score at all — fill all 8 captions to compete.',
      cta: filled === 0 ? 'Build Lineup' : 'Open Lineup',
      target: { type: 'lineup' },
      progress,
      tone: 'blocked',
    };
  }

  // --- 4. No shows registered this week ---------------------------------
  // Championship Week (Days 45-49) auto-enrolls every eligible corps, so
  // there is nothing to register and the prompt would be a lie.
  const inChampionshipWeek = currentDay != null && currentDay >= CHAMPIONSHIP_START_DAY;
  const showsThisWeek = countShowsForWeek(corps.selectedShows, currentWeek);

  if (!inChampionshipWeek && currentWeek != null && showsThisWeek === 0) {
    const maxShows = getMaxShowsForWeek(currentWeek) as number;
    return {
      id: 'register_shows',
      title: 'Register for shows',
      detail: `You are not entered in any Week ${currentWeek} show, and a corps that does not compete does not score. You can enter up to ${maxShows} this week.`,
      cta: 'View Schedule',
      target: { type: 'route', to: '/schedule' },
      progress: null,
      tone: 'blocked',
    };
  }

  // --- 5. Claimable rewards ---------------------------------------------
  if (claimable && claimable.count > 0) {
    const extra = claimable.count - 1;
    return {
      id: 'claim_reward',
      title: claimable.count === 1 ? 'A reward is ready' : `${claimable.count} rewards ready`,
      detail: extra > 0 ? `${claimable.label} and ${extra} more.` : `${claimable.label}.`,
      cta: 'Claim',
      target: { type: 'scroll', to: claimable.targetId },
      progress: null,
      tone: 'reward',
    };
  }

  // --- 6. No show concept ------------------------------------------------
  if (!corps.showConcept?.theme) {
    return {
      id: 'set_concept',
      title: 'Set your show concept',
      detail: 'A concept whose style matches your picks earns a CorpsCoin bonus every night.',
      cta: 'Set Concept',
      target: { type: 'concept' },
      progress: null,
      tone: 'action',
    };
  }

  // --- 7. Today's Director's Report -------------------------------------
  if (dailyTotal > 0 && dailyDone < dailyTotal) {
    return {
      id: 'daily_report',
      title: "Finish today's report",
      detail: 'Challenges and predictions pay XP and CorpsCoin, and keep your streak alive.',
      cta: 'Open Report',
      target: { type: 'scroll', to: 'directors-report' },
      progress: { done: dailyDone, total: dailyTotal },
      tone: 'routine',
    };
  }

  // --- 8. Nothing outstanding -------------------------------------------
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
    title: "You're set for tonight",
    detail: `Lineup filed, shows entered, report done. Scores drop in ${formatCountdown(scoresInMs)}.`,
    cta: 'View Scores',
    target: { type: 'route', to: '/scores' },
    progress: null,
    tone: 'waiting',
  };
}

export default resolveNextAction;
