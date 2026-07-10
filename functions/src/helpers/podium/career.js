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

// The archived-standings doc keeps every realistic field size well under the
// 1 MB doc cap; the slice only matters if Podium someday exceeds this.
const FINAL_STANDINGS_CAP = 200;

// Profile résumé rows kept per corps (matches the career history window).
const PROFILE_HISTORY_CAP = 30;

/**
 * Append the just-archived season to the PUBLIC profile résumé —
 * `corps.podiumClass.seasonHistory`, the same array shape the fantasy
 * classes archive, so the profile's Season History section renders Podium
 * rows with no special-casing (Phase 6.7, design §14.3.b). Registered-but-
 * never-performed seasons leave no row. Idempotent per season (both the
 * nightly sweep and lazy self-archival call this on their once-only branch,
 * and a seasonId guard makes double-calls harmless).
 */
async function appendProfileSeasonHistory(db, uid, seasonUid, state) {
  if (state.lastTotal == null) return false;
  const ref = store.profileRef(db, uid);
  const snapshot = await ref.get();
  const corps = snapshot.exists ? snapshot.data().corps || {} : {};
  const existing = (corps.podiumClass && corps.podiumClass.seasonHistory) || [];
  if (existing.some((row) => row && row.seasonId === seasonUid)) return false;
  const entry = {
    seasonId: seasonUid,
    seasonName: seasonUid,
    corpsName: state.corpsName || null,
    placement: state.seasonRank ?? null,
    finalScore: state.lastTotal,
    totalSeasonScore: state.lastTotal,
    showConcept: state.showConcept || null,
    medals: state.medals || {},
  };
  await ref.set(
    {
      corps: {
        podiumClass: {
          seasonHistory: [...existing.slice(-(PROFILE_HISTORY_CAP - 1)), entry],
        },
      },
    },
    { merge: true }
  );
  return true;
}

/**
 * Rank a season's swept entries into final standings (pure). Latest-total
 * ordering, matching the nightly rankings the players watched all season.
 * Unscored corps (registered, never performed) are excluded. Deterministic
 * tiebreak on uid so idempotent re-sweeps write identical docs.
 */
function buildFinalStandings(entries) {
  return entries
    .filter((entry) => entry.lastTotal != null)
    .sort((a, b) => b.lastTotal - a.lastTotal || String(a.uid).localeCompare(String(b.uid)))
    .slice(0, FINAL_STANDINGS_CAP)
    .map((entry, index) => ({ ...entry, place: index + 1 }));
}

/**
 * Archive every corps of a just-ended season into careers, then freeze the
 * season's champion + final standings into the public recap parent doc
 * (`podium-recaps/{seasonUid}`) — the permanent record the Scores archive and
 * profile résumés read. Runs once per rollover under its own lease (caller
 * provides it). Best-effort per corps; idempotent (re-sweeps skip archived
 * careers but still rebuild the identical standings doc).
 */
