/**
 * Podium Class Firestore layout + state hydration (Phase 2).
 *
 * Competitive state lives in a server-only subcollection
 * (`.../users/{uid}/podium/state`) per PODIUM_CLASS_DESIGN.md §14.2.5 —
 * firestore.rules denies all client writes there and restricts reads to the
 * owner (challenge levels and caption state are competitive intel). The
 * profile's `corps.podiumClass` entry carries only display copies written by
 * these server paths.
 *
 * Curve parameters are never persisted: they are deterministic functions of
 * the stored challenge levels, re-derived on every load (hydrateState), so a
 * curve-data refresh can never desync stored state.
 */

const { dataNamespaceParam } = require("../../config");
const engine = require("./engine");
const curves = require("./curveData.json");
const balance = require("./balanceConfig.json");

// ---------------------------------------------------------------------------
// Runtime balance overrides (Phase 8 tuning path).
//
// The committed balanceConfig.json is the deploy-time seed; the Firestore doc
// `podium-config/balance` holds beta-season overrides so re-tuning never
// needs a deploy. applyBalanceOverrides deep-merges the doc over a pristine
// copy of the committed defaults into the SAME exported `balance` object
// (every module holds a reference to it), memoized for a minute. A missing
// doc, an empty doc, or a read failure all mean "committed defaults" — the
// safe state. To retire an override, set the field back to the committed
// value (or delete it from the doc; the pristine-copy rebuild reverts it on
// the next refresh).
// ---------------------------------------------------------------------------

const BALANCE_DEFAULTS = JSON.parse(JSON.stringify(balance));
const BALANCE_TTL_MS = 60 * 1000;
let balanceFetchedAt = 0;

function deepMerge(target, source) {
  for (const [key, value] of Object.entries(source || {})) {
    const isObject = (v) => v && typeof v === "object" && !Array.isArray(v);
    if (isObject(value) && isObject(target[key])) {
      deepMerge(target[key], value);
    } else if (key in target && isObject(target[key]) !== isObject(value)) {
      // Type-mismatched override (a scalar where the committed default is a
      // section, or vice versa) would poison every read in the container —
      // skip it; the committed default stands.
      continue;
    } else {
      target[key] = value;
    }
  }
  return target;
}

/**
 * Refresh the shared balance object from podium-config/balance overrides.
 * Never throws — the committed defaults always stand on any failure.
 */
async function applyBalanceOverrides(db, { force = false } = {}) {
  const now = Date.now();
  if (!force && now - balanceFetchedAt < BALANCE_TTL_MS) return balance;
  balanceFetchedAt = now;
  try {
    const snapshot = await db.doc("podium-config/balance").get();
    const overrides = snapshot.exists ? snapshot.data() : null;
    const merged = deepMerge(JSON.parse(JSON.stringify(BALANCE_DEFAULTS)), overrides || {});
    for (const key of Object.keys(balance)) delete balance[key];
    Object.assign(balance, merged);
  } catch {
    // Reads can fail transiently; keep whatever is currently applied.
  }
  return balance;
}

// The marching.art majors (competition days). Eastern Classic is one event
// across days 41-42; each corps performs its single assigned night (v1
// assignment: deterministic uid-hash parity; seeding snake lands in Phase 6).
const MAJOR_DAYS = Object.freeze([28, 35, 41, 42]);
const EASTERN_DAYS = Object.freeze([41, 42]);
const CHAMPIONSHIP_AUTO_DAYS = Object.freeze([47, 48, 49]);

/** Max self-selected shows per competition week (majors consume a slot). */
function maxPicksForWeek(week) {
  if (week === 7) return 0; // championship week is auto-attendance only
  if (week >= 4) return 3; // a major occupies one of the 4 weekly slots
  return 4;
}

/** The Eastern night (41 or 42) this corps performs, deterministic per uid+season. */
function easternNightFor(uid, seasonUid) {
  return engine.seededUnit(`${seasonUid}|eastern|${uid}`) < 0.5 ? 41 : 42;
}

/** All auto-attended competition days for a corps (majors + championships). */
function autoDaysFor(uid, seasonUid) {
  return [28, 35, easternNightFor(uid, seasonUid), ...CHAMPIONSHIP_AUTO_DAYS];
}

