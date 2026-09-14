// =============================================================================
// DIRECTOR DIRECTORY — search / browse other directors' profiles
// =============================================================================
// One callable (functions/src/callable/users.js searchDirectors) serves both
// the alphabetical directory and the username search on /directors. Signed-in
// only: the `usernames` collection is list-closed to clients by rule, so this
// is the sole way to enumerate directors, and it is budgeted and page-capped
// server-side. Rows come from each director's server-mirrored public profile
// projection — never lineups or picks.

import { createCallable } from './callable';

/** One directory row: enough to recognize a director and open their profile. */
export interface DirectorSearchEntry {
  uid: string;
  username: string;
  displayName: string;
  photoURL: string | null;
  xpLevel: number;
  userTitle: string;
  location: string;
  seasonsPlayed: number;
  /** Named corps in display order (World, Open, A, SoundSport). */
  corps: Array<{ classKey: string; corpsName: string }>;
}

export interface SearchDirectorsInput {
  /** Username prefix (case-insensitive; a leading "@" is fine). Empty = browse. */
  query?: string;
  /** `nextCursor` from the previous page. */
  cursor?: string | null;
  /** Page size, server-clamped to 1..50 (default 25). */
  limit?: number;
}

export interface SearchDirectorsResult {
  directors: DirectorSearchEntry[];
  /** Pass back as `cursor` for the next page; null when this was the last. */
  nextCursor: string | null;
}

export const searchDirectors = createCallable<SearchDirectorsInput, SearchDirectorsResult>(
  'searchDirectors'
);
