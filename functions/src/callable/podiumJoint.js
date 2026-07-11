/**
 * Joint rehearsals — the Podium social-mechanic callables (Phase 7.1,
 * design §5.12), split from callable/podium.js for file-size hygiene.
 * Shares podiumContext (feature gate + season/day derivation + balance
 * overrides) with the rest of the Podium API.
 */

const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { logger } = require("firebase-functions/v2");
const store = require("../helpers/podium/store");
const joint = require("../helpers/podium/joint");
const venues = require("../helpers/podium/venues");
const { podiumContext } = require("./podium");

// ---------------------------------------------------------------------------
// Joint rehearsals (Phase 7.1, design §5.12) — the human handshake.
// ---------------------------------------------------------------------------

/** Shared proposal-day validation: a competition day still ahead of us. */
function validateJointDay(day, competitionDay) {
  if (!Number.isInteger(day) || day < 1 || day > 49) {
    throw new HttpsError("invalid-argument", "Joint rehearsals run on competition days 1-49.");
  }
  if (day <= competitionDay) {
    throw new HttpsError("failed-precondition", "That day has already passed.");
  }
  const maxAhead = store.balance.joint.proposalMaxAheadDays;
  if (day > competitionDay + maxAhead) {
    throw new HttpsError(
      "invalid-argument",
      `Joint rehearsals can be proposed up to ${maxAhead} days ahead.`
    );
  }
}

/** Throws unless this corps can still take a joint on `day`. */
function assertJointCapacity(state, day, label) {
  if (state.jointRehearsal && state.jointRehearsal.day > 0) {
    throw new HttpsError(
      "failed-precondition",
      `${label} already has a joint rehearsal scheduled (day ${state.jointRehearsal.day}).`
    );
  }
  const week = joint.weekOf(day);
  if (joint.jointsUsedInWeek(state, week) >= store.balance.joint.maxPerWeek) {
    throw new HttpsError(
      "failed-precondition",
      `${label} has already used the week-${week} joint rehearsal.`
    );
  }
}

/**
 * Ranked overlap windows for a proposer→partner pair (design §5.12, redesign):
 * the days over the next two weeks where both corps sit idle on the tour, each
 * priced with its host city/stadium and the proposer's travel burden. This is
 * what Step 2 of the flow renders — the director picks a window instead of
 * guessing a day. Read-only; the actual booking still goes through
 * proposeJointRehearsal → respondJointRehearsal.
 */
exports.getJointOverlaps = onCall({ cors: true }, async (request) => {
  const { uid, db, seasonData, competitionDay } = await podiumContext(request);
  const { toUid } = request.data || {};
  if (typeof toUid !== "string" || !toUid || toUid === uid) {
    throw new HttpsError("invalid-argument", "Pick another director's corps.");
  }

  const [mySnapshot, theirSnapshot] = await Promise.all([
    store.stateRef(db, uid).get(),
    store.stateRef(db, toUid).get(),
  ]);
  if (!mySnapshot.exists || mySnapshot.data().seasonUid !== seasonData.seasonUid) {
    throw new HttpsError("failed-precondition", "Register a Podium corps first.");
  }
  if (!theirSnapshot.exists || theirSnapshot.data().seasonUid !== seasonData.seasonUid) {
    throw new HttpsError("failed-precondition", "That corps is not active this season.");
  }
  const myState = mySnapshot.data();
  const theirState = theirSnapshot.data();

  // One upcoming joint at a time (either side) — surface WHY there are no
  // windows so the client can explain it instead of showing an empty list.
  const alreadyBooked = Boolean(myState.jointRehearsal && myState.jointRehearsal.day > competitionDay);
  const partnerBooked = Boolean(
    theirState.jointRehearsal && theirState.jointRehearsal.day > competitionDay
  );
  if (alreadyBooked || partnerBooked) {
    return {
      success: true,
      windows: [],
      partnerCorpsName: theirState.corpsName || null,
      alreadyBooked,
      partnerBooked,
    };
  }

  const [scheduleLocations, easternAssignments] = await Promise.all([
    store.loadScheduleLocations(db, seasonData),
    store.loadEasternAssignments(db, seasonData.seasonUid),
  ]);
  const windows = joint.computeOverlaps(myState, theirState, uid, toUid, {
    competitionDay,
    scheduleLocations,
    easternAssignments,
    storeModule: store,
    cfg: store.balance,
  });
  return {
    success: true,
    windows,
    partnerCorpsName: theirState.corpsName || null,
    alreadyBooked: false,
    partnerBooked: false,
  };
});

