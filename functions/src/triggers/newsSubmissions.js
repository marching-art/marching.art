// @ts-nocheck -- grandfathered when functions checkJs landed (functions/tsconfig.json); remove when this file is typed or cleaned up
// User news submission callables: submit for approval plus the admin
// pending-list/approve/reject flow. Extracted verbatim from
// triggers/newsGeneration.js.

const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { logger } = require("firebase-functions/v2");
const { defineSecret } = require("firebase-functions/params");
const { FieldValue } = require("firebase-admin/firestore");
const { getDb } = require("../config");
const { brevoApiKey } = require("../helpers/emailService");
const { assertAuth, assertAdmin, assertWriteBudget } = require("../helpers/callableGuards");
const { cloudinarySecrets } = require("../helpers/mediaService");
const {
  AUTO_PUBLISH_THRESHOLD,
  computeNextAutoPublishAt,
  resolveAuthorCredit,
  publishSubmission,
  resolveOwnedCorps,
  validatePressReleaseInput,
  publishPressReleaseArticle,
} = require("../helpers/newsSubmissionsShared");
const { invalidateNewsCache } = require("./newsFeed");

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

    // Abuse throttle: each submission is a Firestore write plus an admin
    // email fan-out, so cap it well above any human authoring rate.
    await assertWriteBudget(db, request.auth.uid, "newsSubmissions", {
      max: 5,
      windowMs: 60 * 60 * 1000,
    });

    const { headline, summary, fullStory, category, imageUrl, imageOption } = request.data || {};

    // Validate required fields (min AND max lengths — these strings are
    // stored verbatim and rendered to admins/readers)
    if (!headline || typeof headline !== "string" || headline.trim().length < 10) {
      throw new HttpsError("invalid-argument", "Headline must be at least 10 characters");
    }
    if (headline.trim().length > 200) {
      throw new HttpsError("invalid-argument", "Headline cannot exceed 200 characters");
    }

    if (!summary || typeof summary !== "string" || summary.trim().length < 20) {
      throw new HttpsError("invalid-argument", "Summary must be at least 20 characters");
    }
    if (summary.trim().length > 500) {
      throw new HttpsError("invalid-argument", "Summary cannot exceed 500 characters");
    }

    if (!fullStory || typeof fullStory !== "string" || fullStory.trim().length < 100) {
      throw new HttpsError("invalid-argument", "Full story must be at least 100 characters");
    }
    if (fullStory.trim().length > 20000) {
      throw new HttpsError("invalid-argument", "Full story cannot exceed 20000 characters");
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
      let parsedUrl;
      try {
        parsedUrl = new URL(imageUrl);
      } catch {
        throw new HttpsError("invalid-argument", "Invalid image URL");
      }
      // Scheme allowlist: the URL is stored and later rendered as an <img>
      // src, so javascript:/data:/etc. must never make it into an article.
      if (parsedUrl.protocol !== "http:" && parsedUrl.protocol !== "https:") {
        throw new HttpsError("invalid-argument", "Image URL must use http or https");
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
// DIRECTOR PRESS RELEASES
// =============================================================================

/**
 * Publish a press release about the author's OWN corps — instantly, with no
 * admin review. This is the community-engagement counterpart to
 * submitNewsForApproval: news submissions cover the shared world and are
 * reviewed; press releases are a director speaking for their own organization
 * and go live immediately.
 *
 * Accountability without a review queue comes from three constraints:
 *   1. the author must own a registered corps (the release is bylined to it),
 *   2. a tight per-uid write budget throttles abuse, and
 *   3. anyone can be moderated after the fact — the author can delete their own
 *      release (deleteMyPressRelease) and admins can remove any article.
 */
exports.publishPressRelease = onCall(
  {
    cors: true,
    timeoutSeconds: 30,
  },
  async (request) => {
    assertAuth(request);

    const db = getDb();

    // Instant, unreviewed publishing — throttle hard. A director posting real
    // organizational news does so a handful of times a week, not per minute.
    await assertWriteBudget(db, request.auth.uid, "pressReleases", {
      max: 4,
      windowMs: 6 * 60 * 60 * 1000,
    });

    const { headline, summary, body, imageUrl, corpsClass } = request.data || {};

    const validation = validatePressReleaseInput({ headline, summary, body, imageUrl });
    if (!validation.valid) {
      throw new HttpsError("invalid-argument", validation.error);
    }

    // A press release must speak for a corps the author actually runs.
    const credit = await resolveAuthorCredit(db, request.auth.uid);
    const corps = resolveOwnedCorps(credit.corps, corpsClass);
    if (!corps) {
      throw new HttpsError(
        "failed-precondition",
        "Register a corps before publishing a press release — a release is issued by your organization."
      );
    }

    try {
      const result = await publishPressReleaseArticle(db, {
        id: db.collection("news_hub").doc().id, // collision-resistant article id
        cleaned: validation.cleaned,
        corps,
        author: {
          uid: request.auth.uid,
          authorName: credit.authorName,
          authorUsername: credit.authorUsername,
          authorLocation: credit.authorLocation,
        },
      });

      // Credit the author's contribution count. This feeds the automatic
      // writer tier (src/utils/writerTier.ts) — a director earns "Contributor"
      // and up purely from what they publish, no admin grant. Best-effort: a
      // counter failure never fails an otherwise-successful publish.
      try {
        await profileDataRef(db, request.auth.uid).set(
          {
            articleStats: {
              pressReleaseCount: FieldValue.increment(1),
              lastPressReleaseAt: new Date(),
            },
          },
          { merge: true }
        );
      } catch (counterErr) {
        logger.warn("Failed to increment author press-release count:", counterErr.message);
      }

      // The feed serves from a short-TTL server cache; drop it so the author
      // sees their release immediately rather than up to 5 minutes later.
      await invalidateNewsCache(db);

      logger.info("Press release published:", {
        articleId: result.articleId,
        authorUid: request.auth.uid,
        corpsName: corps.corpsName,
      });

      return {
        success: true,
        message: `Published — your ${corps.corpsName} press release is live.`,
        articleId: result.articleId,
        articlePath: result.articlePath,
      };
    } catch (error) {
      logger.error("Error publishing press release:", error);
      if (error instanceof HttpsError) throw error;
      throw new HttpsError("internal", "Failed to publish press release. Please try again.");
    }
  }
);

// Composite article id shape the feed uses: {seasonId}_day_{n}_press_{id}.
// seasonId may itself contain underscores, so the day marker anchors the parse.
const PRESS_ARTICLE_ID_RE = /^(.+)_(day_\d+)_(press_[A-Za-z0-9_-]+)$/;

/**
 * Delete a press release the caller authored (admins may delete any). The
 * article is soft-removed — unpublished and marked, not hard-deleted — so any
 * shared link degrades gracefully and moderation stays auditable.
 */
exports.deleteMyPressRelease = onCall(
  {
    cors: true,
    timeoutSeconds: 30,
  },
  async (request) => {
    assertAuth(request);

    const db = getDb();

    await assertWriteBudget(db, request.auth.uid, "pressReleaseDelete", {
      max: 20,
      windowMs: 60 * 60 * 1000,
    });

    const { articleId } = request.data || {};
    if (!articleId || typeof articleId !== "string") {
      throw new HttpsError("invalid-argument", "articleId is required");
    }

    const match = articleId.match(PRESS_ARTICLE_ID_RE);
    if (!match) {
      throw new HttpsError("invalid-argument", "Not a press-release article id");
    }
    const [, seasonId, dayId, articleType] = match;
    const articlePath = `news_hub/${seasonId}/days/${dayId}/articles/${articleType}`;

    try {
      const ref = db.doc(articlePath);
      const snap = await ref.get();
      if (!snap.exists) {
        throw new HttpsError("not-found", "Press release not found");
      }

      const data = snap.data();
      const isAdmin = request.auth.token.admin === true;
      if (data.authorUid !== request.auth.uid && !isAdmin) {
        throw new HttpsError("permission-denied", "You can only delete your own press releases");
      }

      await ref.update({
        isPublished: false,
        status: "removed",
        removedBy: request.auth.uid,
        removedByAdmin: isAdmin && data.authorUid !== request.auth.uid,
        removedAt: new Date(),
        updatedAt: new Date(),
      });

      await invalidateNewsCache(db);

      logger.info("Press release removed:", { articlePath, removedBy: request.auth.uid });

      return { success: true, message: "Press release removed." };
    } catch (error) {
      logger.error("Error removing press release:", error);
      if (error instanceof HttpsError) throw error;
      throw new HttpsError("internal", "Failed to remove press release");
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
    // Approving with "generate" runs two Gemini calls back to back (visual-detail
    // extraction, then the paid image model, which itself retries a 429 up to
    // three times 15s apart) before the upload. 120s left no headroom for that.
    timeoutSeconds: 300,
    memory: "1GiB",
    // Cloudinary creds are required by the image upload inside publishSubmission;
    // without them the upload falls through to the Firebase Storage fallback and
    // the article publishes with no image at all.
    secrets: [geminiApiKey, ...cloudinarySecrets],
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

      const { articlePath, imageUrl: finalImageUrl, imageGenerationFailed } = await publishSubmission(db, {
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
        message: imageGenerationFailed
          ? "Article published, but the AI image could not be generated. Use Regenerate Image on the article to retry."
          : "Article approved and published successfully",
        articlePath,
        imageUrl: finalImageUrl,
        imageGenerationFailed: !!imageGenerationFailed,
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
  publishPressRelease: exports.publishPressRelease,
  deleteMyPressRelease: exports.deleteMyPressRelease,
  listPendingSubmissions: exports.listPendingSubmissions,
  approveSubmission: exports.approveSubmission,
  rejectSubmission: exports.rejectSubmission,
};
