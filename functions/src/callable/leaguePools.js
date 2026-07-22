/**
 * joinLeaguePool — buy into your league's daily prediction pool.
 *
 * A fixed POOL_ANTE is escrowed from the member's CorpsCoin into the
 * league's pools/{gameDay} doc. Entrants with a perfect prediction day
 * split the pot when the nightly scoring run settles it
 * (helpers/leaguePools.js); no winners → the pot carries to the league's
 * next pool. Any accumulated league.poolCarry is folded into a pool the
 * moment it is first created, so rollovers grow the next visible pot.
 */

const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { logger } = require("firebase-functions/v2");
const admin = require("firebase-admin");
const { getDb } = require("../config");
const { paths } = require("../helpers/paths");
const { assertAuth } = require("../helpers/callableGuards");
const { addCoinHistoryEntryToTransaction } = require("../helpers/economy");
const { getGameDay } = require("../helpers/dailyChallenges");
const { POOL_ANTE } = require("../helpers/leaguePools");

const joinLeaguePool = onCall({ cors: true }, async (request) => {
  const uid = assertAuth(request);
  const { leagueId } = request.data || {};
  if (!leagueId || typeof leagueId !== "string") {
    throw new HttpsError("invalid-argument", "A leagueId is required.");
  }

  const db = getDb();
  const leagueRef = db.doc(paths.league(leagueId));
  const profileRef = db.doc(paths.userProfile(uid));

  try {
    const result = await db.runTransaction(async (transaction) => {
      const gameDay = getGameDay();
      const poolRef = leagueRef.collection("pools").doc(gameDay);

      const [leagueDoc, poolDoc, profileDoc] = await Promise.all([
        transaction.get(leagueRef),
        transaction.get(poolRef),
        transaction.get(profileRef),
      ]);

      if (!leagueDoc.exists) {
        throw new HttpsError("not-found", "League not found.");
      }
      if (!(leagueDoc.data().members || []).includes(uid)) {
        throw new HttpsError("permission-denied", "You must be a league member to buy in.");
      }
      if (!profileDoc.exists) {
        throw new HttpsError("not-found", "User profile not found.");
      }

      const pool = poolDoc.exists ? poolDoc.data() : null;
      if (pool?.resolved) {
        throw new HttpsError("failed-precondition", "Today's pool is already settled.");
      }
      if (pool?.entrants?.[uid]) {
        return { success: true, alreadyIn: true, pot: pool.pot || 0 };
      }

      const balance = profileDoc.data().corpsCoin || 0;
      if (balance < POOL_ANTE) {
        throw new HttpsError(
          "failed-precondition",
          `Not enough CorpsCoin. The buy-in is ${POOL_ANTE} CC.`
        );
      }

      // Fold any carried-over pot into a newly created pool.
      const carry = pool ? 0 : leagueDoc.data().poolCarry || 0;
      const newPot = (pool?.pot || 0) + carry + POOL_ANTE;

      transaction.set(
        poolRef,
        {
          gameDay,
          pot: newPot,
          ante: POOL_ANTE,
          entrants: { ...(pool?.entrants || {}), [uid]: true },
          resolved: false,
          ...(pool ? {} : { createdAt: new Date(), carriedIn: carry }),
        },
        { merge: true }
      );
      if (carry > 0) {
        transaction.update(leagueRef, { poolCarry: 0 });
      }
      transaction.update(profileRef, {
        corpsCoin: admin.firestore.FieldValue.increment(-POOL_ANTE),
      });
      addCoinHistoryEntryToTransaction(transaction, db, uid, {
        type: "league_pool_entry",
        amount: -POOL_ANTE,
        description: `Buy-in — ${leagueDoc.data().name || "league"} prediction pool`,
        leagueId,
      });

      return { success: true, pot: newPot, ante: POOL_ANTE };
    });

    if (result.success && !result.alreadyIn) {
      logger.info(`User ${uid} bought into league ${leagueId} pool (pot now ${result.pot} CC)`);
    }
    return result;
  } catch (error) {
    logger.error(`Error joining league pool for user ${uid}:`, error);
    if (error instanceof HttpsError) throw error;
    throw new HttpsError("internal", "Failed to join the pool.");
  }
});

module.exports = { joinLeaguePool };
