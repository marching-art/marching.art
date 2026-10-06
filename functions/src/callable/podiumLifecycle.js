/**
 * Podium corps lifecycle decisions (design §5.13).
 *
 * A Podium corps is a long-term project. At every season boundary the director
 * decides its fate — continue it, start a new one, retire it, or bring back a
 * retired one — and they make that call AFTER seeing where the corps will
 * compete (its assessed class + status). There is no rename: a corps is its
 * name, and history always follows the corps (owner direction, 2026-10).
 * "Continue" and "start new" are the registerPodiumCorps paths (with/without
 * freshStart); this module adds the other two:
 *
 *   - retirePodiumCorps: bank the whole lineage (reputation, peak, history,
 *     class seat, logo and uniforms) off the active roster — recoverable,
 *     never destroyed. The next corps the director founds starts blank.
 *   - unretirePodiumCorps: bring a banked lineage back. The corps it replaces
 *     (if any) is retired automatically, banked the same way. The returning
 *     corps' time away — every season since it last competed — is charged as
 *     dormancy exactly once, when it takes the field, under the published
 *     re-entry rule: one season away keeps its class, a longer absence
 *     re-enters at the class its decayed reputation supports.
 *
 * EVERY status change is confirmed: retire and the un-retire COMMIT both require
 * an explicit `confirm: true`, and un-retire's preview (confirm omitted) exists
 * precisely so the director sees the resulting class + status — and which
 * corps steps aside — before agreeing.
 */

const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { logger } = require("firebase-functions/v2");
const { FieldValue } = require("firebase-admin/firestore");
const { assertWriteBudget } = require("../helpers/callableGuards");
const engine = require("../helpers/podium/engine");
const store = require("../helpers/podium/store");
const career = require("../helpers/podium/career");
const divisions = require("../helpers/podium/divisions");
const assessment = require("../helpers/podium/assessment");
const { podiumContext } = require("./podium");
const { ensurePodiumBoundarySettled } = require("../helpers/season");

/**
 * The named class + status a corps resolves to (shared shape). `division`
 * defaults to the class its reputation alone supports; pass the projected seat
 * (career.projectReturn) when the corps' own class history decides it.
 */
function statusFor(reputation, division) {
  const tier = engine.tierForReputation(reputation || 0, store.balance);
  const seat = division || divisions.divisionForReputation(reputation || 0, store.balance);
  return {
    reputation: Math.round((reputation || 0) * 10) / 10,
    tier,
    tierLabel: assessment.tierLabel(tier),
    division: seat,
    divisionLabel: divisions.DIVISION_LABELS[seat],
  };
}

/**
 * Refuse a lineage change while last season is still being swept: every
 * corps' finished season — and its earned class — must be banked onto its own
 * record before it can step off the roster, or the boundary would write them
 * onto whichever corps is live afterwards.
 */
async function assertBoundarySettled(db, seasonUid) {
  if (!(await ensurePodiumBoundarySettled(db, seasonUid))) {
    throw new HttpsError(
      "unavailable",
      "Last season's results are still being finalized. Try again in a minute."
    );
  }
}

/**
 * The leftover prior-season state, when it is the live corps' own — the
 * source of its home and show concept for banking.
 */
function ownStaleState(stateSnapshot, careerData, seasonUid) {
  if (!stateSnapshot.exists) return null;
  const state = stateSnapshot.data();
  if (state.seasonUid === seasonUid) return null;
  const owner = career.seasonOwner(careerData, state.seasonUid);
  if (owner === "active") return state;
  if (owner === "unarchived" && career.lineageForUnsweptSeason(careerData, state) === "active") {
    return state;
  }
  return null;
}

