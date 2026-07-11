/**
 * Podium staff callables. Staff are hired from a generic, always-available
 * catalog (a role at an entry experience level); hiring MINTS a per-corps
 * instance whose id, tenure, and resume persist for the rest of its career.
 * Experience is EARNED by retaining a staffer across seasons — veteran and
 * above are never hired directly. Directors can RELEASE a staffer to free the
 * seat, and RETRAIN one into a new specialty (tenure kept, reduced boost for
 * the rest of the season).
 */

const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { logger } = require("firebase-functions/v2");
const store = require("../helpers/podium/store");
const staffMarket = require("../helpers/podium/staffMarket");
const { podiumContext } = require("./podium");

exports.getPodiumStaffMarket = onCall({ cors: true }, async (request) => {
  const { db } = await podiumContext(request);
  await store.applyBalanceOverrides(db);
  return { success: true, catalog: staffMarket.buildCatalog(store.balance) };
});

exports.hirePodiumStaff = onCall({ cors: true }, async (request) => {
  const { uid, db, seasonData, competitionDay } = await podiumContext(request);
  const { specialty, tier } = request.data || {};
  const requestedSeasons = request.data?.seasons;

  if (!staffMarket.SPECIALTIES.includes(specialty)) {
    throw new HttpsError("invalid-argument", `Unknown specialty: ${specialty}`);
  }
  if (!staffMarket.HIRABLE_TIERS.includes(tier)) {
    throw new HttpsError(
      "invalid-argument",
      `Staff are hired at ${staffMarket.HIRABLE_TIERS.join(" or ")} — higher tiers are earned by retaining them.`
    );
  }
  const maxSeasons = store.balance.staff.career.maxContractSeasons;
  const seasons =
    requestedSeasons == null
      ? 1
      : Number.isInteger(requestedSeasons) && requestedSeasons >= 1 && requestedSeasons <= maxSeasons
        ? requestedSeasons
        : null;
  if (seasons == null) {
    throw new HttpsError("invalid-argument", `Contract length must be 1-${maxSeasons} seasons.`);
  }

  const day = Math.max(0, competitionDay);
  const sRef = store.stateRef(db, uid);
  const result = await db.runTransaction(async (transaction) => {
    const stateSnapshot = await transaction.get(sRef);
    if (!stateSnapshot.exists || stateSnapshot.data().seasonUid !== seasonData.seasonUid) {
      throw new HttpsError("failed-precondition", "Register a Podium corps first.");
    }
    const state = stateSnapshot.data();
    if (state.staff && state.staff[specialty]) {
      throw new HttpsError("failed-precondition", `You already employ a ${specialty} staff member.`);
    }
    // The id sticks with this staffer for life; one seat per specialty per
    // corps makes the specialty + mint time collision-free.
    const id = `${specialty}_${uid.slice(0, 6)}_${Date.now().toString(36)}`;
    const member = staffMarket.mintStaff({ id, specialty, tier, seasons, day }, store.balance);
    if (!store.debitBudget(state, member.salaryPerSeason, `staff:${specialty}`, day)) {
      throw new HttpsError(
        "failed-precondition",
        `Not enough Corps Budget (salary ${member.salaryPerSeason}).`
      );
    }
    state.staff = { ...(state.staff || {}), [specialty]: member };
    state.updatedAt = new Date().toISOString();
    transaction.set(sRef, state);
    return { staff: state.staff, budget: state.budget, hired: id };
  });

  return { success: true, ...result };
});

exports.releasePodiumStaff = onCall({ cors: true }, async (request) => {
  const { uid, db, seasonData } = await podiumContext(request);
  const { specialty } = request.data || {};
  if (!staffMarket.SPECIALTIES.includes(specialty)) {
    throw new HttpsError("invalid-argument", `Unknown specialty: ${specialty}`);
  }
  const sRef = store.stateRef(db, uid);
  const result = await db.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(sRef);
    if (!snapshot.exists || snapshot.data().seasonUid !== seasonData.seasonUid) {
      throw new HttpsError("failed-precondition", "Register a Podium corps first.");
    }
    const state = snapshot.data();
    if (!state.staff || !state.staff[specialty]) {
      throw new HttpsError("not-found", `You do not employ a ${specialty} staff member.`);
    }
    // The season's salary is already spent — releasing frees the seat, no
    // refund. Their tenure and history end here.
    delete state.staff[specialty];
    state.updatedAt = new Date().toISOString();
    transaction.set(sRef, state);
    return { released: specialty, staff: state.staff };
  });

  return { success: true, ...result };
});

