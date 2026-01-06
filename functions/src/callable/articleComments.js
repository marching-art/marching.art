/**
 * Article Comments - Cloud Functions for article comment system
 *
 * Handles user comments on news articles with moderation workflow.
 * Comments require moderation before being visible to other users.
 *
 * Collections:
 * - article_comments: All comments across all articles
 * - article_comments_reports: Reports on inappropriate comments
 */

const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { logger } = require("firebase-functions/v2");
const { getDb } = require("../config");
const { FieldValue } = require("firebase-admin/firestore");

// Maximum comment length
const MAX_COMMENT_LENGTH = 1000;

// =============================================================================
// USER COMMENT FUNCTIONS
// =============================================================================

/**
 * Add a new comment to an article
 * Comments start in 'pending' status and require moderation
 */
exports.addArticleComment = onCall(
  {
    cors: true,
    timeoutSeconds: 30,
  },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "You must be signed in to comment");
    }

    const db = getDb();
    const { articleId, content } = request.data || {};

    if (!articleId || typeof articleId !== "string") {
      throw new HttpsError("invalid-argument", "Article ID is required");
    }

    if (!content || typeof content !== "string") {
      throw new HttpsError("invalid-argument", "Comment content is required");
    }

    const trimmedContent = content.trim();
    if (trimmedContent.length === 0) {
      throw new HttpsError("invalid-argument", "Comment cannot be empty");
    }

    if (trimmedContent.length > MAX_COMMENT_LENGTH) {
      throw new HttpsError("invalid-argument", `Comment too long (max ${MAX_COMMENT_LENGTH} characters)`);
    }

    try {
      // Get user profile for display name
      const userDoc = await db
        .collection("artifacts")
        .doc(process.env.DATA_NAMESPACE || "marching-art")
        .collection("users")
        .doc(request.auth.uid)
        .collection("profile")
        .doc("data")
        .get();

      const userData = userDoc.exists ? userDoc.data() : {};
      const userName = userData.displayName || userData.username || "Anonymous";
      const userTitle = userData.title || null;

      // Create the comment
      const now = new Date();
      const commentData = {
        articleId,
        userId: request.auth.uid,
        userName,
        userTitle,
        content: trimmedContent,
        status: "pending", // Requires moderation
        createdAt: now,
        updatedAt: now,
        isEdited: false,
      };

      const docRef = await db.collection("article_comments").add(commentData);

      logger.info("Comment added:", {
        commentId: docRef.id,
        articleId,
        userId: request.auth.uid,
      });

      return {
        success: true,
        comment: {
          id: docRef.id,
          ...commentData,
          createdAt: now.toISOString(),
          updatedAt: now.toISOString(),
        },
        message: "Comment submitted for review",
      };
    } catch (error) {
      logger.error("Error adding comment:", error);
      throw new HttpsError("internal", "Failed to add comment");
    }
  }
);

/**
 * Get comments for an article
 * Regular users only see approved comments + their own pending comments
 */