/**
 * Retire the active corps. Banks the lineage into `retiredCareers` (recoverable
 * via unretire) and resets the active career to a blank slate. Between-seasons
 * decision — must be confirmed.
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
  await assertBoundarySettled(db, seasonData.seasonUid);
  const ref = career.careerRef(db, uid);

  const retired = await db.runTransaction(async (transaction) => {
    const [snapshot, stateSnapshot, profileSnapshot] = await Promise.all([
      transaction.get(ref),
      transaction.get(store.stateRef(db, uid)),
      transaction.get(store.profileRef(db, uid)),
    ]);
    const data = snapshot.exists ? snapshot.data() : career.initCareer();
    if (!career.hasActiveCorps(data)) {
      throw new HttpsError("failed-precondition", "You have no corps to retire.");
    }
    const identity = career.captureIdentity(
      profileSnapshot.exists ? (profileSnapshot.data().corps || {}).podiumClass : null,
      ownStaleState(stateSnapshot, data, seasonData.seasonUid)
    );
    const banked = career.bankLineage(data, seasonIndex.index, identity);
    // Keep the last 10 retired lineages (matches the freshStart tail).
    transaction.set(ref, {
      ...career.initCareer(),
      retiredCareers: [...(data.retiredCareers || []).slice(-9), banked],
      updatedAt: new Date().toISOString(),
    });
    return banked;
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
      status: statusFor(retired.reputation, divisions.normalizeDivision(retired.division)),
    },
  };
});

/**
 * Un-retire a banked lineage. Without `confirm` it PREVIEWS where the corps
 * would compete (its time away charged, "are you sure?") and which active corps
 * would step aside; with `confirm: true` it commits — the active corps (if any)
 * is retired automatically, the lineage becomes the active career, and the
 * director then continues it into the new season via registration.
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
  if (confirm) await assertBoundarySettled(db, seasonData.seasonUid);
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
    statusBefore: statusFor(restored.reputationBefore, divisions.normalizeDivision(banked.division)),
    statusAfter: statusFor(restored.reputationAfter, restored.division),
    // The active corps that steps aside (retired automatically) on commit.
    replacing: career.hasActiveCorps(data)
      ? { corpsName: data.corpsName || null, seasonsPlayed: data.seasonsPlayed || 0 }
      : null,
  };

  if (!confirm) {
    // Preview only — the director sees where the corps will compete first.
    return { success: true, committed: false, preview };
  }

  // Commit: the active corps (if any) is retired — banked whole, its look with
  // it — and the restored lineage becomes the active career.
  await db.runTransaction(async (transaction) => {
    const [fresh, stateSnapshot, profileSnapshot] = await Promise.all([
      transaction.get(ref),
      transaction.get(store.stateRef(db, uid)),
      transaction.get(store.profileRef(db, uid)),
    ]);
    const freshData = fresh.exists ? fresh.data() : career.initCareer();
    const freshRetired = freshData.retiredCareers || [];
    // Re-resolve the lineage against the fresh snapshot (index is stable within a
    // between-seasons window; guard anyway so a concurrent edit can't mis-restore).
    const stillThere = freshRetired[lineageIndex];
    if (!stillThere || stillThere.corpsName !== banked.corpsName) {
      throw new HttpsError("aborted", "That retired corps changed; reopen the list and try again.");
    }
    const remaining = freshRetired.filter((_, i) => i !== lineageIndex);
    if (career.hasActiveCorps(freshData)) {
      const identity = career.captureIdentity(
        profileSnapshot.exists ? (profileSnapshot.data().corps || {}).podiumClass : null,
        ownStaleState(stateSnapshot, freshData, seasonData.seasonUid)
      );
      remaining.push(career.bankLineage(freshData, seasonIndex.index, identity));
    }
    transaction.set(ref, {
      ...career.restoreLineage(stillThere, seasonIndex.index, store.balance).career,
      retiredCareers: remaining.slice(-10),
      updatedAt: new Date().toISOString(),
    });
  });

  // Restore the corps' own display identity — name, class, and the logo and
  // uniforms it retired with — so the between-seasons screen greets the
  // returning corps as itself, never in its predecessor's colors.
  try {
    const identity = restored.identity || {};
    await store.profileRef(db, uid).set(
      {
        corps: {
          podiumClass: {
            corpsName: banked.corpsName || null,
            retired: false,
            division: preview.statusAfter.division,
            repTier: preview.statusAfter.tier,
            ...(identity.location ? { location: identity.location } : {}),
            ...(identity.showConcept ? { showConcept: identity.showConcept } : {}),
            seasonRank: null,
            seasonRankOf: null,
            totalSeasonScore: null,
            ...Object.fromEntries(
              career.IDENTITY_FIELDS.map((field) => [
                field,
                identity[field] != null ? identity[field] : FieldValue.delete(),
              ])
            ),
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
      `${preview.statusBefore.tierLabel} → ${preview.statusAfter.tierLabel} ` +
      `(${preview.statusAfter.divisionLabel}) after ${preview.missedSeasons} missed` +
      (preview.replacing ? `; retired ${preview.replacing.corpsName || "the active corps"}.` : ".")
  );
  return { success: true, committed: true, preview };
});
