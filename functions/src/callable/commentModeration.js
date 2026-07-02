/**
 * Admin comment-moderation callables. Extracted from callable/articleComments.js.
 */

const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { logger } = require("firebase-functions/v2");
const { getDb } = require("../config");

// =============================================================================
// ADMIN MODERATION FUNCTIONS
// =============================================================================

/**
 * Check if user is admin - helper function
 */
function checkAdminAuth(auth) {
  if (!auth) {
    throw new HttpsError("unauthenticated", "User must be authenticated");
  }

  if (!auth.token || !auth.token.admin) {
    throw new HttpsError("permission-denied", "Only admins can access this function");
  }
}

/**
 * List comments for moderation
 * Admin-only function to view all comments across articles
 */
exports.listCommentsForModeration = onCall(
  {
    cors: true,
    timeoutSeconds: 60,
  },
  async (request) => {
    checkAdminAuth(request.auth);

    const db = getDb();
    const { status = "pending", limit = 50, startAfter } = request.data || {};

    try {
      // Build query with where() before orderBy() for Firestore best practices
      let query = db.collection("article_comments");

      if (status !== "all") {
        query = query.where("status", "==", status);
      }

      query = query.orderBy("createdAt", "desc");

      if (startAfter) {
        const startDoc = await db.collection("article_comments").doc(startAfter).get();
        if (startDoc.exists) {
          query = query.startAfter(startDoc);
        }
      }

      query = query.limit(limit + 1);

      const snapshot = await query.get();
      const comments = [];
      const docs = snapshot.docs.slice(0, limit);

      // Collect unique article IDs to fetch headlines
      const articleIds = new Set();
      for (const doc of docs) {
        articleIds.add(doc.data().articleId);
      }

      // Fetch article headlines (from collection group query)
      const articleHeadlines = {};
      if (articleIds.size > 0) {
        // Note: orderBy is required to match the composite index (isPublished + createdAt)
        const articlesSnapshot = await db.collectionGroup("articles")
          .where("isPublished", "==", true)
          .orderBy("createdAt", "desc")
          .limit(500)
          .get();

        for (const doc of articlesSnapshot.docs) {
          const pathParts = doc.ref.path.split("/");
          const dayId = pathParts[3];
          const articleType = doc.id;
          const compositeId = `${dayId}_${articleType}`;

          if (articleIds.has(compositeId)) {
            articleHeadlines[compositeId] = doc.data().headline || "Untitled";
          }
        }
      }

      for (const doc of docs) {
        const data = doc.data();
        comments.push({
          id: doc.id,
          ...data,
          articleHeadline: articleHeadlines[data.articleId] || "Unknown Article",
          createdAt: data.createdAt?.toDate?.()?.toISOString() || new Date().toISOString(),
          updatedAt: data.updatedAt?.toDate?.()?.toISOString() || data.createdAt?.toDate?.()?.toISOString(),
          editedAt: data.editedAt?.toDate?.()?.toISOString() || null,
          moderatedAt: data.moderatedAt?.toDate?.()?.toISOString() || null,
        });
      }

      // Get counts for each status
      const [pendingCount, approvedCount, rejectedCount, hiddenCount] = await Promise.all([
        db.collection("article_comments").where("status", "==", "pending").count().get(),
        db.collection("article_comments").where("status", "==", "approved").count().get(),
        db.collection("article_comments").where("status", "==", "rejected").count().get(),
        db.collection("article_comments").where("status", "==", "hidden").count().get(),
      ]);

      return {
        success: true,
        comments,
        hasMore: snapshot.docs.length > limit,
        counts: {
          pending: pendingCount.data().count,
          approved: approvedCount.data().count,
          rejected: rejectedCount.data().count,
          hidden: hiddenCount.data().count,
          total: pendingCount.data().count + approvedCount.data().count + rejectedCount.data().count + hiddenCount.data().count,
        },
      };
    } catch (error) {
      logger.error("Error listing comments for moderation:", error);
      throw new HttpsError("internal", "Failed to list comments");
    }
  }
);

/**
 * Moderate a single comment
 * Admin-only function to approve, reject, or hide a comment
 */
