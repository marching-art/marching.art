/**
 * Private per-director fantasy caption ledger (community request).
 *
 * The public fantasy recap deliberately stores only GE/VIS/MUS for the drafted
 * classes — per-caption values would let players reverse-engineer each other's
 * lineups from the score column. The analysis-grade per-caption detail a
 * director wants for their OWN corps is therefore written here instead: an
 * owner-only, backend-written store the dashboard's Season Recap Ledger reads.
 *
 * One doc per (uid, scored day) under captionLedger/{seasonUid}/days/{day}, so a
 * re-run of a day simply overwrites it — the same idempotency the public recap
 * write has. The parent season doc need not exist for the day subcollection to
 * be written or read.
 */

const { paths } = require("./paths");

/**
 * Append one scored outing to a director's in-progress caption breakdown for
 * tonight. SoundSport is a ratings-only format — its numeric captions are never
 * surfaced anywhere — so it is deliberately excluded from the ledger.
 *
 * @param {Map<string, Array>} captionBreakdown - uid -> [outing, ...] (mutated)
 * @param {Object} outing
 * @param {string} outing.uid
 * @param {string} outing.corpsClass
 * @param {Object} outing.corps - the corps map entry (for name + location)
 * @param {Object} outing.show - the show being scored (for eventName)
 * @param {Object} outing.captions - the 8 per-caption values behind the totals
 * @param {number} outing.geScore
 * @param {number} outing.visualScore
 * @param {number} outing.musicScore
 * @param {number} outing.totalScore
 */
function collectOuting(captionBreakdown, outing) {
  const { uid, corpsClass, corps, show, captions } = outing;
  if (corpsClass === "soundSport") return;
  const outings = captionBreakdown.get(uid) || [];
  outings.push({
    corpsClass,
    corpsName: corps.corpsName,
    eventName: show.eventName,
    location: corps.location || null,
    captions,
    geScore: outing.geScore,
    visualScore: outing.visualScore,
    musicScore: outing.musicScore,
    totalScore: outing.totalScore,
  });
  captionBreakdown.set(uid, outings);
}

/**
 * Queue the private caption-ledger day docs for every director who competed
 * today onto the shared ChunkedWriter batch.
 *
 * @param {import("./chunkedWriter").ChunkedWriter} batch
 * @param {FirebaseFirestore.Firestore} db
 * @param {Object} params
 * @param {Map<string, Array>} [params.captionBreakdown] - uid -> [outing, ...]
 * @param {Object} params.seasonData
 * @param {number} params.scoredDay
 */
function writeCaptionLedgerDocs(batch, db, { captionBreakdown, seasonData, scoredDay }) {
  if (!captionBreakdown) return;
  for (const [uid, outings] of captionBreakdown.entries()) {
    if (!outings || outings.length === 0) continue;
    const ref = db.doc(paths.userCaptionLedgerDay(uid, seasonData.seasonUid, scoredDay));
    batch.set(ref, {
      day: scoredDay,
      seasonName: seasonData.name || null,
      outings,
    });
  }
}

module.exports = { collectOuting, writeCaptionLedgerDocs };
