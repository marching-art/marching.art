const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { logger } = require("firebase-functions/v2");
const admin = require("firebase-admin");
const { getDb, dataNamespaceParam } = require("../config");

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
 * CorpsCoin earning amounts by class for show participation
 */
const SHOW_PARTICIPATION_REWARDS = {
  soundSport: 50,
  aClass: 100,
  open: 150,
  world: 200,
};

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
 * Class unlock costs with CorpsCoin
 */
const CLASS_UNLOCK_COSTS = {
  aClass: 1000,
  open: 2500,
  world: 5000,
};

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

/**
 * Award CorpsCoin after show performance (called by scoring functions)
 */
const awardCorpsCoin = async (uid, corpsClass, showName, customAmount = null) => {
  const db = getDb();
  const profileRef = db.doc(`artifacts/${dataNamespaceParam.value()}/users/${uid}/profile/data`);

  try {
    const amount = customAmount !== null ? customAmount : (SHOW_PARTICIPATION_REWARDS[corpsClass] || 0);
    if (amount === 0) return;

    await db.runTransaction(async (transaction) => {
      const profileDoc = await transaction.get(profileRef);
      if (!profileDoc.exists) return;

      const currentBalance = profileDoc.data().corpsCoin || 0;
      const newBalance = currentBalance + amount;

      // Create history entry
      const historyEntry = {
        type: TRANSACTION_TYPES.SHOW_PARTICIPATION,
        amount: amount,
        balance: newBalance,
        description: `Show performance at ${showName}`,
        corpsClass: corpsClass,
        timestamp: new Date(),
      };

      transaction.update(profileRef, {
        corpsCoin: newBalance,
        corpsCoinHistory: admin.firestore.FieldValue.arrayUnion(historyEntry),
      });
    });

    logger.info(`Awarded ${amount} CorpsCoin to user ${uid} for ${corpsClass} performance at ${showName}`);
    return { success: true, amount };
  } catch (error) {
    logger.error(`Error awarding CorpsCoin to user ${uid}:`, error);
    return { success: false, error: error.message };
  }
};

/**
 * Award weekly league win bonus
 */
const awardLeagueWinBonus = async (uid, leagueName, week) => {
  const db = getDb();
  const profileRef = db.doc(`artifacts/${dataNamespaceParam.value()}/users/${uid}/profile/data`);

  try {
    await db.runTransaction(async (transaction) => {
      const profileDoc = await transaction.get(profileRef);
      if (!profileDoc.exists) return;

      const currentBalance = profileDoc.data().corpsCoin || 0;
      const newBalance = currentBalance + WEEKLY_LEAGUE_WIN_REWARD;

      const historyEntry = {
        type: TRANSACTION_TYPES.LEAGUE_WIN,
        amount: WEEKLY_LEAGUE_WIN_REWARD,
        balance: newBalance,
        description: `Week ${week} win in ${leagueName}`,
        timestamp: new Date(),
      };

      transaction.update(profileRef, {
        corpsCoin: newBalance,
        corpsCoinHistory: admin.firestore.FieldValue.arrayUnion(historyEntry),
      });
    });

    logger.info(`Awarded ${WEEKLY_LEAGUE_WIN_REWARD} CorpsCoin to user ${uid} for Week ${week} league win`);
    return { success: true, amount: WEEKLY_LEAGUE_WIN_REWARD };
  } catch (error) {
    logger.error(`Error awarding league win bonus to user ${uid}:`, error);
    return { success: false, error: error.message };
  }
};

/**
 * Award season finish bonus based on final ranking
 */
const awardSeasonBonus = async (uid, finalRank, seasonName, corpsClass) => {
  const db = getDb();
  const profileRef = db.doc(`artifacts/${dataNamespaceParam.value()}/users/${uid}/profile/data`);

  // Determine bonus amount based on rank
  let amount = 0;
  let rankDescription = '';

  if (finalRank === 1) {
    amount = SEASON_FINISH_BONUSES[1];
    rankDescription = 'Champion';
  } else if (finalRank === 2) {
    amount = SEASON_FINISH_BONUSES[2];
    rankDescription = '2nd place';
  } else if (finalRank === 3) {
    amount = SEASON_FINISH_BONUSES[3];
    rankDescription = '3rd place';
  } else if (finalRank <= 10) {
    amount = SEASON_FINISH_BONUSES.top10;
    rankDescription = `${finalRank}th place (Top 10)`;
  } else if (finalRank <= 25) {
    amount = SEASON_FINISH_BONUSES.top25;
    rankDescription = `${finalRank}th place (Top 25)`;
  }

  if (amount === 0) return { success: true, amount: 0 }; // No bonus for ranks below top 25

  try {
    await db.runTransaction(async (transaction) => {
      const profileDoc = await transaction.get(profileRef);
      if (!profileDoc.exists) return;

      const currentBalance = profileDoc.data().corpsCoin || 0;
      const newBalance = currentBalance + amount;

      const historyEntry = {
        type: TRANSACTION_TYPES.SEASON_BONUS,
        amount: amount,
        balance: newBalance,
        description: `${rankDescription} in ${seasonName} (${corpsClass})`,
        finalRank: finalRank,
        corpsClass: corpsClass,
        timestamp: new Date(),
      };

      transaction.update(profileRef, {
        corpsCoin: newBalance,
        corpsCoinHistory: admin.firestore.FieldValue.arrayUnion(historyEntry),
      });
    });

    logger.info(`Awarded ${amount} CorpsCoin to user ${uid} for ${rankDescription} finish in ${seasonName}`);
    return { success: true, amount, rank: finalRank };
  } catch (error) {
    logger.error(`Error awarding season bonus to user ${uid}:`, error);
    return { success: false, error: error.message };
  }
};

