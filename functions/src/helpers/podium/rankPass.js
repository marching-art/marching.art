/**
 * Nightly rank pass — the season-rank, medal and medal-purse writes that close
 * a Podium night, extracted from `processor.js` so the nightly processor stays
 * under the max-lines guardrail (same pattern as `scrimmagePass.js`).
 *
 * For every corps in tonight's standings: its season rank, its lifetime medal
 * counter (+1 for a medal won tonight), and — for a medal — the Corps Budget
 * purse (§5.4, `balance.budget.medalPurse`) credited on the state's ledger.
 * The display copies land on the profile. Runs after the main loop has
 * committed tonight's state; chunked batches, never a write per field.
 */

const store = require("./store");
const { ChunkedWriter } = require("../chunkedWriter");

/**
 * @param {FirebaseFirestore.Firestore} db
 * @param {object} context
 * @param {Array<{uid: string, lastTotal: number, medals?: Record<string, number>, division: string}>}
 *   context.standings tonight's standings, best first
 * @param {Record<string, string>} context.medalByUid medal won tonight, by uid
 * @param {Map<string, any>} context.stateDataByUid tonight's written state docs
 *   (mutated: a purse is credited on the ledger it carries)
 * @param {number} context.competitionDay
 * @returns {Promise<{pursesPaid: number}>}
 */
async function runRankPass(db, { standings, medalByUid, stateDataByUid, competitionDay }) {
  const rankWriter = new ChunkedWriter(db);
  let pursesPaid = 0;
  for (let i = 0; i < standings.length; i++) {
    const { uid, lastTotal, medals, division } = standings[i];
    const medalWon = medalByUid[uid];
    const updatedMedals = medalWon
      ? { ...(medals || {}), [medalWon]: ((medals || {})[medalWon] || 0) + 1 }
      : medals || {};
    // Medal purse: a podium finish pays Corps Budget on top of the flat show
    // payout, so WHERE you perform (the field you choose) matters.
    const purse = medalWon ? store.medalPurseFor(medalWon) : 0;
    const stateData = purse > 0 ? stateDataByUid.get(uid) : null;
    if (stateData) {
      store.creditBudget(stateData, purse, `purse:${medalWon}`, competitionDay);
      pursesPaid++;
    }
    rankWriter.set(
      store.stateRef(db, uid),
      {
        seasonRank: i + 1,
        seasonRankOf: standings.length,
        medals: updatedMedals,
        ...(stateData ? { budget: stateData.budget } : {}),
      },
      { merge: true }
    );
    rankWriter.set(
      store.profileRef(db, uid),
      {
        corps: {
          podiumClass: {
            totalSeasonScore: lastTotal,
            seasonRank: i + 1,
            seasonRankOf: standings.length,
            division,
            medals: updatedMedals,
          },
        },
      },
      { merge: true }
    );
  }
  await rankWriter.commit();
  return { pursesPaid };
}

module.exports = { runRankPass };
