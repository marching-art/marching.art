const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { paths } = require("../helpers/paths");
const { logger } = require("firebase-functions/v2");
const { getDb } = require("../config");
// NOTE: firebase-admin/firestore has no `serverTimestamp` named export (that
// is the CLIENT SDK's API) — destructuring it yielded undefined and made
// reportComment throw on every call. Use FieldValue.serverTimestamp().
const { FieldValue } = require("firebase-admin/firestore");
const { assertAuth, hasAdminClaim, assertWriteBudget, assertDocId } = require("../helpers/callableGuards");

// Maximum reported-comment text length (mirrors articleComments' MAX_COMMENT_LENGTH)
const MAX_COMMENT_LENGTH = 1000;

exports.sendCommentNotification = onCall({ cors: true }, async (request) => {
  assertAuth(request);
  const { recipientUid } = request.data;
  const commenterUid = request.auth.uid;

  if (!recipientUid || typeof recipientUid !== "string") {
    throw new HttpsError("invalid-argument", "Missing recipient UID.");
  }

  // Prevent users from sending notifications to themselves
  if (recipientUid === commenterUid) {
    return { success: true, message: "Self-notification ignored." };
  }

  const db = getDb();

  // Abuse throttle: this callable writes into ANOTHER user's notification
  // feed, so it was a spam/harassment vector — any auth user could push
  // unlimited notifications at any recipient.
  await assertWriteBudget(db, commenterUid, "commentNotifications", {
    max: 20,
    windowMs: 24 * 60 * 60 * 1000,
  });

  // The displayed name comes from the COMMENTER'S OWN profile, never from
  // the request — client-supplied text used to flow straight into the
  // recipient's notification message.
  const commenterProfile = await db.doc(paths.userProfile(commenterUid)).get();
  const commenterName =
    (commenterProfile.exists &&
      (commenterProfile.data().username || commenterProfile.data().displayName)) ||
    "A director";

  // Route through the shared writer so the doc matches the inbox contract the
  // bell reads (createdAt/read/title). The previous inline write used
  // timestamp/isRead and no title, so it was ordered out of the inbox query
  // and never surfaced in the bell at all.
  const { createUserNotification } = require("../helpers/userNotifications");
  const notificationId = await createUserNotification(db, recipientUid, {
    type: "new_comment",
    title: "New Profile Comment",
    message: `${commenterName} left a comment on your profile.`,
    link: `/profile/${commenterUid}`, // Link back to the commenter's profile
    metadata: { senderUid: commenterUid },
  });

  if (!notificationId) {
    // createUserNotification never throws — a null means the write was skipped
    // or failed. Surface it so the client can retry, matching the old behavior.
    throw new HttpsError("internal", "An error occurred while sending the notification.");
  }
  logger.info(`Notification sent from ${commenterUid} to ${recipientUid}`);
  return { success: true, message: "Notification sent." };
});

exports.deleteComment = onCall({ cors: true }, async (request) => {
  assertAuth(request);

  const { profileOwnerId, commentId } = request.data;
  const callerUid = request.auth.uid;
  const isAdmin = hasAdminClaim(request);

  if (!profileOwnerId || !commentId) {
    throw new HttpsError("invalid-argument", "Missing profile owner ID or comment ID.");
  }
  // Both ids are interpolated into a Firestore doc path below.
  assertDocId(profileOwnerId, "profile owner ID");
  assertDocId(commentId, "comment ID");

  // Security Check: Only the profile owner or an admin can delete.
  if (callerUid !== profileOwnerId && !isAdmin) {
    throw new HttpsError("permission-denied", "You do not have permission to delete this comment.");
  }

  // Abuse throttle (mirrors deleteArticleComment's shared comments bucket).
  await assertWriteBudget(getDb(), callerUid, "comments", { max: 30, windowMs: 10 * 60 * 1000 });

  try {
    const commentRef = getDb().doc(paths.userComment(profileOwnerId, commentId));
    await commentRef.delete();
    return { success: true, message: "Comment deleted successfully." };
  } catch (error) {
    logger.error(`Error deleting comment ${commentId} by user ${callerUid}:`, error);
    throw new HttpsError("internal", "An error occurred while deleting the comment.");
  }
});

exports.reportComment = onCall({ cors: true }, async (request) => {
  assertAuth(request);

  const { profileOwnerId, commentId, commentText, commentAuthorUid } = request.data;
  const reporterUid = request.auth.uid;

  if (!profileOwnerId || !commentId || !commentText || !commentAuthorUid) {
    throw new HttpsError("invalid-argument", "Missing required report data.");
  }
  // Ids must be plausible doc-id strings — commentAuthorUid lands in the
  // report doc and drives moderation actions, so it can't be free-form.
  assertDocId(profileOwnerId, "profile owner ID");
  assertDocId(commentId, "comment ID");
  assertDocId(commentAuthorUid, "comment author UID");

  // The reported text is stored verbatim and rendered to moderators.
  if (typeof commentText !== "string" || commentText.trim().length === 0) {
    throw new HttpsError("invalid-argument", "Comment text must be a non-empty string.");
  }
  if (commentText.length > MAX_COMMENT_LENGTH) {
    throw new HttpsError("invalid-argument",
      `Comment text too long (max ${MAX_COMMENT_LENGTH} characters).`);
  }

  // Abuse throttle (mirrors reportArticleComment's shared comments bucket) —
  // far above any human rate.
  await assertWriteBudget(getDb(), reporterUid, "comments", { max: 30, windowMs: 10 * 60 * 1000 });

  try {
    const reportRef = getDb().collection("reports").doc();
    await reportRef.set({
      type: "comment",
      commentId,
      commentText,
      commentAuthorUid,
      reportedOnProfileUid: profileOwnerId,
      reporterUid,
      status: "new", // 'new', 'reviewed', 'resolved'
      createdAt: FieldValue.serverTimestamp(),
    });
    return { success: true, message: "Comment reported. Thank you for your feedback." };
  } catch (error) {
    logger.error(`Error reporting comment ${commentId} by user ${reporterUid}:`, error);
    throw new HttpsError("internal", "Could not submit report.");
  }
});
