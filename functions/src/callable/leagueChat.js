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
const { FieldValue } = require("firebase-admin/firestore");
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

// A reply carries a snapshot of what it answers, so the quote survives the
// original being deleted and never needs a second read to render.
const REPLY_PREVIEW_LENGTH = 200;

// The reaction palette is fixed server-side: a message doc stores
// `reactions: { [emoji]: uid[] }`, and an open-ended key set would let a client
// grow a doc without bound. Mirrored in src/utils/chatFormat.ts.
const LEAGUE_CHAT_REACTIONS = Object.freeze(["🔥", "😂", "👏", "💀", "🏆", "👀"]);

const MAX_REPORT_REASON_LENGTH = 500;

/**
 * Load the league and confirm the caller is a member. Every chat endpoint
 * starts the same way; a non-member must not be able to react to, reply to, or
 * report a message in a league they cannot read.
 */
async function loadLeagueForMember(db, leagueId, uid) {
  const leagueRef = db.doc(paths.league(leagueId));
  const leagueDoc = await leagueRef.get();
  if (!leagueDoc.exists) {
    throw new HttpsError("not-found", "League not found.");
  }
  const leagueData = leagueDoc.data();
  if (!Array.isArray(leagueData.members) || !leagueData.members.includes(uid)) {
    throw new HttpsError("permission-denied", "You must be a league member to do that.");
  }
  return { leagueRef, leagueData };
}

