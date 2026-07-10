/**
 * Podium Class callables (Phase 2, PODIUM_CLASS_DESIGN.md).
 *
 * Every mutation is server-validated: "today" is always derived from the
 * shared 2 AM ET game clock (never client-supplied), state lives in the
 * server-only podium/state subcollection, and every callable is gated on
 * game-settings/features.podiumClass. Scores are never computed here — only
 * the nightly processor scores shows.
 */

const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { logger } = require("firebase-functions/v2");
const { getDb } = require("../config");
const { assertAuth } = require("../helpers/callableGuards");
const { isPodiumEnabled } = require("../helpers/features");
const { getActiveCalendarDay, toCompetitionDay } = require("../helpers/gameDay");
const engine = require("../helpers/podium/engine");
const store = require("../helpers/podium/store");
const venues = require("../helpers/podium/venues");

const FOOD_TIERS = ["gasStation", "standard", "fullKitchen"];
const MAX_TEMPLATE_BLOCKS = 5;

/**
 * Validate a CorpsCoin -> Corps Budget commitment amount against the
 * division-equal cap (decision 24). `alreadyCommitted` enforces the
 * cumulative cap for mid-season top-ups.
 */
function validateCommitment(amount, alreadyCommitted) {
  if (amount == null || amount === 0) return 0;
  if (!Number.isInteger(amount) || amount < 0) {
    throw new HttpsError("invalid-argument", "Budget commitment must be a non-negative integer.");
  }
  const cap = store.balance.budget.commitmentCap;
  if (alreadyCommitted + amount > cap) {
    throw new HttpsError(
      "invalid-argument",
      `Budget commitments are capped at ${cap} CC per season (already committed: ${alreadyCommitted}).`
    );
  }
  return amount;
}

/**
 * Inside a transaction: debit profile CorpsCoin for a budget commitment.
 * Reads MUST have happened already (Firestore txn rule) — pass the profile
 * snapshot in.
 */
function applyCommitmentDebit(transaction, db, uid, profileSnapshot, amount) {
  const corpsCoin = profileSnapshot.exists ? profileSnapshot.data().corpsCoin || 0 : 0;
  if (corpsCoin < amount) {
    throw new HttpsError("failed-precondition", `Not enough CorpsCoin (have ${corpsCoin}, need ${amount}).`);
  }
  transaction.update(store.profileRef(db, uid), { corpsCoin: corpsCoin - amount });
  const historyRef = db
    .collection(`artifacts/${require("../config").dataNamespaceParam.value()}/users/${uid}/corpsCoinHistory`)
    .doc();
  transaction.set(historyRef, {
    type: "podium_budget_commit",
    amount: -amount,
    description: "Corps Budget commitment (Podium Class)",
    timestamp: new Date(),
  });
}

const AUDITION_POOL = 100;
const NAME_MIN = 3;
const NAME_MAX = 40;

/** Validate a challenge map: all 8 captions, integers 1-8. Returns normalized copy. */
function validateChallenge(challenge) {
  if (!challenge || typeof challenge !== "object") {
    throw new HttpsError("invalid-argument", "Challenge levels are required.");
  }
  const normalized = {};
  for (const caption of engine.CAPTIONS) {
    const level = challenge[caption];
    if (!Number.isInteger(level) || level < 1 || level > 8) {
      throw new HttpsError("invalid-argument", `Challenge for ${caption} must be an integer 1-8.`);
    }
    normalized[caption] = level;
  }
  return normalized;
}

/**
 * Validate an audition allocation: non-negative integers per caption summing
 * to at most AUDITION_POOL. Returns per-caption shares for the engine
 * (undefined when the director skipped the step — even distribution).
 */
function validateAuditions(auditions) {
  if (auditions == null) return undefined;
  if (typeof auditions !== "object") {
    throw new HttpsError("invalid-argument", "Auditions must be a points-per-caption object.");
  }
  let total = 0;
  const points = {};
  for (const caption of engine.CAPTIONS) {
    const value = auditions[caption] ?? 0;
    if (!Number.isInteger(value) || value < 0) {
      throw new HttpsError("invalid-argument", `Audition points for ${caption} must be a non-negative integer.`);
    }
    points[caption] = value;
    total += value;
  }
  if (total === 0) return undefined;
  if (total > AUDITION_POOL) {
    throw new HttpsError("invalid-argument", `Audition points exceed the pool of ${AUDITION_POOL}.`);
  }
  const shares = {};
  for (const caption of engine.CAPTIONS) shares[caption] = points[caption] / total;
  return shares;
}

