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
const divisions = require("./divisions");
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

// ---------------------------------------------------------------------------
// Runtime curve overrides (podium-config/curves) — written by the admin
// rebuildPodiumCurves job from the FULL Firestore historical archive
// (2000-2026), replacing the committed 13-year curveData wholesale. Unlike
// balance (tunable fields, deep-merged), curves are all-or-nothing: apply
// only a payload that passes the shape check; anything else keeps the
// committed data. Same TTL memo + in-place mutation of the shared export.
// ---------------------------------------------------------------------------

const CURVES_DEFAULTS = JSON.parse(JSON.stringify(curves));
let curvesFetchedAt = 0;

/** True when a curve payload is structurally usable by the engine. */
function curvesShapeValid(payload) {
  if (!payload || typeof payload !== "object") return false;
  if (!Array.isArray(payload.totalBands) || payload.totalBands.length !== 49) return false;
  if (!payload.bands || !payload.deltas || !payload.archetypes) return false;
  for (const caption of engine.CAPTIONS) {
    const band = payload.bands[caption];
    if (!Array.isArray(band) || band.length !== 49) return false;
    if (typeof band[48].p5 !== "number" || typeof band[48].max !== "number") return false;
    if (!Array.isArray(payload.archetypes[caption]) || payload.archetypes[caption].length === 0) {
      return false;
    }
  }
  return true;
}

/**
 * Refresh the shared curves object from podium-config/curves. Never throws;
 * an invalid or missing doc means the committed curveData stands.
 */
async function applyCurveOverrides(db, { force = false } = {}) {
  const now = Date.now();
  if (!force && now - curvesFetchedAt < BALANCE_TTL_MS) return curves;
  curvesFetchedAt = now;
  try {
    const snapshot = await db.doc("podium-config/curves").get();
    const payload = snapshot.exists ? snapshot.data() : null;
    const next = curvesShapeValid(payload) ? payload : CURVES_DEFAULTS;
    for (const key of Object.keys(curves)) delete curves[key];
    Object.assign(curves, JSON.parse(JSON.stringify(next)));
  } catch {
    // Reads can fail transiently; keep whatever is currently applied.
  }
  return curves;
}

// The marching.art majors (competition days). Eastern Classic is one event
// across days 41-42; each corps performs its single assigned night —
// division-seeded snake once lineups publish on Day 39 (persisted in
// eastern-classic/{seasonUid}.podium), uid-hash parity as the provisional
// and fallback assignment.
const MAJOR_DAYS = Object.freeze([28, 35, 41, 42]);
const EASTERN_DAYS = Object.freeze([41, 42]);
const EASTERN_PUBLISH_DAY = 39;
const CHAMPIONSHIP_AUTO_DAYS = Object.freeze([47, 48, 49]);

// Championship week in Indianapolis (§5.7 divisions): A and Open run
// Prelims -> Class Finals on days 47-48; World runs Prelims -> Semifinals ->
// Finals through day 49, DCI-shaped.
const CHAMPIONSHIP_DAYS_BY_DIVISION = Object.freeze({
  aClass: Object.freeze([47, 48]),
  openClass: Object.freeze([47, 48]),
  worldClass: CHAMPIONSHIP_AUTO_DAYS,
});
const CHAMPIONSHIP_LABELS_BY_DIVISION = Object.freeze({
  aClass: Object.freeze({ 47: "A Class Prelims", 48: "A Class Finals" }),
  openClass: Object.freeze({ 47: "Open Class Prelims", 48: "Open Class Finals" }),
  worldClass: Object.freeze({
    47: "World Class Prelims",
    48: "World Class Semifinals",
    49: "World Class Finals",
  }),
});

/** Championship-week show days for a corps' division. */
function championshipDaysFor(division) {
  return CHAMPIONSHIP_DAYS_BY_DIVISION[divisions.normalizeDivision(division)];
}

/** Max self-selected shows per competition week (majors consume a slot). */
function maxPicksForWeek(week) {
  if (week === 7) return 0; // championship week is auto-attendance only
  if (week >= 4) return 3; // a major occupies one of the 4 weekly slots
  return 4;
}

/**
 * The Eastern night (41 or 42) this corps performs. `easternAssignments`
 * (the published Day-39 division-seeded snake, from loadEasternAssignments)
 * wins when present; deterministic uid-hash parity otherwise.
 */
function easternNightFor(uid, seasonUid, easternAssignments) {
  const assigned = easternAssignments && easternAssignments[uid];
  if (assigned === 41 || assigned === 42) return assigned;
  return engine.seededUnit(`${seasonUid}|eastern|${uid}`) < 0.5 ? 41 : 42;
}

/** The published Podium Eastern night assignments ({uid: 41|42}), or null. */
async function loadEasternAssignments(db, seasonUid) {
  try {
    const snapshot = await db.doc(`eastern-classic/${seasonUid}`).get();
    const podium = snapshot.exists ? snapshot.data().podium : null;
    return (podium && podium.assignments) || null;
  } catch {
    return null;
  }
}

/** All auto-attended competition days for a corps (majors + championships). */
function autoDaysFor(uid, seasonUid, { division, easternAssignments } = {}) {
  return [
    28,
    35,
    easternNightFor(uid, seasonUid, easternAssignments),
    ...championshipDaysFor(division),
  ];
}

/**
 * The competition days this corps has self-selected, as a number[]. Podium
 * picks are per SHOW now (`state.selectedShows = { [day]: {eventName, location} }`),
 * but `selectedShowDays` (a plain number[]) is still the currency of every
 * day-based check. This unions the new map's day keys with the legacy field so
 * both new and pre-migration states resolve identically.
 */
function selectedDaysOf(state) {
  const fromShows = Object.keys(state.selectedShows || {}).map(Number);
  const legacy = state.selectedShowDays || [];
  return [...new Set([...fromShows, ...legacy])];
}

/** The show a corps picked for `day` (`{eventName, location}`), or null. */
function showPickFor(state, day) {
  const picks = state.selectedShows || {};
  return picks[day] || picks[String(day)] || null;
}

/** True when `competitionDay` is a show day for this corps. */
function isShowDayFor(state, uid, competitionDay, easternAssignments) {
  if (competitionDay < 1 || competitionDay > 49) return false;
  const auto = autoDaysFor(uid, state.seasonUid, {
    division: state.division,
    easternAssignments,
  });
  if (auto.includes(competitionDay)) return true;
  return selectedDaysOf(state).includes(competitionDay);
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
  EASTERN_PUBLISH_DAY,
  CHAMPIONSHIP_AUTO_DAYS,
  CHAMPIONSHIP_DAYS_BY_DIVISION,
  CHAMPIONSHIP_LABELS_BY_DIVISION,
  championshipDaysFor,
  maxPicksForWeek,
  easternNightFor,
  loadEasternAssignments,
  autoDaysFor,
  isShowDayFor,
  selectedDaysOf,
  showPickFor,
  profileRef,
  stateRef,
  rosterRef,
  rosterCollection,
  recapDayRef,
  hydrateState,
  dehydrateState,
  initBudget,
  creditBudget,
  debitBudget,
  applyBalanceOverrides,
  applyCurveOverrides,
  curvesShapeValid,
  curves,
  balance,
};
