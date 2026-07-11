// User news submission callables: submit for approval plus the admin
// pending-list/approve/reject flow. Extracted verbatim from
// triggers/newsGeneration.js.

const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { logger } = require("firebase-functions/v2");
const { defineSecret } = require("firebase-functions/params");
const { FieldValue } = require("firebase-admin/firestore");
const { getDb } = require("../config");
const { brevoApiKey } = require("../helpers/emailService");
const { assertAuth, assertAdmin } = require("../helpers/callableGuards");
const {
  AUTO_PUBLISH_THRESHOLD,
  computeNextAutoPublishAt,
  resolveAuthorCredit,
  publishSubmission,
} = require("../helpers/newsSubmissionsShared");

const geminiApiKey = defineSecret("GOOGLE_GENERATIVE_AI_API_KEY");

const DATA_NAMESPACE = () => process.env.DATA_NAMESPACE || "marching-art";

/** Firestore path to a user's profile data doc. */
function profileDataRef(db, uid) {
  return db
    .collection("artifacts")
    .doc(DATA_NAMESPACE())
    .collection("users")
    .doc(uid)
    .collection("profile")
    .doc("data");
}

// =============================================================================
// USER NEWS SUBMISSIONS
// =============================================================================

/**
 * Submit a news article for admin approval.
 *
 * Any authenticated user can submit. Authors who have had at least
 * AUTO_PUBLISH_THRESHOLD articles approved by an admin are "trusted": their new
 * submissions skip the manual queue and are scheduled to publish automatically
 * at 2 PM Eastern (handled by the autoPublishScheduledSubmissions job).
 */
