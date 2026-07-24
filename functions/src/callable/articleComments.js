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
const { brevoApiKey } = require("../helpers/emailService");
const { hasAdminClaim, assertAuthWithBudget } = require("../helpers/callableGuards");

// Maximum comment length
const MAX_COMMENT_LENGTH = 1000;

// Maximum report-reason length
const MAX_REPORT_REASON_LENGTH = 500;

// getArticleComments page-size clamp (the client's `limit` is a suggestion)
const DEFAULT_COMMENTS_PAGE_SIZE = 20;
const MAX_COMMENTS_PAGE_SIZE = 50;

// Valid emoji reactions
const VALID_REACTIONS = ['👏', '🔥', '💯', '🎺', '❤️', '🤔', '🏳️', '🥁'];

// =============================================================================
// ARTICLE REACTIONS
// =============================================================================

/**
 * Toggle a reaction on an article
 * - If user has no reaction: add the reaction
 * - If user has same reaction: remove it
 * - If user has different reaction: change to new one
 */
exports.toggleArticleReaction = onCall(
  {
    cors: true,
    timeoutSeconds: 30,
  },
  async (request) => {
    const db = getDb();
    // Abuse throttle (shared comments bucket) — far above any human rate.
    await assertAuthWithBudget(db, request, "comments", { max: 30, windowMs: 10 * 60 * 1000 });

    const { articleId, emoji } = request.data || {};

    if (!articleId || typeof articleId !== "string") {
      throw new HttpsError("invalid-argument", "Article ID is required");
    }

    if (!emoji || !VALID_REACTIONS.includes(emoji)) {
      throw new HttpsError("invalid-argument", "Invalid reaction emoji");
    }

    const userId = request.auth.uid;
    const userReactionId = `${articleId}_${userId}`;

    try {
      const result = await db.runTransaction(async (transaction) => {
        // Get the user's current reaction (if any)
        const userReactionRef = db.collection("article_user_reactions").doc(userReactionId);
        const userReactionDoc = await transaction.get(userReactionRef);

        // Get the article's aggregate reaction counts
        const articleReactionsRef = db.collection("article_reactions").doc(articleId);
        const articleReactionsDoc = await transaction.get(articleReactionsRef);

        // Initialize counts if document doesn't exist
        let counts = articleReactionsDoc.exists
          ? articleReactionsDoc.data()
          : { '👏': 0, '🔥': 0, '💯': 0, '🎺': 0, '❤️': 0, '🤔': 0, '🏳️': 0, '🥁': 0, total: 0 };

        let action;
        let resultEmoji;

        if (userReactionDoc.exists) {
          const currentEmoji = userReactionDoc.data().emoji;

          if (currentEmoji === emoji) {
            // Same emoji - remove the reaction
            transaction.delete(userReactionRef);
            counts[currentEmoji] = Math.max(0, (counts[currentEmoji] || 0) - 1);
            counts.total = Math.max(0, (counts.total || 0) - 1);
            action = "removed";
            resultEmoji = null;
          } else {
            // Different emoji - change the reaction
            transaction.update(userReactionRef, {
              emoji,
              updatedAt: new Date(),
            });
            counts[currentEmoji] = Math.max(0, (counts[currentEmoji] || 0) - 1);
            counts[emoji] = (counts[emoji] || 0) + 1;
            action = "changed";
            resultEmoji = emoji;
          }
        } else {
          // No existing reaction - add new one
          transaction.set(userReactionRef, {
            articleId,
            userId,
            emoji,
            createdAt: new Date(),
          });
          counts[emoji] = (counts[emoji] || 0) + 1;
          counts.total = (counts.total || 0) + 1;
          action = "added";
          resultEmoji = emoji;
        }

        // Update the aggregate counts
        transaction.set(articleReactionsRef, counts);

        return { action, emoji: resultEmoji };
      });

      logger.info("Article reaction toggled:", {
        articleId,
        userId,
        action: result.action,
        emoji: result.emoji,
      });

      return {
        success: true,
        action: result.action,
        emoji: result.emoji,
      };
    } catch (error) {
      logger.error("Error toggling article reaction:", error);
      throw new HttpsError("internal", "Failed to toggle reaction");
    }
  }
);

/**
 * Get reactions for an article
 * Returns counts for each emoji and the user's current reaction (if logged in)
 */
