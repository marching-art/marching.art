/**
 * Podium Class callables (Phase 2, PODIUM.md).
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
const economy = require("../helpers/economy");
const { assertAuth } = require("../helpers/callableGuards");
const { isPodiumEnabled } = require("../helpers/features");
const { getActiveCalendarDay, toCompetitionDay } = require("../helpers/gameDay");
const engine = require("../helpers/podium/engine");
const store = require("../helpers/podium/store");
const staffMarket = require("../helpers/podium/staffMarket");
const career = require("../helpers/podium/career");
const divisions = require("../helpers/podium/divisions");
const {
  validateCommitment,
  validateStaffPriority,
  validateChallenge,
  validateAuditions,
  validateShowPicks,
  maxBlocksForPlanType,
  PLAN_FIELD_BY_TYPE,
} = require("./podiumValidation");

const FOOD_TIERS = ["gasStation", "standard", "fullKitchen"];

/**
 * Inside a transaction: debit profile CorpsCoin for a budget commitment.
 * Reads MUST have happened already (Firestore txn rule) — pass the profile
 * snapshot in. Used by the mid-season top-up (commitPodiumBudget); registration
 * nets its commitment against any prior-season refund via
 * applyRegistrationCoinDelta instead.
 */
function applyCommitmentDebit(transaction, db, uid, profileSnapshot, amount) {
  const corpsCoin = profileSnapshot.exists ? profileSnapshot.data().corpsCoin || 0 : 0;
  if (corpsCoin < amount) {
    throw new HttpsError("failed-precondition", `Not enough CorpsCoin (have ${corpsCoin}, need ${amount}).`);
  }
  const newBalance = corpsCoin - amount;
  transaction.update(store.profileRef(db, uid), { corpsCoin: newBalance });
  economy.addCoinHistoryEntryToTransaction(transaction, db, uid, {
    type: economy.TRANSACTION_TYPES.PODIUM_BUDGET_COMMIT,
    amount: -amount,
    balance: newBalance,
    description: "Corps Budget commitment (Podium Class)",
  });
}

/**
 * Registration coin settlement inside a transaction: first sweep the prior
 * season's unspent Corps Budget back to the wallet (refund), then debit the new
 * season's commitment from the combined balance — so a director can re-fund
 * next season straight out of last season's leftover. A single corpsCoin write
 * nets both, with one coin-history row per leg. Reads MUST have happened — pass
 * the profile snapshot in. Returns the amount refunded.
 */
function applyRegistrationCoinDelta(
  transaction,
  db,
  uid,
  profileSnapshot,
  { commitment = 0, refund = 0, refundSeasonUid = null, refundCorpsName = null }
) {
  const corpsCoin = profileSnapshot.exists ? profileSnapshot.data().corpsCoin || 0 : 0;
  const available = corpsCoin + refund;
  if (available < commitment) {
    throw new HttpsError(
      "failed-precondition",
      `Not enough CorpsCoin (have ${corpsCoin}${refund > 0 ? ` plus a ${refund} refund` : ""}, ` +
        `need ${commitment}).`
    );
  }
  const finalBalance = available - commitment;
  if (refund > 0 || commitment > 0) {
    transaction.update(store.profileRef(db, uid), { corpsCoin: finalBalance });
  }
  if (refund > 0) {
    economy.addCoinHistoryEntryToTransaction(transaction, db, uid, {
      type: economy.TRANSACTION_TYPES.PODIUM_BUDGET_REFUND,
      amount: refund,
      balance: available, // wallet after the refund credit, before the new commitment
      description: `Corps Budget refund — ${refundCorpsName || "Podium corps"} (${refundSeasonUid})`,
      seasonUid: refundSeasonUid,
    });
  }
  if (commitment > 0) {
    economy.addCoinHistoryEntryToTransaction(transaction, db, uid, {
      type: economy.TRANSACTION_TYPES.PODIUM_BUDGET_COMMIT,
      amount: -commitment,
      balance: finalBalance,
      description: "Corps Budget commitment (Podium Class)",
    });
  }
  return refund;
}

