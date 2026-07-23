const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { paths } = require("../helpers/paths");
const { logger } = require("firebase-functions/v2");
const { getDb } = require("../config");
const admin = require("firebase-admin");
// NOTE: firebase-admin/firestore has no `serverTimestamp` named export (that
// is the CLIENT SDK's API) — destructuring it yielded undefined and made
// reportComment throw on every call. Use FieldValue.serverTimestamp().
const { FieldValue } = require("firebase-admin/firestore");
const { assertAuth, hasAdminClaim, assertWriteBudget } = require("../helpers/callableGuards");

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

  const notificationRef = db.collection(paths.userNotifications(recipientUid)).doc();

  try {
    await notificationRef.set({
      type: "new_comment",
      message: `${commenterName} left a comment on your profile.`,
      link: `/profile/${commenterUid}`, // Link back to the commenter's profile
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
      isRead: false,
      senderUid: commenterUid,
    });
    logger.info(`Notification sent from ${commenterUid} to ${recipientUid}`);
    return { success: true, message: "Notification sent." };
  } catch (error) {
    logger.error("Error sending comment notification:", error);
    throw new HttpsError("internal", "An error occurred while sending the notification.");
  }
});

exports.deleteComment = onCall({ cors: true }, async (request) => {
  assertAuth(request);

  const { profileOwnerId, commentId } = request.data;
  const callerUid = request.auth.uid;
  const isAdmin = hasAdminClaim(request);

  if (!profileOwnerId || !commentId) {
    throw new HttpsError("invalid-argument", "Missing profile owner ID or comment ID.");
  }

  // Security Check: Only the profile owner or an admin can delete.
  if (callerUid !== profileOwnerId && !isAdmin) {
    throw new HttpsError("permission-denied", "You do not have permission to delete this comment.");
  }

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