/**
 * Validate self-selected show days for one week against the pick budget
 * (majors and championship week are auto-attended and never selectable).
 * @returns {number[]} sorted, deduped days
 */
function validateShowDays(week, days, uid, seasonUid, currentCompetitionDay) {
  if (!Number.isInteger(week) || week < 1 || week > 7) {
    throw new HttpsError("invalid-argument", "Week must be 1-7.");
  }
  if (!Array.isArray(days)) {
    throw new HttpsError("invalid-argument", "Days must be an array.");
  }
  const maxPicks = store.maxPicksForWeek(week);
  const autoDays = store.autoDaysFor(uid, seasonUid);
  const unique = [...new Set(days)].sort((a, b) => a - b);
  if (unique.length > maxPicks) {
    throw new HttpsError("invalid-argument", `Week ${week} allows at most ${maxPicks} selected shows.`);
  }
  for (const day of unique) {
    if (!Number.isInteger(day) || Math.ceil(day / 7) !== week) {
      throw new HttpsError("invalid-argument", `Day ${day} is not in week ${week}.`);
    }
    if (autoDays.includes(day) || store.EASTERN_DAYS.includes(day)) {
      throw new HttpsError("invalid-argument", `Day ${day} is auto-attended (major/championship) and not selectable.`);
    }
    if (day <= currentCompetitionDay) {
      throw new HttpsError("invalid-argument", `Day ${day} has already passed.`);
    }
  }
  return unique;
}

/** Shared preamble: flag gate, auth, season, day context. */
async function podiumContext(request) {
  const uid = assertAuth(request);
  const db = getDb();
  if (!(await isPodiumEnabled(db))) {
    throw new HttpsError("failed-precondition", "Podium Class is not currently enabled.");
  }
  const seasonDoc = await db.doc("game-settings/season").get();
  if (!seasonDoc.exists || !seasonDoc.data().seasonUid) {
    throw new HttpsError("failed-precondition", "There is no active season.");
  }
  const seasonData = seasonDoc.data();
  const calendarDay = getActiveCalendarDay(seasonData.schedule.startDate.toDate());
  const competitionDay = toCompetitionDay(calendarDay, seasonData);
  return { uid, db, seasonData, calendarDay, competitionDay };
}

/**
 * Roll podium/state.today forward to the active calendar day. The completed
 * day's block usage is snapshotted to pendingEndOfDay so the nightly
 * processor can apply decay/recovery even if it runs after the roll.
 */
function rollToday(state, calendarDay) {
  if (state.today && state.today.calendarDay === calendarDay) return state;
  if (state.today && state.today.calendarDay < calendarDay) {
    state.pendingEndOfDay = { ...state.today };
  }
  state.today = { calendarDay, blocksUsed: 0, blocks: [], restDay: false, warmupUsed: false };
  return state;
}