exports.proposeJointRehearsal = onCall({ cors: true }, async (request) => {
  const { uid, db, seasonData, competitionDay } = await podiumContext(request);
  const { toUid, day } = request.data || {};
  if (typeof toUid !== "string" || !toUid || toUid === uid) {
    throw new HttpsError("invalid-argument", "Pick another director's corps.");
  }
  validateJointDay(day, competitionDay);

  const [mySnapshot, theirSnapshot] = await Promise.all([
    store.stateRef(db, uid).get(),
    store.stateRef(db, toUid).get(),
  ]);
  if (!mySnapshot.exists || mySnapshot.data().seasonUid !== seasonData.seasonUid) {
    throw new HttpsError("failed-precondition", "Register a Podium corps first.");
  }
  if (!theirSnapshot.exists || theirSnapshot.data().seasonUid !== seasonData.seasonUid) {
    throw new HttpsError("failed-precondition", "That corps is not active this season.");
  }
  const myState = mySnapshot.data();
  const theirState = theirSnapshot.data();
  assertJointCapacity(myState, day, "Your corps");
  assertJointCapacity(theirState, day, `${theirState.corpsName}`);

  // One live proposal per pair (either direction) keeps the inbox sane.
  const dupes = await joint
    .proposalsCollection(db, seasonData.seasonUid)
    .where("pairKey", "==", [uid, toUid].sort().join("_"))
    .where("status", "==", "pending")
    .get();
  if (dupes.docs.some((d) => d.data().day > competitionDay)) {
    throw new HttpsError("already-exists", "There is already a pending proposal with this corps.");
  }

  // Preview the geography now so BOTH directors see where the joint lands and
  // who bears the travel before anyone commits (design §5.12). The invitee's
  // city hosts; the proposer covers any gap. Recomputed authoritatively at
  // acceptance — this is the informed-consent snapshot.
  const [scheduleLocations, easternAssignments] = await Promise.all([
    store.loadScheduleLocations(db, seasonData),
    store.loadEasternAssignments(db, seasonData.seasonUid),
  ]);
  const myVenue = joint.corpsVenueOnDay(myState, uid, day, scheduleLocations, store, easternAssignments);
  const theirVenue = joint.corpsVenueOnDay(theirState, toUid, day, scheduleLocations, store, easternAssignments);
  const host = theirVenue || myVenue || null;
  const gate = joint.geographyGate(myVenue, theirVenue, store.balance);

  const proposalRef = joint.proposalsCollection(db, seasonData.seasonUid).doc();
  await proposalRef.set({
    fromUid: uid,
    toUid,
    pairKey: [uid, toUid].sort().join("_"),
    fromCorpsName: myState.corpsName || null,
    toCorpsName: theirState.corpsName || null,
    day,
    // Informed-consent snapshot for the inbox.
    city: host ? `${host.city}, ${host.region}` : null,
    stadium: host ? venues.stadiumFor(host.venueId) : null,
    proposerTravelTier: gate.travelTier,
    milesApart: gate.miles,
    status: "pending",
    seasonUid: seasonData.seasonUid,
    createdAt: new Date().toISOString(),
  });
  logger.info(`Joint rehearsal proposed: ${uid} -> ${toUid} day ${day}`);
  return { success: true, proposalId: proposalRef.id, day };
});

