// =============================================================================
// PRODUCT FUNNEL INSTRUMENTATION
// =============================================================================
// Before this module, analytics recorded page views plus four auth events, so
// nothing measured whether any *game* action happened: no lineup saves, no show
// registrations, no class unlocks, no purchases. Four retention features shipped
// (Discord score-drop embed, morning push, lineup-deadline reminders, matchup
// pushes) with no way to tell whether any of them moved D1/D7.
//
// The instrumentation point is `createCallable` (src/api/callable.ts) rather
// than individual components: every server mutation in the app already flows
// through that one factory, so wiring it there covers the whole funnel at once
// and — more importantly — keeps covering it when new callables are added.
// Sprinkling logEvent() calls across ~180 components is the version that rots.
//
// Only the callables in FUNNEL_EVENTS below emit. GA4 caps distinct event names
// (500 per property) and charges attention for every one of them, so the map is
// a curated list of the steps worth building a funnel report on — admin tools,
// reads, and polling callables stay silent on purpose.

import { analytics } from './analytics';

// =============================================================================
// EVENT NAMES
// =============================================================================

/**
 * The funnel steps worth reporting on, keyed by the callable that performs them.
 *
 * Naming rules (GA4): snake_case, <= 40 chars, letters/digits/underscore only,
 * and no `firebase_`/`google_`/`ga_` prefix. Names are stable identifiers — a
 * rename orphans every historical report built on the old name, so treat these
 * as an append-mostly list.
 */
export const FUNNEL_EVENTS: Readonly<Record<string, string>> = Object.freeze({
  // --- Activation: account -> first corps -> first lineup -> first show ---
  createUserProfile: 'profile_created',
  registerCorps: 'corps_created',
  saveLineup: 'lineup_saved',
  selectUserShows: 'shows_registered',
  saveShowConcept: 'show_concept_saved',
  completeJourneyStep: 'journey_step_completed',

  // --- The daily loop ---
  claimDailyLogin: 'daily_login_claimed',
  completeDailyChallenge: 'challenge_completed',
  submitPrediction: 'prediction_submitted',

  // --- Progression ---
  unlockClassWithCorpsCoin: 'class_unlocked',

  // --- Economy (paired with the server-side mint/sink ledger) ---
  purchaseShopItem: 'shop_purchase',
  equipShopItem: 'cosmetic_equipped',
  purchaseStreakFreeze: 'streak_freeze_purchased',
  purchaseRetirementPlaque: 'prestige_purchase',
  purchaseHallBanner: 'prestige_purchase',
  makeLegacyEndowment: 'legacy_endowment',

  // --- Leagues: the highest-retention cohort ---
  createLeague: 'league_created',
  joinLeague: 'league_joined',
  joinLeagueByCode: 'league_joined',
  leaveLeague: 'league_left',
  joinLeaguePool: 'league_pool_joined',
  inviteDirectorToLeague: 'league_invite_sent',
  postLeagueMessage: 'league_message_posted',

  // --- Community: director-authored content ---
  publishPressRelease: 'press_release_published',

  // --- Career lifecycle ---
  retireCorps: 'corps_retired',
  unretireCorps: 'corps_unretired',

  // --- Podium ---
  hostEvent: 'event_hosted',
  commitPodiumBudget: 'podium_budget_committed',
  hirePodiumClinician: 'podium_staff_hired',

  // --- Community ---
  addArticleComment: 'article_comment_posted',
  toggleArticleReaction: 'article_reaction_toggled',
  castFanFavoriteVote: 'fan_favorite_voted',
  submitNewsForApproval: 'news_submitted',
});

/**
 * Funnel steps that are not callables — emitted explicitly from the surface
 * that owns them (push opt-in, install prompt, the score-drop return visit).
 */
export const CLIENT_FUNNEL_EVENTS = Object.freeze({
  /** Push permission resolved. `outcome` carries granted/denied/unsupported. */
  NOTIFICATION_PERMISSION: 'notification_permission',
  /** A push token was registered against the profile. */
  NOTIFICATION_ENABLED: 'notification_enabled',
  /** The PWA install prompt was accepted. */
  PWA_INSTALLED: 'pwa_installed',
  /**
   * The director opened the app and saw results they had not seen before —
   * the conversion event for the nightly score drop and its notifications.
   */
  SCORE_DROP_RETURN: 'score_drop_return',
  /** An onboarding step was reached (`step` param carries which). */
  ONBOARDING_STEP: 'onboarding_step',
  /** Onboarding ran to completion. */
  ONBOARDING_COMPLETED: 'onboarding_completed',
});

// =============================================================================
// PARAMETERS
// =============================================================================

/**
 * Per-callable parameter extraction. Kept deliberately narrow: dimensions we
 * would actually segment a funnel by (which class, which item, which league),
 * never free text and never anything identifying. GA4 rejects params over 100
 * chars and we do not want user-authored strings in an analytics property.
 */
