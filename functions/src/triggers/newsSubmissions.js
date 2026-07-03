// User news submission callables: submit for approval plus the admin
// pending-list/approve/reject flow. Extracted verbatim from
// triggers/newsGeneration.js.

const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { logger } = require("firebase-functions/v2");
const { defineSecret } = require("firebase-functions/params");
const { getDb } = require("../config");
const { brevoApiKey } = require("../helpers/emailService");
const { assertAuth, assertAdmin } = require("../helpers/callableGuards");

const geminiApiKey = defineSecret("GOOGLE_GENERATIVE_AI_API_KEY");

// =============================================================================
// USER NEWS SUBMISSIONS
// =============================================================================

/**
 * Submit a news article for admin approval
 * Any authenticated user can submit articles
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
    const { headline, summary, fullStory, category, imageUrl } = request.data || {};

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

    // Validate image URL if provided
    if (imageUrl && typeof imageUrl === "string") {
      try {
        new URL(imageUrl);
      } catch {
        throw new HttpsError("invalid-argument", "Invalid image URL");
      }
    }

    try {
      // Get user profile for author info
      const userDoc = await db
        .collection("artifacts")
        .doc(process.env.DATA_NAMESPACE || "marching-art")
        .collection("users")
        .doc(request.auth.uid)
        .collection("profile")
        .doc("data")
        .get();

      const userData = userDoc.exists ? userDoc.data() : {};
      const authorName = userData.displayName || userData.username || "Anonymous";

      // Create the submission
      const submission = {
        headline: headline.trim(),
        summary: summary.trim(),
        fullStory: fullStory.trim(),
        category,
        imageUrl: imageUrl?.trim() || null,
        status: "pending", // pending, approved, rejected
        authorUid: request.auth.uid,
        authorName,
        authorEmail: request.auth.token.email || null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const docRef = await db.collection("news_submissions").add(submission);

      logger.info("News submission received:", {
        submissionId: docRef.id,
        authorUid: request.auth.uid,
        headline: headline.substring(0, 50),
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
        message: "Article submitted for review. An admin will review it shortly.",
        submissionId: docRef.id,
      };
    } catch (error) {
      logger.error("Error submitting news article:", error);
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
 * Approve an article submission and publish it
 * Admin can choose to use submitted image, generate AI image, or publish without image
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

      // Get current season info
      const seasonDoc = await db.doc("game-settings/season").get();
      const seasonData = seasonDoc.exists ? seasonDoc.data() : {};
      const seasonId = seasonData.seasonUid || "current_season";
      const currentDay = seasonData.currentDay || 1;

      let finalImageUrl = null;

      // Determine image handling based on imageOption or legacy generateImage flag
      // imageOption takes precedence if provided
      let effectiveOption = imageOption;
      if (!effectiveOption) {
        // Legacy support: convert boolean generateImage to imageOption
        if (generateImage === true) {
          effectiveOption = submission.imageUrl ? "submitted" : "generate";
        } else if (generateImage === false) {
          effectiveOption = "none";
        } else {
          // Default: use submitted image if available, otherwise generate
          effectiveOption = submission.imageUrl ? "submitted" : "generate";
        }
      }

      if (effectiveOption === "submitted" && submission.imageUrl) {
        // Use the submitted image
        finalImageUrl = submission.imageUrl;
        logger.info("Using submitted image:", { submissionId, imageUrl: finalImageUrl });
      } else if (effectiveOption === "generate") {
        // Generate a new AI image
        logger.info("Generating AI image for approved article:", { submissionId });

        const {
          generateImageWithImagen,
          buildArticleImagePrompt,
          buildCorpsSpotlightImagePrompt,
          buildAnalyticsImagePrompt,
          buildFantasyLeagueImagePrompt,
          buildFantasyPerformersImagePrompt,
          DCI_UNIFORMS,
        } = require("../helpers/newsGeneration");
        const { uploadFromUrl } = require("../helpers/mediaService");

        // Try to extract a corps name from the headline/summary for specialized prompts
        const knownCorps = Object.keys(DCI_UNIFORMS);
        const contentToSearch = `${submission.headline} ${submission.summary}`.toLowerCase();
        const extractedCorps = knownCorps.find(corps =>
          contentToSearch.includes(corps.toLowerCase())
        );
        const currentYear = new Date().getFullYear();

        // Build a contextual prompt based on article content
        // Use specialized prompt builders when possible for better image quality
        let imagePrompt;

        if (submission.category === "dci" && extractedCorps) {
          // Use corps spotlight prompt for DCI articles about specific corps
          imagePrompt = buildCorpsSpotlightImagePrompt(
            extractedCorps,
            currentYear,
            null // showTitle
          );
          logger.info("Using specialized corps spotlight prompt:", { extractedCorps });
        } else if (submission.category === "analysis" && extractedCorps) {
          // Use analytics prompt for analysis articles about specific corps
          imagePrompt = buildAnalyticsImagePrompt(
            extractedCorps,
            currentYear,
            "performance analysis",
            null // showTitle
          );
          logger.info("Using specialized analytics prompt:", { extractedCorps });
        } else if (submission.category === "fantasy") {
          // Use fantasy league prompt for fantasy articles
          if (extractedCorps) {
            imagePrompt = buildFantasyPerformersImagePrompt(
              extractedCorps,
              "Championship celebration",
              null, // location
              null  // uniformDesign
            );
            logger.info("Using specialized fantasy performers prompt:", { extractedCorps });
          } else {
            imagePrompt = buildFantasyLeagueImagePrompt();
            logger.info("Using specialized fantasy league prompt");
          }
        } else {
          // Fallback to generic prompt builder
          imagePrompt = buildArticleImagePrompt(
            submission.category,
            submission.headline,
            submission.summary
          );
          logger.info("Using generic article prompt:", { category: submission.category });
        }

        // Generate the image
        const imageData = await generateImageWithImagen(imagePrompt);

        if (imageData) {
          // Upload to Cloudinary
          const uploadResult = await uploadFromUrl(imageData, {
            folder: "marching-art/user-articles",
            publicId: `article_${submissionId}`,
            category: submission.category,
            headline: submission.headline,
          });

          if (uploadResult.success) {
            finalImageUrl = uploadResult.url;
            logger.info("Image generated and uploaded:", { url: finalImageUrl });
          }
        }
      }

      // Create the published article in news_hub
      // User submissions go to a "community" subcollection
      const articlePath = `news_hub/${seasonId}/community/article_${submissionId}`;

      const publishedArticle = {
        type: "community_submission",
        submissionId,
        reportDay: currentDay,
        createdAt: submission.createdAt,
        publishedAt: new Date(),
        updatedAt: new Date(),

        // Article content
        headline: submission.headline,
        summary: submission.summary,
        narrative: submission.fullStory,
        category: submission.category,

        // Image
        imageUrl: finalImageUrl,
        imageIsPlaceholder: !finalImageUrl,

        // Author info
        authorUid: submission.authorUid,
        authorName: submission.authorName,

        // Metadata
        metadata: {
          source: "community_submission",
          approvedBy: request.auth.uid,
          approvedAt: new Date(),
        },

        isPublished: true,
      };

      await db.doc(articlePath).set(publishedArticle);

      // Update submission status
      await submissionRef.update({
        status: "approved",
        publishedAt: new Date(),
        updatedAt: new Date(),
        approvedBy: request.auth.uid,
        publishedImageUrl: finalImageUrl,
        publishedPath: articlePath,
      });

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

      if (submission.status !== "pending") {
        throw new HttpsError("failed-precondition", "This submission has already been processed");
      }

      await submissionRef.update({
        status: "rejected",
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
