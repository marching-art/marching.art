/**
 * Report a director-written article — a press release or a published community
 * submission — to the site admins.
 *
 * Trusted authors' press releases publish instantly and their community
 * articles auto-publish, so the only moderation they get is after the fact.
 * Article comments and league chat already had a report control; the articles
 * themselves did not. Reports land in the shared `reports` collection (type
 * "article") that the admin Reports queue reads, deduplicated per reporter per
 * article by doc id, and "Remove content" there soft-removes the article.
 */

const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { logger } = require("firebase-functions/v2");
const { FieldValue } = require("firebase-admin/firestore");
const { getDb } = require("../config");
const { assertAuth, assertWriteBudget } = require("../helpers/callableGuards");
const { resolveDisplayName } = require("../helpers/leagueHelpers");
const { parseDirectorArticleId, isArticleLive, kindLabel } = require("../helpers/directorArticles");

const MIN_REASON_LENGTH = 5;
const MAX_REASON_LENGTH = 500;
/** How much of the article the report snapshots for moderators. */
const EXCERPT_LENGTH = 1000;

/**
 * The text a moderator sees in the queue: headline, then the start of the
 * body. Snapshotted at report time so it survives an author's later edit.
 *
 * @param {Record<string, any>} article
 * @returns {string}
 */
function articleExcerpt(article) {
  const headline = typeof article.headline === "string" ? article.headline.trim() : "";
  const body = [article.summary, article.narrative, article.fullStory, article.content].find(
    (value) => typeof value === "string" && value.trim()
  );
  const text = [headline, body ? body.trim() : ""].filter(Boolean).join("\n\n");
  return text.length > EXCERPT_LENGTH ? `${text.slice(0, EXCERPT_LENGTH - 1)}…` : text;
}

/**
 * request.data: { articleId: string, reason: string }
 */
exports.reportArticle = onCall({ cors: true, timeoutSeconds: 30 }, async (request) => {
  assertAuth(request);
  const reporterUid = request.auth.uid;
  const { articleId, reason } = request.data || {};

  const parsed = parseDirectorArticleId(articleId);
  if (!parsed) {
    throw new HttpsError("invalid-argument", "Only director-written articles can be reported.");
  }
  if (typeof reason !== "string" || reason.trim().length < MIN_REASON_LENGTH) {
    throw new HttpsError("invalid-argument", "Please say briefly why you're reporting this.");
  }
  const trimmedReason = reason.trim();
  if (trimmedReason.length > MAX_REASON_LENGTH) {
    throw new HttpsError(
      "invalid-argument",
      `Report reason too long (max ${MAX_REASON_LENGTH} characters).`
    );
  }

  const db = getDb();
  // Shares the comment-report bucket — far above any human rate.
  await assertWriteBudget(db, reporterUid, "comments", { max: 30, windowMs: 10 * 60 * 1000 });

  const articleSnap = await db.doc(parsed.articlePath).get();
  if (!articleSnap.exists || !isArticleLive(articleSnap.data())) {
    throw new HttpsError("not-found", "That article is no longer published.");
  }
  const article = articleSnap.data() || {};
  if (!article.authorUid) {
    throw new HttpsError("invalid-argument", "Only director-written articles can be reported.");
  }
  if (article.authorUid === reporterUid) {
    throw new HttpsError("invalid-argument", "You can't report your own article.");
  }

  // One report per reporter per article: a deterministic id makes a second
  // tap a no-op instead of a duplicate row for moderators.
  const reportRef = db.collection("reports").doc(`article_${articleId}_${reporterUid}`);
  const existing = await reportRef.get();
  const label = kindLabel(parsed.kind);
  if (existing.exists) {
    return { success: true, alreadyReported: true, message: `You've already reported this ${label}.` };
  }

  const excerpt = articleExcerpt(article);
  await reportRef.set({
    type: "article",
    articleId,
    articleKind: parsed.kind,
    headline: typeof article.headline === "string" ? article.headline : null,
    commentText: excerpt,
    commentAuthorUid: article.authorUid,
    reporterUid,
    reason: trimmedReason,
    status: "new",
    createdAt: FieldValue.serverTimestamp(),
  });

  // Best-effort admin heads-up; the reporter never sees an email failure.
  try {
    const { fanOutToAdmins, sendAdminCommentReportEmail } = require("../helpers/emailService");
    const [reporterName, authorName] = await Promise.all([
      resolveDisplayName(db, reporterUid, null),
      resolveDisplayName(db, article.authorUid, article.authorUsername || article.authorName || null),
    ]);
    await fanOutToAdmins(sendAdminCommentReportEmail, {
      reportId: reportRef.id,
      reason: trimmedReason,
      commentExcerpt: excerpt.slice(0, 240),
      commentAuthor: authorName,
      reporterName,
      articleId,
      leagueName: null,
      contentKind: label,
    });
  } catch (notifyErr) {
    logger.warn("Failed to notify admins of article report:", notifyErr.message);
  }

  return {
    success: true,
    alreadyReported: false,
    message: `Reported. An admin will review this ${label}.`,
  };
});

exports.articleExcerpt = articleExcerpt;
