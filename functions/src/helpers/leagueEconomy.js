/**
 * League economy helpers — commissioner-set entry fees.
 *
 * Fees flow into the league's prize pool, which season archival pays to the
 * league champion: a closed zero-sum loop, no new coin minted. Shared by
 * createLeague, joinLeague, and joinLeagueByCode (callable/leagues.js).
 */
const { HttpsError } = require("firebase-functions/v2/https");
const admin = require("firebase-admin");
const { addCoinHistoryEntryToTransaction, TRANSACTION_TYPES } = require("../callable/economy");

// Commissioner-set entry fee bounds (CorpsCoin)
const MAX_LEAGUE_ENTRY_FEE = 5000;

/**
 * Charge a league entry fee inside an existing join transaction: validates
 * balance, debits the profile, credits the league prize pool, and writes the
 * ledger entry. profileDoc must already have been read by the transaction.
 * The caller applies the profile corpsCoin decrement alongside its own
 * profile write. Returns the fee charged (0 when the league is free).
 */
function chargeEntryFeeInTransaction(transaction, db, uid, profileDoc, leagueRef, leagueData) {
  const entryFee = leagueData.settings?.entryFee || 0;
  if (entryFee <= 0) return 0;

  if (!profileDoc.exists) {
    throw new HttpsError("not-found", "User profile not found.");
  }
  const balance = profileDoc.data().corpsCoin || 0;
  if (balance < entryFee) {
    throw new HttpsError(
      "failed-precondition",
      `This league has a ${entryFee.toLocaleString()} CC entry fee. You have ${balance.toLocaleString()} CC.`
    );
  }

  transaction.update(leagueRef, {
    'settings.prizePool': admin.firestore.FieldValue.increment(entryFee),
  });
  addCoinHistoryEntryToTransaction(transaction, db, uid, {
    type: TRANSACTION_TYPES.LEAGUE_ENTRY,
    amount: -entryFee,
    balance: balance - entryFee,
    description: `Entry fee for ${leagueData.name}`,
    leagueId: leagueRef.id,
  });
  return entryFee;
}

module.exports = { chargeEntryFeeInTransaction, MAX_LEAGUE_ENTRY_FEE };
