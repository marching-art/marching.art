// =============================================================================
// FIRST SEASON JOURNEY — steps, readiness, and claim state
// =============================================================================
// The quest line that walks a new director through every core mechanic, with
// server-validated XP + CorpsCoin per step.
//
// Step ids and rewards MIRROR functions/src/helpers/journey.js — the
// completeJourneyStep callable re-verifies each step against the profile
// before paying, so anything claimed here that the server disagrees with is
// simply refused. Keep the two lists in sync.
//
// The readiness predicates live here (not in the panel) because two surfaces
// consult them: JourneyPanel, which renders the list, and the Next Action
// resolver, which only needs "how many are ready to claim right now".
// Presentation — icons and which modal an action opens — stays in the panel.

export const JOURNEY_STEP_IDS = [
  'full_lineup',
  'register_shows',
  'show_concept',
  'check_scores',
  'make_prediction',
  'caption_trade',
  'join_league',
  'finish_season',
] as const;

export type JourneyStepId = (typeof JOURNEY_STEP_IDS)[number];

/** Per-class corps entry, narrowed to the fields journey readiness consults. */
interface JourneyCorps {
  lineup?: Record<string, unknown> | null;
  selectedShows?: Record<string, unknown> | null;
  showConcept?: { theme?: string | null } | null;
  weeklyTrades?: { used?: number } | null;
}

export interface JourneyProfile {
  corps?: Record<string, JourneyCorps | null> | null;
  predictions?: Record<string, unknown> | null;
  leagueIds?: string[] | null;
  lifetimeStats?: { totalSeasons?: number } | null;
  /** Server-owned map of claimed step ids. */
  journey?: Partial<Record<JourneyStepId, boolean>> | null;
}

/**
 * The facts every step's readiness is derived from.
 *
 * Note these are portfolio-wide, not per-class: the journey asks "have you
 * done this at all yet", so a director who fields a full lineup in any one of
 * their corps has done it. That mirrors the server's verifier.
 */
export interface JourneyState {
  hasFullLineup: boolean;
  hasShows: boolean;
  hasConcept: boolean;
  hasResults: boolean;
  hasPrediction: boolean;
  hasTraded: boolean;
  hasLeague: boolean;
  hasFinishedSeason: boolean;
}

export interface JourneyStep {
  id: JourneyStepId;
  title: string;
  description: string;
  xp: number;
  coin: number;
  ready: (state: JourneyState) => boolean;
}

export const JOURNEY_STEPS: JourneyStep[] = [
  {
    id: 'full_lineup',
    title: 'Field a Full Corps',
    description: 'Fill all 8 caption slots in your lineup',
    xp: 50,
    coin: 50,
    ready: (s) => s.hasFullLineup,
  },
  {
    id: 'register_shows',
    title: 'Hit the Road',
    description: 'Register your corps for shows this week',
    xp: 50,
    coin: 50,
    ready: (s) => s.hasShows,
  },
  {
    id: 'show_concept',
    title: 'Design Your Show',
    description: 'Set a show concept — matching styles earn nightly CorpsCoin bonuses',
    xp: 50,
    coin: 50,
    ready: (s) => s.hasConcept,
  },
  {
    id: 'check_scores',
    title: 'Read the Recaps',
    description:
      'Scores drop nightly — 9 PM ET in the off-season, late evening in live season — check your first recap',
    xp: 25,
    coin: 0,
    // Trust step: claimable once the corps actually has results to read.
    ready: (s) => s.hasResults,
  },
  {
    id: 'make_prediction',
    title: 'Call Your Shot',
    description: 'Submit a daily prediction from the dashboard panel',
    xp: 25,
    coin: 25,
    ready: (s) => s.hasPrediction,
  },
  {
    id: 'caption_trade',
    title: 'Work the Trade Window',
    description: 'Make a caption change in a weekly window (3/week after Day 14)',
    xp: 50,
    coin: 50,
    ready: (s) => s.hasTraded,
  },
  {
    id: 'join_league',
    title: 'Find Your Circuit',
    description: 'Join a league for weekly head-to-head matchups',
    xp: 75,
    coin: 100,
    ready: (s) => s.hasLeague,
  },
  {
    id: 'finish_season',
    title: 'Complete a Season',
    description: 'Stay with your corps through Finals',
    xp: 100,
    coin: 100,
    ready: (s) => s.hasFinishedSeason,
  },
];

/** Derive the readiness facts from a profile snapshot. */
export function deriveJourneyState(
  profile: JourneyProfile | null,
  resultCount: number
): JourneyState {
  const corpsList = Object.values(profile?.corps || {}).filter(Boolean) as JourneyCorps[];
  return {
    hasFullLineup: corpsList.some((c) => !!c.lineup && Object.keys(c.lineup).length === 8),
    hasShows: corpsList.some((c) =>
      Object.values(c.selectedShows || {}).some((w) => Array.isArray(w) && w.length > 0)
    ),
    hasConcept: corpsList.some((c) => !!c.showConcept?.theme),
    hasResults: (resultCount || 0) > 0,
    hasPrediction: Object.keys(profile?.predictions || {}).length > 0,
    hasTraded: corpsList.some((c) => (c.weeklyTrades?.used || 0) > 0),
    hasLeague: (profile?.leagueIds || []).length > 0,
    hasFinishedSeason: (profile?.lifetimeStats?.totalSeasons || 0) >= 1,
  };
}

export interface JourneyStepStatus extends JourneyStep {
  /** Already claimed (server-owned profile.journey flag). */
  done: boolean;
  /** Earned but unclaimed — the Claim button state. */
  claimable: boolean;
}

/** Every step tagged with its claimed/claimable status, in display order. */
export function getJourneySteps(
  profile: JourneyProfile | null,
  resultCount: number
): JourneyStepStatus[] {
  const state = deriveJourneyState(profile, resultCount);
  const journey = profile?.journey;
  return JOURNEY_STEPS.map((step) => {
    const done = !!journey?.[step.id];
    return { ...step, done, claimable: !done && step.ready(state) };
  });
}

/** Steps the director has earned but not yet claimed, in display order. */
export function getClaimableJourneySteps(
  profile: JourneyProfile | null,
  resultCount: number
): JourneyStepStatus[] {
  return getJourneySteps(profile, resultCount).filter((s) => s.claimable);
}
