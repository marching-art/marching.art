const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { logger } = require("firebase-functions/v2");
const admin = require("firebase-admin");
const { getDb, dataNamespaceParam } = require("../config");
const { calculateXPUpdates } = require("../helpers/xpCalculations");
const { assertAuth } = require("../helpers/callableGuards");

// =============================================================================
// CORPSCOIN HISTORY SUBCOLLECTION HELPERS
//
// History entries are stored in a subcollection instead of an array on the
// profile document. This prevents hitting Firestore's 1MB document size limit
// for active users with many transactions.
//
// Path: artifacts/{namespace}/users/{uid}/corpsCoinHistory/{txnId}
// =============================================================================

/**
 * Get the corpsCoinHistory subcollection reference for a user
 * @param {Object} db - Firestore instance
 * @param {string} uid - User ID
 * @returns {CollectionReference}
 */
function getHistoryCollection(db, uid) {
  return db.collection(`artifacts/${dataNamespaceParam.value()}/users/${uid}/corpsCoinHistory`);
}

/**
 * Add a CorpsCoin history entry to the subcollection.
 * Use this after a transaction has already updated the corpsCoin balance.
 *
 * @param {Object} db - Firestore instance
 * @param {string} uid - User ID
 * @param {Object} entry - History entry data
 * @returns {Promise<DocumentReference>}
 */
async function addCoinHistoryEntry(db, uid, entry) {
  const historyRef = getHistoryCollection(db, uid).doc();
  await historyRef.set({
    ...entry,
    timestamp: entry.timestamp || admin.firestore.FieldValue.serverTimestamp(),
  });
  return historyRef;
}

/**
 * Add a CorpsCoin history entry within a Firestore batch.
 * Used when coin updates are batched with other writes (e.g., scoring).
 *
 * @param {WriteBatch} batch - Firestore batch
 * @param {Object} db - Firestore instance
 * @param {string} uid - User ID
 * @param {Object} entry - History entry data
 */
function addCoinHistoryEntryToBatch(batch, db, uid, entry) {
  const historyRef = getHistoryCollection(db, uid).doc();
  batch.set(historyRef, {
    ...entry,
    timestamp: entry.timestamp || admin.firestore.FieldValue.serverTimestamp(),
  });
}

/**
 * Add a CorpsCoin history entry within a Firestore transaction.
 *
 * @param {Transaction} transaction - Firestore transaction
 * @param {Object} db - Firestore instance
 * @param {string} uid - User ID
 * @param {Object} entry - History entry data
 */
function addCoinHistoryEntryToTransaction(transaction, db, uid, entry) {
  const historyRef = getHistoryCollection(db, uid).doc();
  transaction.set(historyRef, {
    ...entry,
    timestamp: entry.timestamp || new Date(),
  });
}

// =============================================================================
// SIMPLIFIED CORPSCOIN ECONOMY
//
// EARNING SOURCES:
// - Show participation: 50-200 CC per show (by class)
// - Weekly league win: 100 CC
// - Season finish bonus: 250-1000 CC (based on final rank)
//
// SPENDING:
// - Class unlocks (one-time): A=1000, Open=2500, World=5000
// - League entry fees (optional, commissioner-set)
// =============================================================================

/**
 * CorpsCoin earning amounts by class for show participation.
 * Keyed by canonical class names (the scoring loop looks up the corps-map
 * key, which is always canonical); legacy short aliases retained for any
 * caller still holding old-style keys — same pattern as CLASS_UNLOCK_COSTS.
 * The table was previously short-key-only, which silently paid World and
 * Open class corps ZERO show-participation coins.
 */
const { SHOW_PARTICIPATION_REWARDS, CLASS_UNLOCK_COSTS } = require("../helpers/classRegistry");

/**
 * Weekly league win reward
 */
const WEEKLY_LEAGUE_WIN_REWARD = 100;

/**
 * Season finish bonuses based on final rank
 */
const SEASON_FINISH_BONUSES = {
  1: 1000,   // Champion
  2: 750,    // 2nd place
  3: 500,    // 3rd place
  top10: 350, // 4th-10th place
  top25: 250, // 11th-25th place
};

/**
 * Class unlock costs with CorpsCoin.
 * Accepts both short ('open') and canonical ('openClass') keys — normalized before lookup.
 */
// CLASS_UNLOCK_COSTS now comes from the class-capability registry (Phase 1.1).

