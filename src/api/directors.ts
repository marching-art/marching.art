// =============================================================================
// DIRECTOR DIRECTORY — page-at-a-time reads of the `directory/{uid}` index
// =============================================================================
// The index is one small row per director (functions/src/helpers/directory.js),
// kept current by the profile mirror trigger. The /directors page reads it
// straight from Firestore — no function in the path, no cold start — and only
// ever the rows on screen: 50 a page when browsing (ordered by username), 50
// for a search (one indexed equality on the row's word-prefix tokens), and a
// count() aggregation for the header. firestore.rules caps every list at 50,
// so a visit costs one page of reads whether there are a hundred directors or
// fifty thousand. Rows never carry lineups or picks.

import {
  collection,
  query,
  orderBy,
  startAfter,
  limit,
  where,
  getDocs,
  getCountFromServer,
  type QueryDocumentSnapshot,
  type DocumentData,
} from 'firebase/firestore';
import { db, paths } from './client';
import { sortByUsername } from '../utils/directorSearch';

/** Rows per browse page and per search — must stay ≤ the rule-enforced cap. */
export const DIRECTORY_PAGE_SIZE = 50;

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

export interface DirectoryPage {
  directors: DirectorSearchEntry[];
  /** Pass back to fetch the next page; null when this was the last. */
  cursor: QueryDocumentSnapshot<DocumentData> | null;
}

/** Reduce a raw row to the entry the UI renders (search keys stay behind). */
export function directoryEntryFromDoc(uid: string, data: DocumentData): DirectorSearchEntry {
  const corps = Array.isArray(data.corps)
    ? data.corps
        .filter(
          (c: unknown): c is { classKey: string; corpsName: string } =>
            !!c &&
            typeof c === 'object' &&
            typeof (c as { classKey?: unknown }).classKey === 'string' &&
            typeof (c as { corpsName?: unknown }).corpsName === 'string'
        )
        .map((c) => ({ classKey: c.classKey, corpsName: c.corpsName }))
    : [];
  const username = typeof data.username === 'string' ? data.username : '';
  return {
    uid,
    username,
    displayName:
      typeof data.displayName === 'string' && data.displayName ? data.displayName : username,
    photoURL: typeof data.photoURL === 'string' && data.photoURL ? data.photoURL : null,
    xpLevel: typeof data.xpLevel === 'number' && data.xpLevel > 0 ? data.xpLevel : 1,
    userTitle: typeof data.userTitle === 'string' ? data.userTitle : '',
    location: typeof data.location === 'string' ? data.location : '',
    seasonsPlayed: typeof data.seasonsPlayed === 'number' ? data.seasonsPlayed : 0,
    corps,
  };
}

/** One page of the A–Z directory, continuing from `cursor` (null = first page). */
export async function fetchDirectoryPage(
  cursor: QueryDocumentSnapshot<DocumentData> | null
): Promise<DirectoryPage> {
  const base = collection(db, paths.directory());
  const q = cursor
    ? query(base, orderBy('usernameKey'), startAfter(cursor), limit(DIRECTORY_PAGE_SIZE))
    : query(base, orderBy('usernameKey'), limit(DIRECTORY_PAGE_SIZE));
  const snap = await getDocs(q);
  const directors = snap.docs.map((d) => directoryEntryFromDoc(d.id, d.data()));
  const last = snap.docs[snap.docs.length - 1] ?? null;
  return { directors, cursor: snap.docs.length === DIRECTORY_PAGE_SIZE ? last : null };
}

/**
 * Directors whose username, display name or a corps name has a word starting
 * with `token` (already lowercased and truncated — see utils/directorSearch).
 * One indexed equality read, capped at a page; sorted by username.
 */
export async function searchDirectory(token: string): Promise<DirectorSearchEntry[]> {
  if (!token) return [];
  const q = query(
    collection(db, paths.directory()),
    where('searchTokens', 'array-contains', token),
    limit(DIRECTORY_PAGE_SIZE)
  );
  const snap = await getDocs(q);
  return sortByUsername(snap.docs.map((d) => directoryEntryFromDoc(d.id, d.data())));
}

/** Total directors listed — a count() aggregation, not a document read per row. */
export async function fetchDirectoryCount(): Promise<number> {
  const snap = await getCountFromServer(collection(db, paths.directory()));
  return snap.data().count;
}
