/**
 * Podium staff callables. Staff are hired from a generic, always-available
 * catalog (a role at an entry experience level); hiring MINTS a per-corps
 * instance whose id, tenure, and resume persist for the rest of its career.
 * Experience is EARNED by retaining a staffer across seasons — veteran and
 * above are never hired directly. Directors can RELEASE a staffer to free the
 * seat (buying out any seasons still under contract), and RETRAIN one into a
 * new specialty (tenure kept, reduced boost for the rest of the season).
 * Re-signing a lapsed contract happens at re-registration (registerPodiumCorps
 * `staffContracts`), where the floated rate is known.
 *
 * NAMES: a director may name any staffer they employ (at hire, or any time
 * after with namePodiumStaff). Names are unique across the whole game — the
 * `podium-staff-names` registry (helpers/podium/staffNames.js) is claimed and
 * released inside the same transaction as the roster write, so a name is
 * freed the moment its staffer is released and never held by two staffers.
 */

const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { logger } = require("firebase-functions/v2");
const store = require("../helpers/podium/store");
const staffMarket = require("../helpers/podium/staffMarket");
const staffNames = require("../helpers/podium/staffNames");
const { podiumContext } = require("./podium");
const { assertWriteBudget } = require("../helpers/callableGuards");

exports.getPodiumStaffMarket = onCall({ cors: true }, async (request) => {
  const { db } = await podiumContext(request);
  await store.applyBalanceOverrides(db);
  return { success: true, catalog: staffMarket.buildCatalog(store.balance) };
});

exports.hirePodiumStaff = onCall({ cors: true }, async (request) => {
  const { uid, db, seasonData, competitionDay } = await podiumContext(request);
  // Abuse throttle (shared podium bucket) — rehearsal/staff actions are the
  // Podium core loop, so the budget is generous (still far above human rate).
  await assertWriteBudget(db, uid, "podium", { max: 120, windowMs: 10 * 60 * 1000 });
  const { specialty, tier } = request.data || {};
  const requestedSeasons = request.data?.seasons;
  // Optional: name the new hire in the same write. An empty/absent name
  // leaves the staffer going by their role, exactly as before.
  const rawName = typeof request.data?.name === "string" ? request.data.name.trim() : "";
  const requestedName = rawName ? staffNames.normalizeStaffName(rawName) : null;

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
    // The id sticks with this staffer for life; one seat per specialty per
    // corps makes the specialty + mint time collision-free.
    const id = `${specialty}_${uid.slice(0, 6)}_${Date.now().toString(36)}`;
    const nameRef = requestedName ? staffNames.nameRef(db, requestedName.key) : null;
    const [stateSnapshot, profileSnapshot, nameSnapshot] = await Promise.all([
      transaction.get(sRef),
      requestedName ? transaction.get(store.profileRef(db, uid)) : Promise.resolve(null),
      nameRef ? transaction.get(nameRef) : Promise.resolve(null),
    ]);
    if (!stateSnapshot.exists || stateSnapshot.data().seasonUid !== seasonData.seasonUid) {
      throw new HttpsError("failed-precondition", "Register a Podium corps first.");
    }
    const state = stateSnapshot.data();
    if (state.staff && state.staff[specialty]) {
      throw new HttpsError("failed-precondition", `You already employ a ${specialty} staff member.`);
    }
    if (requestedName) {
      staffNames.assertMayName(profileSnapshot && profileSnapshot.exists ? profileSnapshot.data() : null);
      const taken = staffNames.blockingClaim(nameSnapshot, { uid, staffId: id });
      if (taken) throw staffNames.takenError(taken);
    }
    const member = staffMarket.mintStaff({ id, specialty, tier, seasons, day }, store.balance);
    if (!store.debitBudget(state, member.salaryPerSeason, `staff:${specialty}`, day)) {
      throw new HttpsError(
        "failed-precondition",
        `Not enough Corps Budget (salary ${member.salaryPerSeason}).`
      );
    }
    if (requestedName) {
      member.name = requestedName.display;
      member.nameKey = requestedName.key;
      transaction.set(
        nameRef,
        staffNames.buildClaim({
          uid,
          staffId: id,
          specialty,
          corpsName: state.corpsName || null,
          name: requestedName.display,
          key: requestedName.key,
        })
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
  const { uid, db, seasonData, competitionDay } = await podiumContext(request);
  // Abuse throttle (shared podium bucket) — rehearsal/staff actions are the
  // Podium core loop, so the budget is generous (still far above human rate).
  await assertWriteBudget(db, uid, "podium", { max: 120, windowMs: 10 * 60 * 1000 });
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
    // refund. A contract binds both ways: seasons still locked beyond this
    // one are bought out at the contract premium, from the Corps Budget.
    // Their tenure and history end here — and so does their claim on their
    // name, which is free for any corps to use again.
    const member = state.staff[specialty];
    const namePlan = staffNames.planRelease(db, [member]);
    const nameSnapshots = await Promise.all(namePlan.map((entry) => transaction.get(entry.ref)));
    const buyout = staffMarket.buyoutFor(member, store.balance);
    if (buyout > 0 && !store.debitBudget(state, buyout, `staffBuyout:${specialty}`, Math.max(0, competitionDay))) {
      throw new HttpsError(
        "failed-precondition",
        `Not enough Corps Budget to buy out the remaining contract (${buyout} CC).`
      );
    }
    staffNames.applyRelease(transaction, namePlan, nameSnapshots);
    delete state.staff[specialty];
    state.updatedAt = new Date().toISOString();
    transaction.set(sRef, state);
    return {
      released: specialty,
      releasedName: member.name || null,
      buyout,
      staff: state.staff,
      budget: state.budget,
    };
  });

  return { success: true, ...result };
});

