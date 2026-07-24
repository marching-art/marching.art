const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { paths } = require("../helpers/paths");
const { logger } = require("firebase-functions/v2");
const admin = require("firebase-admin");
const { getDb } = require("../config");
const { addCoinHistoryEntryToTransaction } = require("../helpers/economy");
const { assertAuth, assertWriteBudget } = require("../helpers/callableGuards");
const { getLadderTier, getSeasonXP } = require("../helpers/seasonLadder");

/**
 * Claim a seasonal reward ladder tier.
 *
 * Server-authoritative: progress is derived from profile.xp against the
 * rollover baseline (xpAtSeasonStart), claims are recorded per-season in the
 * server-only profile.seasonLadder field, and rewards (CC + the tier-12
 * exclusive title) are paid inside the transaction.
 */
const claimLadderTier = onCall({ cors: true }, async (request) => {
  const uid = assertAuth(request);
  const { tier } = request.data || {};

  const ladderTier = getLadderTier(tier);
  if (!ladderTier) {
    throw new HttpsError("invalid-argument", "Unknown ladder tier.");
  }

  const db = getDb();
  // Abuse throttle (shared engagement bucket) — far above any human rate.
  await assertWriteBudget(db, uid, "engagement", { max: 60, windowMs: 10 * 60 * 1000 });
  const seasonDoc = await db.doc("game-settings/season").get();
  if (!seasonDoc.exists) {
    throw new HttpsError("not-found", "No active season.");
  }
  const { seasonUid } = seasonDoc.data();
  const profileRef = db.doc(paths.userProfile(uid));

  try {
    const result = await db.runTransaction(async (transaction) => {
      const profileDoc = await transaction.get(profileRef);
      if (!profileDoc.exists) {
        throw new HttpsError("not-found", "User profile not found.");
      }
      const profileData = profileDoc.data();

      // Per-season claim ledger; a stale seasonUid means a fresh ladder
      const ladderState = profileData.seasonLadder || {};
      const claimed = ladderState.seasonUid === seasonUid ? ladderState.claimed || [] : [];

      if (claimed.includes(ladderTier.tier)) {
        return { alreadyClaimed: true };
      }

      const seasonXP = getSeasonXP(profileData);
      if (seasonXP < ladderTier.xp) {
        throw new HttpsError(
          "failed-precondition",
          `Not enough season XP. Tier ${ladderTier.tier} needs ${ladderTier.xp}, you have ${seasonXP}.`
        );
      }

      const updates = {
        seasonLadder: { seasonUid, claimed: [...claimed, ladderTier.tier] },
      };
      if (ladderTier.coin > 0) {
        updates.corpsCoin = admin.firestore.FieldValue.increment(ladderTier.coin);
      }
      if (ladderTier.grantItem) {
        updates['cosmetics.owned'] = admin.firestore.FieldValue.arrayUnion(ladderTier.grantItem);
      }

      transaction.update(profileRef, updates);

      if (ladderTier.coin > 0) {
        addCoinHistoryEntryToTransaction(transaction, db, uid, {
          type: 'season_ladder',
          amount: ladderTier.coin,
          description: `Season ladder tier ${ladderTier.tier}`,
        });
      }

      return { alreadyClaimed: false, grantItem: ladderTier.grantItem || null };
    });

    if (result.alreadyClaimed) {
      return { success: true, alreadyClaimed: true, coinAwarded: 0 };
    }

    logger.info(`User ${uid} claimed season ladder tier ${ladderTier.tier} (+${ladderTier.coin} CC)`);
    return {
      success: true,
      alreadyClaimed: false,
      tier: ladderTier.tier,
      coinAwarded: ladderTier.coin,
      grantItem: result.grantItem,
    };
  } catch (error) {
    logger.error(`Error claiming ladder tier for user ${uid}:`, error);
    if (error instanceof HttpsError) throw error;
    throw new HttpsError("internal", "Failed to claim ladder tier.");
  }
});

module.exports = { claimLadderTier };
