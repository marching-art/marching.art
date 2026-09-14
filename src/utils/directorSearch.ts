// Client-side half of the director directory search contract
// (functions/src/helpers/directory.js). The index stores every prefix (2–12
// chars) of every word in a director's username, display name and corps
// names, so ONE equality query on the most selective typed word finds the
// candidates; the remaining typed words are checked locally on that page.
// Pure, so it's testable without Firebase.

export interface DirectorSearchable {
  username: string;
  displayName: string;
  corps: Array<{ corpsName: string }>;
}

/** Mirrors MAX_TOKEN_LENGTH / MIN_TOKEN_LENGTH on the server. */
export const MAX_TOKEN_LENGTH = 12;
export const MIN_TOKEN_LENGTH = 2;

/** Lowercase, trimmed, "@"-stripped — how a typed handle is matched. */
export function toDirectorQuery(raw: string): string {
  return raw.trim().replace(/^@/, '').toLowerCase();
}

/** Lowercase words: letters, digits and underscores; everything else separates. */
export function queryWords(raw: string): string[] {
  return toDirectorQuery(raw)
    .split(/[^a-z0-9_]+/)
    .filter(Boolean);
}

/**
 * The single token sent to Firestore for a typed search: the longest word
 * (most selective), truncated to the stored prefix length. Empty when the
 * text has no word long enough to be a token — the page then waits for more
 * typing rather than fetching a huge, useless candidate set.
 */
export function searchTokenFor(raw: string): string {
  const ws = queryWords(raw);
  if (ws.length === 0) return '';
  const longest = ws.reduce((a, b) => (b.length > a.length ? b : a));
  // A lone one-character word is indexed as itself (an initial); otherwise
  // anything shorter than the minimum prefix is not a token.
  if (longest.length < MIN_TOKEN_LENGTH && ws.length > 1) return '';
  return longest.slice(0, MAX_TOKEN_LENGTH);
}

/**
 * Whether every typed word prefixes some word of the row — the local half of
 * the search, applied to the page the token query returned.
 */
export function matchesAllWords(entry: DirectorSearchable, wordsTyped: string[]): boolean {
  if (wordsTyped.length === 0) return true;
  const haystack = [entry.username, entry.displayName, ...entry.corps.map((c) => c.corpsName)]
    .join(' ')
    .toLowerCase()
    .split(/[^a-z0-9_]+/)
    .filter(Boolean);
  return wordsTyped.every((w) => haystack.some((h) => h.startsWith(w)));
}

/** Case-insensitive by username, uid-stable, without mutating. */
export function sortByUsername<T extends { username: string; uid: string }>(entries: T[]): T[] {
  return [...entries].sort((a, b) => {
    const au = a.username.toLowerCase();
    const bu = b.username.toLowerCase();
    if (au !== bu) return au < bu ? -1 : 1;
    return a.uid < b.uid ? -1 : a.uid > b.uid ? 1 : 0;
  });
}
