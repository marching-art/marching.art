const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { logger } = require("firebase-functions/v2");
const { getDb, dataNamespaceParam } = require("../config");
const admin = require("firebase-admin");
const { serverTimestamp } = require("firebase-admin/firestore");

exports.sendCommentNotification = onCall({ cors: true }, async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "You must be logged in to send a notification.");
  }
  const { recipientUid, commenterUsername } = request.data;
  const commenterUid = request.auth.uid;

  if (!recipientUid || !commenterUsername) {
    throw new HttpsError("invalid-argument", "Missing recipient UID or commenter username.");
  }

  // Prevent users from sending notifications to themselves
  if (recipientUid === commenterUid) {
    return { success: true, message: "Self-notification ignored." };
  }

  const db = getDb();
  const notificationRef = db.collection(`artifacts/${dataNamespaceParam.value()}/users/${recipientUid}/notifications`).doc();

  try {
    await notificationRef.set({
      type: "new_comment",
      message: `${commenterUsername} left a comment on your profile.`,
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
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "You must be logged in to delete comments.");
  }

  const { profileOwnerId, commentId } = request.data;
  const callerUid = request.auth.uid;
  const isAdmin = request.auth.token.admin === true;

  if (!profileOwnerId || !commentId) {
    throw new HttpsError("invalid-argument", "Missing profile owner ID or comment ID.");
  }

  // Security Check: Only the profile owner or an admin can delete.
  if (callerUid !== profileOwnerId && !isAdmin) {
    throw new HttpsError("permission-denied", "You do not have permission to delete this comment.");
  }

  try {
    const commentRef = getDb().doc(`artifacts/${dataNamespaceParam.value()}/users/${profileOwnerId}/comments/${commentId}`);
    await commentRef.delete();
    return { success: true, message: "Comment deleted successfully." };
  } catch (error) {
    logger.error(`Error deleting comment ${commentId} by user ${callerUid}:`, error);
    throw new HttpsError("internal", "An error occurred while deleting the comment.");
  }
});

exports.reportComment = onCall({ cors: true }, async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "You must be logged in to report comments.");
  }

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
      createdAt: serverTimestamp(),
    });
    return { success: true, message: "Comment reported. Thank you for your feedback." };
  } catch (error) {
    logger.error(`Error reporting comment ${commentId} by user ${reporterUid}:`, error);
    throw new HttpsError("internal", "Could not submit report.");
  }
});