const PARAM_EXTRACTORS: Record<string, (data: unknown) => Record<string, unknown>> = {
  registerCorps: (data) => ({ corps_class: pickString(data, 'class') }),
  saveLineup: (data) => ({ corps_class: pickString(data, 'corpsClass') }),
  selectUserShows: (data) => ({
    corps_class: pickString(data, 'corpsClass'),
    week: pickNumber(data, 'week'),
    show_count: pickArrayLength(data, 'shows'),
  }),
  saveShowConcept: (data) => ({ corps_class: pickString(data, 'corpsClass') }),
  unlockClassWithCorpsCoin: (data) => ({ corps_class: pickString(data, 'classToUnlock') }),
  purchaseShopItem: (data) => ({ item_id: pickString(data, 'itemId') }),
  equipShopItem: (data) => ({ item_id: pickString(data, 'itemId') }),
  purchaseRetirementPlaque: (data) => ({ tier: pickString(data, 'tier') }),
  makeLegacyEndowment: (data) => ({ tier: pickString(data, 'tierId') }),
  completeJourneyStep: (data) => ({ step: pickString(data, 'stepId') }),
  completeDailyChallenge: (data) => ({ challenge_id: pickString(data, 'challengeId') }),
  retireCorps: (data) => ({ corps_class: pickString(data, 'corpsClass') }),
  unretireCorps: (data) => ({ corps_class: pickString(data, 'corpsClass') }),
  hostEvent: (data) => ({ venue_tier: pickString(data, 'venueTier') }),
};

/**
 * Calls that reach a mapped callable but do not perform the step.
 *
 * `retireCorps({ checkOnly: true })` is the confirmation dialog's dry run — the
 * UI asks whether retirement is allowed before showing the warning copy. It
 * fires on every glance at the retire button, so counting it as `corps_retired`
 * would report several times the real retirements and make the metric useless
 * for exactly the decision it exists to inform.
 */
const SKIP_PREDICATES: Record<string, (data: unknown) => boolean> = {
  retireCorps: (data) => asRecord(data)?.checkOnly === true,
};

function asRecord(data: unknown): Record<string, unknown> | null {
  return data !== null && typeof data === 'object' ? (data as Record<string, unknown>) : null;
}

/** A short, non-identifying string value, or undefined. Caps GA4 param length. */
function pickString(data: unknown, key: string): string | undefined {
  const value = asRecord(data)?.[key];
  return typeof value === 'string' && value.length > 0 ? value.slice(0, 100) : undefined;
}

function pickNumber(data: unknown, key: string): number | undefined {
  const value = asRecord(data)?.[key];
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

function pickArrayLength(data: unknown, key: string): number | undefined {
  const value = asRecord(data)?.[key];
  return Array.isArray(value) ? value.length : undefined;
}

/** Drop undefined values — GA4 records the key with a literal "undefined". */
function compact(params: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null) out[key] = value;
  }
  return out;
}

// =============================================================================
// PUBLIC API
// =============================================================================

export type FunnelOutcome = 'success' | 'error';

/**
 * Record the outcome of a mapped callable.
 *
 * Outcome lives in a parameter rather than the event name so a funnel report
 * counts attempts and successes off one event, and `error_code` says which
 * server rejection is costing conversions (`failed-precondition` on
 * `class_unlocked` means the price gate, `unauthenticated` means a session
 * problem — two very different bugs that a single `*_failed` event conflates).
 *
 * Unmapped callables are a no-op. Never throws: instrumentation must not be
 * able to fail a user action.
 */
export function trackCallable(
  name: string,
  outcome: FunnelOutcome,
  options: { data?: unknown; durationMs?: number; errorCode?: string } = {}
): void {
  const event = FUNNEL_EVENTS[name];
  if (!event) return;

  try {
    if (SKIP_PREDICATES[name]?.(options.data)) return;

    const extract = PARAM_EXTRACTORS[name];
    analytics.logEvent(
      event,
      compact({
        ...(extract ? extract(options.data) : {}),
        // `callable` disambiguates the events that several callables share
        // (shop/prestige purchases, joinLeague vs joinLeagueByCode).
        callable: name,
        outcome,
        error_code: options.errorCode,
        duration_ms:
          typeof options.durationMs === 'number' ? Math.round(options.durationMs) : undefined,
      })
    );
  } catch {
    // Analytics is best-effort (ad blockers, unsupported browsers, quota).
  }
}

/**
 * Record a funnel step that isn't a callable. `event` should come from
 * CLIENT_FUNNEL_EVENTS so the reportable set stays enumerable in one place.
 */
export function trackFunnelEvent(event: string, params: Record<string, unknown> = {}): void {
  try {
    analytics.logEvent(event, compact(params));
  } catch {
    // Best-effort, as above.
  }
}

/**
 * Map a thrown callable error to a stable, low-cardinality code.
 *
 * Firebase callable errors carry `code` as `functions/<status>`; the status is
 * the part worth segmenting on. Messages are deliberately discarded — they are
 * human prose, sometimes interpolated with user data, and would blow out
 * parameter cardinality.
 */
export function errorCodeOf(error: unknown): string {
  const raw = asRecord(error)?.code;
  if (typeof raw === 'string' && raw.length > 0) {
    return raw.startsWith('functions/') ? raw.slice('functions/'.length) : raw.slice(0, 100);
  }
  return 'unknown';
}
