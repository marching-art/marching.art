/**
 * Podium corps lifecycle decisions (design §5.13).
 *
 * A Podium corps is a long-term project. At every season boundary the director
 * decides its fate — continue it, start a new one, retire it, or un-retire a
 * banked lineage — and they make that call AFTER seeing where the corps will
 * compete (its assessed class + status). "Continue" and "start new" are the
 * existing registerPodiumCorps paths (with/without freshStart); this module adds
 * the two that were missing:
 *
 *   - retirePodiumCorps: bank the whole lineage (reputation, peak, history,
 *     division) off the active roster — recoverable, never destroyed.
 *   - unretirePodiumCorps: bring a banked lineage back, charging the dormancy
 *     decay of the seasons it sat out (§5.13: never returns stronger than it
 *     left) and reporting the resulting status.
 *
 * EVERY status change is confirmed: retire and the un-retire COMMIT both require
 * an explicit `confirm: true`, and un-retire's preview (confirm omitted) exists
 * precisely so the director sees the resulting class + status before agreeing.
 */

const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { logger } = require("firebase-functions/v2");
const { assertWriteBudget } = require("../helpers/callableGuards");
const engine = require("../helpers/podium/engine");
const store = require("../helpers/podium/store");
const career = require("../helpers/podium/career");
const divisions = require("../helpers/podium/divisions");
const assessment = require("../helpers/podium/assessment");
const { podiumContext } = require("./podium");

/** The named class + status a reputation value resolves to (shared shape). */
function statusFor(reputation) {
  const tier = engine.tierForReputation(reputation || 0, store.balance);
  const division = divisions.divisionForReputation(reputation || 0, store.balance);
  return {
    reputation: Math.round((reputation || 0) * 10) / 10,
    tier,
    tierLabel: assessment.tierLabel(tier),
    division,
    divisionLabel: divisions.DIVISION_LABELS[division],
  };
}

/**
 * Retire the active corps. Banks the lineage into `retiredCareers` (recoverable
 * via unretire) and resets the active career. Between-seasons decision — must be
 * confirmed.
 */
exports.retirePodiumCorps = onCall({ cors: true }, async (request) => {
  const { uid, db, seasonData } = await podiumContext(request);
  await assertWriteBudget(db, uid, "podium", { max: 120, windowMs: 10 * 60 * 1000 });
  if (request.data?.confirm !== true) {
    throw new HttpsError("failed-precondition", "Retiring your corps must be confirmed.");
  }
  // A live corps for the CURRENT season is mid-project — retire is a
  // between-seasons decision, so refuse while one is active this season.
  const liveState = await store.stateRef(db, uid).get();
  if (liveState.exists && liveState.data().seasonUid === seasonData.seasonUid) {
    throw new HttpsError(
      "failed-precondition",
      "You're fielding this corps this season. You can retire it at the next season's registration."
    );
  }
  const seasonIndex = await career.ensureSeasonIndex(db, seasonData);
  const ref = career.careerRef(db, uid);

  const retired = await db.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(ref);
    const data = snapshot.exists ? snapshot.data() : career.initCareer();
    if (!(data.seasonsPlayed > 0) && !data.corpsName) {
      throw new HttpsError("failed-precondition", "You have no corps to retire.");
    }
    const banked = career.bankLineage(data, seasonIndex.index);
    // Keep the last 10 retired lineages (matches the freshStart tail).
    transaction.set(ref, {
      ...career.initCareer(),
      retiredCareers: [...(data.retiredCareers || []).slice(-9), banked],
    });
    return { corpsName: banked.corpsName, reputation: banked.reputation, seasonsPlayed: banked.seasonsPlayed };
  });

  // Clear the active display identity (the season history résumé is preserved).
  try {
    await store.profileRef(db, uid).set(
      { corps: { podiumClass: { retired: true, seasonRank: null, seasonRankOf: null, totalSeasonScore: null } } },
      { merge: true }
    );
  } catch (error) {
    logger.warn(`[podium] retire display clear failed for ${uid}: ${error.message}`);
  }

  logger.info(`[podium] corps retired: ${retired.corpsName || uid} (${uid}), ${retired.seasonsPlayed} seasons.`);
  return {
    success: true,
    retired: {
      corpsName: retired.corpsName || null,
      seasonsPlayed: retired.seasonsPlayed || 0,
      status: statusFor(retired.reputation),
    },
  };
});