exports.postLeagueMessage = onCall({ cors: true }, async (request) => {
  assertAuth(request);

  const { leagueId, message, replyTo } = request.data;
  const uid = request.auth.uid;

  if (!leagueId || typeof message !== 'string' || !message.trim()) {
    throw new HttpsError("invalid-argument", "League ID and message are required.");
  }
  // The id is interpolated into a Firestore doc path below.
  assertDocId(leagueId, "league ID");
  if (replyTo !== undefined && replyTo !== null) {
    if (typeof replyTo !== "string") {
      throw new HttpsError("invalid-argument", "replyTo must be a message ID.");
    }
    assertDocId(replyTo, "reply target");
  }

  const trimmedMessage = message.trim();
  if (trimmedMessage.length > MAX_LEAGUE_MESSAGE_LENGTH) {
    throw new HttpsError("invalid-argument",
      `Message too long (max ${MAX_LEAGUE_MESSAGE_LENGTH} characters).`);
  }

  const db = getDb();

  // Abuse throttle (shared league bucket) — humans chat fast; this only stops scripts.
  await assertWriteBudget(db, uid, "leagueSocial", { max: 120 });

  const { leagueRef, leagueData } = await loadLeagueForMember(db, leagueId, uid);

  // A reply quotes the message it answers. The snapshot is taken here, not
  // trusted from the client, so a member cannot put words in another's mouth.
  let replySnapshot = null;
  if (replyTo) {
    const targetDoc = await leagueRef.collection('chat').doc(replyTo).get();
    if (!targetDoc.exists) {
      throw new HttpsError("not-found", "The message you're replying to is gone.");
    }
    const target = targetDoc.data();
    const text = typeof target.message === "string" ? target.message : "";
    replySnapshot = {
      id: replyTo,
      userId: target.userId || null,
      message: text.length > REPLY_PREVIEW_LENGTH
        ? `${text.slice(0, REPLY_PREVIEW_LENGTH - 1)}…`
        : text,
    };
  }

  const allowed = await consumeRateBudget(
    db, CHAT_RATE_COLLECTION, uid, CHAT_MAX_MESSAGES_PER_WINDOW, CHAT_RATE_WINDOW_MS
  );
  if (!allowed) {
    throw new HttpsError("resource-exhausted",
      "You're posting too quickly. Please wait a moment and try again.");
  }

  const messageRef = leagueRef.collection('chat').doc();
  const messageDoc = {
    userId: uid,
    message: trimmedMessage,
    createdAt: FieldValue.serverTimestamp(),
  };
  if (replySnapshot) messageDoc.replyTo = replySnapshot;
  await messageRef.set(messageDoc);

  // The league card's unread dot compares this against the viewer's
  // per-device read marker (utils/leagueChatReads). Only a timestamp: league
  // docs are listable by any signed-in user, so no message text goes here.
  try {
    await leagueRef.update({ lastChatAt: FieldValue.serverTimestamp() });
  } catch (error) {
    logger.warn(`lastChatAt stamp failed for ${leagueId}:`, error);
  }

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

/**
 * Toggle an emoji reaction on a chat message.
 *
 * Reactions live on the message doc as `reactions: { [emoji]: uid[] }` — one
 * read renders the whole conversation, and the transaction keeps two members
 * tapping the same chip at once from losing each other's tap. A member can
 * hold any number of different reactions on a message, one of each.
 */
exports.toggleLeagueMessageReaction = onCall({ cors: true }, async (request) => {
  assertAuth(request);
  const { leagueId, messageId, emoji } = request.data || {};
  const uid = request.auth.uid;

  if (!leagueId || !messageId) {
    throw new HttpsError("invalid-argument", "A league ID and message ID are required.");
  }
  assertDocId(leagueId, "league ID");
  assertDocId(messageId, "message ID");
  if (typeof emoji !== "string" || !LEAGUE_CHAT_REACTIONS.includes(emoji)) {
    throw new HttpsError("invalid-argument", "That reaction isn't available.");
  }

  const db = getDb();
  // Reacting is a tap, not a post: a looser budget than messages, still far
  // above any human rate.
  await assertWriteBudget(db, uid, "leagueSocial", { max: 240 });

  const { leagueRef } = await loadLeagueForMember(db, leagueId, uid);
  const messageRef = leagueRef.collection('chat').doc(messageId);

  const reacted = await db.runTransaction(async (transaction) => {
    const messageDoc = await transaction.get(messageRef);
    if (!messageDoc.exists) {
      throw new HttpsError("not-found", "That message no longer exists.");
    }
    const current = messageDoc.data().reactions || {};
    const holders = Array.isArray(current[emoji]) ? current[emoji] : [];
    const has = holders.includes(uid);
    const next = has ? holders.filter((u) => u !== uid) : [...holders, uid];

    const reactions = { ...current };
    if (next.length > 0) reactions[emoji] = next;
    else delete reactions[emoji];

    transaction.update(messageRef, { reactions });
    return !has;
  });

  return { success: true, reacted };
});

/**
 * Report a chat message to the site admins.
 *
 * League chat had delete for authors and commissioners but no way for a
 * member to flag something a commissioner is ignoring — or something the
 * commissioner said. Reports land in the same `reports` collection the profile
 * comment flow uses, typed so moderation can tell them apart, and are
 * deduplicated per reporter per message by doc id (no query needed).
 */
exports.reportLeagueMessage = onCall({ cors: true }, async (request) => {
  assertAuth(request);
  const { leagueId, messageId, reason } = request.data || {};
  const reporterUid = request.auth.uid;

  if (!leagueId || !messageId) {
    throw new HttpsError("invalid-argument", "A league ID and message ID are required.");
  }
  assertDocId(leagueId, "league ID");
  assertDocId(messageId, "message ID");
  if (typeof reason !== "string" || reason.trim().length < 5) {
    throw new HttpsError("invalid-argument", "Please say briefly why you're reporting this.");
  }
  if (reason.trim().length > MAX_REPORT_REASON_LENGTH) {
    throw new HttpsError("invalid-argument",
      `Report reason too long (max ${MAX_REPORT_REASON_LENGTH} characters).`);
  }

  const db = getDb();
  await assertWriteBudget(db, reporterUid, "comments", { max: 30, windowMs: 10 * 60 * 1000 });

  const { leagueRef, leagueData } = await loadLeagueForMember(db, leagueId, reporterUid);
  const messageDoc = await leagueRef.collection('chat').doc(messageId).get();
  if (!messageDoc.exists) {
    throw new HttpsError("not-found", "That message no longer exists.");
  }
  const message = messageDoc.data();
  if (message.userId === reporterUid) {
    throw new HttpsError("invalid-argument", "You can't report your own message.");
  }

  // One report per reporter per message. A deterministic id makes the second
  // tap a no-op instead of a duplicate row for moderators.
  const reportRef = db.collection("reports").doc(`leaguechat_${messageId}_${reporterUid}`);
  const existing = await reportRef.get();
  if (existing.exists) {
    return { success: true, message: "You've already reported this message." };
  }

  await reportRef.set({
    type: "league_message",
    leagueId,
    leagueName: leagueData.name || null,
    messageId,
    commentText: typeof message.message === "string" ? message.message : "",
    commentAuthorUid: message.userId || null,
    reporterUid,
    reason: reason.trim(),
    status: "new",
    createdAt: FieldValue.serverTimestamp(),
  });

  // Best-effort admin heads-up; the reporter never sees an email failure.
  try {
    const { fanOutToAdmins, sendAdminCommentReportEmail } = require("../helpers/emailService");
    const reporterName = await resolveDisplayName(db, reporterUid, null);
    const authorName = await resolveDisplayName(db, message.userId, null);
    await fanOutToAdmins(sendAdminCommentReportEmail, {
      reportId: reportRef.id,
      reason: reason.trim(),
      commentExcerpt: String(message.message || "").slice(0, 240),
      commentAuthor: authorName,
      reporterName,
      articleId: null,
      leagueName: leagueData.name || null,
    });
  } catch (notifyErr) {
    logger.warn("Failed to notify admins of league chat report:", notifyErr.message);
  }

  return { success: true, message: "Reported. Thanks for keeping the league civil." };
});

exports.LEAGUE_CHAT_REACTIONS = LEAGUE_CHAT_REACTIONS;
