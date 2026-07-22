import { Timestamp } from 'firebase/firestore';

import type { CorpsClass } from './corps';
import type { CaptionScores, ShowResult } from './season';

// =============================================================================
// FANTASY RECAP TYPES
// =============================================================================
// Canonical shapes for fantasy_recaps documents. These are the single source
// of truth for recap data: the fetch side (src/api/season.ts) re-exports
// DayRecap/ShowWithResults from here, and the score-pipeline hooks
// (useScoresData / useDashboardData / useTickerData) consume them.
//
// Recap documents have been written by several generations of the scoring
// pipeline, so older docs carry different field names than current ones.
// Legacy fields are marked below and must only be read through the
// normalizers in src/utils/recap.ts, so the variance is handled in exactly
// one place.

/**
 * A recap `date` as persisted across document eras: current per-day docs
 * store a Firestore Timestamp; legacy single-doc recap arrays stored
 * serialized dates (string/Date).
 */
export type RecapDate = Timestamp | Date | string;

/**
 * Per-corps result within a recap show. Extends the canonical ShowResult with
 * the fields the recap pipeline adds (director identity, SoundSport medal)
 * plus optional legacy aliases.
 */
export interface RecapResult extends ShowResult {
  displayName?: string;
  avatarUrl?: string | null;
  /** SoundSport medal ('Gold' | 'Silver' | 'Bronze') when awarded. */
  medal?: string;
  /** Legacy alias for totalScore on older docs — read via getScoreValue(). */
  score?: number;
}

/** A single show within a day recap. */
export interface ShowWithResults {
  eventName: string;
  location: string;
  results?: RecapResult[];
  /** Legacy alias for eventName on older docs. */
  name?: string;
}

/**
 * One day's recap document (fantasy_recaps/{seasonUid}/days/{day}; the doc ID
 * is the day number and `offSeasonDay` mirrors it). Also the element shape of
 * the legacy single-document `recaps` array.
 *
 * Legacy recap entries sometimes carried show-level display fields at the
 * recap level (showName/eventName/name/totalScore/rank) — read those only
 * through the normalizers in src/utils/recap.ts.
 */
export interface DayRecap {
  offSeasonDay: number;
  date: RecapDate;
  shows: ShowWithResults[];

  // --- Legacy recap-level fields (older doc formats only) ---
  showName?: string;
  eventName?: string;
  name?: string;
  totalScore?: number | string;
  rank?: number | string;
}

// =============================================================================
// NORMALIZED (CANONICAL) SCORE SHAPES
// =============================================================================

/** Caption aggregate totals derived by calculateCaptionAggregates. */
export interface CaptionAggregates {
  GE_Total: number;
  VIS_Total: number;
  MUS_Total: number;
  Total_Score: number;
}

/** Per-caption ranks assigned by calculateCaptionRanks. */
export interface CaptionRanks {
  GE_Rank: number;
  VIS_Rank: number;
  MUS_Rank: number;
}

/**
 * Canonical per-corps score entry after normalization (see
 * normalizeShowResult in src/utils/recap.ts). Both members of the legacy
 * alias pairs (corps/corpsName, score/totalScore) are populated so downstream
 * code can use either.
 */
export interface NormalizedScore {
  corps: string;
  corpsName: string;
  uid: string;
  displayName?: string;
  avatarUrl: string | null;
  score: number;
  totalScore: number;
  geScore: number;
  visualScore: number;
  musicScore: number;
  corpsClass: CorpsClass;
  captions: CaptionScores;
}

/** A show flattened for the Scores page/hooks, with normalized score entries. */
export interface NormalizedShow {
  eventName: string;
  location: string;
  date: string;
  offSeasonDay: number;
  seasonId: string;
  scores: NormalizedScore[];
}
