/**
 * Economy instrumentation — total CorpsCoin minted vs. sunk per window,
 * broken down by transaction type (GAMIFICATION.md "Instrument it").
 *
 * This is the one dashboard the closed-loop economy needs: every coin in
 * circulation was earned by playing, so if minted consistently outruns sunk,
 * prices need a nudge — and the per-type breakdown says which faucet or sink
 * to nudge. Written weekly (and on demand via the admin manualTrigger) to
 * admin-stats/economy, an admin-only doc the Admin > Jobs tab renders.
 *
 * Iterates users via listDocuments (the users/{uid} docs are implicit
 * ancestors — see scheduled/lifetimeLeaderboard.js) and queries each
 * corpsCoinHistory subcollection for the window. Per-user single-field
 * queries need no composite index.
 */

const { logger } = require("firebase-functions/v2");
const { paths } = require("./paths");

const STATS_DOC = "admin-stats/economy";
const DEFAULT_WINDOW_DAYS = 7;

/**
 * Aggregate coin-history over the trailing window.
 *
 * @param {FirebaseFirestore.Firestore} db
 * @param {{days?: number, now?: Date}} [options]
 * @returns {Promise<{windowDays:number, minted:number, sunk:number, net:number,
 *   transactions:number, activeWallets:number, byType:Object}>}
 */
async function computeEconomyStats(db, { days = DEFAULT_WINDOW_DAYS, now = new Date() } = {}) {
  const cutoff = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);

  const userDocRefs = await db.collection(paths.users()).listDocuments();

  let minted = 0;
  let sunk = 0;
  let transactions = 0;
  let activeWallets = 0;
  const byType = {}; // type -> { amount, count } (amount keeps its sign)

  // Bounded concurrency: history queries are small, but thousands of users
  // shouldn't fan out unbounded.
  const CONCURRENCY = 25;
  for (let i = 0; i < userDocRefs.length; i += CONCURRENCY) {
    const chunk = userDocRefs.slice(i, i + CONCURRENCY);
    const snapshots = await Promise.all(
      chunk.map((ref) =>
        ref.collection("corpsCoinHistory").where("timestamp", ">=", cutoff).get()
      )
    );
    for (const snap of snapshots) {
      if (snap.empty) continue;
      activeWallets += 1;
      for (const doc of snap.docs) {
        const entry = doc.data();
        const amount = Number(entry.amount) || 0;
        if (amount === 0) continue;
        transactions += 1;
        if (amount > 0) minted += amount;
        else sunk += -amount;
        const type = entry.type || "unknown";
        if (!byType[type]) byType[type] = { amount: 0, count: 0 };
        byType[type].amount += amount;
        byType[type].count += 1;
      }
    }
  }

  return {
    windowDays: days,
    minted,
    sunk,
    net: minted - sunk,
    transactions,
    activeWallets,
    byType,
  };
}

/**
 * Compute and persist the stats doc the admin page reads.
 */
async function updateEconomyStats(db, options = {}) {
  const stats = await computeEconomyStats(db, options);
  await db.doc(STATS_DOC).set(
    { ...stats, computedAt: new Date() },
    { merge: false }
  );
  logger.info(
    `Economy stats (${stats.windowDays}d): minted ${stats.minted}, sunk ${stats.sunk}, ` +
      `net ${stats.net} across ${stats.transactions} transactions / ${stats.activeWallets} wallets.`
  );
  return stats;
}

module.exports = {
  STATS_DOC,
  DEFAULT_WINDOW_DAYS,
  computeEconomyStats,
  updateEconomyStats,
};