exports.submitNewsForApproval = onCall(
  {
    cors: true,
    timeoutSeconds: 30,
    secrets: [brevoApiKey],
  },
  async (request) => {
    assertAuth(request);

    const db = getDb();
    const { headline, summary, fullStory, category, imageUrl, imageOption } = request.data || {};

    // Validate required fields
    if (!headline || typeof headline !== "string" || headline.trim().length < 10) {
      throw new HttpsError("invalid-argument", "Headline must be at least 10 characters");
    }

    if (!summary || typeof summary !== "string" || summary.trim().length < 20) {
      throw new HttpsError("invalid-argument", "Summary must be at least 20 characters");
    }

    if (!fullStory || typeof fullStory !== "string" || fullStory.trim().length < 100) {
      throw new HttpsError("invalid-argument", "Full story must be at least 100 characters");
    }

    const validCategories = ["dci", "fantasy", "analysis"];
    if (!category || !validCategories.includes(category)) {
      throw new HttpsError("invalid-argument", "Invalid category");
    }

    // The author's image preference, respected on publish. Defaults to
    // generating an image; "submitted" requires a URL, "none" carries no image.
    const validImageOptions = ["generate", "submitted", "none"];
    const authorImageOption = validImageOptions.includes(imageOption) ? imageOption : "generate";

    // Only keep a URL when the author chose to supply their own image.
    let submittedImageUrl = null;
    if (authorImageOption === "submitted") {
      if (!imageUrl || typeof imageUrl !== "string" || !imageUrl.trim()) {
        throw new HttpsError("invalid-argument", "An image URL is required when supplying your own image");
      }
      try {
        new URL(imageUrl);
      } catch {
        throw new HttpsError("invalid-argument", "Invalid image URL");
      }
      submittedImageUrl = imageUrl.trim();
    }

    try {
      // Resolve author credit (name, username, location) and their approved count.
      const credit = await resolveAuthorCredit(db, request.auth.uid);

      // Trusted authors (3+ admin approvals) get their articles auto-published
      // at the next 2 PM Eastern rather than waiting in the admin queue.
      const isTrustedAuthor = credit.approvedCount >= AUTO_PUBLISH_THRESHOLD;
      const scheduledPublishAt = isTrustedAuthor ? computeNextAutoPublishAt() : null;

      // Create the submission
      const submission = {
        headline: headline.trim(),
        summary: summary.trim(),
        fullStory: fullStory.trim(),
        category,
        imageUrl: submittedImageUrl,
        // Author's image preference: "generate" | "submitted" | "none".
        imageOption: authorImageOption,
        status: isTrustedAuthor ? "scheduled" : "pending", // pending | scheduled | approved | rejected
        authorUid: request.auth.uid,
        authorName: credit.authorName,
        authorUsername: credit.authorUsername,
        authorLocation: credit.authorLocation,
        authorEmail: request.auth.token.email || null,
        // Auto-publish scheduling (only for trusted authors)
        autoPublish: isTrustedAuthor,
        scheduledPublishAt,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const docRef = await db.collection("news_submissions").add(submission);

      logger.info("News submission received:", {
        submissionId: docRef.id,
        authorUid: request.auth.uid,
        headline: headline.substring(0, 50),
        autoPublish: isTrustedAuthor,
      });

      // Notify admins. Wrapped so an email failure never breaks the user's submission.
      try {
        const { fanOutToAdmins, sendAdminArticleSubmissionEmail } =
          require("../helpers/emailService");
        await fanOutToAdmins(sendAdminArticleSubmissionEmail, {
          submissionId: docRef.id,
          headline: submission.headline,
          summary: submission.summary,
          authorName: submission.authorName,
          category: submission.category,
        });
      } catch (notifyErr) {
        logger.warn("Failed to notify admins of new submission:", notifyErr.message);
      }

      return {
        success: true,
        message: isTrustedAuthor
          ? "Article scheduled — as a trusted author it will publish automatically at 2 PM Eastern."
          : "Article submitted for review. An admin will review it shortly.",
        submissionId: docRef.id,
        autoPublish: isTrustedAuthor,
        scheduledPublishAt: scheduledPublishAt ? scheduledPublishAt.toISOString() : null,
      };
    } catch (error) {
      logger.error("Error submitting news article:", error);
      if (error instanceof HttpsError) throw error;
      throw new HttpsError("internal", "Failed to submit article. Please try again.");
    }
  }
);

// =============================================================================
// ADMIN ARTICLE MANAGEMENT
// =============================================================================

/**
 * List all pending article submissions for admin review
 */
exports.listPendingSubmissions = onCall(
  {
    cors: true,
    timeoutSeconds: 30,
  },
  async (request) => {
    assertAdmin(request);

    const db = getDb();
    const { status = "pending", limit = 50 } = request.data || {};

    try {
      let query = db.collection("news_submissions").orderBy("createdAt", "desc");

      if (status !== "all") {
        query = query.where("status", "==", status);
      }

      const snapshot = await query.limit(limit).get();

      const submissions = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate?.()?.toISOString() || null,
        updatedAt: doc.data().updatedAt?.toDate?.()?.toISOString() || null,
        scheduledPublishAt: doc.data().scheduledPublishAt?.toDate?.()?.toISOString() || null,
      }));

      return {
        success: true,
        submissions,
        count: submissions.length,
      };
    } catch (error) {
      logger.error("Error listing submissions:", error);
      throw new HttpsError("internal", "Failed to list submissions");
    }
  }
);

/**
 * Approve an article submission and publish it.
 *
 * Publishing generates a Fantasy Daily-style header image (article #5 prompt)
 * and stamps full author credit onto the article. Each admin approval also
 * advances the author's approved-article count; once it reaches
 * AUTO_PUBLISH_THRESHOLD their future submissions auto-publish.
 *
 * imageOption: 'submitted' | 'generate' | 'none'
 */
