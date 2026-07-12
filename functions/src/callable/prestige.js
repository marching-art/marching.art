const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { paths } = require("../helpers/paths");
const { logger } = require("firebase-functions/v2");
const { getDb } = require("../config");
const { addCoinHistoryEntryToTransaction } = require("./economy");
const { assertAuth } = require("../helpers/callableGuards");
const { VALID_CLASSES, isProfaneCorpsName } = require("../helpers/corpsHelpers");
const {
  PLAQUE_TIERS,
  HALL_BANNER_PRICE,
  HALL_BANNER_MAX_LENGTH,
  sanitizeBannerMessage,
} = require("../helpers/prestigeCatalog");

/**
 * Prestige sinks (WS5.6) — purely cosmetic late-game CorpsCoin purchases.
 *
 * Both write onto server-only data: retiredCorps is in the firestore.rules
 * protected profile fields (plaques carry currency, so a client-forged
 * plaque would be free), and season_champions is backend-only already.
 */

/**
 * Commission a memorial plaque for a retired corps. The plaque renders on
 * the corps' card in the Retired Corps Gallery. Upgrades are allowed only
 * to a strictly finer tier and always pay the full price of the new tier —
 * a plaque is a commissioned work, not a trade-in.
 *
 * corpsName is required alongside retiredIndex as an index-shift guard:
 * an unretire elsewhere can reindex the array between render and purchase.
 */
const purchaseRetirementPlaque = onCall({ cors: true }, async (request) => {
  const uid = assertAuth(request);
  const { retiredIndex, corpsName, tier } = request.data || {};

  const plaque = PLAQUE_TIERS[tier];
  if (!plaque) {
    throw new HttpsError("invalid-argument", "Unknown plaque tier.");
  }
  if (!Number.isInteger(retiredIndex) || retiredIndex < 0 || !corpsName) {
    throw new HttpsError("invalid-argument", "A retired corps index and name are required.");
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
      const retiredCorps = [...(profileData.retiredCorps || [])];
      const entry = retiredCorps[retiredIndex];

      if (!entry || entry.corpsName !== corpsName) {
        throw new HttpsError(
          "failed-precondition",
          "That retired corps could not be found — refresh and try again."
        );
      }

      const currentRank = entry.plaque ? (PLAQUE_TIERS[entry.plaque.tier]?.rank || 0) : 0;
      if (plaque.rank <= currentRank) {
        throw new HttpsError(
          "failed-precondition",
          `${entry.corpsName} already displays an equal or finer plaque.`
        );
      }

      const balance = profileData.corpsCoin || 0;
      if (balance < plaque.price) {
        throw new HttpsError(
          "failed-precondition",
          `Not enough CorpsCoin. Need ${plaque.price.toLocaleString()}, have ${balance.toLocaleString()}.`
        );
      }

      const newBalance = balance - plaque.price;
      retiredCorps[retiredIndex] = {
        ...entry,
        // ISO string, not serverTimestamp — FieldValues can't live in arrays
        plaque: { tier, purchasedAt: new Date().toISOString() },
      };

      transaction.update(profileRef, { corpsCoin: newBalance, retiredCorps });
      addCoinHistoryEntryToTransaction(transaction, db, uid, {
        type: "prestige",
        amount: -plaque.price,
        balance: newBalance,
        description: `${plaque.name} for ${entry.corpsName}`,
      });

      return { newBalance, corpsName: entry.corpsName };
    });

    logger.info(`User ${uid} commissioned a ${tier} plaque for ${result.corpsName}`);
    return {
      success: true,
      tier,
      newBalance: result.newBalance,
      message: `${plaque.name} commissioned for ${result.corpsName}.`,
    };
  } catch (error) {
    logger.error(`Error purchasing plaque for user ${uid}:`, error);
    if (error instanceof HttpsError) throw error;
    throw new HttpsError("internal", "Failed to commission plaque.");
  }
});