exports.retrainPodiumStaff = onCall({ cors: true }, async (request) => {
  const { uid, db, seasonData, competitionDay } = await podiumContext(request);
  const { staffId, toSpecialty } = request.data || {};
  if (typeof staffId !== "string" || !staffId) {
    throw new HttpsError("invalid-argument", "staffId is required.");
  }
  if (!staffMarket.SPECIALTIES.includes(toSpecialty)) {
    throw new HttpsError("invalid-argument", `Unknown specialty: ${toSpecialty}`);
  }
  const sRef = store.stateRef(db, uid);
  const result = await db.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(sRef);
    if (!snapshot.exists || snapshot.data().seasonUid !== seasonData.seasonUid) {
      throw new HttpsError("failed-precondition", "Register a Podium corps first.");
    }
    const state = snapshot.data();
    const entry = Object.entries(state.staff || {}).find(([, member]) => member && member.id === staffId);
    if (!entry) throw new HttpsError("not-found", "You do not employ that staff member.");
    const [specialty, member] = entry;
    if (specialty === toSpecialty) {
      throw new HttpsError("invalid-argument", `That staffer already covers ${toSpecialty}.`);
    }
    if (state.staff[toSpecialty]) {
      throw new HttpsError("failed-precondition", `You already employ a ${toSpecialty} staff member.`);
    }
    const cost = store.balance.staff.career.retrainCost;
    if (!store.debitBudget(state, cost, `staffRetrain:${toSpecialty}`, Math.max(0, competitionDay))) {
      throw new HttpsError("failed-precondition", `Not enough Corps Budget (retraining ${cost}).`);
    }
    delete state.staff[specialty];
    state.staff[toSpecialty] = {
      ...member,
      specialty: toSpecialty,
      // Learning curve: reduced boost for the rest of THIS season (the
      // multiplier is applied at yield time, keyed on retrain.seasonUid).
      retrain: { seasonUid: seasonData.seasonUid, day: Math.max(0, competitionDay) },
    };
    state.updatedAt = new Date().toISOString();
    transaction.set(sRef, state);
    return { retrained: staffId, toSpecialty, staff: state.staff, budget: state.budget };
  });

  logger.info(`[podium] staff ${staffId} retrained to ${toSpecialty} by ${uid}`);
  return { success: true, ...result };
});

/**
 * Acknowledge the next-season payroll warning (design §5.6). getPodiumState
 * flags the corps "at risk" when its aged staff payroll can't fit the division
 * cap; this records the payroll figure the director has seen so the banner
 * stays dismissed until that figure changes (a hire, a release, or next
 * season's aging), at which point it re-warns. Stores only the acknowledged
 * number — no separate collection, no nag.
 */
exports.acknowledgePodiumStaffOutlook = onCall({ cors: true }, async (request) => {
  const { uid, db, seasonData } = await podiumContext(request);
  const sRef = store.stateRef(db, uid);
  const acknowledgedPayroll = await db.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(sRef);
    if (!snapshot.exists || snapshot.data().seasonUid !== seasonData.seasonUid) {
      throw new HttpsError("failed-precondition", "Register a Podium corps first.");
    }
    const state = snapshot.data();
    // Budget is irrelevant to the payroll total — pass 0 and read the total.
    const payroll = staffMarket.projectRetention(state.staff || {}, 0, store.balance).payroll;
    transaction.set(sRef, { staffOutlookAck: payroll, updatedAt: new Date().toISOString() }, { merge: true });
    return payroll;
  });
  return { success: true, acknowledgedPayroll };
});