/**
 * Normalize a class key to canonical form stored in `unlockedClasses`.
 * Historical code wrote short keys ('open', 'world') while the rest of the app
 * expects canonical keys ('openClass', 'worldClass'). All writes now use canonical.
 */
const CANONICAL_CLASS_KEY = {
  soundSport: 'soundSport',
  aClass: 'aClass',
  open: 'openClass',
  openClass: 'openClass',
  world: 'worldClass',
  worldClass: 'worldClass',
};
function toCanonicalClass(key) {
  return CANONICAL_CLASS_KEY[key] || key;
}

/**
 * Transaction types for history tracking
 */
const TRANSACTION_TYPES = {
  SHOW_PARTICIPATION: 'show_participation',
  LEAGUE_WIN: 'league_win',
  SEASON_BONUS: 'season_bonus',
  CLASS_UNLOCK: 'class_unlock',
  LEAGUE_ENTRY: 'league_entry',
  COSMETIC_PURCHASE: 'cosmetic_purchase',
};

// =============================================================================
// EARNING FUNCTIONS
// =============================================================================
// NOTE: single-write helpers awardCorpsCoin, awardLeagueWinBonus, and
// awardSeasonBonus were removed — the live paths batch these awards instead
// (helpers/scoringAwards.js processCoinAwardsBatch / processWeeklyMatchups,
// and helpers/season.js getSeasonBonusAmount at rollover).

/**
 * Pure lookup: CorpsCoin bonus and label for a final season rank.
 * Used by the season-rollover payout in helpers/season.js.
 * Ranks below top 25 earn no coin bonus.
 */
const getSeasonBonusAmount = (finalRank) => {
  if (!finalRank || finalRank <= 0) return { amount: 0, rankDescription: '' };
  if (finalRank === 1) return { amount: SEASON_FINISH_BONUSES[1], rankDescription: 'Champion' };
  if (finalRank === 2) return { amount: SEASON_FINISH_BONUSES[2], rankDescription: '2nd place' };
  if (finalRank === 3) return { amount: SEASON_FINISH_BONUSES[3], rankDescription: '3rd place' };
  if (finalRank <= 10) {
    return { amount: SEASON_FINISH_BONUSES.top10, rankDescription: `${finalRank}th place (Top 10)` };
  }
  if (finalRank <= 25) {
    return { amount: SEASON_FINISH_BONUSES.top25, rankDescription: `${finalRank}th place (Top 25)` };
  }
  return { amount: 0, rankDescription: '' };
};

// =============================================================================
// SPENDING FUNCTIONS
// =============================================================================

/**
 * Unlock a class with CorpsCoin
 */
const unlockClassWithCorpsCoin = onCall({ cors: true }, async (request) => {
  const uid = assertAuth(request);
  const { classToUnlock } = request.data;

  // Accept both short ('open', 'world') and canonical ('openClass', 'worldClass')
  // keys from clients, then normalize to canonical for storage.
  const canonicalClass = toCanonicalClass(classToUnlock);
  if (!['aClass', 'openClass', 'worldClass'].includes(canonicalClass)) {
    throw new HttpsError("invalid-argument", "Invalid class specified.");
  }

  const cost = CLASS_UNLOCK_COSTS[canonicalClass];
  const db = getDb();
  const profileRef = db.doc(`artifacts/${dataNamespaceParam.value()}/users/${uid}/profile/data`);

  try {
    const result = await db.runTransaction(async (transaction) => {
      const profileDoc = await transaction.get(profileRef);
      if (!profileDoc.exists) {
        throw new HttpsError("not-found", "User profile not found.");
      }

      const profileData = profileDoc.data();
      const currentCoin = profileData.corpsCoin || 0;
      const rawUnlocked = profileData.unlockedClasses || ['soundSport'];
      // Normalize stored entries so legacy short keys ('open', 'world') are
      // treated as already-unlocked for the canonical class.
      const unlockedClasses = Array.from(
        new Set(rawUnlocked.map((c) => toCanonicalClass(c)))
      );

      if (unlockedClasses.includes(canonicalClass)) {
        throw new HttpsError("already-exists", "Class already unlocked.");
      }

      if (currentCoin < cost) {
        throw new HttpsError("failed-precondition", `Insufficient CorpsCoin. Need ${cost}, have ${currentCoin}.`);
      }

      const newBalance = currentCoin - cost;
      unlockedClasses.push(canonicalClass);

      transaction.update(profileRef, {
        corpsCoin: newBalance,
        unlockedClasses: unlockedClasses,
      });

      addCoinHistoryEntryToTransaction(transaction, db, uid, {
        type: TRANSACTION_TYPES.CLASS_UNLOCK,
        amount: -cost,
        balance: newBalance,
        description: `Unlocked ${canonicalClass}`,
        classUnlocked: canonicalClass,
      });

      return { newBalance, classUnlocked: canonicalClass };
    });

    logger.info(`User ${uid} unlocked ${result.classUnlocked} with ${cost} CorpsCoin`);
    return {
      success: true,
      message: `${result.classUnlocked} unlocked!`,
      classUnlocked: result.classUnlocked,
      newBalance: result.newBalance,
    };
  } catch (error) {
    logger.error(`Error unlocking class for user ${uid}:`, error);
    if (error instanceof HttpsError) throw error;
    throw new HttpsError("internal", "Failed to unlock class.");
  }
});