exports.registerPodiumCorps = onCall({ cors: true }, async (request) => {
  const { uid, db, seasonData, calendarDay } = await podiumContext(request);
  const { corpsName, location, showConcept } = request.data || {};

  if (typeof corpsName !== "string" || corpsName.trim().length < NAME_MIN || corpsName.trim().length > NAME_MAX) {
    throw new HttpsError("invalid-argument", `Corps name must be ${NAME_MIN}-${NAME_MAX} characters.`);
  }
  if (calendarDay < 1) {
    throw new HttpsError("failed-precondition", "The season has not started yet.");
  }
  const challenge = validateChallenge(request.data?.challenge);
  const auditionShares = validateAuditions(request.data?.auditions);
  const budgetCommitment = validateCommitment(request.data?.budgetCommitment, 0);

  const seasonUid = seasonData.seasonUid;
  const trimmedName = corpsName.trim();
  const normalizedName = trimmedName.toLowerCase();
  // Same reservation namespace as fantasy registration: one corps name per
  // season across the whole game.
  const nameRef = db.doc(`corpsnames/${seasonUid}_${normalizedName}`);
  const sRef = store.stateRef(db, uid);

  await db.runTransaction(async (transaction) => {
    const [existingState, existingName, profileSnapshot] = await Promise.all([
      transaction.get(sRef),
      transaction.get(nameRef),
      transaction.get(store.profileRef(db, uid)),
    ]);
    if (existingState.exists && existingState.data().seasonUid === seasonUid) {
      throw new HttpsError("already-exists", "You already field a Podium corps this season.");
    }
    if (existingName.exists && existingName.data().uid !== uid) {
      throw new HttpsError("already-exists", "That corps name is taken this season.");
    }
    if (budgetCommitment > 0) {
      applyCommitmentDebit(transaction, db, uid, profileSnapshot, budgetCommitment);
    }


    // Mid-season joiners start from the corpus catch-up baseline: the engine
    // seeds day-1 state; content advances toward the median pace for the
    // current day (§9 catch-up: playable, never advantaged).
    const engineState = engine.createSeasonState(
      { challenge, auditions: auditionShares, repTier: 1 },
      store.curves,
      store.balance
    );
    const competitionDay = toCompetitionDay(calendarDay, seasonData);
    if (competitionDay > 1) {
      const catchUp = Math.min(0.85, (competitionDay - 1) / 49) * 0.35;
      for (const caption of engine.CAPTIONS) {
        engineState.captions[caption].content = Math.min(1, engineState.captions[caption].content + catchUp);
        engineState.captions[caption].clean = Math.min(1, engineState.captions[caption].clean + catchUp * 0.6);
      }
    }

    const stored = store.dehydrateState(engineState);
    transaction.set(sRef, {
      ...stored,
      seasonUid,
      corpsName: trimmedName,
      location: typeof location === "string" ? location.slice(0, 80) : "",
      showConcept: typeof showConcept === "string" ? showConcept.slice(0, 200) : "",
      challenge,
      auditions: auditionShares || null,
      reputation: 0,
      repTier: 1,
      budget: (() => {
        const budget = store.initBudget();
        if (budgetCommitment > 0) {
          budget.balance = budgetCommitment;
          budget.committed = budgetCommitment;
          budget.log = [{ day: 0, amount: budgetCommitment, reason: "commitment" }];
        }
        return budget;
      })(),
      selectedShowDays: [],
      today: { calendarDay, blocksUsed: 0, blocks: [], restDay: false, warmupUsed: false },
      lastScoredDay: null,
      lastTotal: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    transaction.set(nameRef, { uid, corpsClass: "podiumClass", seasonUid });
    transaction.set(store.rosterRef(db, seasonUid, uid), {
      uid,
      corpsName: trimmedName,
      createdAt: new Date().toISOString(),
    });
    // Display copy on the profile (identity + placeholders the UI reads).
    transaction.set(
      store.profileRef(db, uid),
      {
        corps: {
          podiumClass: {
            corpsName: trimmedName,
            location: typeof location === "string" ? location.slice(0, 80) : "",
            showConcept: typeof showConcept === "string" ? showConcept.slice(0, 200) : "",
            class: "podiumClass",
            repTier: 1,
            totalSeasonScore: null,
            seasonRank: null,
            seasonRankOf: null,
            createdAt: new Date().toISOString(),
          },
        },
      },
      { merge: true }
    );
  });

  logger.info(`Podium corps registered: ${trimmedName} (${uid}) season ${seasonUid}`);
  return { success: true, corpsName: trimmedName, easternNight: store.easternNightFor(uid, seasonUid) };
});

exports.allocateRehearsalBlock = onCall({ cors: true }, async (request) => {
  const { uid, db, seasonData, calendarDay, competitionDay } = await podiumContext(request);
  const { blockType, blockIndex } = request.data || {};

  const isFundraiser = blockType === "fundraiser";
  if (!isFundraiser && !engine.BLOCK_TYPES.includes(blockType)) {
    throw new HttpsError("invalid-argument", `Unknown block type: ${blockType}`);
  }
  if (calendarDay < 1) {
    throw new HttpsError("failed-precondition", "The season has not started yet.");
  }
  if (competitionDay > 49) {
    throw new HttpsError("failed-precondition", "The season is over.");
  }

  const sRef = store.stateRef(db, uid);
  const result = await db.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(sRef);
    if (!snapshot.exists || snapshot.data().seasonUid !== seasonData.seasonUid) {
      throw new HttpsError("failed-precondition", "Register a Podium corps first.");
    }
    const state = store.hydrateState(snapshot.data());
    rollToday(state, calendarDay);

    if (state.today.restDay) {
      throw new HttpsError("failed-precondition", "Today is a declared rest day.");
    }
    const isShowDay = store.isShowDayFor(state, uid, competitionDay);
    const isSpringTraining = seasonData.status === "live-season" && competitionDay < 1;
    const maxBlocks = engine.blocksAvailable(state, { isShowDay, isSpringTraining }, store.balance);

    if (state.today.blocksUsed >= maxBlocks) {
      throw new HttpsError("resource-exhausted", `All ${maxBlocks} blocks are used for today.`);
    }
    // Idempotency: the client passes the index it believes it is allocating;
    // a retry of an applied call is rejected instead of double-applied.
    if (Number.isInteger(blockIndex) && blockIndex !== state.today.blocksUsed) {
      throw new HttpsError(
        "aborted",
        `Block index ${blockIndex} already allocated (next is ${state.today.blocksUsed}).`
      );
    }

    let panel;
    if (isFundraiser) {
      // The guns-vs-butter block (design §14.1.2): a block slot converted to
      // Corps Budget income instead of caption growth.
      const { yield: fundraiserYield, staminaCost } = store.balance.budget.fundraiser;
      store.creditBudget(state, fundraiserYield, "fundraiser", competitionDay);
      state.condition.stamina = Math.max(0, state.condition.stamina - staminaCost);
      panel = {
        blockType: "fundraiser",
        day: competitionDay,
        gains: {},
        budgetEarned: fundraiserYield,
        staminaCost,
        repeatMult: 1,
      };
    } else {
      const blocksSoFar = {};
      for (const b of state.today.blocks) blocksSoFar[b] = (blocksSoFar[b] || 0) + 1;
      // Active clinician engagement boosts their block type (design §5.6).
      const clinicianActive =
        state.clinician &&
        state.clinician.block === blockType &&
        state.clinician.expiresDay >= competitionDay;
      panel = engine.allocateBlock(
        state,
        blockType,
        competitionDay,
        state.today.blocksUsed,
        blocksSoFar,
        store.curves,
        store.balance,
        clinicianActive ? { yieldMultiplier: store.balance.clinician.yieldBoost } : {}
      );
      if (clinicianActive) panel.clinicianBoost = store.balance.clinician.yieldBoost;
    }

    state.today.blocksUsed += 1;
    state.today.blocks = [...state.today.blocks, blockType];
    if (blockType === "warmup") state.today.warmupUsed = true;
    state.updatedAt = new Date().toISOString();

    transaction.set(sRef, store.dehydrateState(state));
    return {
      panel,
      today: state.today,
      condition: state.condition,
      blocksRemaining: maxBlocks - state.today.blocksUsed,
    };
  });

  return { success: true, ...result };
});