exports.moderateComment = onCall(
  {
    cors: true,
    timeoutSeconds: 30,
  },
  async (request) => {
    checkAdminAuth(request.auth);

    const db = getDb();
    const { commentId, action, reason } = request.data || {};

    if (!commentId || typeof commentId !== "string") {
      throw new HttpsError("invalid-argument", "Comment ID is required");
    }

    const validActions = ["approve", "reject", "hide"];
    if (!action || !validActions.includes(action)) {
      throw new HttpsError("invalid-argument", `Action must be one of: ${validActions.join(", ")}`);
    }

    try {
      const commentRef = db.collection("article_comments").doc(commentId);
      const commentDoc = await commentRef.get();

      if (!commentDoc.exists) {
        throw new HttpsError("not-found", "Comment not found");
      }

      const commentData = commentDoc.data();

      // Map action to status
      const statusMap = {
        approve: "approved",
        reject: "rejected",
        hide: "hidden",
      };

      const now = new Date();
      const updates = {
        status: statusMap[action],
        moderatedAt: now,
        moderatedBy: request.auth.uid,
        moderationReason: reason || null,
        updatedAt: now,
      };

      await commentRef.update(updates);

      logger.info("Comment moderated:", {
        commentId,
        action,
        moderatedBy: request.auth.uid,
      });

      return {
        success: true,
        comment: {
          id: commentId,
          ...commentData,
          ...updates,
          createdAt: commentData.createdAt?.toDate?.()?.toISOString() || new Date().toISOString(),
          updatedAt: now.toISOString(),
          moderatedAt: now.toISOString(),
        },
        message: `Comment ${action === "approve" ? "approved" : action === "reject" ? "rejected" : "hidden"} successfully`,
      };
    } catch (error) {
      if (error instanceof HttpsError) throw error;
      logger.error("Error moderating comment:", error);
      throw new HttpsError("internal", "Failed to moderate comment");
    }
  }
);

/**
 * Bulk moderate multiple comments
 * Admin-only function to moderate multiple comments at once
 */
exports.bulkModerateComments = onCall(
  {
    cors: true,
    timeoutSeconds: 120,
  },
  async (request) => {
    checkAdminAuth(request.auth);

    const db = getDb();
    const { commentIds, action, reason } = request.data || {};

    if (!Array.isArray(commentIds) || commentIds.length === 0) {
      throw new HttpsError("invalid-argument", "Comment IDs array is required");
    }

    if (commentIds.length > 100) {
      throw new HttpsError("invalid-argument", "Maximum 100 comments per batch");
    }

    const validActions = ["approve", "reject", "hide"];
    if (!action || !validActions.includes(action)) {
      throw new HttpsError("invalid-argument", `Action must be one of: ${validActions.join(", ")}`);
    }

    // Map action to status
    const statusMap = {
      approve: "approved",
      reject: "rejected",
      hide: "hidden",
    };

    try {
      const now = new Date();
      let moderated = 0;
      let failed = 0;

      // Process in batches of 500 (Firestore limit)
      const batch = db.batch();

      for (const commentId of commentIds) {
        try {
          const commentRef = db.collection("article_comments").doc(commentId);
          batch.update(commentRef, {
            status: statusMap[action],
            moderatedAt: now,
            moderatedBy: request.auth.uid,
            moderationReason: reason || null,
            updatedAt: now,
          });
          moderated++;
        } catch {
          failed++;
        }
      }

      await batch.commit();

      logger.info("Bulk moderation completed:", {
        action,
        moderated,
        failed,
        moderatedBy: request.auth.uid,
      });

      return {
        success: true,
        moderated,
        failed,
        message: `${moderated} comment(s) ${action === "approve" ? "approved" : action === "reject" ? "rejected" : "hidden"} successfully`,
      };
    } catch (error) {
      logger.error("Error in bulk moderation:", error);
      throw new HttpsError("internal", "Failed to moderate comments");
    }
  }
);

// =============================================================================
// ARTICLE ENGAGEMENT (Combined reactions + comments count)
// =============================================================================