exports.getArticleReactions = onCall(
  {
    cors: true,
    timeoutSeconds: 30,
  },
  async (request) => {
    const db = getDb();
    const { articleId } = request.data || {};

    if (!articleId || typeof articleId !== "string") {
      throw new HttpsError("invalid-argument", "Article ID is required");
    }

    try {
      // Get aggregate counts
      const articleReactionsRef = db.collection("article_reactions").doc(articleId);
      const articleReactionsDoc = await articleReactionsRef.get();

      const counts = articleReactionsDoc.exists
        ? articleReactionsDoc.data()
        : { '👏': 0, '🔥': 0, '💯': 0, '🎺': 0, '❤️': 0, '🤔': 0, '🏳️': 0, '🥁': 0, total: 0 };

      // Get user's reaction if logged in
      let userReaction = null;
      if (request.auth) {
        const userReactionId = `${articleId}_${request.auth.uid}`;
        const userReactionDoc = await db.collection("article_user_reactions").doc(userReactionId).get();
        if (userReactionDoc.exists) {
          userReaction = userReactionDoc.data().emoji;
        }
      }

      return {
        success: true,
        counts,
        userReaction,
      };
    } catch (error) {
      logger.error("Error getting article reactions:", error);
      throw new HttpsError("internal", "Failed to get reactions");
    }
  }
);

// =============================================================================
// USER COMMENT FUNCTIONS
// =============================================================================

/**
 * Add a new comment to an article
 * Comments from users registered for more than 24 hours are auto-approved.
 * Comments from newer users start in 'pending' status and require moderation.
 */