exports.setPodiumRestDay = onCall({ cors: true }, async (request) => {
  const { uid, db, seasonData, calendarDay } = await podiumContext(request);
  if (calendarDay < 1) {
    throw new HttpsError("failed-precondition", "The season has not started yet.");
  }
  const sRef = store.stateRef(db, uid);
  await db.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(sRef);
    if (!snapshot.exists || snapshot.data().seasonUid !== seasonData.seasonUid) {
      throw new HttpsError("failed-precondition", "Register a Podium corps first.");
    }
    const state = snapshot.data();
    rollToday(state, calendarDay);
    if (state.today.blocksUsed > 0) {
      throw new HttpsError("failed-precondition", "Rest days must be declared before rehearsing.");
    }
    state.today.restDay = true;
    state.updatedAt = new Date().toISOString();
    transaction.set(sRef, state);
  });
  return { success: true };
});

exports.setPodiumShows = onCall({ cors: true }, async (request) => {
  const { uid, db, seasonData, competitionDay } = await podiumContext(request);
  const { week, days } = request.data || {};
  const sRef = store.stateRef(db, uid);

  const selected = await db.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(sRef);
    if (!snapshot.exists || snapshot.data().seasonUid !== seasonData.seasonUid) {
      throw new HttpsError("failed-precondition", "Register a Podium corps first.");
    }
    const state = snapshot.data();
    const validated = validateShowDays(week, days, uid, seasonData.seasonUid, Math.max(0, competitionDay));
    const keep = (state.selectedShowDays || []).filter((d) => Math.ceil(d / 7) !== week);
    state.selectedShowDays = [...keep, ...validated].sort((a, b) => a - b);
    state.updatedAt = new Date().toISOString();
    transaction.set(sRef, state);
    return state.selectedShowDays;
  });

  return { success: true, selectedShowDays: selected };
});

