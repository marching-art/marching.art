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
const staffMarket = require("../helpers/podium/staffMarket");
const career = require("../helpers/podium/career");
const divisions = require("../helpers/podium/divisions");

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
 * Validate an optional staff keep-priority list: the specialties the director
 * wants to retain next season, in keep-first order (design §5.6, the funding
 * decision). Deduped and filtered to real specialties. A staffer omitted from
 * a provided list is a voluntary release; when the list is absent entirely the
 * roster is kept priciest-first and a shortfall sheds the cheapest. Returns
 * undefined when absent so downstream code can tell "keep all" from "keep none".
 */
function validateStaffPriority(value) {
  if (value == null) return undefined;
  if (!Array.isArray(value)) {
    throw new HttpsError("invalid-argument", "staffPriority must be an array of specialties.");
  }
  const seen = new Set();
  const order = [];
  for (const specialty of value) {
    if (typeof specialty === "string" && staffMarket.SPECIALTIES.includes(specialty) && !seen.has(specialty)) {
      seen.add(specialty);
      order.push(specialty);
    }
  }
  return order;
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
 * Validate a week's self-selected SHOW picks against the pick budget and the
 * schedule. Podium now registers for a specific show (like fantasy), one per
 * night; majors and championship week are auto-attended and never selectable.
 *
 * `division`/`easternAssignments` make the auto-day set division-correct and
 * match the client's locked days — without them a World corps' Championship
 * day 49 and the published Eastern night would be computed with A Class /
 * hash-parity fallbacks and reject picks the client shows as valid.
 * `scheduleShowsByDay` ({ [day]: [{eventName, location}] }) lets the server
 * confirm each picked eventName is actually on the schedule that day and
 * resolve its authoritative location (the client's location is never trusted).
 *
 * @returns {{ [day:number]: { eventName: string, location: string } }} normalized picks
 */
function validateShowPicks(
  week,
  shows,
  uid,
  seasonUid,
  currentCompetitionDay,
  { division, easternAssignments, scheduleShowsByDay = {} } = {}
) {
  if (!Number.isInteger(week) || week < 1 || week > 7) {
    throw new HttpsError("invalid-argument", "Week must be 1-7.");
  }
  if (!Array.isArray(shows)) {
    throw new HttpsError("invalid-argument", "Shows must be an array.");
  }
  const maxPicks = store.maxPicksForWeek(week);
  const autoDays = store.autoDaysFor(uid, seasonUid, { division, easternAssignments });
  const byDay = {};
  for (const pick of shows) {
    const day = pick && pick.day;
    const eventName = typeof (pick && pick.eventName) === "string" ? pick.eventName.trim() : "";
    if (!Number.isInteger(day) || Math.ceil(day / 7) !== week) {
      throw new HttpsError("invalid-argument", `Day ${day} is not in week ${week}.`);
    }
    if (store.CHAMPIONSHIP_WEEK_DAYS.includes(day)) {
      throw new HttpsError("invalid-argument", `Day ${day} is Championship Week (auto-attended) and not selectable.`);
    }
    if (autoDays.includes(day) || store.EASTERN_DAYS.includes(day)) {
      throw new HttpsError("invalid-argument", `Day ${day} is auto-attended (major/championship) and not selectable.`);
    }
    // Strictly-before only: the current competition day's show is still open
    // (it scores at the 2 AM ET run the next day, when currentCompetitionDay
    // advances), matching the fantasy show-registration deadline.
    if (day < currentCompetitionDay) {
      throw new HttpsError("invalid-argument", `Day ${day} has already passed.`);
    }
    if (!eventName) {
      throw new HttpsError("invalid-argument", `A show must be chosen for day ${day}.`);
    }
    // The picked show must actually be on the schedule that day.
    const dayList = scheduleShowsByDay[day] || [];
    const match = dayList.find((s) => s.eventName === eventName);
    if (!match) {
      throw new HttpsError("invalid-argument", `"${eventName}" is not a scheduled show on day ${day}.`);
    }
    // One show per night — a later pick for the same day replaces the earlier.
    byDay[day] = { eventName, location: match.location || "" };
  }
  if (Object.keys(byDay).length > maxPicks) {
    throw new HttpsError("invalid-argument", `Week ${week} allows at most ${maxPicks} selected shows.`);
  }
  return byDay;
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
  // committed defaults, and swap in the full-archive curve rebuild when
  // podium-config/curves exists (memoized; committed values stand on any
  // failure or invalid payload).
  await store.applyBalanceOverrides(db);
  await store.applyCurveOverrides(db);
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
  const staffPriority = validateStaffPriority(request.data?.staffPriority);

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
  // Division seat (§5.7): carried from the career's assessed seat; beyond the
  // grace window a returning corps re-enters at the division its now-decayed
  // reputation supports (gradual erosion by time away, not a hard reset). The
  // commitment cap is division-equal, so validate it once the seat is known.
  const division = divisions.divisionForRegistration(
    careerData,
    missedSeasons,
    store.balance,
    careerData.reputation
  );
  const budgetCommitment = validateCommitment(request.data?.budgetCommitment, 0, division);
  // Staff are RETAINED across seasons: every employed staffer ages up one
  // year (tenure raises their tier, the salary lock floats once it lapses)
  // and is paid from the NEW budget below — an unaffordable season lapses the
  // contract, never a debt, and a 30-season career retires. The just-finished
  // season is banked on each staffer's resume as they carry over.
  const retainedStaff = [];
  // The retention plan: which carried staff the fresh budget keeps, in the
  // director's chosen keep-priority (design §5.6). projectRetention makes the
  // same greedy decision the client previewed at commit time, so a director
  // who saw "you'll lose your guard tech" loses exactly that one — never an
  // arbitrary staffer the loop happened to reach last.
  let staffPlan = null;
  if (
    !freshStart &&
    staleStateSnapshot.exists &&
    staleStateSnapshot.data().seasonUid !== seasonUid
  ) {
    const stale = staleStateSnapshot.data();
    const completed = {
      seasonUid: stale.seasonUid,
      corpsName: stale.corpsName || null,
      placement: stale.seasonRank ?? null,
    };
    for (const member of Object.values(stale.staff || {})) {
      if (!member || !member.specialty) continue;
      const aged = staffMarket.ageStaff(member, store.balance, completed);
      if (aged) retainedStaff.push(aged); // null == retired, drops off the roster
    }
    staffPlan = staffMarket.projectRetention(
      stale.staff,
      budgetCommitment,
      store.balance,
      staffPriority
    );
  }
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
    // Budget first, then carried contracts draw their season's salary from
    // it. debitBudget mutates a draft {budget} holder.
    const draft = {
      budget: (() => {
        const budget = store.initBudget();
        if (budgetCommitment > 0) {
          budget.balance = budgetCommitment;
          budget.committed = budgetCommitment;
          budget.log = [{ day: 0, amount: budgetCommitment, reason: "commitment" }];
        }
        return budget;
      })(),
    };
    const carriedStaff = {};
    const keptSet = new Set(staffPlan ? staffPlan.kept : []);
    for (const member of retainedStaff) {
      if (!keptSet.has(member.specialty)) continue; // lapsed: unaffordable or released
      // projectRetention already proved the kept set fits the committed
      // budget, so this debit always succeeds — the return value is ignored.
      store.debitBudget(draft, member.salaryPerSeason, `staff:${member.specialty}`, 0);
      carriedStaff[member.specialty] = member;
    }
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
      budget: draft.budget,
      ...(Object.keys(carriedStaff).length > 0 ? { staff: carriedStaff } : {}),
      selectedShows: {},
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
    // Confirm the staffing outcome so the UI can say exactly who stayed and
    // who left (and why: unaffordable, released, or retired after 30 seasons).
    retainedStaff: staffPlan ? staffPlan.kept : [],
    lapsedStaff: staffPlan
      ? staffPlan.staff
          .filter((s) => !s.kept)
          .map((s) => ({ specialty: s.specialty, reason: s.lapseReason }))
      : [],
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
        { yieldMultiplier: staffMult * clinicianMult * jointMult, isShowDay }
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
  const { uid, db, seasonData, calendarDay, competitionDay } = await podiumContext(request);
  const { week, shows } = request.data || {};
  const sRef = store.stateRef(db, uid);
  // Reads before the transaction: the published Eastern-night assignments (so
  // auto-day validation matches getPodiumState) and the schedule (to confirm
  // each picked show exists that day and resolve its authoritative location).
  const [easternAssignments, scheduleShowsByDay] = await Promise.all([
    store.loadEasternAssignments(db, seasonData.seasonUid),
    store.loadScheduleShowsByDay(db, seasonData),
  ]);

  const result = await db.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(sRef);
    if (!snapshot.exists || snapshot.data().seasonUid !== seasonData.seasonUid) {
      throw new HttpsError("failed-precondition", "Register a Podium corps first.");
    }
    const state = snapshot.data();
    const validated = validateShowPicks(
      week,
      shows,
      uid,
      seasonData.seasonUid,
      Math.max(0, competitionDay),
      { division: state.division, easternAssignments, scheduleShowsByDay }
    );
    // Replace only this week's picks (mirrors fantasy selectUserShows).
    const keep = Object.fromEntries(
      Object.entries(state.selectedShows || {}).filter(
        ([d]) => Math.ceil(Number(d) / 7) !== week
      )
    );
    // Over-rehearsal guard: a show day only allows blocksOnShowDay clicks (the
    // morning run-through). If today has already been rehearsed as a full
    // rehearsal day past that budget, it can't retroactively become a show day
    // — the extra growth would be an exploit. Only today's usage is knowable
    // (block counts are tracked per calendar day), so the guard applies to a
    // pick FOR today; future days start at zero.
    const showDayBudget = store.balance.rehearsal.blocksOnShowDay;
    const usedToday =
      state.today && state.today.calendarDay === calendarDay ? state.today.blocksUsed || 0 : 0;
    if (competitionDay >= 1 && validated[competitionDay] && usedToday > showDayBudget) {
      throw new HttpsError(
        "failed-precondition",
        `You've already rehearsed ${usedToday} blocks today — a show day allows only ${showDayBudget}. ` +
          `You can't register for a show on a day you've already over-rehearsed. ` +
          `Register this show before rehearsing next time, or pick a different day.`
      );
    }
    state.selectedShows = { ...keep, ...validated };
    // Derived day list, kept in sync for every day-based reader.
    state.selectedShowDays = Object.keys(state.selectedShows)
      .map(Number)
      .sort((a, b) => a - b);
    state.updatedAt = new Date().toISOString();
    transaction.set(sRef, state);
    return { selectedShows: state.selectedShows, selectedShowDays: state.selectedShowDays };
  });

  return { success: true, ...result };
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

// The assistant director keeps a plan per day TYPE (design §5.2): `rehearsal`
// is the full-grind default, `show` the lighter pre-performance routine, and
// `springTraining` the install-heavy camp plan — each run by the nightly
// autoplay on the matching unplayed day. `rehearsal` writes the legacy
// `planTemplate` field so existing corps are untouched.
const PLAN_FIELD_BY_TYPE = {
  rehearsal: "planTemplate",
  show: "showDayPlan",
  springTraining: "springTrainingPlan",
};

exports.setPodiumPlanTemplate = onCall({ cors: true }, async (request) => {
  const { uid, db, seasonData } = await podiumContext(request);
  const { blocks, planType = "rehearsal" } = request.data || {};
  const field = PLAN_FIELD_BY_TYPE[planType];
  if (!field) {
    throw new HttpsError(
      "invalid-argument",
      `Plan type must be one of: ${Object.keys(PLAN_FIELD_BY_TYPE).join(", ")}.`
    );
  }
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
      { [field]: blocks, updatedAt: new Date().toISOString() },
      { merge: true }
    );
  });
  return { success: true, planType, [field]: blocks };
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

module.exports.validateChallenge = validateChallenge;
module.exports.validateCommitment = validateCommitment;
module.exports.validateAuditions = validateAuditions;
module.exports.validateShowPicks = validateShowPicks;
module.exports.validateStaffPriority = validateStaffPriority;
// Shared preamble for the split callable modules (podiumJoint.js).
module.exports.podiumContext = podiumContext;