/** True when `competitionDay` is a show day for this corps. */
function isShowDayFor(state, uid, competitionDay) {
  if (competitionDay < 1 || competitionDay > 49) return false;
  if (autoDaysFor(uid, state.seasonUid).includes(competitionDay)) return true;
  return (state.selectedShowDays || []).includes(competitionDay);
}

function profileRef(db, uid) {
  return db.doc(`artifacts/${dataNamespaceParam.value()}/users/${uid}/profile/data`);
}

function stateRef(db, uid) {
  return db.doc(`artifacts/${dataNamespaceParam.value()}/users/${uid}/podium/state`);
}

/** Season roster of Podium corps — lets the nightly processor iterate without a collection-group index. */
function rosterRef(db, seasonUid, uid) {
  return db.doc(`podium-season/${seasonUid}/corps/${uid}`);
}

function rosterCollection(db, seasonUid) {
  return db.collection(`podium-season/${seasonUid}/corps`);
}

function recapDayRef(db, seasonUid, competitionDay) {
  return db.doc(`podium-recaps/${seasonUid}/days/${competitionDay}`);
}

/** Season staff market — one public doc, lazily created (deterministic). */
function staffMarketRef(db, seasonUid) {
  return db.doc(`podium-staff/${seasonUid}`);
}

// ---------------------------------------------------------------------------
// Corps Budget ledger (Phase 4, design §14.2.1 / decision 24)
// ---------------------------------------------------------------------------
// The per-season operating ledger: funded by a capped CC commitment plus
// in-class earnings, spent on travel/food/camp/clinicians. The free floor is
// structural — debit() returns false instead of throwing, and callers apply
// the degraded alternative (stamina surcharge, gas-station food).

const BUDGET_LOG_LIMIT = 40;

/** Initialize an empty ledger. */
function initBudget() {
  return { balance: 0, committed: 0, earned: 0, spent: 0, log: [] };
}

/** Credit the ledger (earnings/commitments). Mutates state. */
function creditBudget(state, amount, reason, day) {
  if (!state.budget) state.budget = initBudget();
  state.budget.balance += amount;
  state.budget.earned += reason === "commitment" ? 0 : amount;
  if (reason === "commitment") state.budget.committed += amount;
  state.budget.log = [...(state.budget.log || []).slice(-(BUDGET_LOG_LIMIT - 1)), { day, amount, reason }];
}

/**
 * Debit the ledger if affordable. Mutates state and returns true, or leaves
 * it untouched and returns false — the caller applies the free-floor
 * fallback (never a block).
 */
function debitBudget(state, amount, reason, day) {
  if (amount <= 0) return true;
  if (!state.budget || state.budget.balance < amount) return false;
  state.budget.balance -= amount;
  state.budget.spent += amount;
  state.budget.log = [
    ...(state.budget.log || []).slice(-(BUDGET_LOG_LIMIT - 1)),
    { day, amount: -amount, reason },
  ];
  return true;
}

/**
 * Re-attach derived curve params to a stored state so engine functions can
 * run. Stored docs persist only player state (content/clean/etc.).
 * @param {object} stored podium/state doc data
 * @returns {object} engine-shaped state (mutating a copy)
 */
function hydrateState(stored) {
  const state = { ...stored, captions: { ...stored.captions } };
  for (const caption of engine.CAPTIONS) {
    const cap = stored.captions[caption];
    state.captions[caption] = {
      ...cap,
      curve: engine.curveForChallenge(caption, cap.challenge, curves, balance),
    };
  }
  return state;
}

/** Strip derived fields before persisting. */
function dehydrateState(state) {
  const captions = {};
  for (const caption of engine.CAPTIONS) {
    const { content, clean, lastRehearsedDay, challenge } = state.captions[caption];
    captions[caption] = { content, clean, lastRehearsedDay, challenge };
  }
  return { ...state, captions };
}

module.exports = {
  MAJOR_DAYS,
  EASTERN_DAYS,
  CHAMPIONSHIP_AUTO_DAYS,
  maxPicksForWeek,
  easternNightFor,
  autoDaysFor,
  isShowDayFor,
  profileRef,
  stateRef,
  rosterRef,
  rosterCollection,
  recapDayRef,
  staffMarketRef,
  hydrateState,
  dehydrateState,
  initBudget,
  creditBudget,
  debitBudget,
  applyBalanceOverrides,
  curves,
  balance,
};