exports.getArticleComments = onCall(
  {
    cors: true,
    timeoutSeconds: 30,
  },
  async (request) => {
    const db = getDb();
    const { articleId, status = "approved", limit = 20, startAfter } = request.data || {};

    if (!articleId || typeof articleId !== "string") {
      throw new HttpsError("invalid-argument", "Article ID is required");
    }

    try {
      let query = db.collection("article_comments")
        .where("articleId", "==", articleId);

      // Non-admins can only see approved comments (plus their own pending ones handled client-side)
      const isAdmin = request.auth?.token?.admin === true;

      if (status === "all" && isAdmin) {
        // Admin can see all
      } else if (status === "approved" || !isAdmin) {
        query = query.where("status", "==", "approved");
      } else {
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

      for (const doc of docs) {
        const data = doc.data();
        comments.push({
          id: doc.id,
          ...data,
          createdAt: data.createdAt?.toDate?.()?.toISOString() || new Date().toISOString(),
          updatedAt: data.updatedAt?.toDate?.()?.toISOString() || data.createdAt?.toDate?.()?.toISOString(),
          editedAt: data.editedAt?.toDate?.()?.toISOString() || null,
          moderatedAt: data.moderatedAt?.toDate?.()?.toISOString() || null,
        });
      }

      // Also include user's own pending comments if logged in
      if (request.auth && status === "approved") {
        const userPendingQuery = await db.collection("article_comments")
          .where("articleId", "==", articleId)
          .where("userId", "==", request.auth.uid)
          .where("status", "==", "pending")
          .get();

        for (const doc of userPendingQuery.docs) {
          const data = doc.data();
          // Add at beginning since these are typically newer
          comments.unshift({
            id: doc.id,
            ...data,
            createdAt: data.createdAt?.toDate?.()?.toISOString() || new Date().toISOString(),
            updatedAt: data.updatedAt?.toDate?.()?.toISOString() || data.createdAt?.toDate?.()?.toISOString(),
          });
        }
      }

      // Get total count of approved comments
      const countQuery = await db.collection("article_comments")
        .where("articleId", "==", articleId)
        .where("status", "==", "approved")
        .count()
        .get();

      return {
        success: true,
        comments,
        hasMore: snapshot.docs.length > limit,
        total: countQuery.data().count,
      };
    } catch (error) {
      logger.error("Error fetching comments:", error);
      throw new HttpsError("internal", "Failed to fetch comments");
    }
  }
);

/**
 * Edit an existing comment
 * Only the comment author can edit their own comments
 */
exports.editArticleComment = onCall(
  {
    cors: true,
    timeoutSeconds: 30,
  },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "You must be signed in");
    }

    const db = getDb();
    const { commentId, content } = request.data || {};

    if (!commentId || typeof commentId !== "string") {
      throw new HttpsError("invalid-argument", "Comment ID is required");
    }

    if (!content || typeof content !== "string") {
      throw new HttpsError("invalid-argument", "Content is required");
    }

    const trimmedContent = content.trim();
    if (trimmedContent.length === 0) {
      throw new HttpsError("invalid-argument", "Comment cannot be empty");
    }

    if (trimmedContent.length > MAX_COMMENT_LENGTH) {
      throw new HttpsError("invalid-argument", `Comment too long (max ${MAX_COMMENT_LENGTH} characters)`);
    }

    try {
      const commentRef = db.collection("article_comments").doc(commentId);
      const commentDoc = await commentRef.get();

      if (!commentDoc.exists) {
        throw new HttpsError("not-found", "Comment not found");
      }

      const commentData = commentDoc.data();

      // Only the author can edit
      if (commentData.userId !== request.auth.uid) {
        throw new HttpsError("permission-denied", "You can only edit your own comments");
      }

      // Can't edit hidden/rejected comments
      if (commentData.status === "hidden" || commentData.status === "rejected") {
        throw new HttpsError("failed-precondition", "Cannot edit this comment");
      }

      const now = new Date();
      const updates = {
        content: trimmedContent,
        updatedAt: now,
        editedAt: now,
        isEdited: true,
        // Reset to pending if was approved (re-moderation)
        status: commentData.status === "approved" ? "pending" : commentData.status,
      };

      await commentRef.update(updates);

      return {
        success: true,
        comment: {
          id: commentId,
          ...commentData,
          ...updates,
          createdAt: commentData.createdAt?.toDate?.()?.toISOString() || new Date().toISOString(),
          updatedAt: now.toISOString(),
          editedAt: now.toISOString(),
        },
        message: updates.status === "pending" ? "Comment updated and sent for re-review" : "Comment updated",
      };
    } catch (error) {
      if (error instanceof HttpsError) throw error;
      logger.error("Error editing comment:", error);
      throw new HttpsError("internal", "Failed to edit comment");
    }
  }
);

/**
 * Delete a comment
 * Only the comment author or admin can delete
 */
exports.deleteArticleComment = onCall(
  {
    cors: true,
    timeoutSeconds: 30,
  },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "You must be signed in");
    }

    const db = getDb();
    const { commentId } = request.data || {};

    if (!commentId || typeof commentId !== "string") {
      throw new HttpsError("invalid-argument", "Comment ID is required");
    }

    try {
      const commentRef = db.collection("article_comments").doc(commentId);
      const commentDoc = await commentRef.get();

      if (!commentDoc.exists) {
        throw new HttpsError("not-found", "Comment not found");
      }

      const commentData = commentDoc.data();
      const isAdmin = request.auth.token?.admin === true;

      // Only the author or admin can delete
      if (commentData.userId !== request.auth.uid && !isAdmin) {
        throw new HttpsError("permission-denied", "You can only delete your own comments");
      }

      await commentRef.delete();

      logger.info("Comment deleted:", {
        commentId,
        deletedBy: request.auth.uid,
        isAdmin,
      });

      return {
        success: true,
        message: "Comment deleted",
      };
    } catch (error) {
      if (error instanceof HttpsError) throw error;
      logger.error("Error deleting comment:", error);
      throw new HttpsError("internal", "Failed to delete comment");
    }
  }
);

