/**
 * Podium budget & settings callables (food plan, plan templates, mid-season
 * budget top-up, clinician hire), split from callable/podium.js for file-size
 * hygiene. Shares podiumContext (feature gate + season/day derivation + balance
 * overrides) with the rest of the Podium API.
 */

const { onCall, HttpsError } = require("firebase-functions/v2/https");
const economy = require("../helpers/economy");
const { assertWriteBudget } = require("../helpers/callableGuards");
const engine = require("../helpers/podium/engine");
const store = require("../helpers/podium/store");
const { validateCommitment, maxBlocksForPlanType, PLAN_FIELD_BY_TYPE } = require("./podiumValidation");
const { podiumContext } = require("./podium");

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

exports.setPodiumFoodPlan = onCall({ cors: true }, async (request) => {
  const { uid, db, seasonData } = await podiumContext(request);
  // Abuse throttle (shared podium bucket) — rehearsal/staff actions are the
  // Podium core loop, so the budget is generous (still far above human rate).
  await assertWriteBudget(db, uid, "podium", { max: 120, windowMs: 10 * 60 * 1000 });
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
  // Abuse throttle (shared podium bucket) — rehearsal/staff actions are the
  // Podium core loop, so the budget is generous (still far above human rate).
  await assertWriteBudget(db, uid, "podium", { max: 120, windowMs: 10 * 60 * 1000 });
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
  // Abuse throttle (shared podium bucket) — rehearsal/staff actions are the
  // Podium core loop, so the budget is generous (still far above human rate).
  await assertWriteBudget(db, uid, "podium", { max: 120, windowMs: 10 * 60 * 1000 });
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
  // Abuse throttle (shared podium bucket) — rehearsal/staff actions are the
  // Podium core loop, so the budget is generous (still far above human rate).
  await assertWriteBudget(db, uid, "podium", { max: 120, windowMs: 10 * 60 * 1000 });
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
