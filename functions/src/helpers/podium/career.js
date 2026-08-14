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
const { paths } = require("../paths");
const economy = require("../economy");
const engine = require("./engine");
const store = require("./store");
const divisions = require("./divisions");
const assessment = require("./assessment");

const SEASONS_DOC = "podium-config/podiumSeasons";

function careerRef(db, uid) {
  return db.doc(paths.userPodiumCareer(uid));
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
        // The division this corps COMPETED in, and the medals it won there.
        // Both are read back by a re-sweep, which no longer has the finished
        // season's state doc to read (the director has re-registered by then)
        // and would otherwise rebuild the season's frozen standings with an
        // empty medal count and NEXT season's division seat.
        division: divisions.normalizeDivision(state.division),
        medals: state.medals || {},
        // The season's engagement accumulator, carried onto the entry so a
        // re-sweep (state doc already gone) can still rate the corps' activity
        // for the season-start assessment.
        activity: state.activity || null,
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
 * Bank a live career lineage for retirement (pure, §5.13 "attached to the corps,
 * not the director"). Retiring preserves the whole lineage — reputation,
 * historical peak, trophy history, division — so it can be un-retired later; it
 * just steps off the active roster. Staff are per-season employment (§5.6) and
 * simply lapse, so they are not banked. `retiredAtIndex` timestamps the lineage
 * against the global season ledger so a future un-retire can charge the dormancy
 * decay of the seasons it sat out.
 */
function bankLineage(careerData, retiredAtIndex) {
  const banked = { ...careerData };
  delete banked.retiredCareers;
  delete banked.pendingAssessment;
  banked.retiredAtIndex = retiredAtIndex;
  banked.retiredAt = new Date().toISOString();
  return banked;
}

/**
 * Restore a retired lineage as an active career (pure, §5.13 comeback arc). The
 * seasons it sat retired are charged as dormancy against its reputation — the
 * governing invariant is that a corps NEVER returns stronger than it left — but
 * its historical peak is preserved, so heritage credit still accelerates the
 * re-climb toward it. Returns { career, missedSeasons, reputationBefore,
 * reputationAfter } so the caller can show the resulting status BEFORE the
 * director confirms.
 */
function restoreLineage(banked, currentIndex, cfg) {
  const retiredAtIndex = banked.retiredAtIndex ?? banked.lastPlayedIndex ?? currentIndex;
  const missedSeasons = Math.max(0, currentIndex - retiredAtIndex);
  const before = banked.reputation || 0;
  const after = applyDormancy({ reputation: before, historicalPeak: banked.historicalPeak || 0 }, missedSeasons, cfg)
    .reputation;
  const restored = { ...banked, reputation: after };
  delete restored.retiredAtIndex;
  delete restored.retiredAt;
  return { career: restored, missedSeasons, reputationBefore: before, reputationAfter: after };
}

// The archived-standings doc keeps every realistic field size well under the
// 1 MB doc cap; the slice only matters if Podium someday exceeds this.
const FINAL_STANDINGS_CAP = 200;

// Profile résumé rows kept per corps (matches the career history window).
const PROFILE_HISTORY_CAP = 30;

/**
 * Write the just-archived season into the PUBLIC profile résumé —
 * `corps.podiumClass.seasonHistory`, the same array shape the fantasy
 * classes archive, so the profile's Season History section renders Podium
 * rows with no special-casing (Phase 6.7, design §14.3.b). Registered-but-
 * never-performed seasons leave no row.
 *
 * A row for the season may ALREADY EXIST, and in production it always does:
 * the season rollover's profile sweep (helpers/season.js
 * archiveAndResetProfiles) writes a row for every corps class it finds on the
 * profile, podiumClass included — and it runs the night BEFORE this does,
 * because the Podium boundary is settled by the first nightly stage of the new
 * season. That row is built from the fantasy fields: it has the display copy's
 * `totalSeasonScore` and a placement, but no final score, no medals, and no
 * show concept (Podium stores a plain string where the fantasy reader expects
 * `{theme}`).
 *
 * So this UPGRADES rather than skips. The Podium result is merged over
 * whatever is already there, keeping the rollover's fields (lineup history,
 * shows attended, archivedAt) and supplying the ones only Podium knows. Still
 * idempotent: the merged values are derived from the finished state, so a
 * second call rewrites the identical row.
 */
async function appendProfileSeasonHistory(db, uid, seasonUid, state) {
  if (state.lastTotal == null) return false;
  const ref = store.profileRef(db, uid);
  const snapshot = await ref.get();
  const corps = snapshot.exists ? snapshot.data().corps || {} : {};
  const existing = (corps.podiumClass && corps.podiumClass.seasonHistory) || [];
  const podiumResult = {
    seasonId: seasonUid,
    seasonName: seasonUid,
    corpsName: state.corpsName || null,
    placement: state.seasonRank ?? null,
    finalScore: state.lastTotal,
    totalSeasonScore: state.lastTotal,
    showConcept: state.showConcept || null,
    medals: state.medals || {},
  };
  const index = existing.findIndex((row) => row && row.seasonId === seasonUid);
  const seasonHistory =
    index >= 0
      ? existing.map((row, i) => (i === index ? { ...row, ...podiumResult } : row))
      : [...existing.slice(-(PROFILE_HISTORY_CAP - 1)), podiumResult];
  await ref.set(
    { corps: { podiumClass: { seasonHistory } } },
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
 * Sweep a finished season's unspent Corps Budget back to the primary CorpsCoin
 * wallet inside `transaction` (a corps operating account never lets funds
 * vanish — it settles up with its parent at archival, design §14.2.1). Credits
 * the leftover balance, logs a `podium_budget_refund` coin-history row, and
 * returns the amount refunded (0 when nothing is owed or the profile is
 * missing). Reads must already have happened — pass the profile snapshot in.
 */
function applyBudgetRefund(transaction, db, uid, profileSnapshot, report, seasonUid) {
  if (!report || !(report.refunded > 0)) return 0;
  if (!profileSnapshot.exists) {
    logger.warn(`[podium] budget refund skipped for ${uid}: no profile document.`);
    return 0;
  }
  const corpsCoin = profileSnapshot.data().corpsCoin || 0;
  const newBalance = corpsCoin + report.refunded;
  transaction.update(store.profileRef(db, uid), { corpsCoin: newBalance });
  economy.addCoinHistoryEntryToTransaction(transaction, db, uid, {
    type: economy.TRANSACTION_TYPES.PODIUM_BUDGET_REFUND,
    amount: report.refunded,
    balance: newBalance,
    description: `Corps Budget refund — ${report.corpsName || "Podium corps"} (${seasonUid})`,
    seasonUid,
  });
  return report.refunded;
}

/**
 * The season a corps played, as its career recorded it — searching retired
 * lineages too. A director who founds a new corps (`freshStart`) banks the
 * whole career into `retiredCareers`, so the season it just played is no
 * longer on the live career at all; a re-sweep that only looked there would
 * drop that corps out of the season's frozen standings entirely.
 */
function archivedSeasonEntry(career, seasonUid) {
  const lineages = [career, ...((career && career.retiredCareers) || [])];
  for (const lineage of lineages) {
    const entry = (lineage && lineage.history ? lineage.history : []).find(
      (h) => h && h.seasonUid === seasonUid
    );
    if (entry) return entry;
  }
  return null;
}

/**
 * Archive every corps of a just-ended season into careers, then freeze the
 * season's champion + final standings into the public recap parent doc
 * (`podium-recaps/{seasonUid}`) — the permanent record the Scores archive and
 * profile résumés read. Runs once per rollover under its own lease (caller
 * provides it).
 *
 * A re-sweep is a real scenario, not a theoretical one: the stage marks a
 * failed sweep for retry and re-claims it the following night, by which point
 * directors have re-registered and the finished season's state docs are gone.
 * Everything here is written to survive that, in one of two ways:
 *
 *  - **Retryable, per corps or per document.** Career archival and the budget
 *    refund are guarded by each corps' own `lastSeasonUid` /
 *    `lastRefundedSeasonUid` markers; the Hall of Champions merge, the records
 *    mark, the profile résumé row and the Fan Favorite crowning are each
 *    idempotent on their own terms. A sweep that failed partway finishes the
 *    rest tomorrow.
 *
 *  - **Once-only.** The division re-seat, alone, cannot be re-run: it promotes
 *    each corps relative to the seat it currently holds, and a retry would read
 *    the seats this assessment just assigned and promote the whole field again.
 *    `divisionsSeatedAt` on the archive doc is what makes it once.
 *
 * Everything a rebuild needs about a corps whose state is gone — the division
 * it competed in, the medals it won — is carried on its archived career entry
 * (`applySeasonResult`) precisely so the rebuild is faithful rather than a
 * degraded guess.
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
      const result = await db.runTransaction(async (transaction) => {
        // Profile read joins the txn so the budget refund credits corpsCoin
        // atomically with the career archival that gates it.
        const [stateSnapshot, careerSnapshot, profileSnapshot] = await Promise.all([
          transaction.get(store.stateRef(db, uid)),
          transaction.get(careerRef(db, uid)),
          transaction.get(store.profileRef(db, uid)),
        ]);
        const txnState =
          stateSnapshot.exists && stateSnapshot.data().seasonUid === previousSeason.seasonUid
            ? stateSnapshot.data()
            : null;
        const txnCareer = careerSnapshot.exists ? careerSnapshot.data() : initCareer();
        if (txnState && txnCareer.lastSeasonUid !== previousSeason.seasonUid) {
          const updated = applySeasonResult(
            txnCareer,
            { seasonUid: previousSeason.seasonUid, seasonIndex: previousSeason.index, state: txnState },
            store.balance
          );
          updated.updatedAt = new Date().toISOString();
          // End-of-season financial settlement: bank the line-item report and
          // sweep any unspent budget back to the wallet. The lastRefundedSeasonUid
          // marker moves in lock-step with lastSeasonUid, so a re-sweep (or a
          // director who re-registered first and already refunded) never
          // double-pays — the archival branch itself is once-only.
          if (txnCareer.lastRefundedSeasonUid !== previousSeason.seasonUid) {
            const report = store.buildSeasonFinancialReport(txnState, {
              seasonUid: previousSeason.seasonUid,
              seasonIndex: previousSeason.index,
            });
            applyBudgetRefund(transaction, db, uid, profileSnapshot, report, previousSeason.seasonUid);
            updated.lastRefundedSeasonUid = previousSeason.seasonUid;
            updated.lastSeasonReport = report;
          }
          transaction.set(careerRef(db, uid), updated);
          return {
            state: txnState,
            career: txnCareer,
            didArchive: true,
            // Assessment inputs (§5.7/§5.13): the reputation move this season
            // produced, and the tier-relative performance it was earned on.
            reputationBefore: txnCareer.reputation || 0,
            reputationAfter: updated.reputation || 0,
            historicalPeakBefore: txnCareer.historicalPeak || 0,
            tierPerformance: finalsPercentile(txnState),
          };
        }
        // Already archived (re-sweep, or the director re-registered and lazily
        // self-archived): the reputation move lives on the frozen history entry.
        const prior = archivedSeasonEntry(txnCareer, previousSeason.seasonUid);
        return {
          state: txnState,
          career: txnCareer,
          didArchive: false,
          reputationBefore: prior?.reputationBefore ?? txnCareer.reputation ?? 0,
          reputationAfter: prior?.reputationAfter ?? txnCareer.reputation ?? 0,
          historicalPeakBefore: txnCareer.historicalPeak || 0,
          tierPerformance: prior?.percentile ?? (txnState ? finalsPercentile(txnState) : null),
        };
      }).then(async (result) => {
        if (result.didArchive) {
          await appendProfileSeasonHistory(db, uid, previousSeason.seasonUid, result.state);
          archived++;
        }
        return result;
      });
      const { state, career } = result;
      // What the corps did this season. The live state is the source while it
      // still holds the finished season; once the director has re-registered
      // (lazy self-archival, or simply a night later) the career's archived
      // entry is — which is why that entry carries the competing division and
      // the medals, rather than being reconstructed from whatever the corps
      // looks like now.
      const entry = archivedSeasonEntry(career, previousSeason.seasonUid);
      // Assessment fields shared by both swept shapes: the reputation move, the
      // engagement accumulator, and the heritage flag — everything the
      // season-start assessment needs beyond division + finals total.
      const assessmentFields = {
        reputationBefore: result.reputationBefore ?? 0,
        reputationAfter: result.reputationAfter ?? 0,
        tierPerformance: result.tierPerformance ?? null,
        historicalPeakBefore: result.historicalPeakBefore ?? 0,
        // Heritage credit accelerated the climb when the corps re-earned ground
        // below its historical peak (engine.updateReputation, §5.13).
        heritageApplied:
          (result.reputationAfter ?? 0) > (result.reputationBefore ?? 0) &&
          (result.historicalPeakBefore ?? 0) >
            (result.reputationBefore ?? 0) +
              (store.balance.reputation.tierThresholds["3"] -
                store.balance.reputation.tierThresholds["2"]),
      };
      if (state) {
        swept.push({
          uid,
          corpsName: state.corpsName || null,
          lastTotal: state.lastTotal ?? null,
          lastScoredDay: state.lastScoredDay ?? null,
          seasonRank: state.seasonRank ?? null,
          seasonRankOf: state.seasonRankOf ?? null,
          medals: state.medals || {},
          division: divisions.normalizeDivision(state.division || (entry && entry.division)),
          underCutoffSeasons: career.underCutoffSeasons || 0,
          activity: state.activity || (entry && entry.activity) || null,
          seasonsPlayed: result.didArchive
            ? (career.seasonsPlayed || 0) + 1
            : career.seasonsPlayed || 0,
          ...assessmentFields,
        });
      } else if (entry) {
        swept.push({
          uid,
          corpsName: entry.corpsName || null,
          lastTotal: entry.finalsTotal ?? null,
          lastScoredDay: entry.finalsDay ?? null,
          seasonRank: entry.seasonRank ?? null,
          seasonRankOf: entry.seasonRankOf ?? null,
          // Pre-migration entries carry neither field; `career.division` is
          // the best remaining guess for a season archived before they landed.
          medals: entry.medals || {},
          division: divisions.normalizeDivision(entry.division || career.division),
          underCutoffSeasons: career.underCutoffSeasons || 0,
          activity: entry.activity || null,
          seasonsPlayed: career.seasonsPlayed || 0,
          ...assessmentFields,
        });
      }
    } catch (error) {
      logger.error(`[podium] career archival failed for ${uid}: ${error.message}`);
    }
  }

  const finalStandings = buildFinalStandings(swept);

  // Staff resumes need no archival sweep: each staffer is retained on the
  // director's own state and banks the finished season onto its resume as it
  // ages into the next season at re-registration (staffMarket.ageStaff).

  const archiveRef = db.doc(`podium-recaps/${previousSeason.seasonUid}`);
  const storedArchive = (await archiveRef.get()).data() || {};

  // --- Division re-seat (design §5.7, decision 26) --------------------------
  // Assess the veteran pool against published percentile cutoffs and write
  // each corps' next-season seat into its career. If the corps already
  // re-registered for the new season (rollover-night race), its live state
  // and profile display are re-stamped with the assessed seat so nobody
  // plays a whole season in yesterday's division.
  //
  // ONCE-ONLY, unlike everything else in this function. The assessment
  // promotes each corps RELATIVE TO THE SEAT IT CURRENTLY HOLDS, and by the
  // time a retried sweep runs — a night later, because that is when the lease
  // frees — the field has re-registered into the seats this very assessment
  // assigned. Running it again would read those as the corps' current
  // divisions and promote every one of them a second time: a corps that earned
  // Open Class would wake up in World, having never competed there.
  // `underCutoffSeasons` would double-count the same way, demoting on a single
  // bad season instead of two. `divisionsSeatedAt` is what makes it once.
  const divisionAssessment = divisions.assessDivisions(
    swept.map((entry) => ({
      uid: entry.uid,
      division: entry.division,
      finalsTotal: entry.lastTotal,
      underCutoffSeasons: entry.underCutoffSeasons,
    })),
    store.balance
  );
  if (storedArchive.divisionsSeatedAt) {
    logger.info(
      `[podium] divisions for ${previousSeason.seasonUid} were already seated at ` +
        `${storedArchive.divisionsSeatedAt}; not re-seating.`
    );
  } else {
    for (const [uid, seat] of Object.entries(divisionAssessment.next)) {
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
  }

  // --- Season-start assessment (design §5.7 + §5.13) ------------------------
  // Publish each corps' complete evaluation onto its career as `pendingAssessment`
  // so the between-seasons screen shows CLASS (division), STATUS (reputation
  // tier), how it stacked up against last season's field, and its SEPARATE
  // activity rating — all BEFORE the director chooses to continue, retire, start
  // a new corps, or un-retire one. Field-relative activity is rated here, once
  // the whole pool's engagement is known. Idempotent: every value is derived
  // from the frozen season, so a re-sweep rewrites the identical object. A
  // director who has already registered for the new season never sees it (the
  // dashboard shows their live corps, not the assessment); registration clears
  // it. Isolated: an assessment failure never fails archival.
  try {
    const seasonDoc = await db.doc("game-settings/season").get();
    const currentSeasonUid = seasonDoc.exists ? seasonDoc.data().seasonUid : null;
    const activityRatings = assessment.buildActivityRatings(
      swept.map((e) => ({ uid: e.uid, activity: e.activity })),
      store.balance
    );
    for (const e of swept) {
      const seat = divisionAssessment.next[e.uid];
      const built = assessment.buildAssessment(
        {
          seasonUid: previousSeason.seasonUid,
          seasonIndex: previousSeason.index,
          assessedForSeasonUid: currentSeasonUid,
          state: {
            corpsName: e.corpsName,
            lastTotal: e.lastTotal,
            lastScoredDay: e.lastScoredDay,
            seasonRank: e.seasonRank,
            seasonRankOf: e.seasonRankOf,
            medals: e.medals,
            division: e.division,
            seasonsPlayed: e.seasonsPlayed,
          },
          reputationBefore: e.reputationBefore,
          reputationAfter: e.reputationAfter,
          finalsPerformance: e.tierPerformance,
          previousDivision: e.division,
          nextDivision: seat ? seat.division : e.division,
          divisionCutoffs: divisionAssessment.cutoffs,
          activityRating: activityRatings.get(e.uid),
          missedSeasons: 0,
          heritageApplied: e.heritageApplied,
          decisions: ["continue", "retire", "startNew"],
        },
        store.balance
      );
      try {
        await careerRef(db, e.uid).set({ pendingAssessment: built }, { merge: true });
      } catch (error) {
        logger.error(`[podium] pending assessment write failed for ${e.uid}: ${error.message}`);
      }
    }
  } catch (error) {
    logger.error(`[podium] season-start assessment failed (archival unaffected): ${error.message}`);
  }

  // The frozen record only ever gets MORE complete. A rebuild reconstructs
  // every corps whose director has re-registered from its archived career
  // entry, which is faithful — but only as far back as the career history
  // window reaches, and a retired lineage eventually falls off the
  // `retiredCareers` tail. A season's permanent standings must not quietly
  // lose a corps years later, so a shorter rebuild is discarded in favour of
  // what is already on file.
  const storedStandings = Array.isArray(storedArchive.finalStandings)
    ? storedArchive.finalStandings
    : [];
  const rebuiltIsPoorer = storedStandings.length > finalStandings.length;
  if (rebuiltIsPoorer) {
    logger.warn(
      `[podium] rebuilt standings for ${previousSeason.seasonUid} hold ` +
        `${finalStandings.length} corps against ${storedStandings.length} already on file; ` +
        "keeping the record as archived."
    );
  }
  const record = rebuiltIsPoorer ? storedStandings : finalStandings;

  // Champions per division — the FMA rise: every division crowns its own.
  const divisionChampions = {};
  for (const division of divisions.DIVISIONS) {
    const top = record.find((entry) => entry.division === division);
    if (top) {
      divisionChampions[division] = {
        uid: top.uid,
        corpsName: top.corpsName,
        score: top.lastTotal,
        place: top.place,
      };
    }
  }

  await archiveRef.set(
    {
      seasonUid: previousSeason.seasonUid,
      seasonIndex: previousSeason.index,
      champion: record[0] || null,
      finalStandings: record,
      divisionChampions,
      divisions: {
        cutoffs: divisionAssessment.cutoffs,
        nextSeasonCounts: divisionAssessment.counts,
      },
      corpsCount: roster.size,
      archivedAt: new Date().toISOString(),
      divisionsSeatedAt: storedArchive.divisionsSeatedAt || new Date().toISOString(),
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
  if (record.length > 0) {
    try {
      const metals = ["gold", "silver", "bronze"];
      // Finals hardware per DIVISION (the FMA rise: every division medals
      // its own podium). A director fields one corps in one division, so the
      // per-user corpsClass+seasonName dedupe still holds.
      let hallChampions = [];
      for (const division of [...divisions.DIVISIONS].reverse()) {
        const divisionStandings = record.filter((entry) => entry.division === division);
        if (divisionStandings.length === 0) continue;
        const eventName = `Podium ${divisions.DIVISION_LABELS[division]} Finals`;
        const champions = [];
        for (let i = 0; i < Math.min(3, divisionStandings.length); i++) {
          const entry = divisionStandings[i];
          const medalRank = i + 1;
          let username = "Unknown";
          let avatarUrl = null;
          try {
            const profileSnapshot = await store.profileRef(db, entry.uid).get();
            const profile = profileSnapshot.exists ? profileSnapshot.data() : null;
            if (profile) {
              username = profile.username || profile.displayName || "Unknown";
              // Podium corps store their graphic at corps.podiumClass.avatarUrl
              // (same source the fantasy classes use) so the Hall of Champions
              // can render the corps logo rather than a bare initial.
              avatarUrl = (profile.corps && profile.corps.podiumClass && profile.corps.podiumClass.avatarUrl) || null;
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
            avatarUrl,
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
  if (record.length > 0) {
    try {
      const { updateSeasonBestRecords } = require("../gameRecords");
      const top = record[0];
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
      `${archived} careers, ${record.length} in final standings.`
  );
  return archived;
}

/**
 * Raise every active corps' live `state.division` to the division its career
 * was seated into for this season, and mirror it to the profile display.
 *
 * The division a corps competes in is EARNED at the season boundary and written
 * to its career (`archivePodiumSeason` re-seat) — that seat is the single source
 * of truth. Registration copies it onto the live season state, so the two agree
 * as long as the boundary was seated before the director registered. A corps
 * that registered in the reset window — before the boundary sweep had run — was
 * seated from last season's stale career division and, without this, would be
 * SCORED, recapped, and budget-capped in that lower class all season while its
 * dashboard (career/profile) already shows the promotion. The split is exactly
 * what confused directors on the first night of a new season.
 *
 * This reconciles the live state UP to the earned seat. It only ever raises a
 * seat — demotions are a boundary decision, and within a season a corps' seat
 * only needs correcting upward — so it is safe to run unconditionally and
 * idempotently every night BEFORE scoring (the processor reads `state.division`
 * for the night's recap and budget cap). It also makes the boundary's live
 * re-stamp non-load-bearing: even if that once-only re-stamp missed a corps, the
 * next nightly run repairs it, closing the "dashboard promoted but scoring
 * didn't" gap permanently.
 *
 * @param {FirebaseFirestore.Firestore} db
 * @param {string} seasonUid  the currently active season
 * @returns {Promise<number>} corps raised to their earned seat
 */
async function reconcileSeasonDivisions(db, seasonUid) {
  if (!seasonUid) return 0;
  let healed = 0;
  const roster = await store.rosterCollection(db, seasonUid).get();
  for (const rosterDoc of roster.docs) {
    const uid = rosterDoc.id;
    try {
      const [stateSnapshot, careerSnapshot] = await Promise.all([
        store.stateRef(db, uid).get(),
        careerRef(db, uid).get(),
      ]);
      // Only the corps actively fielding THIS season — a stale state left from a
      // prior season the director hasn't re-registered from must not be touched.
      if (!stateSnapshot.exists || stateSnapshot.data().seasonUid !== seasonUid) continue;
      if (!careerSnapshot.exists) continue;
      const earned = divisions.normalizeDivision(careerSnapshot.data().division);
      const current = divisions.normalizeDivision(stateSnapshot.data().division);
      if (divisions.divisionRank(earned) <= divisions.divisionRank(current)) continue;
      await store.stateRef(db, uid).set({ division: earned }, { merge: true });
      await store
        .profileRef(db, uid)
        .set({ corps: { podiumClass: { division: earned } } }, { merge: true });
      healed++;
    } catch (error) {
      logger.error(`[podium] division reconcile failed for ${uid}: ${error.message}`);
    }
  }
  if (healed > 0) {
    logger.info(`[podium] reconciled ${healed} corps to their earned division for ${seasonUid}.`);
  }
  return healed;
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
  bankLineage,
  restoreLineage,
  buildFinalStandings,
  appendProfileSeasonHistory,
  applyBudgetRefund,
  archivePodiumSeason,
  reconcileSeasonDivisions,
};
