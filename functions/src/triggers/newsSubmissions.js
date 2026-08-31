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
  PRESS_RELEASE_AUTO_APPROVE_THRESHOLD,
  computeNextAutoPublishAt,
  resolveAuthorCredit,
  publishSubmission,
  resolveOwnedCorps,
  validatePressReleaseInput,
  publishPressReleaseArticle,
  submissionForAuthor,
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

    // A submitted news article is flaired for one of the game's two competition
    // worlds — Podium or Fantasy. (dci/analysis are legacy generated-article
    // categories and stay accepted so older in-flight submissions never reject,
    // but the composer only offers the two current flairs.)
    const validCategories = ["podium", "fantasy", "dci", "analysis"];
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
 * Publish a press release about the author's OWN corps. Press releases run on
 * their own trust track, separate from news articles: a director's first
 * releases are reviewed by an admin before going live, and once
 * PRESS_RELEASE_AUTO_APPROVE_THRESHOLD of their releases have been approved,
 * new ones publish instantly with no review. This is the community-engagement
 * counterpart to submitNewsForApproval — but a director speaking for their own
 * organization, never circuit-wide coverage.
 *
 * The gate is the author's approved-PRESS-RELEASE count only; approved news
 * articles do not count toward it (and vice versa), so directors no longer route
 * their corps' bulletins through the news queue just to earn instant releases.
 *
 * Accountability comes from four constraints:
 *   1. the author must own a registered corps (the release is bylined to it),
 *   2. an untrusted author's release is held for admin review,
 *   3. a tight per-uid write budget throttles abuse, and
 *   4. anyone can be moderated after the fact — the author can delete their own
 *      release (deleteMyPressRelease) and admins can remove any article.
 */
