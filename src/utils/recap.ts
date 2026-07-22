// =============================================================================
// RECAP NORMALIZERS
// =============================================================================
// Normalizers for legacy field variance in fantasy_recaps documents.
//
// Recap documents have been written by several generations of the scoring
// pipeline, so older docs use different field names than current ones
// (recap-level `showName`/`name` vs per-show `eventName`, result-level
// `score` vs `totalScore`, serialized dates vs Firestore Timestamps). Every
// legacy-field fallback chain lives HERE, at the read boundary, so downstream
// code consumes one canonical shape and the variance is handled in exactly
// one place.

import type { Timestamp } from 'firebase/firestore';

import type { DayRecap, NormalizedScore, RecapDate, RecapResult } from '../types/recap';

/**
 * Display/event name for a recap day.
 * Legacy chain: recap-level showName → eventName → name (older single-doc
 * recap arrays carried the show name on the recap itself), then the first
 * show's eventName (current per-day format).
 */
export function getRecapEventName(recap: DayRecap): string {
  return recap.showName || recap.eventName || recap.name || recap.shows?.[0]?.eventName || 'Show';
}

/**
 * Whether a recap day has anything displayable — a legacy recap-level name
 * field or at least one show in the current format.
 */
export function recapHasEvent(recap: DayRecap): boolean {
  return Boolean(recap.showName || recap.eventName || recap.name || (recap.shows?.length ?? 0) > 0);
}

/**
 * Numeric score for a result or score-history entry.
 * Legacy chain: `score` (older docs and normalized entries) → `totalScore`
 * (current docs) → 0.
 */
export function getScoreValue(entry: { score?: number; totalScore?: number }): number {
  return entry.score || entry.totalScore || 0;
}

/**
 * Convert a stored recap `date` (Firestore Timestamp on current docs, a
 * serialized string/Date on legacy ones) to a JS Date. Returns null when the
 * field is absent so callers own their own fallback.
 */
export function toRecapDate(date: RecapDate | null | undefined): Date | null {
  if (!date) return null;
  if (date instanceof Date) return date;
  if (typeof date === 'string') return new Date(date);
  if (typeof (date as Timestamp).toDate === 'function') return (date as Timestamp).toDate();
  return null;
}

/**
 * Normalize a raw per-corps recap result to the canonical score entry used by
 * the Scores page and Dashboard. Populates both members of the legacy alias
 * pairs (corps/corpsName, score/totalScore) so consumers can use either.
 */
export function normalizeShowResult(result: RecapResult): NormalizedScore {
  return {
    corps: result.corpsName,
    corpsName: result.corpsName,
    uid: result.uid,
    displayName: result.displayName,
    avatarUrl: result.avatarUrl || null,
    score: result.totalScore || 0,
    totalScore: result.totalScore || 0,
    geScore: result.geScore || 0,
    visualScore: result.visualScore || 0,
    musicScore: result.musicScore || 0,
    corpsClass: result.corpsClass,
    captions: result.captions || {},
  };
}
