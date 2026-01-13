/**
 * Push Notification Trigger Functions
 * Firestore triggers for league-related push notifications
 */

const { onDocumentCreated, onDocumentUpdated } = require("firebase-functions/v2/firestore");
const { logger } = require("firebase-functions/v2");
const admin = require("firebase-admin");
const { dataNamespaceParam } = require("../config");
const {
  sendLeagueActivityPush,
} = require("../helpers/pushService");

/**
 * Send push notification when a new member joins a league
 */
exports.onLeagueMemberJoined = onDocumentUpdated(
  {
    document: "artifacts/{namespace}/leagues/{leagueId}",
  },
  async (event) => {
    const before = event.data?.before?.data();
    const after = event.data?.after?.data();

    if (!before || !after) return;

    const beforeMembers = before.members || [];
    const afterMembers = after.members || [];

    // Check if new member added
    if (afterMembers.length <= beforeMembers.length) return;

    const newMemberId = afterMembers.find((id) => !beforeMembers.includes(id));
    if (!newMemberId) return;

    logger.info(`New member ${newMemberId} joined league ${event.params.leagueId}`);

    const namespace = dataNamespaceParam.value();

    // Get new member's username
    const newMemberProfile = await admin
      .firestore()
      .doc(`artifacts/${namespace}/users/${newMemberId}/profile/data`)
      .get();
    const newMemberName = newMemberProfile.data()?.username || "A new director";

    // Notify other members (excluding the new member)
    const otherMembers = afterMembers.filter((id) => id !== newMemberId);

    await Promise.all(
      otherMembers.map((memberId) =>
        sendLeagueActivityPush(
          memberId,
          after.name || "Your league",
          "member_joined",
          `${newMemberName} has joined the league!`
        )
      )
    );

    logger.info(`Member joined notifications sent to ${otherMembers.length} users`);
  }
);

/**
 * Send push notification when a league chat message mentions a user
 * Note: This requires @mention parsing in the message
 */
exports.onLeagueChatMessage = onDocumentCreated(
  {
    document: "artifacts/{namespace}/leagues/{leagueId}/chat/{messageId}",
  },
  async (event) => {
    const message = event.data?.data();
    if (!message) return;

    const { senderId, text } = message;

    // Check for @mentions in the message
    const mentionRegex = /@(\w+)/g;
    const mentions = text?.match(mentionRegex);

    if (!mentions || mentions.length === 0) return;

    logger.info(`Chat message with mentions: ${mentions.join(", ")}`);

    const namespace = dataNamespaceParam.value();

    // Get league info
    const leagueDoc = await admin
      .firestore()
      .doc(`artifacts/${namespace}/leagues/${event.params.leagueId}`)
      .get();
    const league = leagueDoc.data();
    if (!league) return;

    // Get sender username
    const senderProfile = await admin
      .firestore()
      .doc(`artifacts/${namespace}/users/${senderId}/profile/data`)
      .get();
    const senderName = senderProfile.data()?.username || "Someone";

    // Find mentioned users by username
    const mentionedUsernames = mentions.map((m) => m.slice(1).toLowerCase());

    // Get all league members' profiles to find matches
    const memberProfiles = await Promise.all(
      league.members.map((memberId) =>
        admin.firestore().doc(`artifacts/${namespace}/users/${memberId}/profile/data`).get()
      )
    );

    const mentionedUsers = memberProfiles
      .filter((doc) => {
        const username = doc.data()?.username?.toLowerCase();
        return username && mentionedUsernames.includes(username);
      })
      .map((doc) => doc.ref.parent.parent.id); // Get user ID from path

    // Send push to mentioned users (excluding sender)
    await Promise.all(
      mentionedUsers
        .filter((userId) => userId !== senderId)
        .map((userId) =>
          sendLeagueActivityPush(
            userId,
            league.name || "League Chat",
            "mention",
            `${senderName} mentioned you: "${text.slice(0, 50)}${text.length > 50 ? "..." : ""}"`
          )
        )
    );

    logger.info(`Mention notifications sent to ${mentionedUsers.length} users`);
  }
);