/**
 * Sync class unlocks outside of XP events.
 *
 * Classes unlock by XP level (early), seasons actively completed (the
 * standard path — applied at season archival), or the distant account-age
 * backstop. XP- and archival-driven unlocks are applied when those events
 * run, but a returning user can cross the backstop threshold (or have
 * missed an archival-time grant) without any XP event. Clients call this on
 * session start; the server recomputes eligibility and persists any newly
 * unlocked classes. This replaces the old client-side unlockedClasses
 * write, which security rules no longer permit.
 */
const syncClassUnlocks = onCall({ cors: true }, async (request) => {
  const uid = assertAuth(request);
  const db = getDb();
  const profileRef = db.doc(`artifacts/${dataNamespaceParam.value()}/users/${uid}/profile/data`);

  try {
    const result = await db.runTransaction(async (transaction) => {
      const profileDoc = await transaction.get(profileRef);
      if (!profileDoc.exists) {
        throw new HttpsError("not-found", "User profile not found.");
      }

      const profileData = profileDoc.data();
      // calculateXPUpdates with 0 XP recomputes unlock eligibility and
      // canonicalizes legacy class keys without changing XP.
      const { updates, classUnlocked, unlockPath } = calculateXPUpdates(profileData, 0);

      if (!updates.unlockedClasses) {
        return {
          unlockedClasses: profileData.unlockedClasses || ["soundSport"],
          classUnlocked: null,
        };
      }

      // Persist the unlock-path marks (classUnlockPaths.*) alongside the
      // array — the client uses them for the graduation ceremony asymmetry.
      const pathUpdates = Object.fromEntries(
        Object.entries(updates).filter(([key]) => key.startsWith("classUnlockPaths."))
      );
      transaction.update(profileRef, {
        unlockedClasses: updates.unlockedClasses,
        ...pathUpdates,
      });
      return { unlockedClasses: updates.unlockedClasses, classUnlocked, unlockPath };
    });

    if (result.classUnlocked) {
      logger.info(`User ${uid} unlocked ${result.classUnlocked} via sync (${result.unlockPath})`);
    }
    return { success: true, ...result };
  } catch (error) {
    logger.error(`Error syncing class unlocks for user ${uid}:`, error);
    if (error instanceof HttpsError) throw error;
    throw new HttpsError("internal", "Failed to sync class unlocks.");
  }
});

// NOTE: payLeagueEntryFee was removed — league entry fees are charged inside
// the create/join league transactions via
// helpers/leagueEconomy.js chargeEntryFeeInTransaction.

// =============================================================================
// QUERY FUNCTIONS
// =============================================================================

/**
 * Get CorpsCoin balance and history
 */
const getCorpsCoinHistory = onCall({ cors: true }, async (request) => {
  const uid = assertAuth(request);
  const { limit: queryLimit = 50 } = request.data || {};

  const db = getDb();
  const profileRef = db.doc(`artifacts/${dataNamespaceParam.value()}/users/${uid}/profile/data`);

  try {
    // Fetch balance and history in parallel
    const [profileDoc, historySnapshot] = await Promise.all([
      profileRef.get(),
      getHistoryCollection(db, uid)
        .orderBy('timestamp', 'desc')
        .limit(queryLimit)
        .get(),
    ]);

    if (!profileDoc.exists) {
      throw new HttpsError("not-found", "User profile not found.");
    }

    const balance = profileDoc.data().corpsCoin || 0;
    const history = historySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    return {
      success: true,
      balance,
      history,
    };
  } catch (error) {
    logger.error(`Error getting CorpsCoin history for user ${uid}:`, error);
    if (error instanceof HttpsError) throw error;
    throw new HttpsError("internal", "Failed to get CorpsCoin history.");
  }
});

