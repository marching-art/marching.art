/**
 * Podium staff callables (design §5.6, careers per decision 28) — split from
 * podium.js (same max-lines discipline as podiumJoint.js).
 *
 * The market is the persistent-career pool (podium-staff/registry) projected
 * into a season doc; hiring signs a 1-3 season CONTRACT at a salary frozen
 * at signing; employers can POST a contract to the transfer market
 * (buyer pays remaining pro-rata salary + buyout premium, seller recoups
 * the remainder) and RETRAIN a person into a new specialty (tenure kept,
 * reduced boost for the rest of the season).
 */

const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { logger } = require("firebase-functions/v2");
const store = require("../helpers/podium/store");
const staffMarket = require("../helpers/podium/staffMarket");
const career = require("../helpers/podium/career");
const { podiumContext } = require("./podium");

/** Remaining pro-rata salary of a contract season from `day` (never < 0). */
function remainingSeasonSalary(salaryPerSeason, day) {
  const remainingDays = Math.max(0, 49 - Math.max(0, day));
  return Math.round((salaryPerSeason * remainingDays) / 49);
}

/** Lazily create the season market from the persistent registry. */
async function ensureSeasonMarket(db, seasonData) {
  const marketRef = store.staffMarketRef(db, seasonData.seasonUid);
  const snapshot = await marketRef.get();
  // A doc can exist WITHOUT a staff array: contract carry-over at
  // re-registration merge-writes `preSigned` before anyone opens the market.
  if (snapshot.exists && Array.isArray(snapshot.data().staff)) {
    return { marketRef, market: snapshot.data() };
  }
  const seasonIndex = await career.ensureSeasonIndex(db, seasonData);
  const registryRef = store.staffRegistryRef(db);
  const registrySnapshot = await registryRef.get();
  const { registry, staff } = staffMarket.buildSeasonMarket(
    registrySnapshot.exists ? registrySnapshot.data() : null,
    seasonData.seasonUid,
    seasonIndex.index,
    store.balance
  );
  // Carried multi-season contracts signed before the market was generated.
  const preSigned = (snapshot.exists && snapshot.data().preSigned) || {};
  for (const person of staff) {
    if (preSigned[person.id]) person.signedBy = preSigned[person.id];
  }
  const market = {
    seasonUid: seasonData.seasonUid,
    generatedAt: new Date().toISOString(),
    staff,
    transfers: [],
    preSigned,
  };
  await registryRef.set(registry);
  await marketRef.set(market, { merge: true });
  return { marketRef, market };
}

exports.getPodiumStaffMarket = onCall({ cors: true }, async (request) => {
  const { db, seasonData } = await podiumContext(request);
  const { market } = await ensureSeasonMarket(db, seasonData);
  return { success: true, market: market.staff, transfers: market.transfers || [] };
});

