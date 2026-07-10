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
const staffMarket = require("../helpers/podium/staffMarket");
const career = require("../helpers/podium/career");
const divisions = require("../helpers/podium/divisions");
const hostedEvents = require("../helpers/podium/hostedEvents");

const FOOD_TIERS = ["gasStation", "standard", "fullKitchen"];
// Template covers a full spring-training day (the largest block budget).
const MAX_TEMPLATE_BLOCKS = 20;

/**
 * Validate a CorpsCoin -> Corps Budget commitment amount against the
 * division-equal cap (decision 24). `alreadyCommitted` enforces the
 * cumulative cap for mid-season top-ups; the cap scales with the corps'
 * division seat (a World budget fields World staff payrolls).
 */
function validateCommitment(amount, alreadyCommitted, division) {
  if (amount == null || amount === 0) return 0;
  if (!Number.isInteger(amount) || amount < 0) {
    throw new HttpsError("invalid-argument", "Budget commitment must be a non-negative integer.");
  }
  const byDivision = store.balance.budget.commitmentCapByDivision || {};
  const cap = byDivision[division] || store.balance.budget.commitmentCap;
  if (alreadyCommitted + amount > cap) {
    throw new HttpsError(
      "invalid-argument",
      `Budget commitments are capped at ${cap} CC per season for your division ` +
        `(already committed: ${alreadyCommitted}).`
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
  // Beta tuning path: merge podium-config/balance overrides over the
  // committed defaults (memoized; committed values stand on any failure).
  await store.applyBalanceOverrides(db);
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
  const freshStart = request.data?.freshStart === true;

  const seasonUid = seasonData.seasonUid;
  // Career continuity (Phase 5): carry reputation across seasons, applying
  // dormancy decay for missed seasons (counted via the global season index).
  // freshStart banks the old lineage into retiredCareers and restarts.
  const seasonIndex = await career.ensureSeasonIndex(db, seasonData);
  const careerSnapshot = await career.careerRef(db, uid).get();
  let careerData = careerSnapshot.exists ? careerSnapshot.data() : career.initCareer();
  // Lazy self-archival: if this director's previous season hasn't been swept
  // into the career yet (registering before the nightly rollover sweep),
  // apply it now — idempotent with the sweep via lastSeasonUid.
  const staleStateSnapshot = await store.stateRef(db, uid).get();
  if (
    staleStateSnapshot.exists &&
    staleStateSnapshot.data().seasonUid !== seasonUid &&
    careerData.lastSeasonUid !== staleStateSnapshot.data().seasonUid
  ) {
    const staleState = staleStateSnapshot.data();
    const oldIndex =
      (await career.seasonIndexFor(db, staleState.seasonUid)) ?? seasonIndex.index - 1;
    careerData = career.applySeasonResult(
      careerData,
      { seasonUid: staleState.seasonUid, seasonIndex: oldIndex, state: staleState },
      store.balance
    );
    // Profile résumé row for the finished season (idempotent with the sweep).
    await career.appendProfileSeasonHistory(db, uid, staleState.seasonUid, staleState);
  }
  let missedSeasons = 0;
  if (freshStart && careerData.seasonsPlayed > 0) {
    const banked = { ...careerData };
    delete banked.retiredCareers;
    careerData = {
      ...career.initCareer(),
      retiredCareers: [...(careerData.retiredCareers || []).slice(-9), banked],
    };
  } else if (careerData.lastPlayedIndex != null) {
    missedSeasons = Math.max(0, seasonIndex.index - careerData.lastPlayedIndex - 1);
    careerData = career.applyDormancy(careerData, missedSeasons, store.balance);
  }
  const startingReputation = careerData.reputation || 0;
  const startingTier = engine.tierForReputation(startingReputation, store.balance);
  // Division seat (§5.7): carried from the career's assessed seat; a fresh
  // start or a 2+ season absence re-enters at A Class. The commitment cap is
  // division-equal, so it can only be validated once the seat is known.
  const division = divisions.divisionForRegistration(careerData, missedSeasons, store.balance);
  const budgetCommitment = validateCommitment(request.data?.budgetCommitment, 0, division);
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
      { challenge, auditions: auditionShares, repTier: startingTier },
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
      reputation: startingReputation,
      repTier: startingTier,
      division,
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
    transaction.set(career.careerRef(db, uid), {
      ...careerData,
      corpsName: trimmedName,
      division,
      updatedAt: new Date().toISOString(),
    });
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
            repTier: startingTier,
            division,
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

  logger.info(
    `Podium corps registered: ${trimmedName} (${uid}) season ${seasonUid} — ` +
      `${divisions.DIVISION_LABELS[division]}`
  );
  const easternAssignments = await store.loadEasternAssignments(db, seasonUid);
  return {
    success: true,
    corpsName: trimmedName,
    division,
    divisionLabel: divisions.DIVISION_LABELS[division],
    easternNight: store.easternNightFor(uid, seasonUid, easternAssignments),
  };
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
  // On the Eastern nights the published snake decides which night is the
  // show day (block budget shrinks on show days) — parity fallback otherwise.
  const easternAssignments = store.EASTERN_DAYS.includes(competitionDay)
    ? await store.loadEasternAssignments(db, seasonData.seasonUid)
    : null;
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
    const isShowDay = store.isShowDayFor(state, uid, competitionDay, easternAssignments);
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
      // Staff + clinician boosts compose multiplicatively (design §5.6);
      // the staff share is capped inside staffYieldMultiplier. A joint
      // rehearsal (§5.12) sharpens Full Ensemble only, at the multiplier
      // frozen when the handshake was accepted.
      const clinicianActive =
        state.clinician &&
        state.clinician.block === blockType &&
        state.clinician.expiresDay >= competitionDay;
      const staffMult = staffMarket.staffYieldMultiplier(state, blockType, store.balance);
      const clinicianMult = clinicianActive ? store.balance.clinician.yieldBoost : 1;
      const jointActive =
        blockType === "fullEnsemble" &&
        state.jointRehearsal &&
        state.jointRehearsal.day === competitionDay;
      const jointMult = jointActive ? state.jointRehearsal.bonusMult || 1 : 1;
      panel = engine.allocateBlock(
        state,
        blockType,
        competitionDay,
        state.today.blocksUsed,
        blocksSoFar,
        store.curves,
        store.balance,
        { yieldMultiplier: staffMult * clinicianMult * jointMult }
      );
      if (clinicianActive) panel.clinicianBoost = store.balance.clinician.yieldBoost;
      if (staffMult > 1) panel.staffBoost = Number((staffMult - 1).toFixed(3));
      if (jointActive && jointMult > 1) {
        panel.jointBoost = Number((jointMult - 1).toFixed(3));
        panel.jointPartner = state.jointRehearsal.partnerCorpsName || null;
      }
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

exports.hostEvent = onCall({ cors: true }, async (request) => {
  const { uid, db, seasonData, competitionDay } = await podiumContext(request);
  let validated;
  try {
    validated = hostedEvents.validateHostRequest(request.data || {}, Math.max(0, competitionDay));
  } catch (error) {
    throw new HttpsError("invalid-argument", error.message);
  }
  const { eventName, venueTier, tier, day, venue } = validated;

  // Host must field a corps somewhere in the game (anti-alt guard).
  const profileSnapshotPre = await store.profileRef(db, uid).get();
  const corpsMap = profileSnapshotPre.exists ? profileSnapshotPre.data().corps || {} : {};
  if (Object.values(corpsMap).filter(Boolean).length === 0) {
    throw new HttpsError("failed-precondition", "Field a corps before hosting events.");
  }

  const seasonUid = seasonData.seasonUid;
  const dayEvents = await hostedEvents
    .eventsCollection(db, seasonUid)
    .where("day", "==", day)
    .get();
  if (dayEvents.size >= store.balance.hostedEvents.maxEventsPerDay) {
    throw new HttpsError("failed-precondition", `Day ${day} already has the maximum hosted events.`);
  }

  const eventRef = hostedEvents.eventsCollection(db, seasonUid).doc();
  await db.runTransaction(async (transaction) => {
    const profileSnapshot = await transaction.get(store.profileRef(db, uid));
    const corpsCoin = profileSnapshot.exists ? profileSnapshot.data().corpsCoin || 0 : 0;
    if (corpsCoin < tier.rentalCC) {
      throw new HttpsError(
        "failed-precondition",
        `Venue rental is ${tier.rentalCC} CC (you have ${corpsCoin}).`
      );
    }
    transaction.update(store.profileRef(db, uid), { corpsCoin: corpsCoin - tier.rentalCC });
    const historyRef = db
      .collection(
        `artifacts/${require("../config").dataNamespaceParam.value()}/users/${uid}/corpsCoinHistory`
      )
      .doc();
    transaction.set(historyRef, {
      type: "hosted_event_rental",
      amount: -tier.rentalCC,
      description: `Venue rental: ${eventName} (${tier.label})`,
      timestamp: new Date(),
    });
    transaction.set(eventRef, {
      hostUid: uid,
      eventName,
      venueTier,
      day,
      location: `${venue.city}, ${venue.region}`,
      venueId: venue.venueId,
      rentalCC: tier.rentalCC,
      capacity: tier.capacity,
      paidOut: false,
      createdAt: new Date().toISOString(),
    });
  });

  // Insert into the season schedule so every class can select it through
  // the normal weekly picker (open enrollment — no host approval).
  const { addShowToDay } = require("../helpers/seasonSchedule");
  const scheduleId = seasonData.dataDocId || seasonData.name;
  if (scheduleId) {
    await addShowToDay(scheduleId, day, {
      eventName,
      location: `${venue.city}, ${venue.region}`,
      eventTier: "hosted",
      hostUid: uid,
    });
  }

  logger.info(`Hosted event created: ${eventName} day ${day} by ${uid}`);
  return { success: true, eventId: eventRef.id, day, eventName };
});

exports.getPodiumStaffMarket = onCall({ cors: true }, async (request) => {
  const { db, seasonData } = await podiumContext(request);
  const marketRef = store.staffMarketRef(db, seasonData.seasonUid);
  let snapshot = await marketRef.get();
  if (!snapshot.exists) {
    // Lazy, idempotent creation: generation is deterministic per season.
    await marketRef.set({
      seasonUid: seasonData.seasonUid,
      generatedAt: new Date().toISOString(),
      staff: staffMarket.generateMarket(seasonData.seasonUid),
    });
    snapshot = await marketRef.get();
  }
  return { success: true, market: snapshot.data().staff };
});

exports.hirePodiumStaff = onCall({ cors: true }, async (request) => {
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
    const market = marketSnapshot.exists
      ? marketSnapshot.data()
      : {
        seasonUid: seasonData.seasonUid,
        generatedAt: new Date().toISOString(),
        staff: staffMarket.generateMarket(seasonData.seasonUid),
      };
    const person = market.staff.find((member) => member.id === staffId);
    if (!person) throw new HttpsError("not-found", "That staff member is not in this season's market.");
    if (person.signedBy && person.signedBy !== uid) {
      throw new HttpsError("failed-precondition", `${person.name} has already signed elsewhere.`);
    }
    const state = stateSnapshot.data();
    if (state.staff && state.staff[person.specialty]) {
      throw new HttpsError("failed-precondition", `You already employ a ${person.specialty} staff member.`);
    }
    if (!store.debitBudget(state, person.salary, `staff:${person.specialty}`, Math.max(0, competitionDay))) {
      throw new HttpsError("failed-precondition", `Not enough Corps Budget (salary ${person.salary}).`);
    }
    person.signedBy = uid;
    state.staff = {
      ...(state.staff || {}),
      [person.specialty]: {
        id: person.id,
        name: person.name,
        tier: person.tier,
        boost: person.boost,
        trait: person.trait,
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
    const validated = validateCommitment(amount, committed, state.division);
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

// Branded names for the fixed majors on the route sheet.
const MAJOR_ROUTE_LABELS = {
  28: "marching.art Southwestern Championship",
  35: "marching.art Southeastern Championship",
  41: "marching.art Eastern Classic",
  42: "marching.art Eastern Classic",
};

/**
 * Upcoming route preview: the chain of travel legs through the corps' next
 * show days (auto + selected), each with tier, miles, coin cost (majors
 * subsidized), heat surcharge, and — for the majors and Championship Week
 * in Indianapolis — the division-correct event label (an A Class corps sees
 * A Class Prelims/Finals, a World corps sees Prelims/Semis/Finals). Shown
 * in the tour picker BEFORE selections are confirmed (design §5.3
 * open-information routing).
 */
async function buildRoutePreview(db, seasonData, state, uid, competitionDay, easternAssignments) {
  const division = divisions.normalizeDivision(state.division);
  const upcoming = [
    ...new Set([
      ...store.autoDaysFor(uid, seasonData.seasonUid, { division, easternAssignments }),
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

  const championshipLabels = store.CHAMPIONSHIP_LABELS_BY_DIVISION[division];
  const legs = [];
  let cursor = state.lastVenue || venues.venueFor(state.location) || null;
  for (const day of upcoming) {
    const venue = venues.MAJOR_VENUES[day] || (locations[day] ? venues.venueFor(locations[day]) : null);
    const leg = venues.travelLeg(cursor, venue, store.balance);
    const isMajor = Boolean(venues.MAJOR_VENUES[day]);
    legs.push({
      day,
      city: venue ? `${venue.city}, ${venue.region}` : "TBA",
      label: championshipLabels[day] || MAJOR_ROUTE_LABELS[day] || null,
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
  const easternAssignments = await store.loadEasternAssignments(db, seasonData.seasonUid);
  const isShowDay = store.isShowDayFor(state, uid, competitionDay, easternAssignments);
  const routePreview = await buildRoutePreview(
    db, seasonData, state, uid, competitionDay, easternAssignments
  );
  const careerSnapshot = await career.careerRef(db, uid).get();
  const careerData = careerSnapshot.exists ? careerSnapshot.data() : null;
  const division = divisions.normalizeDivision(state.division);
  return {
    exists: true,
    calendarDay,
    competitionDay,
    isShowDay,
    division,
    divisionLabel: divisions.DIVISION_LABELS[division],
    commitmentCap:
      (store.balance.budget.commitmentCapByDivision || {})[division] ||
      store.balance.budget.commitmentCap,
    easternNight: store.easternNightFor(uid, seasonData.seasonUid, easternAssignments),
    easternNightFinal: Boolean(easternAssignments && easternAssignments[uid]),
    autoDays: store.autoDaysFor(uid, seasonData.seasonUid, { division, easternAssignments }),
    routePreview,
    career: careerData
      ? {
        reputation: careerData.reputation,
        historicalPeak: careerData.historicalPeak,
        seasonsPlayed: careerData.seasonsPlayed,
        history: (careerData.history || []).slice(-5),
      }
      : null,
    state,
  };
});


module.exports.validateChallenge = validateChallenge;
module.exports.validateCommitment = validateCommitment;
module.exports.validateAuditions = validateAuditions;
module.exports.validateShowDays = validateShowDays;
// Shared preamble for the split callable modules (podiumJoint.js).
module.exports.podiumContext = podiumContext;