exports.respondJointRehearsal = onCall({ cors: true }, async (request) => {
  const { uid, db, seasonData, competitionDay } = await podiumContext(request);
  const { proposalId, accept } = request.data || {};
  if (typeof proposalId !== "string" || !proposalId) {
    throw new HttpsError("invalid-argument", "proposalId is required.");
  }
  const proposalRef = joint.proposalsCollection(db, seasonData.seasonUid).doc(proposalId);
  const proposalSnapshot = await proposalRef.get();
  if (!proposalSnapshot.exists) throw new HttpsError("not-found", "Proposal not found.");
  const proposal = proposalSnapshot.data();
  if (proposal.toUid !== uid) {
    throw new HttpsError("permission-denied", "Only the invited director can respond.");
  }
  if (proposal.status !== "pending") {
    throw new HttpsError("failed-precondition", `Proposal already ${proposal.status}.`);
  }
  if (proposal.day <= competitionDay) {
    await proposalRef.set({ status: "expired" }, { merge: true });
    throw new HttpsError("failed-precondition", "That proposal expired unanswered.");
  }

  if (accept !== true) {
    await proposalRef.set(
      { status: "declined", respondedAt: new Date().toISOString() },
      { merge: true }
    );
    return { success: true, status: "declined" };
  }

  // Geography (design §5.12): free within the day-trip tier of both corps'
  // tour positions on that day; beyond it the PROPOSER pays the normal
  // travel cost of the gap (charged by the processor on the joint day).
  const scheduleLocations = await store.loadScheduleLocations(db, seasonData);

  const fromRef = store.stateRef(db, proposal.fromUid);
  const toRef = store.stateRef(db, uid);
  const result = await db.runTransaction(async (transaction) => {
    const [fromSnapshot, toSnapshot] = await Promise.all([
      transaction.get(fromRef),
      transaction.get(toRef),
    ]);
    if (!fromSnapshot.exists || fromSnapshot.data().seasonUid !== seasonData.seasonUid) {
      throw new HttpsError("failed-precondition", "The proposing corps is no longer active.");
    }
    if (!toSnapshot.exists || toSnapshot.data().seasonUid !== seasonData.seasonUid) {
      throw new HttpsError("failed-precondition", "Register a Podium corps first.");
    }
    const fromState = fromSnapshot.data();
    const toState = toSnapshot.data();
    assertJointCapacity(fromState, proposal.day, `${fromState.corpsName}`);
    assertJointCapacity(toState, proposal.day, "Your corps");

    const venueFrom = joint.corpsVenueOnDay(
      fromState, proposal.fromUid, proposal.day, scheduleLocations, store
    );
    const venueTo = joint.corpsVenueOnDay(toState, uid, proposal.day, scheduleLocations, store);
    const gate = joint.geographyGate(venueFrom, venueTo, store.balance);

    // Repeat-pair decay, frozen at acceptance so both sides agree forever.
    const priorPairs = joint.pairCountWith(fromState, uid);
    const bonusMult = joint.ensembleBonusFor(priorPairs, store.balance);
    const hostCity = venueTo
      ? `${venueTo.city}, ${venueTo.region}`
      : venueFrom
        ? `${venueFrom.city}, ${venueFrom.region}`
        : null;

    const host = venueTo || venueFrom || null;
    const week = joint.weekOf(proposal.day);
    const entryBase = {
      day: proposal.day,
      bonusMult,
      city: hostCity,
      stadium: host ? venues.stadiumFor(host.venueId) : null,
      proposalId,
    };
    transaction.set(
      fromRef,
      {
        jointRehearsal: {
          ...entryBase,
          partnerUid: uid,
          partnerCorpsName: toState.corpsName || null,
          // The proposer closes the geography gap on their own dime.
          travelTier: gate.travelTier,
        },
        jointHistory: [
          ...(fromState.jointHistory || []).slice(-19),
          { day: proposal.day, partnerUid: uid, week },
        ],
      },
      { merge: true }
    );
    transaction.set(
      toRef,
      {
        jointRehearsal: {
          ...entryBase,
          partnerUid: proposal.fromUid,
          partnerCorpsName: fromState.corpsName || null,
          travelTier: null,
        },
        jointHistory: [
          ...(toState.jointHistory || []).slice(-19),
          { day: proposal.day, partnerUid: proposal.fromUid, week },
        ],
      },
      { merge: true }
    );
    transaction.set(
      proposalRef,
      {
        status: "accepted",
        respondedAt: new Date().toISOString(),
        bonusMult,
        travelTier: gate.travelTier,
        miles: gate.miles,
        city: hostCity,
      },
      { merge: true }
    );
    return { day: proposal.day, bonusMult, travelTier: gate.travelTier, city: hostCity };
  });

  logger.info(`Joint rehearsal accepted: ${proposal.fromUid} x ${uid} day ${result.day}`);
  return { success: true, status: "accepted", ...result };
});

exports.getJointRehearsals = onCall({ cors: true }, async (request) => {
  const { uid, db, seasonData, competitionDay } = await podiumContext(request);
  const seasonUid = seasonData.seasonUid;

  const [incomingSnapshot, outgoingSnapshot, stateSnapshot, rosterSnapshot] = await Promise.all([
    joint.proposalsCollection(db, seasonUid)
      .where("toUid", "==", uid).where("status", "==", "pending").get(),
    joint.proposalsCollection(db, seasonUid)
      .where("fromUid", "==", uid).where("status", "==", "pending").get(),
    store.stateRef(db, uid).get(),
    store.rosterCollection(db, seasonUid).get(),
  ]);

  const live = (docs) =>
    docs
      .map((d) => ({ id: d.id, ...d.data() }))
      .filter((p) => p.day > competitionDay);
  const state =
    stateSnapshot.exists && stateSnapshot.data().seasonUid === seasonUid
      ? stateSnapshot.data()
      : null;
  return {
    success: true,
    incoming: live(incomingSnapshot.docs),
    outgoing: live(outgoingSnapshot.docs),
    upcoming: state && state.jointRehearsal ? state.jointRehearsal : null,
    scrimmage: state && state.scrimmage ? state.scrimmage : null,
    headToHead: state && state.headToHead ? state.headToHead : {},
    history: state ? state.jointHistory || [] : [],
    roster: rosterSnapshot.docs
      .filter((d) => d.id !== uid)
      .map((d) => ({
        uid: d.id,
        corpsName: d.data().corpsName || null,
        city: d.data().location || null,
      })),
  };
});

module.exports.validateJointDay = validateJointDay;
