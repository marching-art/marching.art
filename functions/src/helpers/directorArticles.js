/**
 * Director-authored articles in the news feed: press releases (`press_*`,
 * instant-publish for trusted authors) and approved community submissions
 * (`community_*`, auto-publish for trusted authors). Both live at
 * `news_hub/{seasonId}/days/day_{n}/articles/{articleType}` and are addressed
 * in the feed by the composite id `{seasonId}_day_{n}_{articleType}`.
 *
 * Shared by the author's own delete (deleteMyPressRelease), the player report
 * control (reportArticle) and the admin Reports queue's "Remove content", so a
 * takedown is the same soft-remove — unpublished and marked, never
 * hard-deleted — whichever path triggers it.
 */

const { logger } = require("firebase-functions/v2");

// seasonId may itself contain underscores, so the day marker anchors the parse.
const DIRECTOR_ARTICLE_ID_RE = /^(.+)_(day_\d+)_((press|community)_[A-Za-z0-9_-]+)$/;

/**
 * Parse a composite feed id for a director-authored article.
 *
 * @param {unknown} articleId
 * @returns {{seasonId: string, dayId: string, articleType: string,
 *   kind: "press"|"community", articlePath: string} | null}
 */
function parseDirectorArticleId(articleId) {
  if (typeof articleId !== "string" || articleId.length > 300) return null;
  const match = articleId.match(DIRECTOR_ARTICLE_ID_RE);
  if (!match) return null;
  const [, seasonId, dayId, articleType, kind] = match;
  if (seasonId.includes("/")) return null;
  return {
    seasonId,
    dayId,
    articleType,
    kind: /** @type {"press"|"community"} */ (kind),
    articlePath: `news_hub/${seasonId}/days/${dayId}/articles/${articleType}`,
  };
}

/** A published article is live until it is unpublished or marked removed. */
function isArticleLive(data) {
  return Boolean(data) && data.isPublished !== false && data.status !== "removed";
}

/** Player-facing noun for the article kind. */
const kindLabel = (kind) => (kind === "press" ? "press release" : "article");

/**
 * Soft-remove a director article and, when someone other than the author took
 * it down, bell the author. The notification is best-effort.
 *
 * @param {FirebaseFirestore.Firestore} db
 * @param {{ref: FirebaseFirestore.DocumentReference, data: Record<string, any>,
 *   articleType: string, kind: "press"|"community", removedBy: string,
 *   removedByAdmin: boolean, reason?: string|null}} params
 */
async function softRemoveDirectorArticle(
  db,
  { ref, data, articleType, kind, removedBy, removedByAdmin, reason = null }
) {
  const now = new Date();
  await ref.update({
    isPublished: false,
    status: "removed",
    removedBy,
    removedByAdmin,
    removalReason: reason,
    removedAt: now,
    updatedAt: now,
  });

  if (!removedByAdmin || !data.authorUid) return;
  try {
    const { createUserNotification } = require("./userNotifications");
    const label = kindLabel(kind);
    await createUserNotification(db, data.authorUid, {
      type: "press_release_removed",
      title: `Your ${label} was removed`,
      message:
        `An admin removed your ${label}${data.headline ? `: “${data.headline}”` : ""}. ` +
        `Reach out if you think this was a mistake.`,
      link: "/profile",
      dedupeKey: `press_release_removed_${articleType}`,
    });
  } catch (notifyErr) {
    logger.warn(`Failed to notify author of ${kindLabel(kind)} removal:`, notifyErr.message);
  }
}

module.exports = {
  DIRECTOR_ARTICLE_ID_RE,
  parseDirectorArticleId,
  isArticleLive,
  kindLabel,
  softRemoveDirectorArticle,
};
