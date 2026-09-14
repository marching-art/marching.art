// =============================================================================
// DIRECTOR DIRECTORY — every director, for the /directors page
// =============================================================================
// One callable (functions/src/callable/users.js searchDirectors) returns the
// whole directory in a single response: each director's server-mirrored
// public profile projection, reduced to the row below and sorted by username.
// Signed-in only and budgeted server-side. Search runs locally on the list
// (utils/directorSearch), which is why it can match display and corps names
// and why there is no query parameter here. Rows never carry lineups or picks.

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
  /** Named corps in display order (World, Open, A, SoundSport, Podium). */
  corps: Array<{ classKey: string; corpsName: string }>;
}

export interface DirectoryResult {
  /** Every director, sorted by username (case-insensitive). */
  directors: DirectorSearchEntry[];
  total: number;
  /** True only if the server hit its row ceiling — never expected in practice. */
  truncated: boolean;
}

export const listDirectors = createCallable<void, DirectoryResult>('searchDirectors');
