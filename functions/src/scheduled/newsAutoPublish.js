// Daily 2 PM Eastern job that publishes scheduled submissions from trusted
// authors (those with 3+ admin-approved articles). Each due submission is
// published through the same routine the admin approve flow uses, so it gets a
// Fantasy Daily-style image and full author credit.

const { onSchedule } = require("firebase-functions/v2/scheduler");
const { logger } = require("firebase-functions/v2");
const { defineSecret } = require("firebase-functions/params");
const { getDb } = require("../config");
const { publishSubmission } = require("../helpers/newsSubmissionsShared");

const geminiApiKey = defineSecret("GOOGLE_GENERATIVE_AI_API_KEY");

exports.autoPublishScheduledSubmissions = onSchedule(
  {
    schedule: "0 14 * * *", // Every day at 2:00 PM
    timeZone: "America/New_York",
    timeoutSeconds: 540,
    memory: "1GiB",
    secrets: [geminiApiKey],
  },
  async () => {
    const db = getDb();
    const now = new Date();

    // Two equality filters (no range) so no composite index is required; the
    // scheduledPublishAt gate is applied in memory.
    const snapshot = await db
      .collection("news_submissions")
      .where("autoPublish", "==", true)
      .where("status", "==", "scheduled")
      .get();

    if (snapshot.empty) {
      logger.info("[auto-publish] No scheduled submissions to publish.");
      return;
    }

    let published = 0;
    let skipped = 0;
    let failed = 0;

    for (const doc of snapshot.docs) {
      const submission = doc.data();

      // Only publish submissions whose 2 PM slot has arrived. A submission made
      // after 2 PM is scheduled for the following day and waits for that run.
      const dueAt = submission.scheduledPublishAt?.toDate?.() || null;
      if (dueAt && dueAt.getTime() > now.getTime()) {
        skipped++;
        continue;
      }

      try {
        await publishSubmission(db, {
          submissionRef: doc.ref,
          submission,
          submissionId: doc.id,
          approvedBy: "system_auto_publish",
          imageOption: "generate",
          autoPublished: true,
        });
        published++;
      } catch (error) {
        failed++;
        logger.error("[auto-publish] Failed to publish submission:", {
          submissionId: doc.id,
          error: error.message,
        });
      }
    }

    logger.info("[auto-publish] Run complete.", { published, skipped, failed });
  }
);

module.exports = {
  autoPublishScheduledSubmissions: exports.autoPublishScheduledSubmissions,
};