/**
 * Hang a champion's banner in the Hall of Champions. Only the rank-1 entry
 * holder for that season + class may buy one, once — the banner message
 * renders on their championship plaque forever.
 */
const purchaseHallBanner = onCall({ cors: true }, async (request) => {
  const uid = assertAuth(request);
  const { seasonId, corpsClass, message } = request.data || {};

  if (!seasonId || typeof seasonId !== "string" || seasonId.includes("/")) {
    throw new HttpsError("invalid-argument", "A season is required.");
  }
  // Podium champions hang banners too (Phase 6.5). podiumClass is not in
  // VALID_CLASSES (no fantasy lineup), but its champions live in the same
  // season_champions doc — and the rank-1 ownership check below still gates.
  if (!VALID_CLASSES.includes(corpsClass) && corpsClass !== "podiumClass") {
    throw new HttpsError("invalid-argument", "Invalid corps class.");
  }
  const banner = sanitizeBannerMessage(message);
  if (!banner) {
    throw new HttpsError(
      "invalid-argument",
      `Banner message must be 1-${HALL_BANNER_MAX_LENGTH} characters.`
    );
  }
  if (isProfaneCorpsName(banner)) {
    throw new HttpsError("invalid-argument", "Keep the banner family-friendly.");
  }

  const db = getDb();
  const championsRef = db.doc(`season_champions/${seasonId}`);
  const profileRef = db.doc(paths.userProfile(uid));

  try {
    const result = await db.runTransaction(async (transaction) => {
      const [championsDoc, profileDoc] = await Promise.all([
        transaction.get(championsRef),
        transaction.get(profileRef),
      ]);
      if (!championsDoc.exists) {
        throw new HttpsError("not-found", "Season record not found.");
      }
      if (!profileDoc.exists) {
        throw new HttpsError("not-found", "User profile not found.");
      }

      const entries = [...(championsDoc.data().classes?.[corpsClass] || [])];
      const index = entries.findIndex((e) => e.uid === uid && e.rank === 1);
      if (index === -1) {
        throw new HttpsError(
          "failed-precondition",
          "Only that season's champion can hang a banner here."
        );
      }
      if (entries[index].banner) {
        throw new HttpsError("already-exists", "Your banner already hangs for this championship.");
      }

      const profileData = profileDoc.data();
      const balance = profileData.corpsCoin || 0;
      if (balance < HALL_BANNER_PRICE) {
        throw new HttpsError(
          "failed-precondition",
          `Not enough CorpsCoin. Need ${HALL_BANNER_PRICE.toLocaleString()}, have ${balance.toLocaleString()}.`
        );
      }

      const newBalance = balance - HALL_BANNER_PRICE;
      entries[index] = {
        ...entries[index],
        banner: { message: banner, purchasedAt: new Date().toISOString() },
      };

      // corpsClass is validated against the fixed class list above, so it is
      // safe to use in a field path.
      transaction.update(championsRef, { [`classes.${corpsClass}`]: entries });
      transaction.update(profileRef, { corpsCoin: newBalance });
      addCoinHistoryEntryToTransaction(transaction, db, uid, {
        type: "prestige",
        amount: -HALL_BANNER_PRICE,
        balance: newBalance,
        description: `Hall of Champions banner (${seasonId})`,
      });

      return { newBalance, corpsName: entries[index].corpsName };
    });

    logger.info(`User ${uid} hung a Hall banner for ${seasonId}/${corpsClass}`);
    return {
      success: true,
      newBalance: result.newBalance,
      message: `Your banner now hangs in the Hall of Champions.`,
    };
  } catch (error) {
    logger.error(`Error purchasing Hall banner for user ${uid}:`, error);
    if (error instanceof HttpsError) throw error;
    throw new HttpsError("internal", "Failed to hang banner.");
  }
});

module.exports = { purchaseRetirementPlaque, purchaseHallBanner };
