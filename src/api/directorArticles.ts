// =============================================================================
// DIRECTOR ARTICLES — a director's own published news-hub content
// =============================================================================
// Powers the profile Newsroom: the press releases and articles a director has
// authored, newest first. Reads the public `articles` collection group directly
// (rules allow read); only author-written docs carry an authorUid, so filtering
// by it naturally excludes the AI/system-generated daily articles. The pure
// mapping helpers live in directorArticlesMap.ts (no Firebase import) so they
// stay unit-testable.

import {
  collectionGroup,
  query,
  where,
  orderBy,
  limit as fbLimit,
  getDocs,
} from 'firebase/firestore';
import { db } from './client';
import { mapArticleDoc, type DirectorArticle } from './directorArticlesMap';

export { articleIdFromPath, mapArticleDoc } from './directorArticlesMap';
export type { DirectorArticle } from './directorArticlesMap';

/**
 * Fetch a director's published, self-authored articles (press releases +
 * approved community articles), newest first.
 */
export async function getDirectorArticles(uid: string, max = 12): Promise<DirectorArticle[]> {
  const q = query(
    collectionGroup(db, 'articles'),
    where('authorUid', '==', uid),
    where('isPublished', '==', true),
    orderBy('createdAt', 'desc'),
    fbLimit(max)
  );
  const snap = await getDocs(q);
  const out: DirectorArticle[] = [];
  for (const d of snap.docs) {
    const mapped = mapArticleDoc(d.ref.path, d.data());
    if (mapped) out.push(mapped);
  }
  return out;
}
