const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { paths } = require("../helpers/paths");
const { logger } = require("firebase-functions/v2");
const admin = require("firebase-admin");
const { getDb } = require("../config");
const { calculateXPUpdates } = require("../helpers/xpCalculations");
const { addCoinHistoryEntryToTransaction } = require("../helpers/economy");
const { assertAuth } = require("../helpers/callableGuards");
const { getJourneyStep, verifyJourneyStep } = require("../helpers/journey");

/**
 * Complete a First Season Journey step.
 *
 * Server-authoritative: validates the step exists, hasn't been completed,
 * and that the profile actually satisfies it (lineup filled, shows
 * registered, league joined, etc. — see helpers/journey.js), then pays the
 * step's XP + CorpsCoin through the shared pipelines. journey.{stepId} is a
 * server-only field, so completions can't be forged or replayed.
 */
const completeJourneyStep = onCall({ cors: true }, async (request) => {
  const uid = assertAuth(request);
  const { stepId } = request.data || {};

  const step = getJourneyStep(stepId);
  if (!step) {
    throw new HttpsError("invalid-argument", "Unknown journey step.");
  }

  const db = getDb();
  const profileRef = db.doc(paths.userProfile(uid));

  try {
    const result = await db.runTransaction(async (transaction) => {
      const profileDoc = await transaction.get(profileRef);
      if (!profileDoc.exists) {
        throw new HttpsError("not-found", "User profile not found.");
      }
      const profileData = profileDoc.data();

      if (profileData.journey?.[step.id]) {
        return { alreadyCompleted: true };
      }

      // Podium Rookie Journey steps verify against the server-only podium
      // state doc as well (helpers/journey.js PODIUM_JOURNEY_STEPS).
      let podiumState = null;
      if (step.id.startsWith("podium_")) {
        const podiumStateRef = db.doc(
          paths.userPodiumState(uid)
        );
        const podiumStateDoc = await transaction.get(podiumStateRef);
        podiumState = podiumStateDoc.exists ? podiumStateDoc.data() : null;
      }

      if (!verifyJourneyStep(step, profileData, podiumState)) {
        throw new HttpsError(
          "failed-precondition",
          `Not there yet — ${step.description.toLowerCase()} first.`
        );
      }

      const xpResult = calculateXPUpdates(profileData, step.xp);
      const updates = {
        [`journey.${step.id}`]: new Date().toISOString(),
        ...xpResult.updates,
      };
      if (step.coin > 0) {
        updates.corpsCoin = admin.firestore.FieldValue.increment(step.coin);
      }

      transaction.update(profileRef, updates);

      if (step.coin > 0) {
        addCoinHistoryEntryToTransaction(transaction, db, uid, {
          type: 'journey_step',
          amount: step.coin,
          description: `Journey: ${step.title}`,
        });
      }

      return {
        alreadyCompleted: false,
        newLevel: xpResult.newLevel,
        classUnlocked: xpResult.classUnlocked,
      };
    });

    if (result.alreadyCompleted) {
      return { success: true, alreadyCompleted: true, xpAwarded: 0, coinAwarded: 0 };
    }

    logger.info(`User ${uid} completed journey step ${step.id} (+${step.xp} XP, +${step.coin} CC)`);
    return {
      success: true,
      alreadyCompleted: false,
      step: { id: step.id, title: step.title },
      xpAwarded: step.xp,
      coinAwarded: step.coin,
      newLevel: result.newLevel,
      classUnlocked: result.classUnlocked,
    };
  } catch (error) {
    logger.error(`Error completing journey step for user ${uid}:`, error);
    if (error instanceof HttpsError) throw error;
    throw new HttpsError("internal", "Failed to complete journey step.");
  }
});

module.exports = { completeJourneyStep };