exports.addArticleComment = onCall(
  {
    cors: true,
    timeoutSeconds: 30,
  },
  async (request) => {
    const db = getDb();
    // Abuse throttle (shared comments bucket) — far above any human rate.
    await assertAuthWithBudget(db, request, "comments", { max: 30, windowMs: 10 * 60 * 1000 });

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

      // Check if user has been registered for more than 24 hours
      const now = new Date();
      const TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000;
      let autoApprove = false;

      if (userData.createdAt) {
        const userCreatedAt = userData.createdAt.toDate ? userData.createdAt.toDate() : new Date(userData.createdAt);
        const accountAgeMs = now.getTime() - userCreatedAt.getTime();
        autoApprove = accountAgeMs >= TWENTY_FOUR_HOURS_MS;
      }

      // Create the comment
      const commentData = {
        articleId,
        userId: request.auth.uid,
        userName,
        userTitle,
        content: trimmedContent,
        status: autoApprove ? "approved" : "pending",
        createdAt: now,
        updatedAt: now,
        isEdited: false,
      };

      const docRef = await db.collection("article_comments").add(commentData);

      logger.info("Comment added:", {
        commentId: docRef.id,
        articleId,
        userId: request.auth.uid,
        autoApproved: autoApprove,
      });

      return {
        success: true,
        comment: {
          id: docRef.id,
          ...commentData,
          createdAt: now.toISOString(),
          updatedAt: now.toISOString(),
        },
        message: autoApprove ? "Comment posted" : "Comment submitted for review",
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
    const { articleId, status = "approved", limit, startAfter } = request.data || {};

    if (!articleId || typeof articleId !== "string") {
      throw new HttpsError("invalid-argument", "Article ID is required");
    }

    // Page size is client-suggested but server-clamped: an unbounded limit
    // would let one call read (and bill) an arbitrarily large result set.
    const parsedLimit = parseInt(limit, 10);
    const pageSize = Number.isFinite(parsedLimit)
      ? Math.min(Math.max(parsedLimit, 1), MAX_COMMENTS_PAGE_SIZE)
      : DEFAULT_COMMENTS_PAGE_SIZE;

    if (startAfter !== undefined && startAfter !== null && typeof startAfter !== "string") {
      throw new HttpsError("invalid-argument", "startAfter must be a comment ID string");
    }

    try {
      let query = db.collection("article_comments")
        .where("articleId", "==", articleId);

      // Non-admins can only see approved comments (plus their own pending ones handled client-side)
      const isAdmin = hasAdminClaim(request);

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

      query = query.limit(pageSize + 1);

      const snapshot = await query.get();

      const comments = [];
      const docs = snapshot.docs.slice(0, pageSize);

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
        hasMore: snapshot.docs.length > pageSize,
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
    const db = getDb();
    // Abuse throttle (shared comments bucket) — far above any human rate.
    await assertAuthWithBudget(db, request, "comments", { max: 30, windowMs: 10 * 60 * 1000 });

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
    const db = getDb();
    // Abuse throttle (shared comments bucket) — far above any human rate.
    await assertAuthWithBudget(db, request, "comments", { max: 30, windowMs: 10 * 60 * 1000 });

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
      const isAdmin = hasAdminClaim(request);

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
    secrets: [brevoApiKey],
  },
  async (request) => {
    const db = getDb();
    // Abuse throttle (shared comments bucket) — far above any human rate.
    await assertAuthWithBudget(db, request, "comments", { max: 30, windowMs: 10 * 60 * 1000 });

    const { commentId, reason } = request.data || {};

    if (!commentId || typeof commentId !== "string") {
      throw new HttpsError("invalid-argument", "Comment ID is required");
    }

    if (!reason || typeof reason !== "string" || reason.trim().length < 5) {
      throw new HttpsError("invalid-argument", "Please provide a reason for the report");
    }

    if (reason.trim().length > MAX_REPORT_REASON_LENGTH) {
      throw new HttpsError(
        "invalid-argument",
        `Report reason too long (max ${MAX_REPORT_REASON_LENGTH} characters)`
      );
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
      const reportRef = await db.collection("article_comments_reports").add({
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

      // Notify admins. Best-effort: never bubble up email failures to the reporter.
      try {
        const { fanOutToAdmins, sendAdminCommentReportEmail } =
          require("../helpers/emailService");
        const reporterRecord = await require("firebase-admin")
          .auth()
          .getUser(request.auth.uid)
          .catch(() => null);
        const commentExcerpt = (commentData.content || commentData.text || "")
          .toString()
          .slice(0, 240);

        await fanOutToAdmins(sendAdminCommentReportEmail, {
          reportId: reportRef.id,
          reason: reason.trim(),
          commentExcerpt,
          commentAuthor: commentData.username || commentData.displayName || null,
          reporterName: reporterRecord?.displayName || reporterRecord?.email || null,
          articleId: commentData.articleId || null,
        });
      } catch (notifyErr) {
        logger.warn("Failed to notify admins of comment report:", notifyErr.message);
      }

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
      const defaultReactionCounts = { '👏': 0, '🔥': 0, '💯': 0, '🎺': 0, '❤️': 0, '🤔': 0, '🏳️': 0, '🥁': 0, total: 0 };
      const userId = request.auth?.uid;

      // Build parallel queries
      const queries = [
        // Run all comment count queries in parallel
        Promise.all(
          articleIds.map(articleId =>
            db.collection("article_comments")
              .where("articleId", "==", articleId)
              .where("status", "==", "approved")
              .count()
              .get()
              .then(result => ({ articleId, count: result.data().count }))
          )
        ),
        // Batch fetch all reaction documents in a single Firestore call
        db.getAll(
          ...articleIds.map(articleId =>
            db.collection("article_reactions").doc(articleId)
          )
        ).catch(() => []) // Handle case where collection doesn't exist
      ];

      // If user is authenticated, also fetch their reactions
      if (userId) {
        queries.push(
          db.getAll(
            ...articleIds.map(articleId =>
              db.collection("article_user_reactions").doc(`${articleId}_${userId}`)
            )
          ).catch(() => [])
        );
      }

      const results = await Promise.all(queries);
      const [commentCountResults, reactionDocs] = results;
      const userReactionDocs = userId ? results[2] : [];

      // Build lookup maps for O(1) access
      const commentCountMap = new Map(
        commentCountResults.map(({ articleId, count }) => [articleId, count])
      );

      const reactionCountMap = new Map(
        reactionDocs.map((doc, index) => [
          articleIds[index],
          doc.exists ? doc.data() : defaultReactionCounts
        ])
      );

      const userReactionMap = new Map(
        userReactionDocs.map((doc, index) => [
          articleIds[index],
          doc.exists ? doc.data().emoji : null
        ])
      );

      // Assemble final engagement object
      for (const articleId of articleIds) {
        engagement[articleId] = {
          commentCount: commentCountMap.get(articleId) || 0,
          reactionCounts: reactionCountMap.get(articleId) || defaultReactionCounts,
          userReaction: userReactionMap.get(articleId) || null,
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
