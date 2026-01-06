/**
 * Email Trigger Functions
 * Firestore triggers for real-time email notifications
 */

const { onDocumentCreated } = require("firebase-functions/v2/firestore");
const { logger } = require("firebase-functions/v2");
const admin = require("firebase-admin");
const { dataNamespaceParam } = require("../config");
const {
  sendWelcomeEmail,
  sendMilestoneEmail,
  brevoApiKey,
  EMAIL_TYPES,
} = require("../helpers/emailService");

// Streak milestones that trigger celebration emails
const STREAK_MILESTONES = [7, 14, 30, 60, 100];

/**
 * Get user email from Firebase Auth
 */
async function getUserEmail(uid) {
  try {
    const userRecord = await admin.auth().getUser(uid);
    return userRecord.email;
  } catch (error) {
    logger.warn(`Could not get email for user ${uid}:`, error.message);
    return null;
  }
}

/**
 * Send welcome email when a new user profile is created
 */
exports.onProfileCreated = onDocumentCreated(
  {
    document: "artifacts/{namespace}/users/{userId}/profile/data",
    secrets: [brevoApiKey],
  },
  async (event) => {
    const snapshot = event.data;
    if (!snapshot) {
      logger.info("No data in profile creation event");
      return;
    }

    const profile = snapshot.data();
    const userId = event.params.userId;

    logger.info(`New profile created for user ${userId}: ${profile.username}`);

    // Get user email from Firebase Auth
    const email = await getUserEmail(userId);
    if (!email) {
      logger.warn(`No email found for user ${userId}, skipping welcome email`);
      return;
    }

    // Send welcome email
    const success = await sendWelcomeEmail(email, profile.username || "Director");

    if (success) {
      logger.info(`Welcome email sent to ${email} for user ${userId}`);
    } else {
      logger.error(`Failed to send welcome email to ${email} for user ${userId}`);
    }
  }
);

/**
 * Send milestone email when user reaches a streak milestone
 * Triggers on profile updates that include engagement data
 */
exports.onStreakMilestoneReached = onDocumentCreated(
  {
    document: "artifacts/{namespace}/users/{userId}/streak_milestones/{milestoneId}",
    secrets: [brevoApiKey],
  },
  async (event) => {
    const snapshot = event.data;
    if (!snapshot) {
      return;
    }

    const milestone = snapshot.data();
    const userId = event.params.userId;

    logger.info(`Streak milestone reached for user ${userId}: ${milestone.days} days`);

    // Get user email
    const email = await getUserEmail(userId);
    if (!email) {
      logger.warn(`No email found for user ${userId}, skipping milestone email`);
      return;
    }

    // Get profile for username
    const namespace = dataNamespaceParam.value();
    const profileDoc = await admin
      .firestore()
      .doc(`artifacts/${namespace}/users/${userId}/profile/data`)
      .get();

    const profile = profileDoc.data() || {};

    // Check email preferences
    const emailPreferences = profile.settings?.emailPreferences || {};
    if (emailPreferences.allEmails === false || emailPreferences[EMAIL_TYPES.MILESTONE_ACHIEVED] === false) {
      logger.info(`User ${userId} has opted out of milestone emails`);
      return;
    }

    // Send milestone email
    const success = await sendMilestoneEmail(
      email,
      profile.username || "Director",
      "streak",
      milestone.days,
      milestone.xpReward || 0,
      milestone.coinReward || 0
    );

    if (success) {
      logger.info(`Milestone email sent to ${email} for ${milestone.days}-day streak`);
    }
  }
);
