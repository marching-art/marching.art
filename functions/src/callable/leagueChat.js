/**
 * League chat.
 *
 * Split out of callable/leagues.js, which is at its module size cap. Chat is
 * its own concern anyway: it has its own rate limit, its own length cap, and —
 * since it gained a moderation surface — its own permission rule, distinct from
 * the roster and matchup endpoints next door.
 *
 * Messages are stored verbatim and rendered to every league member, so both the
 * size and the rate of writes are server-capped. Budget docs live in a
 * server-only collection (no client rule matches it).
 */

const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { logger } = require("firebase-functions/v2");
const { paths } = require("../helpers/paths");
const { getDb } = require("../config");
const admin = require("firebase-admin");
const { createLeagueActivity, resolveDisplayName } = require("../helpers/leagueHelpers");
const { consumeRateBudget } = require("../helpers/rateLimit");
const {
  assertAuth,
  hasAdminClaim,
  assertWriteBudget,
  assertDocId,
} = require("../helpers/callableGuards");
const { isLeagueCommissioner } = require("../helpers/leaguePermissions");

// Post a message to league chat
// Chat messages are stored verbatim and rendered to every league member, so
// both the size and the rate of writes are server-capped: 1000 chars (same as
// article comments' MAX_COMMENT_LENGTH) and 10 messages per minute per user.
// Budget docs live in a server-only collection (no client rule matches it).
const MAX_LEAGUE_MESSAGE_LENGTH = 1000;
const CHAT_RATE_COLLECTION = "leagueChatRateLimits";
const CHAT_MAX_MESSAGES_PER_WINDOW = 10;
const CHAT_RATE_WINDOW_MS = 60 * 1000; // 1 minute

exports.postLeagueMessage = onCall({ cors: true }, async (request) => {
  assertAuth(request);

  const { leagueId, message } = request.data;
  const uid = request.auth.uid;

  if (!leagueId || typeof message !== 'string' || !message.trim()) {
    throw new HttpsError("invalid-argument", "League ID and message are required.");
  }
  // The id is interpolated into a Firestore doc path below.
  assertDocId(leagueId, "league ID");

  const trimmedMessage = message.trim();
  if (trimmedMessage.length > MAX_LEAGUE_MESSAGE_LENGTH) {
    throw new HttpsError("invalid-argument",
      `Message too long (max ${MAX_LEAGUE_MESSAGE_LENGTH} characters).`);
  }

  const db = getDb();

  // Abuse throttle (shared league bucket) — humans chat fast; this only stops scripts.
  await assertWriteBudget(db, uid, "leagueSocial", { max: 120 });

  const leagueRef = db.doc(paths.league(leagueId));

  // Verify user is a member
  const leagueDoc = await leagueRef.get();
  if (!leagueDoc.exists) {
    throw new HttpsError("not-found", "League not found.");
  }

  const leagueData = leagueDoc.data();
  if (!leagueData.members.includes(uid)) {
    throw new HttpsError("permission-denied", "You must be a league member to post.");
  }

  const allowed = await consumeRateBudget(
    db, CHAT_RATE_COLLECTION, uid, CHAT_MAX_MESSAGES_PER_WINDOW, CHAT_RATE_WINDOW_MS
  );
  if (!allowed) {
    throw new HttpsError("resource-exhausted",
      "You're posting too quickly. Please wait a moment and try again.");
  }

  const messageRef = leagueRef.collection('chat').doc();
  await messageRef.set({
    userId: uid,
    message: trimmedMessage,
    createdAt: admin.firestore.FieldValue.serverTimestamp()
  });

  // Notify the other members. Deduped per league (dedupeKey `chat_<leagueId>`)
  // so a busy chat collapses to ONE "new messages" bell per league rather than
  // one per message — the latest message overwrites the same doc and re-marks
  // it unread. Best-effort: a notification failure never fails the post.
  try {
    const senderName = await resolveDisplayName(db, uid);
    const preview = trimmedMessage.length > 140
      ? `${trimmedMessage.slice(0, 139)}…`
      : trimmedMessage;
    const recipients = (leagueData.members || []).filter((memberUid) => memberUid !== uid);
    if (recipients.length > 0) {
      const { createUserNotifications } = require("../helpers/userNotifications");
      await createUserNotifications(
        db,
        recipients.map((memberUid) => ({
          uid: memberUid,
          type: "new_message",
          title: `New message in ${leagueData.name || "your league"}`,
          message: `${senderName}: ${preview}`,
          link: `/leagues/${leagueId}`,
          leagueId,
          leagueName: leagueData.name || "your league",
          metadata: { senderUid: uid, senderName },
          dedupeKey: `chat_${leagueId}`,
        }))
      );
    }
  } catch (error) {
    logger.error(`League chat notification fan-out failed for ${leagueId}:`, error);
  }

  return { success: true, message: "Message posted!", messageId: messageRef.id };
});

/**
 * Remove a chat message.
 *
 * League chat had no moderation surface at all: no delete, no report, no mute,
 * while storing messages verbatim and rendering them to every member with no
 * recourse. A persistent social space needs this to exist before it is needed,
 * not after.
 *
 * Authors can remove their own message; the commissioner can remove anyone's.
 * A commissioner removal is written to the activity feed for the same reason
 * removeLeagueMember is — members are entitled to see moderation happen.
 */
exports.deleteLeagueMessage = onCall({ cors: true }, async (request) => {
  assertAuth(request);
  const { leagueId, messageId } = request.data || {};
  const uid = request.auth.uid;

  if (!leagueId || !messageId) {
    throw new HttpsError("invalid-argument", "A league ID and message ID are required.");
  }
  assertDocId(leagueId, "league ID");
  assertDocId(messageId, "message ID");

  const db = getDb();
  await assertWriteBudget(db, uid, "leagueSocial", { max: 60 });

  const leagueRef = db.doc(paths.league(leagueId));
  const messageRef = leagueRef.collection('chat').doc(messageId);

  const { wasCommissionerAction } = await db.runTransaction(async (transaction) => {
    const [leagueDoc, messageDoc] = await Promise.all([
      transaction.get(leagueRef),
      transaction.get(messageRef),
    ]);

    if (!leagueDoc.exists) throw new HttpsError("not-found", "League not found.");
    if (!messageDoc.exists) throw new HttpsError("not-found", "That message no longer exists.");

    const leagueData = leagueDoc.data();
    const isCommissioner = isLeagueCommissioner(leagueData, uid) || hasAdminClaim(request);
    const isAuthor = messageDoc.data().userId === uid;

    if (!isAuthor && !isCommissioner) {
      throw new HttpsError(
        "permission-denied",
        "You can only delete your own messages."
      );
    }

    transaction.delete(messageRef);
    return { wasCommissionerAction: !isAuthor };
  });

  if (wasCommissionerAction) {
    await createLeagueActivity(db, leagueId, {
      type: 'message_removed',
      title: 'Message Removed',
      message: 'The commissioner removed a chat message.',
      userId: uid,
      metadata: { messageId },
    });
  }

  return { success: true, message: "Message deleted." };
});
