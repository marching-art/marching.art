const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { paths } = require("../helpers/paths");
const { logger } = require("firebase-functions/v2");
const admin = require("firebase-admin");
const { getDb } = require("../config");
const { addCoinHistoryEntryToTransaction, TRANSACTION_TYPES } = require("../helpers/economy");
const { assertAuth, assertWriteBudget } = require("../helpers/callableGuards");
const {
  getEndowmentTier,
  newlyEarnedLegacyTitles,
  sanitizeDedication,
  MAX_LEGACY_ENTRIES,
} = require("../helpers/legacyCatalog");

/**
 * Legacy Endowments — the game's recurring CorpsCoin sink.
 *
 * Rationale and pricing live in helpers/legacyCatalog.js. In short: every other
 * sink is bought once, so an active director exhausts the whole catalog in about
 * a year and every coin after that is dead surplus. An endowment is repeatable
 * forever and purely commemorative.
 *
 * `legacy` is a server-only profile field (guarded in firestore.rules alongside
 * corpsCoin and cosmetics): it carries currency and renders on public profiles,
 * so a client write would let anyone mint a legacy for free.
 */
const makeLegacyEndowment = onCall({ cors: true }, async (request) => {
  const uid = assertAuth(request);
  const { tierId, dedication = null } = request.data || {};

  const tier = getEndowmentTier(tierId);
  if (!tier) {
    throw new HttpsError("invalid-argument", "Unknown endowment tier.");
  }

  // A dedication is optional flair. Oversized or unusable text is dropped
  // rather than rejected — the endowment is the point, not the caption.
  const cleanDedication = sanitizeDedication(dedication);

  const db = getDb();
  // Abuse throttle (shared economy bucket) — far above any human rate.
  await assertWriteBudget(db, uid, "economy");
  const profileRef = db.doc(paths.userProfile(uid));

  try {
    const result = await db.runTransaction(async (transaction) => {
      const profileDoc = await transaction.get(profileRef);
      if (!profileDoc.exists) {
        throw new HttpsError("not-found", "User profile not found.");
      }
      const profileData = profileDoc.data();

      const balance = profileData.corpsCoin || 0;
      if (balance < tier.price) {
        throw new HttpsError(
          "failed-precondition",
          `Not enough CorpsCoin. Need ${tier.price.toLocaleString()}, ` +
            `have ${balance.toLocaleString()}.`
        );
      }

      const legacy = profileData.legacy || {};
      const previousTotal = Number(legacy.total) || 0;
      const previousCount = Number(legacy.count) || 0;
      const newTotal = previousTotal + tier.price;
      const newBalance = balance - tier.price;

      const entry = {
        tierId,
        name: tier.name,
        amount: tier.price,
        at: new Date(),
        // Which season the gift was made in — the detail that turns a list of
        // amounts into a career timeline.
        seasonUid: profileData.activeSeasonId || null,
      };
      if (cleanDedication) entry.dedication = cleanDedication;

      // Newest first, then trimmed. `total` and `count` are independent
      // scalars, so trimming loses no aggregate — and corpsCoinHistory keeps
      // the complete audit trail. This only bounds the profile doc, which the
      // dashboard reads on every visit.
      const entries = [entry, ...(Array.isArray(legacy.entries) ? legacy.entries : [])].slice(
        0,
        MAX_LEGACY_ENTRIES
      );

      const owned = profileData.cosmetics?.owned || [];
      const earnedTitles = newlyEarnedLegacyTitles(newTotal, owned);

      /** @type {Record<string, unknown>} */
      const updates = {
        corpsCoin: newBalance,
        "legacy.total": newTotal,
        "legacy.count": previousCount + 1,
        "legacy.entries": entries,
        "legacy.lastEndowedAt": new Date(),
      };
      if (earnedTitles.length > 0) {
        // Grant-only titles, so they route through the same cosmetics.owned
        // machinery every other title uses and equip normally.
        updates["cosmetics.owned"] = admin.firestore.FieldValue.arrayUnion(
          ...earnedTitles.map((title) => title.itemId)
        );
      }
      transaction.update(profileRef, updates);

      addCoinHistoryEntryToTransaction(transaction, db, uid, {
        type: TRANSACTION_TYPES.LEGACY_ENDOWMENT,
        amount: -tier.price,
        balance: newBalance,
        description: `Legacy: ${tier.name}`,
        itemId: tierId,
      });

      return { newBalance, newTotal, earnedTitles };
    });

    logger.info(
      `User ${uid} endowed ${tierId} for ${tier.price} CC ` +
        `(legacy total ${result.newTotal})` +
        (result.earnedTitles.length > 0
          ? `, earning ${result.earnedTitles.map((t) => t.name).join(", ")}`
          : "")
    );

    const titleNames = result.earnedTitles.map((title) => title.name);
    return {
      success: true,
      tierId,
      name: tier.name,
      amount: tier.price,
      newBalance: result.newBalance,
      legacyTotal: result.newTotal,
      earnedTitles: result.earnedTitles,
      message:
        titleNames.length > 0
          ? `${tier.name} endowed. You are now ${titleNames.join(" and ")}.`
          : `${tier.name} endowed — it's part of your record now.`,
    };
  } catch (error) {
    logger.error(`Error making legacy endowment for user ${uid}:`, error);
    if (error instanceof HttpsError) throw error;
    throw new HttpsError("internal", "Failed to make the endowment.");
  }
});

module.exports = { makeLegacyEndowment };