exports.approveSubmission = onCall(
  {
    cors: true,
    timeoutSeconds: 120,
    memory: "1GiB",
    secrets: [geminiApiKey],
  },
  async (request) => {
    assertAdmin(request);

    const db = getDb();
    // Support both old 'generateImage' boolean and new 'imageOption' string
    const { submissionId, generateImage, imageOption } = request.data || {};

    if (!submissionId) {
      throw new HttpsError("invalid-argument", "Submission ID is required");
    }

    try {
      // Get the submission
      const submissionRef = db.collection("news_submissions").doc(submissionId);
      const submissionDoc = await submissionRef.get();

      if (!submissionDoc.exists) {
        throw new HttpsError("not-found", "Submission not found");
      }

      const submission = submissionDoc.data();

      if (submission.status === "approved") {
        throw new HttpsError("failed-precondition", "This submission has already been approved");
      }

      // Determine image handling. An explicit admin choice (imageOption) wins;
      // otherwise fall back to the author's stored preference so a "no image" or
      // "use my URL" flag is never silently overridden with an AI image.
      let effectiveOption = imageOption;
      if (!effectiveOption) {
        if (generateImage === true) {
          effectiveOption = submission.imageUrl ? "submitted" : "generate";
        } else if (generateImage === false) {
          effectiveOption = "none";
        } else {
          effectiveOption = submission.imageOption || (submission.imageUrl ? "submitted" : "generate");
        }
      }

      const { articlePath, imageUrl: finalImageUrl } = await publishSubmission(db, {
        submissionRef,
        submission,
        submissionId,
        approvedBy: request.auth.uid,
        imageOption: effectiveOption,
        autoPublished: false,
      });

      // Credit the author with an admin approval. Once they cross the threshold,
      // their future submissions auto-publish. Wrapped so a counter failure
      // never fails an otherwise-successful publish.
      try {
        await profileDataRef(db, submission.authorUid).set(
          {
            articleStats: {
              approvedCount: FieldValue.increment(1),
              lastApprovedAt: new Date(),
            },
          },
          { merge: true }
        );
      } catch (counterErr) {
        logger.warn("Failed to increment author approved count:", counterErr.message);
      }

      logger.info("Article approved and published:", {
        submissionId,
        articlePath,
        hasImage: !!finalImageUrl,
      });

      return {
        success: true,
        message: "Article approved and published successfully",
        articlePath,
        imageUrl: finalImageUrl,
      };
    } catch (error) {
      logger.error("Error approving submission:", error);
      if (error instanceof HttpsError) throw error;
      throw new HttpsError("internal", "Failed to approve submission");
    }
  }
);

/**
 * Reject an article submission
 */
exports.rejectSubmission = onCall(
  {
    cors: true,
    timeoutSeconds: 30,
  },
  async (request) => {
    assertAdmin(request);

    const db = getDb();
    const { submissionId, reason } = request.data || {};

    if (!submissionId) {
      throw new HttpsError("invalid-argument", "Submission ID is required");
    }

    try {
      const submissionRef = db.collection("news_submissions").doc(submissionId);
      const submissionDoc = await submissionRef.get();

      if (!submissionDoc.exists) {
        throw new HttpsError("not-found", "Submission not found");
      }

      const submission = submissionDoc.data();

      // Allow rejecting both queued (pending) and auto-scheduled submissions.
      if (submission.status !== "pending" && submission.status !== "scheduled") {
        throw new HttpsError("failed-precondition", "This submission has already been processed");
      }

      await submissionRef.update({
        status: "rejected",
        autoPublish: false,
        rejectionReason: reason || "Does not meet our content guidelines",
        rejectedBy: request.auth.uid,
        updatedAt: new Date(),
      });

      logger.info("Article rejected:", { submissionId, reason });

      return {
        success: true,
        message: "Submission rejected",
      };
    } catch (error) {
      logger.error("Error rejecting submission:", error);
      if (error instanceof HttpsError) throw error;
      throw new HttpsError("internal", "Failed to reject submission");
    }
  }
);

module.exports = {
  submitNewsForApproval: exports.submitNewsForApproval,
  listPendingSubmissions: exports.listPendingSubmissions,
  approveSubmission: exports.approveSubmission,
  rejectSubmission: exports.rejectSubmission,
};