// =============================================================================
// SPENDING FUNCTIONS
// =============================================================================

/**
 * Unlock a class with CorpsCoin
 */
const unlockClassWithCorpsCoin = onCall({ cors: true }, async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "You must be logged in.");
  }

  const { classToUnlock } = request.data;
  const uid = request.auth.uid;

  if (!['aClass', 'open', 'world'].includes(classToUnlock)) {
    throw new HttpsError("invalid-argument", "Invalid class specified.");
  }

  const cost = CLASS_UNLOCK_COSTS[classToUnlock];
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
      const unlockedClasses = profileData.unlockedClasses || ['soundSport'];

      if (unlockedClasses.includes(classToUnlock)) {
        throw new HttpsError("already-exists", "Class already unlocked.");
      }

      if (currentCoin < cost) {
        throw new HttpsError("failed-precondition", `Insufficient CorpsCoin. Need ${cost}, have ${currentCoin}.`);
      }

      const newBalance = currentCoin - cost;
      unlockedClasses.push(classToUnlock);

      // Create history entry
      const historyEntry = {
        type: TRANSACTION_TYPES.CLASS_UNLOCK,
        amount: -cost,
        balance: newBalance,
        description: `Unlocked ${classToUnlock}`,
        classUnlocked: classToUnlock,
        timestamp: new Date(),
      };

      transaction.update(profileRef, {
        corpsCoin: newBalance,
        unlockedClasses: unlockedClasses,
        corpsCoinHistory: admin.firestore.FieldValue.arrayUnion(historyEntry),
      });

      return { newBalance, classUnlocked: classToUnlock };
    });

    logger.info(`User ${uid} unlocked ${classToUnlock} with ${cost} CorpsCoin`);
    return {
      success: true,
      message: `${classToUnlock} unlocked!`,
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
 * Pay league entry fee (for commissioner-set league fees)
 */
const payLeagueEntryFee = async (uid, leagueId, leagueName, fee) => {
  if (fee <= 0) return { success: true, amount: 0 }; // No fee

  const db = getDb();
  const profileRef = db.doc(`artifacts/${dataNamespaceParam.value()}/users/${uid}/profile/data`);

  try {
    await db.runTransaction(async (transaction) => {
      const profileDoc = await transaction.get(profileRef);
      if (!profileDoc.exists) {
        throw new Error("User profile not found.");
      }

      const profileData = profileDoc.data();
      const currentCoin = profileData.corpsCoin || 0;

      if (currentCoin < fee) {
        throw new Error(`Insufficient CorpsCoin. Need ${fee}, have ${currentCoin}.`);
      }

      const newBalance = currentCoin - fee;

      const historyEntry = {
        type: TRANSACTION_TYPES.LEAGUE_ENTRY,
        amount: -fee,
        balance: newBalance,
        description: `Entry fee for ${leagueName}`,
        leagueId: leagueId,
        timestamp: new Date(),
      };

      transaction.update(profileRef, {
        corpsCoin: newBalance,
        corpsCoinHistory: admin.firestore.FieldValue.arrayUnion(historyEntry),
      });
    });

    logger.info(`User ${uid} paid ${fee} CorpsCoin entry fee for league ${leagueName}`);
    return { success: true, amount: fee };
  } catch (error) {
    logger.error(`Error processing league entry fee for user ${uid}:`, error);
    return { success: false, error: error.message };
  }
};

// =============================================================================
// QUERY FUNCTIONS
// =============================================================================

/**
 * Get CorpsCoin balance and history
 */
const getCorpsCoinHistory = onCall({ cors: true }, async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "You must be logged in.");
  }

  const uid = request.auth.uid;
  const { limit = 50 } = request.data || {};

  const db = getDb();
  const profileRef = db.doc(`artifacts/${dataNamespaceParam.value()}/users/${uid}/profile/data`);

  try {
    const profileDoc = await profileRef.get();
    if (!profileDoc.exists) {
      throw new HttpsError("not-found", "User profile not found.");
    }

    const profileData = profileDoc.data();
    const balance = profileData.corpsCoin || 0;
    const history = (profileData.corpsCoinHistory || [])
      .sort((a, b) => {
        const timeA = a.timestamp?.toDate?.() || new Date(a.timestamp);
        const timeB = b.timestamp?.toDate?.() || new Date(b.timestamp);
        return timeB - timeA;
      })
      .slice(0, limit);

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
 * Get earning opportunities summary
 */
const getEarningOpportunities = onCall({ cors: true }, async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "You must be logged in.");
  }

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
  awardCorpsCoin,
  awardLeagueWinBonus,
  awardSeasonBonus,

  // Spending functions
  unlockClassWithCorpsCoin,
  payLeagueEntryFee,

  // Query functions
  getCorpsCoinHistory,
  getEarningOpportunities,

  // Constants (for use in other modules)
  SHOW_PARTICIPATION_REWARDS,
  WEEKLY_LEAGUE_WIN_REWARD,
  SEASON_FINISH_BONUSES,
  CLASS_UNLOCK_COSTS,
  TRANSACTION_TYPES,
};
