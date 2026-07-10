/**
 * Podium careers — reputation across seasons (Phase 5, design §5.13).
 *
 * Reputation attaches to the CORPS LINEAGE, stored per director in
 * `.../users/{uid}/podium/career` (same server-only subcollection as state).
 * A monotonically increasing global season index
 * (podium-config/podiumSeasons) makes dormancy countable: a returning
 * director's missed seasons = currentIndex - lastPlayedIndex - 1.
 *
 * Rules implemented (all engine-backed, harness-asserted):
 *   - Season archival: finals percentile -> engine.updateReputation gain
 *     (near-ceiling window, heritage credit vs historicalPeak).
 *   - Dormancy: graduated decay per missed season; a corps NEVER returns
 *     stronger than it left (engine invariant).
 *   - Renaming keeps reputation (the career persists); founding fresh
 *     (freshStart) banks the old career into retiredCareers and restarts at
 *     tier 1.
 *   - Staff contracts are per-season and simply lapse (the loyalty-grace
 *     evolution is recorded in the design doc).
 */

const { logger } = require("firebase-functions/v2");
const { dataNamespaceParam } = require("../../config");
const engine = require("./engine");
const store = require("./store");

const SEASONS_DOC = "podium-config/podiumSeasons";

function careerRef(db, uid) {
  return db.doc(`artifacts/${dataNamespaceParam.value()}/users/${uid}/podium/career`);
}

/** Fresh career shape. */
function initCareer() {
  return {
    reputation: 0,
    historicalPeak: 0,
    seasonsPlayed: 0,
    lastPlayedIndex: null,
    lastSeasonUid: null,
    corpsName: null,
    history: [],
    retiredCareers: [],
  };
}

/**
 * Ensure the global Podium season index tracks the active season. Returns
 * { index, seasonUid, previous } where `previous` is the just-ended season
 * ({ index, seasonUid }) when this call performed a rollover, else null.
 * Transactional — safe under concurrent stage runs.
 */
async function ensureSeasonIndex(db, seasonData) {
  const ref = db.doc(SEASONS_DOC);
  return db.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(ref);
    if (!snapshot.exists) {
      const fresh = { current: { seasonUid: seasonData.seasonUid, index: 1 } };
      transaction.set(ref, fresh);
      return { ...fresh.current, previous: null };
    }
    const data = snapshot.data();
    if (data.current.seasonUid === seasonData.seasonUid) {
      return { ...data.current, previous: null };
    }
    const previous = data.current;
    const next = { seasonUid: seasonData.seasonUid, index: previous.index + 1 };
    transaction.set(
      ref,
      { current: next, history: { [String(previous.index)]: previous } },
      { merge: true }
    );
    return { ...next, previous };
  });
}

/**
 * Look up the global index of a past season (null when unknown).
 */
async function seasonIndexFor(db, seasonUid) {
  const snapshot = await db.doc(SEASONS_DOC).get();
  if (!snapshot.exists) return null;
  const data = snapshot.data();
  if (data.current && data.current.seasonUid === seasonUid) return data.current.index;
  for (const entry of Object.values(data.history || {})) {
    if (entry && entry.seasonUid === seasonUid) return entry.index;
  }
  return null;
}

/**
 * Percentile of a season's final result. Uses the corps' last scored day so
 * a mid-season disappearance is judged where it stopped, not at day 49.
 */
function finalsPercentile(state) {
  if (state.lastTotal == null || state.lastScoredDay == null) return null;
  return engine.percentileOfTotal(state.lastTotal, state.lastScoredDay, store.curves);
}

/**
 * Apply one played season to a career (pure). Returns the updated career.
 */
function applySeasonResult(career, { seasonUid, seasonIndex, state }, cfg) {
  const pct = finalsPercentile(state);
  const before = career.reputation;
  const after =
    pct == null
      ? before // registered but never performed: no gain, no penalty
      : engine.updateReputation(before, pct, { dormantSeasons: 0, historicalPeak: career.historicalPeak }, cfg);
  return {
    ...career,
    reputation: after,
    historicalPeak: Math.max(career.historicalPeak || 0, after),
    seasonsPlayed: (career.seasonsPlayed || 0) + 1,
    lastPlayedIndex: seasonIndex,
    lastSeasonUid: seasonUid,
    corpsName: state.corpsName || career.corpsName,
    history: [
      ...(career.history || []).slice(-29),
      {
        seasonUid,
        seasonIndex,
        corpsName: state.corpsName || null,
        finalsTotal: state.lastTotal ?? null,
        finalsDay: state.lastScoredDay ?? null,
        percentile: pct == null ? null : Math.round(pct * 10) / 10,
        reputationBefore: before,
        reputationAfter: after,
        seasonRank: state.seasonRank ?? null,
        seasonRankOf: state.seasonRankOf ?? null,
      },
    ],
  };
}

/**
 * Apply dormancy decay for missed seasons (pure). The engine guarantees the
 * return-weaker invariant.
 */
function applyDormancy(career, missedSeasons, cfg) {
  if (!missedSeasons || missedSeasons <= 0) return career;
  return {
    ...career,
    reputation: engine.updateReputation(career.reputation, 0, { dormantSeasons: missedSeasons }, cfg),
  };
}

/**
 * Archive every corps of a just-ended season into careers. Runs once per
 * rollover under its own lease (caller provides it). Best-effort per corps.
 */
async function archivePodiumSeason(db, previousSeason) {
  const roster = await store.rosterCollection(db, previousSeason.seasonUid).get();
  let archived = 0;
  for (const rosterDoc of roster.docs) {
    const uid = rosterDoc.id;
    try {
      const stateSnapshot = await store.stateRef(db, uid).get();
      if (!stateSnapshot.exists || stateSnapshot.data().seasonUid !== previousSeason.seasonUid) {
        continue;
      }
      const state = stateSnapshot.data();
      const careerSnapshot = await careerRef(db, uid).get();
      const career = careerSnapshot.exists ? careerSnapshot.data() : initCareer();
      if (career.lastSeasonUid === previousSeason.seasonUid) continue; // already archived
      const updated = applySeasonResult(
        career,
        { seasonUid: previousSeason.seasonUid, seasonIndex: previousSeason.index, state },
        store.balance
      );
      updated.updatedAt = new Date().toISOString();
      await careerRef(db, uid).set(updated);
      archived++;
    } catch (error) {
      logger.error(`[podium] career archival failed for ${uid}: ${error.message}`);
    }
  }
  logger.info(
    `[podium] archived season ${previousSeason.seasonUid} (index ${previousSeason.index}): ${archived} careers.`
  );
  return archived;
}

module.exports = {
  SEASONS_DOC,
  careerRef,
  initCareer,
  ensureSeasonIndex,
  seasonIndexFor,
  finalsPercentile,
  applySeasonResult,
  applyDormancy,
  archivePodiumSeason,
};
