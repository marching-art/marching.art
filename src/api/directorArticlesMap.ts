// =============================================================================
// DIRECTOR ARTICLES — pure mapping helpers (no Firebase import)
// =============================================================================
// Kept separate from directorArticles.ts (which imports the Firestore client)
// so this logic — path parsing, id building, timestamp normalization — is
// unit-testable without initializing Firebase.

import type { DocumentData } from 'firebase/firestore';

export interface DirectorArticle {
  /** Composite id for the /article/:id route ({seasonId}_{dayId}_{type}). */
  id: string;
  headline: string;
  summary: string;
  category: string;
  createdAt: string | null;
  imageUrl: string | null;
  corpsName: string | null;
}

/** Build the feed's composite article id from a Firestore doc path. */
export function articleIdFromPath(path: string): string | null {
  // news_hub/{seasonId}/days/{dayId}/articles/{articleType}
  const parts = path.split('/');
  if (parts.length < 6) return null;
  const [, seasonId, , dayId, , articleType] = parts;
  if (!seasonId || !dayId || !articleType) return null;
  return `${seasonId}_${dayId}_${articleType}`;
}

/** Normalize a createdAt that may be a Firestore Timestamp or an ISO string. */
function toIso(value: unknown): string | null {
  if (!value) return null;
  const ts = value as { toDate?: () => Date };
  if (typeof ts.toDate === 'function') return ts.toDate().toISOString();
  if (typeof value === 'string') return value;
  return null;
}

/** Map an article doc (path + data) to a DirectorArticle, or null if unusable. */
export function mapArticleDoc(path: string, data: DocumentData): DirectorArticle | null {
  const id = articleIdFromPath(path);
  if (!id) return null;
  return {
    id,
    headline: data.headline || '',
    summary: data.summary || '',
    category: data.category || 'press',
    createdAt: toIso(data.createdAt),
    imageUrl: data.imageUrl || null,
    corpsName: data.corpsName || null,
  };
}