const NAME_MIN = 3;
const NAME_MAX = 40;

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
  // Snapshot the stamina the day begins with: the daily block cap's low-stamina
  // penalty is judged against this, so draining stamina across the day can never
  // shrink the cap below blocks already used (see engine.blocksAvailable).
  state.today = {
    calendarDay,
    blocksUsed: 0,
    blocks: [],
    restDay: false,
    warmupUsed: false,
    startStamina: state.condition ? state.condition.stamina : undefined,
  };
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
  const hasStalePriorSeason =
    staleStateSnapshot.exists && staleStateSnapshot.data().seasonUid !== seasonUid;
  // Resolved for both the lazy archival and the end-of-season financial report,
  // and captured before applySeasonResult mutates the career. willLazyArchive
  // scopes the budget refund to the season THIS registration is banking, so a
  // season the nightly sweep already settled is never re-refunded here.
  let staleSeasonIndex = null;
  let willLazyArchive = false;
  if (hasStalePriorSeason) {
    const staleState = staleStateSnapshot.data();
    staleSeasonIndex =
      (await career.seasonIndexFor(db, staleState.seasonUid)) ?? seasonIndex.index - 1;
    willLazyArchive = careerData.lastSeasonUid !== staleState.seasonUid;
    if (willLazyArchive) {
      careerData = career.applySeasonResult(
        careerData,
        { seasonUid: staleState.seasonUid, seasonIndex: staleSeasonIndex, state: staleState },
        store.balance
      );
      // Profile résumé row for the finished season (idempotent with the sweep).
      await career.appendProfileSeasonHistory(db, uid, staleState.seasonUid, staleState);
    }
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

  const txnResult = await db.runTransaction(async (transaction) => {
    const [existingState, existingName, profileSnapshot, careerTxnSnapshot] = await Promise.all([
      transaction.get(sRef),
      transaction.get(nameRef),
      transaction.get(store.profileRef(db, uid)),
      transaction.get(career.careerRef(db, uid)),
    ]);
    if (existingState.exists && existingState.data().seasonUid === seasonUid) {
      throw new HttpsError("already-exists", "You already field a Podium corps this season.");
    }
    if (existingName.exists && existingName.data().uid !== uid) {
      throw new HttpsError("already-exists", "That corps name is taken this season.");
    }

    // End-of-season settlement for the season this registration retires: sweep
    // its unspent Corps Budget back to the wallet and bank the line-item report.
    // existingState (when it exists with a different seasonUid) IS last season's
    // finished state, read transactionally so the refunded amount matches what
    // this same write is about to overwrite. The career's refund marker — read
    // in this txn — makes it strictly once-only against a concurrent sweep.
    const staleForRefund =
      willLazyArchive && existingState.exists && existingState.data().seasonUid !== seasonUid
        ? existingState.data()
        : null;
    const alreadyRefunded =
      staleForRefund &&
      careerTxnSnapshot.exists &&
      careerTxnSnapshot.data().lastRefundedSeasonUid === staleForRefund.seasonUid;
    const seasonReport =
      staleForRefund && !alreadyRefunded
        ? store.buildSeasonFinancialReport(staleForRefund, {
          seasonUid: staleForRefund.seasonUid,
          seasonIndex: staleSeasonIndex,
        })
        : null;
    const refundAmount = seasonReport ? seasonReport.refunded : 0;

    applyRegistrationCoinDelta(transaction, db, uid, profileSnapshot, {
      commitment: budgetCommitment,
      refund: refundAmount,
      refundSeasonUid: seasonReport ? staleForRefund.seasonUid : null,
      refundCorpsName: seasonReport ? staleForRefund.corpsName : null,
    });


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
      // Bank the refund marker + report alongside the archived career so the
      // between-seasons preview can show last season's settlement and the sweep
      // never re-refunds this season.
      ...(seasonReport
        ? { lastRefundedSeasonUid: staleForRefund.seasonUid, lastSeasonReport: seasonReport }
        : {}),
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
    return { refund: refundAmount, seasonReport };
  });

  logger.info(
    `Podium corps registered: ${trimmedName} (${uid}) season ${seasonUid} — ` +
      `${divisions.DIVISION_LABELS[division]}` +
      (txnResult.refund > 0 ? ` (refunded ${txnResult.refund} CC from last season)` : "")
  );
  const easternAssignments = await store.loadEasternAssignments(db, seasonUid);
  return {
    success: true,
    corpsName: trimmedName,
    division,
    divisionLabel: divisions.DIVISION_LABELS[division],
    easternNight: store.easternNightFor(uid, seasonUid, easternAssignments),
    // The prior season's Corps Budget refund (0 when nothing was left or already
    // swept by the nightly rollover), with the line-item report behind it.
    budgetRefund: txnResult.refund || 0,
    lastSeasonReport: txnResult.seasonReport || null,
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
    // Base the daily block cap on the stamina the day BEGAN with, not the live
    // (already-drained) value, so the cap stays fixed as blocks are used. A day
    // rolled before this snapshot existed lacks startStamina; treat it as rested
    // (== threshold ⇒ no penalty) so an in-progress day is never stranded below
    // the blocks already played instead of applying today's depleted stamina.
    const staminaForCap =
      typeof state.today.startStamina === "number"
        ? state.today.startStamina
        : store.balance.condition.lowStaminaThreshold;
    const maxBlocks = engine.blocksAvailable(
      state,
      { isShowDay, isSpringTraining, staminaForCap },
      store.balance
    );

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
          "You can't register for a show on a day you've already over-rehearsed. " +
          "Register this show before rehearsing next time, or pick a different day."
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
  const maxBlocks = maxBlocksForPlanType(planType);
  if (!Array.isArray(blocks) || blocks.length > maxBlocks) {
    throw new HttpsError(
      "invalid-argument",
      `A ${planType} plan may hold at most ${maxBlocks} blocks.`
    );
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

// Shared preamble for the split callable modules (podiumJoint.js).
module.exports.podiumContext = podiumContext;
