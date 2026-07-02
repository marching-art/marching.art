// Articles API - Resolves full article documents by id
// Moved from components/Articles/articleLoader.js so pages stay presentational.
//
// Lookup order:
//   1. Composite id ({seasonId}_{dayId}_{articleType}) under news_hub days.
//   2. Community submissions under the active season.
//   3. Legacy flat collections (news_hub, news, articles).
//   4. Paging through the recent-news API as a last resort.
//
// NOTE: Errors are intentionally NOT wrapped with withErrorHandling — the
// per-method try/catch fallbacks below are the original error semantics.

import { doc, getDoc } from 'firebase/firestore';
import { db } from './client';
import { getRecentNews } from './functions';
import type { NewsEntry } from '../types';

/** An article resolved from any of the storage locations. */
export interface ResolvedArticle {
  id: string;
  [key: string]: unknown;
}

/**
 * Resolve a full article document by id, trying each storage location in order.
 *
 * @param id - Article id from the route.
 * @returns The resolved article, or null/undefined when not found.
 */
export async function resolveArticleById(
  id: string
): Promise<ResolvedArticle | NewsEntry | null | undefined> {
  let foundArticle: ResolvedArticle | NewsEntry | null | undefined = null;

  // Method 1: Parse composite article ID and fetch from correct path
  // ID format: {seasonId}_{dayId}_{articleType} e.g., "scherzo_2025-26_day_1_deep_analytics"
  // Path: news_hub/{seasonId}/days/{dayId}/articles/{articleType}
  const idMatch = id.match(/^(.+)_(day_\d+)_(.+)$/);
  if (idMatch) {
    const [, seasonId, dayId, articleType] = idMatch;
    const articlePath = `news_hub/${seasonId}/days/${dayId}/articles/${articleType}`;
    try {
      const docRef = doc(db, articlePath);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        const data = docSnap.data();
        // Determine category from article type
        const category =
          articleType === 'dci_recap'
            ? 'analysis'
            : articleType === 'deep_analytics'
              ? 'analysis'
              : articleType.startsWith('dci_')
                ? 'dci'
                : articleType.startsWith('fantasy_')
                  ? 'fantasy'
                  : 'dci';
        foundArticle = {
          id,
          seasonId,
          reportDay: parseInt(dayId.replace('day_', ''), 10),
          articleType,
          category,
          ...data,
          createdAt: data.createdAt?.toDate?.()?.toISOString() || data.createdAt,
        };
      }
    } catch {
      // Path doesn't exist or no permission, try other methods
    }
  }

  // Method 2: Try community submissions path
  // Format: news_hub/{seasonId}/community/article_{submissionId}
  if (!foundArticle && id.startsWith('article_')) {
    // Try to find in community submissions - need to know seasonId
    // Fetch active season from game-settings
    try {
      const seasonSettingsRef = doc(db, 'game-settings', 'season');
      const seasonSettingsSnap = await getDoc(seasonSettingsRef);
      if (seasonSettingsSnap.exists()) {
        const seasonId = seasonSettingsSnap.data()?.seasonUid || 'current_season';
        const communityPath = `news_hub/${seasonId}/community/${id}`;
        const docRef = doc(db, communityPath);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          const data = docSnap.data();
          foundArticle = {
            id,
            ...data,
            createdAt: data.createdAt?.toDate?.()?.toISOString() || data.createdAt,
          };
        }
      }
    } catch {
      // Community path doesn't exist
    }
  }

  // Method 3: Try legacy flat collection paths
  if (!foundArticle) {
    const legacyCollections = ['news_hub', 'news', 'articles'];
    for (const collectionPath of legacyCollections) {
      try {
        const docRef = doc(db, collectionPath, id);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          const data = docSnap.data();
          foundArticle = {
            id: docSnap.id,
            ...data,
            createdAt: data.createdAt?.toDate?.()?.toISOString() || data.createdAt,
          };
          break;
        }
      } catch {
        // Collection doesn't exist or no permission, try next
      }
    }
  }

  // Method 4: Fall back to searching through recent news API
  if (!foundArticle) {
    let startAfter: string | null | undefined = null;
    let attempts = 0;
    const maxAttempts = 5;

    while (!foundArticle && attempts < maxAttempts) {
      const result = await getRecentNews({
        limit: 100,
        startAfter: startAfter as string | undefined,
      });

      if (!result.data?.success || !result.data.news?.length) {
        break;
      }

      foundArticle = result.data.news.find((a) => a.id === id);

      if (!foundArticle && result.data.hasMore) {
        const lastArticle = result.data.news[result.data.news.length - 1];
        startAfter = lastArticle?.createdAt;
        attempts++;
      } else {
        break;
      }
    }
  }

  return foundArticle;
}