exports.setPodiumFoodPlan = onCall({ cors: true }, async (request) => {
  const { uid, db, seasonData } = await podiumContext(request);
  const { tier } = request.data || {};
  if (!FOOD_TIERS.includes(tier)) {
    throw new HttpsError("invalid-argument", `Food tier must be one of: ${FOOD_TIERS.join(", ")}.`);
  }
  const sRef = store.stateRef(db, uid);
  await db.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(sRef);
    if (!snapshot.exists || snapshot.data().seasonUid !== seasonData.seasonUid) {
      throw new HttpsError("failed-precondition", "Register a Podium corps first.");
    }
    // Cost lands with the Corps Budget ledger (Phase 4); tier switching is
    // free until then so condition effects can be alpha-tested.
    transaction.set(sRef, { foodTier: tier, updatedAt: new Date().toISOString() }, { merge: true });
  });
  return { success: true, tier };
});

exports.setPodiumPlanTemplate = onCall({ cors: true }, async (request) => {
  const { uid, db, seasonData } = await podiumContext(request);
  const { blocks } = request.data || {};
  if (!Array.isArray(blocks) || blocks.length > MAX_TEMPLATE_BLOCKS) {
    throw new HttpsError("invalid-argument", `Template must be an array of at most ${MAX_TEMPLATE_BLOCKS} blocks.`);
  }
  for (const blockType of blocks) {
    if (!engine.BLOCK_TYPES.includes(blockType)) {
      throw new HttpsError("invalid-argument", `Unknown block type: ${blockType}`);
    }
  }
  const sRef = store.stateRef(db, uid);
  await db.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(sRef);
    if (!snapshot.exists || snapshot.data().seasonUid !== seasonData.seasonUid) {
      throw new HttpsError("failed-precondition", "Register a Podium corps first.");
    }
    transaction.set(
      sRef,
      { planTemplate: blocks, updatedAt: new Date().toISOString() },
      { merge: true }
    );
  });
  return { success: true, planTemplate: blocks };
});

exports.commitPodiumBudget = onCall({ cors: true }, async (request) => {
  const { uid, db, seasonData } = await podiumContext(request);
  const { amount } = request.data || {};
  const sRef = store.stateRef(db, uid);
  const result = await db.runTransaction(async (transaction) => {
    const [snapshot, profileSnapshot] = await Promise.all([
      transaction.get(sRef),
      transaction.get(store.profileRef(db, uid)),
    ]);
    if (!snapshot.exists || snapshot.data().seasonUid !== seasonData.seasonUid) {
      throw new HttpsError("failed-precondition", "Register a Podium corps first.");
    }
    const state = snapshot.data();
    const committed = state.budget ? state.budget.committed || 0 : 0;
    const validated = validateCommitment(amount, committed);
    if (validated <= 0) {
      throw new HttpsError("invalid-argument", "Commitment amount must be positive.");
    }
    applyCommitmentDebit(transaction, db, uid, profileSnapshot, validated);
    store.creditBudget(state, validated, "commitment", 0);
    state.updatedAt = new Date().toISOString();
    transaction.set(sRef, state);
    return state.budget;
  });
  return { success: true, budget: result };
});