exports.publishPressRelease = onCall(
  {
    cors: true,
    // Re-hosting an author-supplied header image (publishPressReleaseArticle ->
    // rehostUserImageUrl -> uploadFromUrl) needs the Cloudinary creds and a beat
    // longer than a pure-text publish; without the secrets the upload falls
    // through to a placeholder and the linked photo is lost.
    timeoutSeconds: 60,
    secrets: [...cloudinarySecrets],
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
    // `=== false` (not `!`): this tsconfig runs non-strict, where truthiness
    // checks don't narrow the valid/invalid result union.
    if (validation.valid === false) {
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

    // The gate is the author's approved-PRESS-RELEASE count, tracked separately
    // from approved news articles. Below the bar → hold for admin review; at or
    // above it → the author has earned instant, unreviewed publishing.
    const isTrustedPressAuthor =
      (credit.approvedPressReleaseCount || 0) >= PRESS_RELEASE_AUTO_APPROVE_THRESHOLD;

    if (!isTrustedPressAuthor) {
      // Untrusted author: queue the release for admin review rather than
      // publishing it. It rides the same news_submissions queue and admin tools
      // as news articles, marked kind:"press_release" / category:"press" so it
      // publishes back through the press-release path on approval and counts
      // toward the press-release trust track — never the news one.
      try {
        const submission = {
          kind: "press_release",
          headline: validation.cleaned.headline,
          summary: validation.cleaned.summary,
          // Stored as fullStory so the shared admin review UI renders the body.
          fullStory: validation.cleaned.body,
          category: "press",
          imageUrl: validation.cleaned.imageUrl,
          // "submitted" when the author linked an image, else "none" — a press
          // release never generates an AI image.
          imageOption: validation.cleaned.imageUrl ? "submitted" : "none",
          // The corps the release is bylined to, plus the class the author chose,
          // so approval can re-resolve (or fall back to) the byline.
          corpsClass: corps.corpsClass,
          pressCorps: corps,
          status: "pending",
          authorUid: request.auth.uid,
          authorName: credit.authorName,
          authorUsername: credit.authorUsername,
          authorLocation: credit.authorLocation,
          authorEmail: request.auth.token.email || null,
          createdAt: new Date(),
          updatedAt: new Date(),
        };

        const docRef = await db.collection("news_submissions").add(submission);

        logger.info("Press release queued for review:", {
          submissionId: docRef.id,
          authorUid: request.auth.uid,
          corpsName: corps.corpsName,
        });

        // Notify admins. Best-effort — an email failure never fails the submit.
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
          logger.warn("Failed to notify admins of new press release:", notifyErr.message);
        }

        const remaining = Math.max(
          0,
          PRESS_RELEASE_AUTO_APPROVE_THRESHOLD - (credit.approvedPressReleaseCount || 0)
        );
        return {
          success: true,
          message:
            `Your ${corps.corpsName} press release was submitted for review. ` +
            `After ${remaining} more of your releases ${remaining === 1 ? "is" : "are"} approved, ` +
            `your press releases will publish instantly.`,
          submissionId: docRef.id,
        };
      } catch (error) {
        logger.error("Error submitting press release for review:", error);
        if (error instanceof HttpsError) throw error;
        throw new HttpsError("internal", "Failed to submit press release. Please try again.");
      }
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

      const removedByAdmin = isAdmin && data.authorUid !== request.auth.uid;

      await ref.update({
        isPublished: false,
        status: "removed",
        removedBy: request.auth.uid,
        removedByAdmin,
        removedAt: new Date(),
        updatedAt: new Date(),
      });

      // When an admin takes down someone else's release (the "declined" outcome
      // for an instantly-published release), bell the author. A self-delete
      // needs no notification. Best-effort.
      if (removedByAdmin) {
        try {
          const { createUserNotification } = require("../helpers/userNotifications");
          await createUserNotification(db, data.authorUid, {
            type: "press_release_removed",
            title: "Your press release was removed",
            message:
              `An admin removed your press release${data.headline ? `: “${data.headline}”` : ""}. ` +
              `Reach out if you think this was a mistake.`,
            link: "/profile",
            dedupeKey: `press_release_removed_${articleType}`,
          });
        } catch (notifyErr) {
          logger.warn("Failed to notify author of press-release removal:", notifyErr.message);
        }
      }

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
// AUTHOR'S OWN SUBMISSIONS
// =============================================================================

/**
 * List the caller's own recent submissions that are still in flight — pending
 * review, scheduled to auto-publish, or rejected. This is the author-facing
 * window into the review queue: without it, a queued press release or article
 * produces one toast and then vanishes until an admin acts, and the profile
 * Newsroom (published articles only) tells the author nothing is there.
 * Approved submissions are excluded — they surface as published articles.
 *
 * Read-only; each doc is field-allowlisted by submissionForAuthor before it
 * leaves the server (admin uids, authorEmail, publish paths are dropped).
 */
exports.getMyNewsSubmissions = onCall(
  {
    cors: true,
    timeoutSeconds: 30,
  },
  async (request) => {
    assertAuth(request);

    const db = getDb();

    try {
      // Newest 25 of the author's submissions, filtered to the in-flight
      // statuses in memory. 25 is plenty: pending/scheduled items are by
      // nature recent, and the surface is "what's happening to my recent
      // submissions", not an archive.
      const snapshot = await db
        .collection("news_submissions")
        .where("authorUid", "==", request.auth.uid)
        .orderBy("createdAt", "desc")
        .limit(25)
        .get();

      const submissions = [];
      for (const doc of snapshot.docs) {
        const mapped = submissionForAuthor(doc.id, doc.data());
        if (mapped) submissions.push(mapped);
      }

      return { success: true, submissions };
    } catch (error) {
      logger.error("Error listing author's own submissions:", error);
      throw new HttpsError("internal", "Failed to load your submissions");
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
 * Approve a queued press release: publish it under the author's corps byline
 * (press releases carry only an author-supplied photo — never an AI image),
 * mark the submission approved, and advance the author's approved-PRESS-RELEASE
 * count. Once that count reaches PRESS_RELEASE_AUTO_APPROVE_THRESHOLD the
 * author's future releases publish instantly. Shares the admin approve callable
 * with news articles but stays on the press trust track throughout.
 *
 * @returns {Promise<{success: boolean, message: string, articlePath: string, articleId: string}>}
 */
async function approvePressReleaseSubmission(db, { submissionRef, submission, submissionId, approvedBy }) {
  // Re-resolve the byline from the author's current profile so a rename since
  // submission is honored; fall back to the byline captured at submit time.
  const credit = await resolveAuthorCredit(db, submission.authorUid);
  const corps = resolveOwnedCorps(credit.corps, submission.corpsClass) || submission.pressCorps;
  if (!corps || !corps.corpsName) {
    throw new HttpsError(
      "failed-precondition",
      "This author no longer has a registered corps to byline the release to."
    );
  }

  const result = await publishPressReleaseArticle(db, {
    id: db.collection("news_hub").doc().id,
    cleaned: {
      headline: submission.headline,
      summary: submission.summary,
      body: submission.fullStory,
      imageUrl: submission.imageUrl || null,
    },
    corps,
    author: {
      uid: submission.authorUid,
      authorName: credit.authorName || submission.authorName,
      authorUsername: credit.authorUsername || submission.authorUsername,
      authorLocation: credit.authorLocation || submission.authorLocation,
    },
  });

  const now = new Date();
  await submissionRef.update({
    status: "approved",
    publishedAt: now,
    updatedAt: now,
    approvedBy,
    publishedPath: result.articlePath,
  });

  // Advance BOTH counters: approvedPressReleaseCount is the instant-publish gate;
  // pressReleaseCount feeds the writer tier (every published release counts).
  // Read the approved count back so the trusted milestone fires exactly on the
  // crossing approval. Best-effort — a counter failure never fails the publish.
  let newApprovedCount = null;
  try {
    const statsRef = profileDataRef(db, submission.authorUid);
    await statsRef.set(
      {
        articleStats: {
          approvedPressReleaseCount: FieldValue.increment(1),
          pressReleaseCount: FieldValue.increment(1),
          lastPressReleaseAt: now,
        },
      },
      { merge: true }
    );
    const statsSnap = await statsRef.get();
    newApprovedCount = statsSnap.data()?.articleStats?.approvedPressReleaseCount ?? null;
  } catch (counterErr) {
    logger.warn("Failed to increment author approved-press-release count:", counterErr.message);
  }

  // Bell the author: their release is live, and — on the approval that reaches
  // the threshold — that their future releases now publish instantly.
  try {
    const { createUserNotification } = require("../helpers/userNotifications");
    await createUserNotification(db, submission.authorUid, {
      type: "press_release_approved",
      title: "Your press release was approved",
      message: `“${submission.headline}” has been approved and published to the news hub.`,
      link: result.articleId ? `/article/${result.articleId}` : "/profile",
      dedupeKey: `press_release_approved_${submissionId}`,
      metadata: { submissionId },
    });

    if (newApprovedCount === PRESS_RELEASE_AUTO_APPROVE_THRESHOLD) {
      await createUserNotification(db, submission.authorUid, {
        type: "press_releases_unlocked",
        title: "Your press releases now publish instantly",
        message:
          `With ${PRESS_RELEASE_AUTO_APPROVE_THRESHOLD} approved press releases, ` +
          `your future releases publish instantly — no review.`,
        link: "/profile",
        dedupeKey: `press_releases_unlocked_${submission.authorUid}`,
      });
    }
  } catch (notifyErr) {
    logger.warn("Failed to notify author of press-release approval:", notifyErr.message);
  }

  await invalidateNewsCache(db);

  logger.info("Press release approved and published:", {
    submissionId,
    articlePath: result.articlePath,
    corpsName: corps.corpsName,
  });

  return {
    success: true,
    message: "Press release approved and published successfully",
    articlePath: result.articlePath,
    articleId: result.articleId,
  };
}

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
    cpu: 1,
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

      // A queued press release publishes back through the press-release path
      // (its own byline, no AI image generation) and counts toward the press
      // trust track — not the news one.
      if (submission.kind === "press_release") {
        return await approvePressReleaseSubmission(db, {
          submissionRef,
          submission,
          submissionId,
          approvedBy: request.auth.uid,
        });
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

      const { articlePath, articleId, imageUrl: finalImageUrl, imageGenerationFailed } = await publishSubmission(db, {
        submissionRef,
        submission,
        submissionId,
        approvedBy: request.auth.uid,
        imageOption: effectiveOption,
        autoPublished: false,
      });

      // Credit the author with an admin approval. Once they cross the threshold,
      // their future submissions auto-publish AND press releases unlock. Wrapped
      // so a counter failure never fails an otherwise-successful publish. Read
      // the resulting count back so we can fire the trusted-author milestone
      // exactly on the crossing approval.
      let newApprovedCount = null;
      try {
        const statsRef = profileDataRef(db, submission.authorUid);
        await statsRef.set(
          {
            articleStats: {
              approvedCount: FieldValue.increment(1),
              lastApprovedAt: new Date(),
            },
          },
          { merge: true }
        );
        const statsSnap = await statsRef.get();
        newApprovedCount = statsSnap.data()?.articleStats?.approvedCount ?? null;
      } catch (counterErr) {
        logger.warn("Failed to increment author approved count:", counterErr.message);
      }

      // Bell the author: their submission was approved and is live, and — on the
      // approval that reaches AUTO_PUBLISH_THRESHOLD — that they've become a
      // trusted author (auto-publish + press releases now unlocked). Best-effort.
      try {
        const { createUserNotification } = require("../helpers/userNotifications");
        await createUserNotification(db, submission.authorUid, {
          type: "article_approved",
          title: "Your article was approved",
          message: `“${submission.headline}” has been approved and published to the news hub.`,
          link: articleId ? `/article/${articleId}` : "/profile",
          dedupeKey: `article_approved_${submissionId}`,
          metadata: { submissionId },
        });

        if (newApprovedCount === AUTO_PUBLISH_THRESHOLD) {
          await createUserNotification(db, submission.authorUid, {
            type: "trusted_author_unlocked",
            title: "You're now a trusted author",
            message:
              `With ${AUTO_PUBLISH_THRESHOLD} approved articles, your future submissions ` +
              `publish automatically — and you can now post instant press releases for your corps.`,
            link: "/profile",
            dedupeKey: `trusted_author_unlocked_${submission.authorUid}`,
          });
        }
      } catch (notifyErr) {
        logger.warn("Failed to notify author of approval:", notifyErr.message);
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

      const rejectionReason = reason || "Does not meet our content guidelines";

      await submissionRef.update({
        status: "rejected",
        autoPublish: false,
        rejectionReason,
        rejectedBy: request.auth.uid,
        updatedAt: new Date(),
      });

      // Bell the author so a declined submission never just disappears. Best-effort.
      const isPressRelease = submission.kind === "press_release";
      const rejectedNoun = isPressRelease ? "press release" : "article";
      try {
        const { createUserNotification } = require("../helpers/userNotifications");
        await createUserNotification(db, submission.authorUid, {
          type: "article_rejected",
          title: `Your ${rejectedNoun} wasn't approved`,
          message: `“${submission.headline}” wasn't approved: ${rejectionReason}`,
          link: "/profile",
          dedupeKey: `article_rejected_${submissionId}`,
          metadata: { submissionId },
        });
      } catch (notifyErr) {
        logger.warn("Failed to notify author of rejection:", notifyErr.message);
      }

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
  getMyNewsSubmissions: exports.getMyNewsSubmissions,
  listPendingSubmissions: exports.listPendingSubmissions,
  approveSubmission: exports.approveSubmission,
  rejectSubmission: exports.rejectSubmission,
};
