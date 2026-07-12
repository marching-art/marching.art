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
const divisions = require("./divisions");

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
 * The most recent PREVIOUS season ({seasonUid, index}) from the global index
 * history, or null. Lets the nightly stage re-attempt a failed archival
 * sweep on later nights — ensureSeasonIndex only reports `previous` on the
 * single call that performs the rollover.
 */
async function latestPreviousSeason(db) {
  const snapshot = await db.doc(SEASONS_DOC).get();
  if (!snapshot.exists) return null;
  let latest = null;
  for (const entry of Object.values(snapshot.data().history || {})) {
    if (entry && entry.seasonUid && (!latest || entry.index > latest.index)) {
      latest = { seasonUid: entry.seasonUid, index: entry.index };
    }
  }
  return latest;
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
 * Tier-relative season performance (0-100) — how close to this corps' own tier
 * ceiling it finished. Scoring is reputation-gated, so the reputation ladder
 * climbs on performance AT YOUR ALTITUDE, not absolute field position (§5.13).
 * Uses the corps' last scored day so a mid-season disappearance is judged where
 * it stopped, not at day 49.
 */
function finalsPercentile(state) {
  if (state.lastTotal == null || state.lastScoredDay == null) return null;
  return engine.tierPerformance(
    state.lastTotal,
    state.lastScoredDay,
    state.repTier || 1,
    store.curves,
    store.balance
  );
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
      // Transactional per corps: registerPodiumCorps can lazily self-archive
      // and/or freshStart-reset the career concurrently on rollover night —
      // re-reading state AND career inside the transaction guarantees the
      // sweep never clobbers a just-committed registration (both sides are
      // idempotent via the lastSeasonUid / seasonUid guards).
      const { state, career } = await db.runTransaction(async (transaction) => {
        const stateSnapshot = await transaction.get(store.stateRef(db, uid));
        const txnState =
          stateSnapshot.exists && stateSnapshot.data().seasonUid === previousSeason.seasonUid
            ? stateSnapshot.data()
            : null;
        const careerSnapshot = await transaction.get(careerRef(db, uid));
        const txnCareer = careerSnapshot.exists ? careerSnapshot.data() : initCareer();
        if (txnState && txnCareer.lastSeasonUid !== previousSeason.seasonUid) {
          const updated = applySeasonResult(
            txnCareer,
            { seasonUid: previousSeason.seasonUid, seasonIndex: previousSeason.index, state: txnState },
            store.balance
          );
          updated.updatedAt = new Date().toISOString();
          transaction.set(careerRef(db, uid), updated);
          return { state: txnState, career: txnCareer, didArchive: true };
        }
        return { state: txnState, career: txnCareer, didArchive: false };
      }).then(async (result) => {
        if (result.didArchive) {
          await appendProfileSeasonHistory(db, uid, previousSeason.seasonUid, result.state);
          archived++;
        }
        return result;
      });
      if (state) {
        swept.push({
          uid,
          corpsName: state.corpsName || null,
          lastTotal: state.lastTotal ?? null,
          lastScoredDay: state.lastScoredDay ?? null,
          medals: state.medals || {},
          division: divisions.normalizeDivision(state.division || career.division),
          underCutoffSeasons: career.underCutoffSeasons || 0,
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
            division: divisions.normalizeDivision(career.division),
            underCutoffSeasons: career.underCutoffSeasons || 0,
          });
        }
      }
    } catch (error) {
      logger.error(`[podium] career archival failed for ${uid}: ${error.message}`);
    }
  }

  const finalStandings = buildFinalStandings(swept);

  // Staff resumes need no archival sweep: each staffer is retained on the
  // director's own state and banks the finished season onto its resume as it
  // ages into the next season at re-registration (staffMarket.ageStaff).

  // --- Division re-seat (design §5.7, decision 26) --------------------------
  // Assess the veteran pool against published percentile cutoffs and write
  // each corps' next-season seat into its career. If the corps already
  // re-registered for the new season (rollover-night race), its live state
  // and profile display are re-stamped with the assessed seat so nobody
  // plays a whole season in yesterday's division.
  const assessment = divisions.assessDivisions(
    swept.map((entry) => ({
      uid: entry.uid,
      division: entry.division,
      finalsTotal: entry.lastTotal,
      underCutoffSeasons: entry.underCutoffSeasons,
    })),
    store.balance
  );
  for (const [uid, seat] of Object.entries(assessment.next)) {
    try {
      await careerRef(db, uid).set(
        {
          division: seat.division,
          underCutoffSeasons: seat.underCutoffSeasons,
          updatedAt: new Date().toISOString(),
        },
        { merge: true }
      );
      const liveState = await store.stateRef(db, uid).get();
      if (liveState.exists && liveState.data().seasonUid !== previousSeason.seasonUid) {
        await store.stateRef(db, uid).set({ division: seat.division }, { merge: true });
        await store
          .profileRef(db, uid)
          .set({ corps: { podiumClass: { division: seat.division } } }, { merge: true });
      }
    } catch (error) {
      logger.error(`[podium] division seat write failed for ${uid}: ${error.message}`);
    }
  }

  // Champions per division — the FMA rise: every division crowns its own.
  const divisionChampions = {};
  for (const division of divisions.DIVISIONS) {
    const top = finalStandings.find((entry) => entry.division === division);
    if (top) {
      divisionChampions[division] = {
        uid: top.uid,
        corpsName: top.corpsName,
        score: top.lastTotal,
        place: top.place,
      };
    }
  }

  await db.doc(`podium-recaps/${previousSeason.seasonUid}`).set(
    {
      seasonUid: previousSeason.seasonUid,
      seasonIndex: previousSeason.index,
      champion: finalStandings[0] || null,
      finalStandings,
      divisionChampions,
      divisions: {
        cutoffs: assessment.cutoffs,
        nextSeasonCounts: assessment.counts,
      },
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
      // Finals hardware per DIVISION (the FMA rise: every division medals
      // its own podium). A director fields one corps in one division, so the
      // per-user corpsClass+seasonName dedupe still holds.
      let hallChampions = [];
      for (const division of [...divisions.DIVISIONS].reverse()) {
        const divisionStandings = finalStandings.filter((entry) => entry.division === division);
        if (divisionStandings.length === 0) continue;
        const eventName = `Podium ${divisions.DIVISION_LABELS[division]} Finals`;
        const champions = [];
        for (let i = 0; i < Math.min(3, divisionStandings.length); i++) {
          const entry = divisionStandings[i];
          const medalRank = i + 1;
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
                        metal: metals[medalRank - 1],
                        corpsClass: "podiumClass",
                        seasonName: previousSeason.seasonUid,
                        eventName,
                        score: entry.lastTotal,
                        rank: medalRank,
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
            rank: medalRank,
            uid: entry.uid,
            username,
            corpsName: entry.corpsName,
            score: entry.lastTotal,
          });
        }
        // The Hall of Champions shows the TOP active division's podium —
        // World once it exists, the highest formed division until then.
        if (hallChampions.length === 0) hallChampions = champions;
      }
      const championsRef = db.doc(`season_champions/${previousSeason.seasonUid}`);
      const championsSnapshot = await championsRef.get();
      // The fantasy finals normally create this doc at day 49; if Podium is
      // the only crowned class this season, supply the doc-level fields.
      const base = championsSnapshot.exists
        ? {}
        : { seasonName: previousSeason.seasonUid, archivedAt: new Date() };
      await championsRef.set({ ...base, classes: { podiumClass: hallChampions } }, { merge: true });
    } catch (error) {
      logger.error(`[podium] Hall of Champions merge failed (archival unaffected): ${error.message}`);
    }
  }

  // Records Book season-total mark (§14.1.6). Isolated; strictly-better
  // merge makes re-sweeps harmless.
  if (finalStandings.length > 0) {
    try {
      const { updateSeasonBestRecords } = require("../gameRecords");
      const top = finalStandings[0];
      await updateSeasonBestRecords(
        db,
        [{ corpsClass: "podiumClass", value: top.lastTotal, corpsName: top.corpsName, uid: top.uid }],
        previousSeason.seasonUid
      );
    } catch (error) {
      logger.error(`[podium] season-best record failed (archival unaffected): ${error.message}`);
    }
  }

  // Fan Favorite (decision 30): crown the finals-ballot winner with the
  // season record. Isolated + idempotent.
  try {
    const fanFavorite = require("./fanFavorite");
    const winner = await fanFavorite.crownWinner(db, previousSeason.seasonUid);
    if (winner) {
      await db
        .doc(`podium-recaps/${previousSeason.seasonUid}`)
        .set({ fanFavorite: winner }, { merge: true });
    }
  } catch (error) {
    logger.error(`[podium] Fan Favorite crowning failed (archival unaffected): ${error.message}`);
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
  latestPreviousSeason,
  finalsPercentile,
  applySeasonResult,
  applyDormancy,
  buildFinalStandings,
  appendProfileSeasonHistory,
  archivePodiumSeason,
};