exports.retrainPodiumStaff = onCall({ cors: true }, async (request) => {
  const { uid, db, seasonData, competitionDay } = await podiumContext(request);
  // Abuse throttle (shared podium bucket) — rehearsal/staff actions are the
  // Podium core loop, so the budget is generous (still far above human rate).
  await assertWriteBudget(db, uid, "podium", { max: 120, windowMs: 10 * 60 * 1000 });
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
    // Their name (if any) rides along: the registry doc notes the new role.
    const namePlan = staffNames.planRelease(db, [member]);
    const nameSnapshots = await Promise.all(namePlan.map((e) => transaction.get(e.ref)));
    const cost = store.balance.staff.career.retrainCost;
    if (!store.debitBudget(state, cost, `staffRetrain:${toSpecialty}`, Math.max(0, competitionDay))) {
      throw new HttpsError("failed-precondition", `Not enough Corps Budget (retraining ${cost}).`);
    }
    staffNames.applyCarry(transaction, namePlan, nameSnapshots, { specialty: toSpecialty });
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
 * Name (or rename, or un-name with an empty string) a staffer you employ.
 * Names are unique game-wide: the registry is read and written in the same
 * transaction as the roster, so two directors racing for one name can't both
 * win. A taken name says which corps has it. A director whose naming
 * privilege an admin revoked is refused (their existing names were cleared
 * by that action; the roster is otherwise untouched).
 */
exports.namePodiumStaff = onCall({ cors: true }, async (request) => {
  const { uid, db, seasonData } = await podiumContext(request);
  await assertWriteBudget(db, uid, "podium", { max: 120, windowMs: 10 * 60 * 1000 });
  const { staffId } = request.data || {};
  if (typeof staffId !== "string" || !staffId) {
    throw new HttpsError("invalid-argument", "staffId is required.");
  }
  const rawName = typeof request.data?.name === "string" ? request.data.name.trim() : "";
  const requested = rawName ? staffNames.normalizeStaffName(rawName) : null;

  const sRef = store.stateRef(db, uid);
  const result = await db.runTransaction(async (transaction) => {
    const newRef = requested ? staffNames.nameRef(db, requested.key) : null;
    const [snapshot, profileSnapshot, newSnapshot] = await Promise.all([
      transaction.get(sRef),
      transaction.get(store.profileRef(db, uid)),
      newRef ? transaction.get(newRef) : Promise.resolve(null),
    ]);
    if (!snapshot.exists || snapshot.data().seasonUid !== seasonData.seasonUid) {
      throw new HttpsError("failed-precondition", "Register a Podium corps first.");
    }
    staffNames.assertMayName(profileSnapshot.exists ? profileSnapshot.data() : null);
    const state = snapshot.data();
    const entry = Object.entries(state.staff || {}).find(([, m]) => m && m.id === staffId);
    if (!entry) throw new HttpsError("not-found", "You do not employ that staff member.");
    const [specialty, member] = entry;
    const previousName = member.name || null;
    if (requested && member.nameKey === requested.key && member.name === requested.display) {
      return { staffId, name: previousName, previousName, staff: state.staff, unchanged: true };
    }
    if (requested) {
      const taken = staffNames.blockingClaim(newSnapshot, { uid, staffId });
      if (taken) throw staffNames.takenError(taken);
    }
    // Drop the old claim (only if this staffer still owns it), then write the
    // new one. Same key with different casing/punctuation is a rename in place.
    const oldPlan = staffNames.planRelease(db, [member]);
    const oldSnapshots = await Promise.all(oldPlan.map((e) => transaction.get(e.ref)));
    const sameKey = requested && member.nameKey === requested.key;
    if (!sameKey) staffNames.applyRelease(transaction, oldPlan, oldSnapshots);
    if (requested) {
      transaction.set(
        newRef,
        staffNames.buildClaim({
          uid,
          staffId,
          specialty,
          corpsName: state.corpsName || null,
          name: requested.display,
          key: requested.key,
        })
      );
      member.name = requested.display;
      member.nameKey = requested.key;
    } else {
      delete member.name;
      delete member.nameKey;
    }
    state.staff[specialty] = member;
    state.updatedAt = new Date().toISOString();
    transaction.set(sRef, state);
    return { staffId, name: requested ? requested.display : null, previousName, staff: state.staff };
  });

  logger.info(
    `[podium] staff ${staffId} ${result.name ? `named "${result.name}"` : "un-named"} by ${uid}`
  );
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
  // Abuse throttle (shared podium bucket) — rehearsal/staff actions are the
  // Podium core loop, so the budget is generous (still far above human rate).
  await assertWriteBudget(db, uid, "podium", { max: 120, windowMs: 10 * 60 * 1000 });
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
