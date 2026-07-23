/**
 * Push Notification Service for marching.art Cloud Functions
 * Handles sending Firebase Cloud Messaging (FCM) push notifications
 */

const admin = require("firebase-admin");
const { logger } = require("firebase-functions/v2");
const { paths } = require("./paths");

// Push notification types
const PUSH_TYPES = {
  MATCHUP_START: "matchup_start",
  MATCHUP_RESULT: "matchup_result",
  SCORE_UPDATE: "score_update",
  LEAGUE_ACTIVITY: "league_activity",
  TRADE_PROPOSAL: "trade_proposal",
  SHOW_REMINDER: "show_reminder",
  LINEUP_REMINDER: "lineup_reminder",
};

// Preference field mapping
const PUSH_PREFERENCE_MAP = {
  [PUSH_TYPES.MATCHUP_START]: "matchupStart",
  [PUSH_TYPES.MATCHUP_RESULT]: "matchupResult",
  [PUSH_TYPES.SCORE_UPDATE]: "scoreUpdate",
  [PUSH_TYPES.LEAGUE_ACTIVITY]: "leagueActivity",
  [PUSH_TYPES.TRADE_PROPOSAL]: "tradeProposal",
  [PUSH_TYPES.SHOW_REMINDER]: "showReminder",
  [PUSH_TYPES.LINEUP_REMINDER]: "lineupReminder",
};

/**
 * Get user's FCM token and push preferences
 * @param {string} userId - User ID
 * @returns {Object} Token and preferences
 */
async function getUserPushConfig(userId) {
  try {
    const db = admin.firestore();
    // The FCM token lives on the owner-only private doc — profile/data is
    // world-readable and must not carry device identifiers. Tokens saved
    // before the move still sit at profile settings.fcmToken, so fall back
    // to that until the client re-registers (every enable/refresh writes to
    // the private doc now).
    const [privateDoc, profileDoc] = await db.getAll(
      db.doc(paths.userPrivate(userId)),
      db.doc(paths.userProfile(userId))
    );

    if (!profileDoc.exists && !privateDoc.exists) {
      return { token: null, preferences: null };
    }

    const settings = profileDoc.data()?.settings || {};
    const privateData = privateDoc.data() || {};
    return {
      token: privateData.fcmToken || settings.fcmToken || null,
      preferences: settings.pushPreferences || null,
    };
  } catch (error) {
    logger.error(`Error getting push config for user ${userId}:`, error);
    return { token: null, preferences: null };
  }
}

/**
 * Check if user has enabled a specific push notification type
 * @param {Object} preferences - User's push preferences
 * @param {string} pushType - Type of push notification
 * @returns {boolean}
 */
function isPushTypeEnabled(preferences, pushType) {
  if (!preferences) return false;
  if (preferences.allPush === false) return false;

  const preferenceField = PUSH_PREFERENCE_MAP[pushType];
  if (!preferenceField) return true; // Default to enabled for unknown types

  // Default to true if preference is not explicitly set
  return preferences[preferenceField] !== false;
}

/**
 * Send a push notification to a user
 * @param {string} userId - Target user ID
 * @param {Object} notification - Notification payload
 * @param {string} notification.title - Notification title
 * @param {string} notification.body - Notification body
 * @param {string} notification.url - URL to open when clicked
 * @param {string} pushType - Type of push notification (for preference checking)
 * @param {Object} data - Additional data payload
 * @returns {Promise<boolean>} Success status
 */
async function sendPushNotification(userId, { title, body, url }, pushType, data = {}) {
  try {
    const { token, preferences } = await getUserPushConfig(userId);

    // Check if user has a token
    if (!token) {
      logger.info(`No FCM token for user ${userId}, skipping push notification`);
      return false;
    }

    // Check if user has enabled this type of notification
    if (!isPushTypeEnabled(preferences, pushType)) {
      logger.info(`User ${userId} has disabled ${pushType} push notifications`);
      return false;
    }

    // Prepare the message
    const message = {
      token,
      notification: {
        title,
        body,
      },
      webpush: {
        notification: {
          icon: "/logo192.png",
          badge: "/logo192.png",
          vibrate: [100, 50, 100],
        },
        fcmOptions: {
          link: url || "https://marching.art/dashboard",
        },
      },
      data: {
        ...data,
        pushType,
        url: url || "/dashboard",
        timestamp: new Date().toISOString(),
      },
    };

    // Send the message
    const response = await admin.messaging().send(message);
    logger.info(`Push notification sent to user ${userId}: ${response}`);
    return true;
  } catch (error) {
    // Handle invalid token errors
    if (
      error.code === "messaging/registration-token-not-registered" ||
      error.code === "messaging/invalid-registration-token"
    ) {
      logger.warn(`Invalid FCM token for user ${userId}, removing token`);
      await removeInvalidToken(userId);
    } else {
      logger.error(`Error sending push notification to user ${userId}:`, error);
    }
    return false;
  }
}

/**
 * Remove invalid FCM token from user profile
 * @param {string} userId - User ID
 */
async function removeInvalidToken(userId) {
  try {
    const db = admin.firestore();
    // Clear both homes of the token: the private doc (current) and the
    // legacy profile settings field (pre-migration fallback read above).
    await db.doc(paths.userPrivate(userId)).set(
      {
        fcmToken: null,
        fcmTokenInvalidatedAt: new Date().toISOString(),
      },
      { merge: true }
    );
    await db.doc(paths.userProfile(userId)).update({
      "settings.fcmToken": null,
      "settings.fcmTokenInvalidatedAt": new Date().toISOString(),
    });
  } catch (error) {
    logger.error(`Error removing invalid token for user ${userId}:`, error);
  }
}

// =============================================================================
// NOTIFICATION SENDERS
// =============================================================================

/**
 * Send matchup starting notification
 */
async function sendMatchupStartPush(userId, opponentName, leagueName) {
  return sendPushNotification(
    userId,
    {
      title: "Matchup Starting!",
      body: `Your matchup vs ${opponentName} in ${leagueName} is about to begin!`,
      url: "/leagues",
    },
    PUSH_TYPES.MATCHUP_START,
    { opponentName, leagueName }
  );
}

/**
 * Send league activity notification
 */
async function sendLeagueActivityPush(userId, leagueName, activityType, message) {
  return sendPushNotification(
    userId,
    {
      title: leagueName,
      body: message,
      url: "/leagues",
    },
    PUSH_TYPES.LEAGUE_ACTIVITY,
    { leagueName, activityType }
  );
}

/**
 * Send show reminder notification
 */
async function sendShowReminderPush(userId, showName, hoursUntil) {
  return sendPushNotification(
    userId,
    {
      title: "Show Starting Soon",
      body: `${showName} starts in ${hoursUntil} hours. Is your lineup ready?`,
      url: "/dashboard",
    },
    PUSH_TYPES.SHOW_REMINDER,
    { showName, hoursUntil: String(hoursUntil) }
  );
}

// =============================================================================
// EXPORTS
// =============================================================================

module.exports = {
  // Types
  PUSH_TYPES,

  // Core functions
  sendPushNotification,
  getUserPushConfig,
  isPushTypeEnabled,

  // Notification senders
  sendMatchupStartPush,
  sendLeagueActivityPush,
  sendShowReminderPush,
};
