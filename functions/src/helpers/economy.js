// @ts-nocheck -- grandfathered when functions checkJs landed (functions/tsconfig.json); remove when this file is typed or cleaned up
// =============================================================================
// CORPSCOIN ECONOMY PRIMITIVES
//
// Shared domain logic for the CorpsCoin economy: the coin-history subcollection
// writers, the earning/unlock constants, rank-bonus lookup, and class-key
// canonicalization. These live in the helpers layer because both the economy
// callables (callable/economy.js) AND the scoring / season-rollover / league
// pipelines (helpers/*.js) depend on them. Previously they lived in
// callable/economy.js and the helpers reached "upward" into the callable layer
// to get them — an inverted dependency. The callables now import from here.
// =============================================================================

const admin = require("firebase-admin");
const { paths } = require("./paths");
const { SHOW_PARTICIPATION_REWARDS, CLASS_UNLOCK_COSTS } = require("./classRegistry");

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
  return db.collection(paths.userCorpsCoinHistory(uid));
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
// ECONOMY CONSTANTS
//
// EARNING SOURCES:
// - Show participation: 50-200 CC per show (by class) — SHOW_PARTICIPATION_REWARDS
// - Weekly league win: 100 CC
// - Season finish bonus: 250-1000 CC (based on final rank)
//
// SPENDING:
// - Class unlocks (one-time): A=1000, Open=2500, World=5000 — CLASS_UNLOCK_COSTS
// - League entry fees (optional, commissioner-set)
//
// SHOW_PARTICIPATION_REWARDS and CLASS_UNLOCK_COSTS come from the class-capability
// registry (helpers/classRegistry, Phase 1.1) and are re-exported here so the
// economy stays the single import surface for economy values.
// =============================================================================

/** Weekly league win reward */
const WEEKLY_LEAGUE_WIN_REWARD = 100;

/** Season finish bonuses based on final rank */
const SEASON_FINISH_BONUSES = {
  1: 1000, // Champion
  2: 750, // 2nd place
  3: 500, // 3rd place
  top10: 350, // 4th-10th place
  top25: 250, // 11th-25th place
};

/** Transaction types for history tracking */
const TRANSACTION_TYPES = {
  SHOW_PARTICIPATION: "show_participation",
  LEAGUE_WIN: "league_win",
  SEASON_BONUS: "season_bonus",
  CLASS_UNLOCK: "class_unlock",
  LEAGUE_ENTRY: "league_entry",
  COSMETIC_PURCHASE: "cosmetic_purchase",
  // Podium Class Corps Budget: CC committed from the wallet into a season's
  // operating ledger, and the end-of-season sweep of the unspent balance back.
  PODIUM_BUDGET_COMMIT: "podium_budget_commit",
  PODIUM_BUDGET_REFUND: "podium_budget_refund",
};

/**
 * Normalize a class key to canonical form stored in `unlockedClasses`.
 * Historical code wrote short keys ('open', 'world') while the rest of the app
 * expects canonical keys ('openClass', 'worldClass'). All writes now use canonical.
 */
const CANONICAL_CLASS_KEY = {
  soundSport: "soundSport",
  aClass: "aClass",
  open: "openClass",
  openClass: "openClass",
  world: "worldClass",
  worldClass: "worldClass",
};

function toCanonicalClass(key) {
  return CANONICAL_CLASS_KEY[key] || key;
}

/**
 * Pure lookup: CorpsCoin bonus and label for a final season rank.
 * Used by the season-rollover payout in helpers/season.js.
 * Ranks below top 25 earn no coin bonus.
 */
const getSeasonBonusAmount = (finalRank) => {
  if (!finalRank || finalRank <= 0) return { amount: 0, rankDescription: "" };
  if (finalRank === 1) return { amount: SEASON_FINISH_BONUSES[1], rankDescription: "Champion" };
  if (finalRank === 2) return { amount: SEASON_FINISH_BONUSES[2], rankDescription: "2nd place" };
  if (finalRank === 3) return { amount: SEASON_FINISH_BONUSES[3], rankDescription: "3rd place" };
  if (finalRank <= 10) {
    return { amount: SEASON_FINISH_BONUSES.top10, rankDescription: `${finalRank}th place (Top 10)` };
  }
  if (finalRank <= 25) {
    return { amount: SEASON_FINISH_BONUSES.top25, rankDescription: `${finalRank}th place (Top 25)` };
  }
  return { amount: 0, rankDescription: "" };
};

module.exports = {
  // History subcollection helpers
  getHistoryCollection,
  addCoinHistoryEntryToBatch,
  addCoinHistoryEntryToTransaction,

  // Rank-bonus lookup + class-key canonicalization
  getSeasonBonusAmount,
  toCanonicalClass,

  // Constants
  WEEKLY_LEAGUE_WIN_REWARD,
  SEASON_FINISH_BONUSES,
  TRANSACTION_TYPES,

  // Re-exported from the class registry (single import surface for economy values)
  SHOW_PARTICIPATION_REWARDS,
  CLASS_UNLOCK_COSTS,
};
