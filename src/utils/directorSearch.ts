// Client-side search over the director directory (api/directors). The whole
// list arrives in one response, so matching is a plain case-insensitive
// substring test across the fields a director would type: username, display
// name, and the names of the corps they field. Pure, so it's testable
// without Firebase.

export interface DirectorSearchable {
  username: string;
  displayName: string;
  corps: Array<{ corpsName: string }>;
}

/** Lowercase, trimmed, "@"-stripped — how a typed handle is matched. */
export function toDirectorQuery(raw: string): string {
  return raw.trim().replace(/^@/, '').toLowerCase();
}

/** Whether one directory row matches an already-normalized query. */
export function matchesDirector(entry: DirectorSearchable, query: string): boolean {
  if (!query) return true;
  if (entry.username.toLowerCase().includes(query)) return true;
  if (entry.displayName.toLowerCase().includes(query)) return true;
  return entry.corps.some((corps) => corps.corpsName.toLowerCase().includes(query));
}

/** The rows matching a typed search, in their original order. */
export function filterDirectors<T extends DirectorSearchable>(entries: T[], raw: string): T[] {
  const query = toDirectorQuery(raw);
  if (!query) return entries;
  return entries.filter((entry) => matchesDirector(entry, query));
}