exports.hirePodiumStaff = onCall({ cors: true }, async (request) => {
  const { uid, db, seasonData, competitionDay } = await podiumContext(request);
  const { staffId } = request.data || {};
  const requestedSeasons = request.data?.seasons;
  if (typeof staffId !== "string" || !staffId) {
    throw new HttpsError("invalid-argument", "staffId is required.");
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
  await ensureSeasonMarket(db, seasonData);
  const marketRef = store.staffMarketRef(db, seasonData.seasonUid);
  const sRef = store.stateRef(db, uid);

  const result = await db.runTransaction(async (transaction) => {
    const [marketSnapshot, stateSnapshot] = await Promise.all([
      transaction.get(marketRef),
      transaction.get(sRef),
    ]);
    if (!stateSnapshot.exists || stateSnapshot.data().seasonUid !== seasonData.seasonUid) {
      throw new HttpsError("failed-precondition", "Register a Podium corps first.");
    }
    const market = marketSnapshot.data();
    const person = market.staff.find((member) => member.id === staffId);
    if (!person) throw new HttpsError("not-found", "That staff member is not in this season's market.");
    if (person.signedBy && person.signedBy !== uid) {
      throw new HttpsError("failed-precondition", `${person.name} has already signed elsewhere.`);
    }
    const state = stateSnapshot.data();
    if (state.staff && state.staff[person.specialty]) {
      throw new HttpsError("failed-precondition", `You already employ a ${person.specialty} staff member.`);
    }
    // First season's salary is due at signing; later seasons are charged
    // from each new season's budget at re-registration (lapse if unpaid).
    if (!store.debitBudget(state, person.salary, `staff:${person.specialty}`, Math.max(0, competitionDay))) {
      throw new HttpsError("failed-precondition", `Not enough Corps Budget (salary ${person.salary}).`);
    }
    person.signedBy = uid;
    state.staff = {
      ...(state.staff || {}),
      [person.specialty]: {
        id: person.id,
        name: person.name,
        specialty: person.specialty,
        tier: person.tier,
        boost: person.boost,
        trait: person.trait,
        careerSeasons: person.careerSeasons || 0,
        salaryPerSeason: person.salary,
        contract: { seasons, remaining: seasons },
        hiredDay: Math.max(0, competitionDay),
      },
    };
    state.updatedAt = new Date().toISOString();
    transaction.set(marketRef, market);
    transaction.set(sRef, state);
    return { staff: state.staff, budget: state.budget, hired: person.name };
  });

  return { success: true, ...result };
});

exports.postPodiumStaff = onCall({ cors: true }, async (request) => {
  const { uid, db, seasonData, competitionDay } = await podiumContext(request);
  const { staffId } = request.data || {};
  if (typeof staffId !== "string" || !staffId) {
    throw new HttpsError("invalid-argument", "staffId is required.");
  }
  const marketRef = store.staffMarketRef(db, seasonData.seasonUid);
  const sRef = store.stateRef(db, uid);

  const result = await db.runTransaction(async (transaction) => {
    const [marketSnapshot, stateSnapshot] = await Promise.all([
      transaction.get(marketRef),
      transaction.get(sRef),
    ]);
    if (!stateSnapshot.exists || stateSnapshot.data().seasonUid !== seasonData.seasonUid) {
      throw new HttpsError("failed-precondition", "Register a Podium corps first.");
    }
    const state = stateSnapshot.data();
    const entry = Object.entries(state.staff || {}).find(([, member]) => member && member.id === staffId);
    if (!entry) throw new HttpsError("not-found", "You do not employ that staff member.");
    const [specialty, member] = entry;

    const remaining = remainingSeasonSalary(
      member.salaryPerSeason || member.salary || 0,
      competitionDay
    );
    const buyout = Math.ceil(remaining * (1 + store.balance.staff.career.buyoutPremium));

    delete state.staff[specialty];
    state.updatedAt = new Date().toISOString();

    const market = marketSnapshot.exists ? marketSnapshot.data() : { staff: [], transfers: [] };
    market.transfers = [
      ...(market.transfers || []),
      {
        staffId: member.id,
        member,
        fromUid: uid,
        fromCorpsName: state.corpsName || null,
        postedDay: Math.max(0, competitionDay),
        remainingSalary: remaining,
        buyout,
      },
    ];
    transaction.set(marketRef, market, { merge: true });
    transaction.set(sRef, state);
    return { posted: member.name, buyout, staff: state.staff };
  });

  return { success: true, ...result };
});

exports.buyPodiumStaffContract = onCall({ cors: true }, async (request) => {
  const { uid, db, seasonData, competitionDay } = await podiumContext(request);
  const { staffId } = request.data || {};
  if (typeof staffId !== "string" || !staffId) {
    throw new HttpsError("invalid-argument", "staffId is required.");
  }
  const marketRef = store.staffMarketRef(db, seasonData.seasonUid);
  const sRef = store.stateRef(db, uid);

  const result = await db.runTransaction(async (transaction) => {
    const [marketSnapshot, stateSnapshot] = await Promise.all([
      transaction.get(marketRef),
      transaction.get(sRef),
    ]);
    if (!stateSnapshot.exists || stateSnapshot.data().seasonUid !== seasonData.seasonUid) {
      throw new HttpsError("failed-precondition", "Register a Podium corps first.");
    }
    if (!marketSnapshot.exists) throw new HttpsError("not-found", "No staff market this season.");
    const market = marketSnapshot.data();
    const listingIndex = (market.transfers || []).findIndex((t) => t.staffId === staffId);
    if (listingIndex === -1) {
      throw new HttpsError("not-found", "That contract is not on the transfer market.");
    }
    const listing = market.transfers[listingIndex];
    if (listing.fromUid === uid) {
      throw new HttpsError("failed-precondition", "Withdraw your own posting instead of buying it.");
    }
    const state = stateSnapshot.data();
    const specialty = listing.member.specialty;
    if (state.staff && state.staff[specialty]) {
      throw new HttpsError("failed-precondition", `You already employ a ${specialty} staff member.`);
    }
    // Seller's state is read INSIDE the transaction (all reads before writes).
    const sellerRef = store.stateRef(db, listing.fromUid);
    const sellerSnapshot = await transaction.get(sellerRef);

    if (!store.debitBudget(state, listing.buyout, `staffBuyout:${specialty}`, Math.max(0, competitionDay))) {
      throw new HttpsError("failed-precondition", `Not enough Corps Budget (buyout ${listing.buyout}).`);
    }
    state.staff = {
      ...(state.staff || {}),
      [specialty]: { ...listing.member, hiredDay: Math.max(0, competitionDay) },
    };
    state.updatedAt = new Date().toISOString();

    // Seller recoups the pro-rata remainder; the premium is a sink.
    if (
      sellerSnapshot.exists &&
      sellerSnapshot.data().seasonUid === seasonData.seasonUid &&
      listing.remainingSalary > 0
    ) {
      const sellerState = sellerSnapshot.data();
      store.creditBudget(
        sellerState,
        listing.remainingSalary,
        `staffSold:${specialty}`,
        Math.max(0, competitionDay)
      );
      sellerState.updatedAt = new Date().toISOString();
      transaction.set(sellerRef, sellerState);
    }

    market.transfers = market.transfers.filter((_, index) => index !== listingIndex);
    const person = (market.staff || []).find((member) => member.id === staffId);
    if (person) person.signedBy = uid;
    transaction.set(marketRef, market, { merge: true });
    transaction.set(sRef, state);
    return { hired: listing.member.name, budget: state.budget, staff: state.staff };
  });

  logger.info(`[podium] staff contract ${staffId} bought by ${uid}`);
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
      throw new HttpsError("invalid-argument", `${member.name} already covers ${toSpecialty}.`);
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
    return { retrained: member.name, toSpecialty, staff: state.staff, budget: state.budget };
  });

  // The specialty change is for life — persist it to the career registry
  // (best-effort; the registry self-heals at the next market build).
  try {
    const registryRef = store.staffRegistryRef(db);
    const registrySnapshot = await registryRef.get();
    if (registrySnapshot.exists) {
      const registry = registrySnapshot.data();
      if (registry.people && registry.people[staffId]) {
        registry.people[staffId].specialty = toSpecialty;
        await registryRef.set(registry);
      }
    }
  } catch (error) {
    logger.warn(`[podium] registry retrain update failed for ${staffId}: ${error.message}`);
  }

  return { success: true, ...result };
});