exports.hirePodiumClinician = onCall({ cors: true }, async (request) => {
  const { uid, db, seasonData, competitionDay } = await podiumContext(request);
  const { block } = request.data || {};
  if (!engine.BLOCK_TYPES.includes(block) || block === "warmup") {
    throw new HttpsError("invalid-argument", "Clinicians coach a rehearsal block (not warmup).");
  }
  const sRef = store.stateRef(db, uid);
  const result = await db.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(sRef);
    if (!snapshot.exists || snapshot.data().seasonUid !== seasonData.seasonUid) {
      throw new HttpsError("failed-precondition", "Register a Podium corps first.");
    }
    const state = snapshot.data();
    if (state.clinician && state.clinician.expiresDay >= competitionDay) {
      throw new HttpsError("failed-precondition", "A clinician engagement is already active.");
    }
    const { cost, durationDays } = store.balance.clinician;
    if (!store.debitBudget(state, cost, "clinician", competitionDay)) {
      throw new HttpsError("failed-precondition", `Not enough Corps Budget (need ${cost}).`);
    }
    state.clinician = { block, hiredDay: competitionDay, expiresDay: competitionDay + durationDays - 1 };
    state.updatedAt = new Date().toISOString();
    transaction.set(sRef, state);
    return { clinician: state.clinician, budget: state.budget };
  });
  return { success: true, ...result };
});

/**
 * Upcoming route preview: the chain of travel legs through the corps' next
 * show days (auto + selected), each with tier, miles, coin cost (majors
 * subsidized) and heat surcharge — shown in the tour picker BEFORE
 * selections are confirmed (design §5.3 open-information routing).
 */
async function buildRoutePreview(db, seasonData, state, uid, competitionDay) {
  const upcoming = [
    ...new Set([
      ...store.autoDaysFor(uid, seasonData.seasonUid),
      ...(state.selectedShowDays || []),
    ]),
  ]
    .filter((day) => day > Math.max(0, competitionDay) && day <= 49)
    .sort((a, b) => a - b)
    .slice(0, 8);
  if (upcoming.length === 0) return [];

  const scheduleId = seasonData.dataDocId || seasonData.name;
  let locations = {};
  if (scheduleId) {
    const doc = await db.doc(`schedules/${scheduleId}`).get();
    if (doc.exists) {
      for (const comp of doc.data().competitions || []) {
        if (comp.day != null && comp.location && locations[comp.day] == null) {
          locations[comp.day] = comp.location;
        }
      }
    }
  }

  const legs = [];
  let cursor = state.lastVenue || venues.venueFor(state.location) || null;
  for (const day of upcoming) {
    const venue = venues.MAJOR_VENUES[day] || (locations[day] ? venues.venueFor(locations[day]) : null);
    const leg = venues.travelLeg(cursor, venue, store.balance);
    const isMajor = Boolean(venues.MAJOR_VENUES[day]);
    legs.push({
      day,
      city: venue ? `${venue.city}, ${venue.region}` : "TBA",
      tier: leg ? leg.tier : null,
      miles: leg ? leg.miles : null,
      coinCost: leg && !isMajor ? leg.coinCost : 0,
      staminaCost: leg ? leg.staminaCost : 0,
      heat: venues.heatStamina(venue, store.balance),
      isMajor,
    });
    if (venue) cursor = venue;
  }
  return legs;
}

exports.getPodiumState = onCall({ cors: true }, async (request) => {
  const { uid, db, seasonData, calendarDay, competitionDay } = await podiumContext(request);
  const snapshot = await store.stateRef(db, uid).get();
  if (!snapshot.exists || snapshot.data().seasonUid !== seasonData.seasonUid) {
    return { exists: false, calendarDay, competitionDay };
  }
  const state = snapshot.data();
  const isShowDay = store.isShowDayFor(state, uid, competitionDay);
  const routePreview = await buildRoutePreview(db, seasonData, state, uid, competitionDay);
  return {
    exists: true,
    calendarDay,
    competitionDay,
    isShowDay,
    autoDays: store.autoDaysFor(uid, seasonData.seasonUid),
    routePreview,
    state,
  };
});

module.exports.validateChallenge = validateChallenge;
module.exports.validateCommitment = validateCommitment;
module.exports.validateAuditions = validateAuditions;
module.exports.validateShowDays = validateShowDays;