/**
 * Get earning opportunities summary — the in-game "how to earn" guide.
 * Every value is read from the table that actually pays it, so this guide
 * can never drift from the live economy.
 */
const getEarningOpportunities = onCall({ cors: true }, async (request) => {
  assertAuth(request);

  const { PREDICTION_COIN, PERFECT_BONUS_COIN } = require("../helpers/dailyPredictions");
  const { RARITY_CC } = require("../helpers/achievements");
  const { LADDER_TIERS } = require("../helpers/seasonLadder");
  const {
    LEVEL_UP_STIPEND,
    STREAK_MILESTONES,
    STREAK_FREEZE_COST,
  } = require("../helpers/engagementRewards");
  const { SHOP_CATALOG } = require("../helpers/shopCatalog");

  const streakCoinByDay = Object.fromEntries(
    Object.entries(STREAK_MILESTONES).map(([day, m]) => [day, m.coin])
  );
  const ladderCoinTotal = LADDER_TIERS.reduce((sum, t) => sum + (t.coin || 0), 0);
  const shopPrices = SHOP_CATALOG.filter((i) => !i.grantOnly && i.price).map((i) => i.price);

  return {
    success: true,
    opportunities: {
      showParticipation: {
        title: "Show Participation",
        description: "Earn CC for each show your corps performs at",
        rewards: SHOW_PARTICIPATION_REWARDS,
      },
      weeklyLeagueWin: {
        title: "Weekly League Win",
        description: "Win your weekly matchup to earn bonus CC",
        reward: WEEKLY_LEAGUE_WIN_REWARD,
      },
      dailyPredictions: {
        title: "Daily Predictions",
        description: `Earn ${PREDICTION_COIN} CC per correct pick, +${PERFECT_BONUS_COIN} CC bonus for a perfect day`,
        reward: PREDICTION_COIN,
      },
      streakMilestones: {
        title: "Login Streak Milestones",
        description: "CC bonuses when your daily login streak hits a milestone day",
        rewards: streakCoinByDay,
      },
      levelUpStipend: {
        title: "Level-Up Stipend",
        description: "CC for every director level you gain",
        reward: LEVEL_UP_STIPEND,
      },
      seasonLadder: {
        title: "Season Reward Ladder",
        description: `Claim ladder tiers as you earn XP — up to ${ladderCoinTotal} CC per season`,
      },
      achievements: {
        title: "Achievements",
        description: `One-time CC per achievement, ${RARITY_CC.common}–${RARITY_CC.legendary} CC by rarity`,
      },
      seasonBonus: {
        title: "Season Finish Bonus",
        description: "Earn CC based on your final season ranking",
        rewards: SEASON_FINISH_BONUSES,
      },
    },
    spending: {
      classUnlocks: {
        title: "Class Unlocks",
        description: "One-time unlock for higher competition classes",
        costs: CLASS_UNLOCK_COSTS,
      },
      streakFreeze: {
        title: "Streak Freeze",
        description: `Protect your login streak for 24 hours (${STREAK_FREEZE_COST} CC, one per 7 days)`,
      },
      shop: {
        title: "Corps Identity Shop",
        description: `Director titles, profile frames, and card themes (${Math.min(...shopPrices).toLocaleString()}–${Math.max(...shopPrices).toLocaleString()} CC)`,
      },
      leagueEntryFees: {
        title: "League Entry Fees",
        description: "Some leagues may require an entry fee (set by commissioner)",
        note: "Optional - varies by league",
      },
    },
  };
});

// =============================================================================
// EXPORTS
// =============================================================================

module.exports = {
  // Earning functions
  getSeasonBonusAmount,

  // Spending functions
  unlockClassWithCorpsCoin,

  // Progression sync
  syncClassUnlocks,

  // Query functions
  getCorpsCoinHistory,
  getEarningOpportunities,

  // History subcollection helpers (for use in scoring.js, dailyOps.js, etc.)
  addCoinHistoryEntry,
  addCoinHistoryEntryToBatch,
  addCoinHistoryEntryToTransaction,

  // Constants (for use in other modules)
  SHOW_PARTICIPATION_REWARDS,
  WEEKLY_LEAGUE_WIN_REWARD,
  SEASON_FINISH_BONUSES,
  CLASS_UNLOCK_COSTS,
  TRANSACTION_TYPES,
};
