// Client-side half of the director search contract (functions/src/helpers/
// directorSearch.js): normalize what the director typed into the username key
// the callable matches on, and know what the server will accept so the page
// never sends a query it would reject. Pure, so it's testable without Firebase.

/** A username key: what the server matches against. Empty = browse everyone. */
export const DIRECTOR_QUERY_RE = /^[a-z0-9_]{0,15}$/;

/** Lowercase, trimmed, "@"-stripped — the form the callable matches on. */
export function toDirectorQuery(raw: string): string {
  return raw.trim().replace(/^@/, '').toLowerCase();
}

export function isValidDirectorQuery(query: string): boolean {
  return DIRECTOR_QUERY_RE.test(query);
}