/**
 * Report a comment for moderation review
 */
exports.reportArticleComment = onCall(
  {
    cors: true,
    timeoutSeconds: 30,
  },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "You must be signed in to report");
    }

    const db = getDb();
    const { commentId, reason } = request.data || {};

    if (!commentId || typeof commentId !== "string") {
      throw new HttpsError("invalid-argument", "Comment ID is required");
    }

    if (!reason || typeof reason !== "string" || reason.trim().length < 5) {
      throw new HttpsError("invalid-argument", "Please provide a reason for the report");
    }

    try {
      const commentRef = db.collection("article_comments").doc(commentId);
      const commentDoc = await commentRef.get();

      if (!commentDoc.exists) {
        throw new HttpsError("not-found", "Comment not found");
      }

      const commentData = commentDoc.data();

      // Can't report your own comment
      if (commentData.userId === request.auth.uid) {
        throw new HttpsError("invalid-argument", "You cannot report your own comment");
      }

      // Check for duplicate reports
      const existingReport = await db.collection("article_comments_reports")
        .where("commentId", "==", commentId)
        .where("reporterId", "==", request.auth.uid)
        .limit(1)
        .get();

      if (!existingReport.empty) {
        return {
          success: true,
          message: "You have already reported this comment",
        };
      }

      // Create report
      await db.collection("article_comments_reports").add({
        commentId,
        articleId: commentData.articleId,
        commentAuthorId: commentData.userId,
        reporterId: request.auth.uid,
        reason: reason.trim(),
        status: "pending",
        createdAt: new Date(),
      });

      // Update comment report count
      await commentRef.update({
        reportCount: FieldValue.increment(1),
      });

      logger.info("Comment reported:", {
        commentId,
        reporterId: request.auth.uid,
      });

      return {
        success: true,
        message: "Thank you for your report. Our team will review it.",
      };
    } catch (error) {
      if (error instanceof HttpsError) throw error;
      logger.error("Error reporting comment:", error);
      throw new HttpsError("internal", "Failed to submit report");
    }
  }
);

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
      let query = db.collection("article_comments")
        .orderBy("createdAt", "desc");

      if (status !== "all") {
        query = query.where("status", "==", status);
      }

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
        const articlesSnapshot = await db.collectionGroup("articles")
          .where("isPublished", "==", true)
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

/**
 * Get engagement data for multiple articles
 * Returns reaction counts and comment counts for each article
 */
exports.getArticleEngagement = onCall(
  {
    cors: true,
    timeoutSeconds: 30,
  },
  async (request) => {
    const db = getDb();
    const { articleIds } = request.data || {};

    if (!Array.isArray(articleIds) || articleIds.length === 0) {
      throw new HttpsError("invalid-argument", "Article IDs array is required");
    }

    if (articleIds.length > 50) {
      throw new HttpsError("invalid-argument", "Maximum 50 articles per request");
    }

    try {
      const engagement = {};

      for (const articleId of articleIds) {
        // Get approved comment count
        const commentCount = await db.collection("article_comments")
          .where("articleId", "==", articleId)
          .where("status", "==", "approved")
          .count()
          .get();

        // Get reaction counts (if reactions collection exists)
        let reactionCounts = { fire: 0, heart: 0, mindblown: 0, sad: 0, angry: 0 };
        try {
          const reactionsDoc = await db.collection("article_reactions").doc(articleId).get();
          if (reactionsDoc.exists) {
            reactionCounts = reactionsDoc.data().counts || reactionCounts;
          }
        } catch {
          // Reactions collection may not exist yet
        }

        engagement[articleId] = {
          commentCount: commentCount.data().count,
          reactionCounts,
        };
      }

      return {
        success: true,
        engagement,
      };
    } catch (error) {
      logger.error("Error getting article engagement:", error);
      throw new HttpsError("internal", "Failed to get engagement data");
    }
  }
);