async function archivePodiumSeason(db, previousSeason) {
  const roster = await store.rosterCollection(db, previousSeason.seasonUid).get();
  let archived = 0;
  const swept = [];
  for (const rosterDoc of roster.docs) {
    const uid = rosterDoc.id;
    try {
      const stateSnapshot = await store.stateRef(db, uid).get();
      const state =
        stateSnapshot.exists && stateSnapshot.data().seasonUid === previousSeason.seasonUid
          ? stateSnapshot.data()
          : null;
      const careerSnapshot = await careerRef(db, uid).get();
      const career = careerSnapshot.exists ? careerSnapshot.data() : initCareer();
      if (state && career.lastSeasonUid !== previousSeason.seasonUid) {
        const updated = applySeasonResult(
          career,
          { seasonUid: previousSeason.seasonUid, seasonIndex: previousSeason.index, state },
          store.balance
        );
        updated.updatedAt = new Date().toISOString();
        await careerRef(db, uid).set(updated);
        await appendProfileSeasonHistory(db, uid, previousSeason.seasonUid, state);
        archived++;
      }
      if (state) {
        swept.push({
          uid,
          corpsName: state.corpsName || null,
          lastTotal: state.lastTotal ?? null,
          lastScoredDay: state.lastScoredDay ?? null,
          medals: state.medals || {},
        });
      } else {
        // The state was already replaced (lazy self-archival at re-registration
        // for the new season) — recover the finished season from the career.
        const entry = (career.history || []).find(
          (h) => h && h.seasonUid === previousSeason.seasonUid
        );
        if (entry) {
          swept.push({
            uid,
            corpsName: entry.corpsName || null,
            lastTotal: entry.finalsTotal ?? null,
            lastScoredDay: entry.finalsDay ?? null,
            medals: {},
          });
        }
      }
    } catch (error) {
      logger.error(`[podium] career archival failed for ${uid}: ${error.message}`);
    }
  }

  const finalStandings = buildFinalStandings(swept);
  await db.doc(`podium-recaps/${previousSeason.seasonUid}`).set(
    {
      seasonUid: previousSeason.seasonUid,
      seasonIndex: previousSeason.index,
      champion: finalStandings[0] || null,
      finalStandings,
      corpsCount: roster.size,
      archivedAt: new Date().toISOString(),
    },
    { merge: true }
  );

  // Hall of Champions (Phase 6.5): merge the Podium top 3 into the season's
  // champions doc — the same doc the fantasy finals write, same entry shape
  // (awardFinalsAndSaveChampions), so the Hall renders Podium class-filtered
  // with zero special-casing. Each medalist also banks a Finals medal in
  // their profile trophy case (`trophies.championships`, fantasy shape) —
  // the trophy-case client renders corpsClass podiumClass as the
  // metal-colored Gem. Isolated: a Hall failure never fails archival.
  if (finalStandings.length > 0) {
    try {
      const metals = ["gold", "silver", "bronze"];
      const champions = [];
      for (const entry of finalStandings.slice(0, 3)) {
        let username = "Unknown";
        try {
          const profileSnapshot = await store.profileRef(db, entry.uid).get();
          const profile = profileSnapshot.exists ? profileSnapshot.data() : null;
          if (profile) {
            username = profile.username || profile.displayName || "Unknown";
          }
          // Finals medal — idempotent per season (re-sweeps skip the append).
          const existing = (profile && profile.trophies && profile.trophies.championships) || [];
          const alreadyAwarded = existing.some(
            (trophy) =>
              trophy &&
              trophy.corpsClass === "podiumClass" &&
              trophy.seasonName === previousSeason.seasonUid
          );
          if (!alreadyAwarded) {
            await store.profileRef(db, entry.uid).set(
              {
                trophies: {
                  championships: [
                    ...existing,
                    {
                      type: "championship",
                      metal: metals[entry.place - 1],
                      corpsClass: "podiumClass",
                      seasonName: previousSeason.seasonUid,
                      eventName: "Podium Class Finals",
                      score: entry.lastTotal,
                      rank: entry.place,
                    },
                  ],
                },
              },
              { merge: true }
            );
          }
        } catch (profileError) {
          logger.warn(`[podium] medal/username write failed for ${entry.uid}: ${profileError.message}`);
        }
        champions.push({
          rank: entry.place,
          uid: entry.uid,
          username,
          corpsName: entry.corpsName,
          score: entry.lastTotal,
        });
      }
      const championsRef = db.doc(`season_champions/${previousSeason.seasonUid}`);
      const championsSnapshot = await championsRef.get();
      // The fantasy finals normally create this doc at day 49; if Podium is
      // the only crowned class this season, supply the doc-level fields.
      const base = championsSnapshot.exists
        ? {}
        : { seasonName: previousSeason.seasonUid, archivedAt: new Date() };
      await championsRef.set({ ...base, classes: { podiumClass: champions } }, { merge: true });
    } catch (error) {
      logger.error(`[podium] Hall of Champions merge failed (archival unaffected): ${error.message}`);
    }
  }

  logger.info(
    `[podium] archived season ${previousSeason.seasonUid} (index ${previousSeason.index}): ` +
      `${archived} careers, ${finalStandings.length} in final standings.`
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
  buildFinalStandings,
  appendProfileSeasonHistory,
  archivePodiumSeason,
};