/**
 * Un-retire a banked lineage. Without `confirm` it PREVIEWS the resulting status
 * (dormancy charged, "are you sure?"); with `confirm: true` it commits — the
 * lineage becomes the active career and the director then continues it into the
 * new season via registration.
 */
exports.unretirePodiumCorps = onCall({ cors: true }, async (request) => {
  const { uid, db, seasonData } = await podiumContext(request);
  await assertWriteBudget(db, uid, "podium", { max: 120, windowMs: 10 * 60 * 1000 });
  const lineageIndex = Number(request.data?.lineageIndex);
  const confirm = request.data?.confirm === true;

  const liveState = await store.stateRef(db, uid).get();
  if (liveState.exists && liveState.data().seasonUid === seasonData.seasonUid) {
    throw new HttpsError(
      "failed-precondition",
      "You're already fielding a corps this season. Un-retire at the next season's registration."
    );
  }
  const seasonIndex = await career.ensureSeasonIndex(db, seasonData);
  const ref = career.careerRef(db, uid);
  const snapshot = await ref.get();
  const data = snapshot.exists ? snapshot.data() : career.initCareer();
  const retiredCareers = data.retiredCareers || [];
  if (!Number.isInteger(lineageIndex) || lineageIndex < 0 || lineageIndex >= retiredCareers.length) {
    throw new HttpsError("invalid-argument", "No such retired corps to bring back.");
  }
  const banked = retiredCareers[lineageIndex];
  const restored = career.restoreLineage(banked, seasonIndex.index, store.balance);

  const preview = {
    corpsName: banked.corpsName || null,
    seasonsPlayed: banked.seasonsPlayed || 0,
    missedSeasons: restored.missedSeasons,
    statusBefore: statusFor(restored.reputationBefore),
    statusAfter: statusFor(restored.reputationAfter),
  };

  if (!confirm) {
    // Preview only — the director sees where the corps will compete first.
    return { success: true, committed: false, preview };
  }

  // Commit: the restored lineage becomes the active career; the rest stay banked.
  const activeCareer = restored.career;
  if (data.pendingAssessment) activeCareer.pendingAssessment = data.pendingAssessment;
  await db.runTransaction(async (transaction) => {
    const fresh = await transaction.get(ref);
    const freshData = fresh.exists ? fresh.data() : career.initCareer();
    const freshRetired = freshData.retiredCareers || [];
    // Re-resolve the lineage against the fresh snapshot (index is stable within a
    // between-seasons window; guard anyway so a concurrent edit can't mis-restore).
    const stillThere = freshRetired[lineageIndex];
    if (!stillThere || stillThere.corpsName !== banked.corpsName) {
      throw new HttpsError("aborted", "That retired corps changed; reopen the list and try again.");
    }
    transaction.set(ref, {
      ...activeCareer,
      retiredCareers: freshRetired.filter((_, i) => i !== lineageIndex),
      updatedAt: new Date().toISOString(),
    });
  });

  // Restore the active display identity so the between-seasons screen greets the
  // returning corps by name.
  try {
    await store.profileRef(db, uid).set(
      {
        corps: {
          podiumClass: {
            corpsName: banked.corpsName || null,
            retired: false,
            division: preview.statusAfter.division,
            repTier: preview.statusAfter.tier,
          },
        },
      },
      { merge: true }
    );
  } catch (error) {
    logger.warn(`[podium] un-retire display restore failed for ${uid}: ${error.message}`);
  }

  logger.info(
    `[podium] corps un-retired: ${banked.corpsName || uid} (${uid}) — ` +
      `${preview.statusBefore.tierLabel} → ${preview.statusAfter.tierLabel} after ${preview.missedSeasons} missed.`
  );
  return { success: true, committed: true, preview };
});
