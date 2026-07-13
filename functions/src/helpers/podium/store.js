/**
 * Podium Class Firestore layout + state hydration (Phase 2).
 *
 * Competitive state lives in a server-only subcollection
 * (`.../users/{uid}/podium/state`) per PODIUM.md §14.2.5 —
 * firestore.rules denies all client writes there and restricts reads to the
 * owner (challenge levels and caption state are competitive intel). The
 * profile's `corps.podiumClass` entry carries only display copies written by
 * these server paths.
 *
 * Curve parameters are never persisted: they are deterministic functions of
 * the stored challenge levels, re-derived on every load (hydrateState), so a
 * curve-data refresh can never desync stored state.
 */

const { paths } = require("../paths");
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

// Championship week in Indianapolis runs the EXACT fantasy finals-week bracket
// (scoringAwards.buildChampionshipConfig) in parallel — the same schedule and
// the same advancement, scored on the Podium system with its own results board
// (podium-recaps, never cross-ranked with fantasy). Two identical tournaments
// side by side:
//   Day 45  Open and A Class Prelims        — all Open + A corps
//   Day 46  Open and A Class Finals         — top 8 Open + top 4 A from day 45
//   Day 47  World Championship Prelims      — EVERYONE (World + Open + A)
//   Day 48  World Championship Semifinals   — top 25 overall from day 47
//   Day 49  World Championship Finals       — top 12 overall from day 48
// Days 46/48/49 are ADVANCEMENT days (see CHAMPIONSHIP_ADVANCEMENT): only the
// cut survivors compete. Every division reaches the World rounds — A/Open corps
// eliminated at day 46 still march day-47 Prelims, exactly like the fantasy
// classes.
const CHAMPIONSHIP_AUTO_DAYS = Object.freeze([47, 48, 49]);
const CHAMPIONSHIP_WEEK_DAYS = Object.freeze([45, 46, 47, 48, 49]);
const CHAMPIONSHIP_DAYS_BY_DIVISION = Object.freeze({
  aClass: Object.freeze([45, 46, 47, 48, 49]),
  openClass: Object.freeze([45, 46, 47, 48, 49]),
  worldClass: CHAMPIONSHIP_AUTO_DAYS,
});
// One event per championship day, shared across every division that competes
// that day (mirrors the fantasy event names so the two boards read identically).
const CHAMPIONSHIP_EVENT_BY_DAY = Object.freeze({
  45: "Open and A Class Prelims",
  46: "Open and A Class Finals",
  47: "marching.art World Championship Prelims",
  48: "marching.art World Championship Semifinals",
  49: "marching.art World Championship Finals",
});

// The advancement bracket, cut-for-cut identical to fantasy: day 46 cuts each
// class separately (top 8 Open, top 4 A); days 48/49 cut the whole combined
// field (top 25, then top 12). Tie-inclusive at the cut line. The keys index
// balance.championship.advancement.
const CHAMPIONSHIP_ADVANCEMENT = Object.freeze({
  46: Object.freeze({
    priorDay: 45,
    perDivision: Object.freeze([
      Object.freeze({ division: "aClass", advanceKey: "aClassFinals" }),
      Object.freeze({ division: "openClass", advanceKey: "openClassFinals" }),
    ]),
  }),
  48: Object.freeze({ priorDay: 47, overallKey: "worldSemifinals" }),
  49: Object.freeze({ priorDay: 48, overallKey: "worldFinals" }),
});

/** Championship-week show days a corps' division is auto-enrolled into. */
function championshipDaysFor(division) {
  return CHAMPIONSHIP_DAYS_BY_DIVISION[divisions.normalizeDivision(division)];
}

/** The Podium championship event name for a championship day (or undefined). */
function championshipEventFor(competitionDay) {
  return CHAMPIONSHIP_EVENT_BY_DAY[competitionDay];
}

/** Top N of `results` by total, tie-inclusive at the cut line, into `set`. */
function addTopN(results, n, set) {
  if (!(n > 0) || results.length === 0) return;
  const ranked = [...results].sort((a, b) => b.totalScore - a.totalScore);
  const cutoff = ranked[Math.min(n, ranked.length) - 1].totalScore;
  for (const r of ranked) {
    if (r.totalScore >= cutoff) set.add(r.uid);
  }
}

/**
 * The set of uids that advanced INTO `competitionDay`'s championship round,
 * from the prior round's Podium recap. Day 46 cuts each division separately
 * (top 8 Open, top 4 A); days 48/49 cut the whole combined field (top 25, then
 * top 12) — the fantasy rule, tie-inclusive at the cut line. Returns null when
 * the day is not an advancement day, or the prior recap has no usable results
 * (the fantasy "no prior results -> auto-enroll the whole field" safeguard: no
 * gating).
 */
function advancingUids(priorRecap, competitionDay, cfg) {
  const spec = CHAMPIONSHIP_ADVANCEMENT[competitionDay];
  if (!spec) return null;
  const allResults = (priorRecap && Array.isArray(priorRecap.shows) ? priorRecap.shows : [])
    .flatMap((show) => show.results || []);
  if (allResults.length === 0) return null;
  const sizes = (cfg && cfg.championship && cfg.championship.advancement) || {};
  const advancing = new Set();
  if (spec.overallKey) {
    // World Semifinals / Finals: cut the whole combined field.
    addTopN(allResults, sizes[spec.overallKey] || 0, advancing);
  }
  for (const cut of spec.perDivision || []) {
    // Open/A Finals: each class cuts on its own prelims standing.
    const classResults = allResults.filter(
      (r) => divisions.normalizeDivision(r.division) === cut.division
    );
    addTopN(classResults, sizes[cut.advanceKey] || 0, advancing);
  }
  return advancing;
}

/**
 * Max self-selected shows per competition week. Weeks 4-6 spend one of four
 * slots on a major; week 7's championship days (45-49) are auto-attended, so
 * only its two open days (43-44) are selectable.
 */
function maxPicksForWeek(week) {
  if (week === 7) return 2; // days 43-44 are open; 45-49 are Championship Week
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

/**
 * { [day]: [{eventName, location}] } from the season's schedule doc — the
 * per-day list of scheduled shows. Used to validate/resolve which show a
 * Podium corps registers for and scores at (reads competition `name`).
 */
async function loadScheduleShowsByDay(db, seasonData) {
  const scheduleId = seasonData.dataDocId || seasonData.name;
  const byDay = {};
  if (!scheduleId) return byDay;
  const doc = await db.doc(`schedules/${scheduleId}`).get();
  if (!doc.exists) return byDay;
  for (const comp of doc.data().competitions || []) {
    if (comp.day == null || !comp.name) continue;
    (byDay[comp.day] = byDay[comp.day] || []).push({
      eventName: comp.name,
      location: comp.location || "",
    });
  }
  return byDay;
}

/**
 * {day -> location string} for the season schedule — the preload joint
 * rehearsals use to resolve each corps' tour position on a given day
 * (helpers/podium/joint.corpsVenueOnDay). Mirrors loadScheduleShowsByDay but
 * keeps the first non-empty location seen per day.
 */
async function loadScheduleLocations(db, seasonData) {
  const byDay = await loadScheduleShowsByDay(db, seasonData);
  const locations = {};
  for (const [day, shows] of Object.entries(byDay)) {
    const withLocation = shows.find((s) => s.location);
    if (withLocation) locations[day] = withLocation.location;
  }
  return locations;
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
  return db.doc(paths.userProfile(uid));
}

function stateRef(db, uid) {
  return db.doc(paths.userPodiumState(uid));
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

/**
 * Normalize a ledger `reason` into the coarse line-item category the
 * end-of-season financial report groups by. Debit reasons are namespaced
 * (`staff:brass`, `food:standard`, `staffRetrain:guard`); credits carry a flat
 * source key. Anything unrecognized falls under "other" so the report always
 * balances against the aggregate `spent`/`earned` totals.
 */
function budgetCategoryOf(reason) {
  const key = String(reason || "");
  if (key.startsWith("staff")) return "staff"; // staff:*, staffRetrain:*
  if (key === "travel" || key === "jointTravel") return "travel";
  if (key.startsWith("food")) return "food";
  if (key === "camp") return "camp"; // spring-training housing/food
  if (key === "clinician") return "clinician";
  if (key === "commitment") return "commitment"; // CC dedicated from the wallet
  if (key === "showPayout" || key === "fundraiser") return "earnings"; // in-class income
  return "other";
}

/**
 * Initialize an empty ledger. `byCategory` accumulates lifetime totals per
 * line-item category (income keys positive, spend keys positive) so the
 * end-of-season report is exact even though `log` is capped at the most recent
 * BUDGET_LOG_LIMIT entries — a busy 49-day tour easily overruns the log.
 */
function initBudget() {
  return { balance: 0, committed: 0, earned: 0, spent: 0, byCategory: {}, log: [] };
}

/** Add `amount` to the running per-category total (mutates the ledger). */
function accrueCategory(budget, reason, amount) {
  if (!budget.byCategory) budget.byCategory = {};
  const category = budgetCategoryOf(reason);
  budget.byCategory[category] = (budget.byCategory[category] || 0) + amount;
}

/** Credit the ledger (earnings/commitments). Mutates state. */
function creditBudget(state, amount, reason, day) {
  if (!state.budget) state.budget = initBudget();
  state.budget.balance += amount;
  state.budget.earned += reason === "commitment" ? 0 : amount;
  if (reason === "commitment") state.budget.committed += amount;
  accrueCategory(state.budget, reason, amount);
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
  accrueCategory(state.budget, reason, amount);
  state.budget.log = [
    ...(state.budget.log || []).slice(-(BUDGET_LOG_LIMIT - 1)),
    { day, amount: -amount, reason },
  ];
  return true;
}

// The spend categories a season's operating costs fall into, in the order the
// financial report and estimated-budget lists render them. Staff is tracked
// separately in the estimate (next season's payroll is known exactly), so it
// leads; the rest are the recurring tour costs.
const SPEND_CATEGORIES = Object.freeze(["staff", "travel", "food", "camp", "clinician", "other"]);
const SPEND_CATEGORY_LABELS = Object.freeze({
  staff: "Staff salaries",
  travel: "Travel",
  food: "Food & housing",
  camp: "Spring training",
  clinician: "Clinicians",
  other: "Other",
});

/**
 * Per-category spend for a finished season. Prefers the exact `byCategory`
 * accumulator; falls back to reconstructing from the (capped) `log` for
 * pre-migration states that predate the accumulator. Returns { [category]:
 * amount } including only categories with a positive total.
 */
function spendByCategory(budget) {
  const out = {};
  const fromAccumulator =
    budget && budget.byCategory && Object.keys(budget.byCategory).length > 0;
  if (fromAccumulator) {
    for (const category of SPEND_CATEGORIES) {
      const amount = budget.byCategory[category] || 0;
      if (amount > 0) out[category] = amount;
    }
    return out;
  }
  for (const entry of (budget && budget.log) || []) {
    if (!entry || entry.amount >= 0) continue; // credits are income, not spend
    const category = budgetCategoryOf(entry.reason);
    out[category] = (out[category] || 0) - entry.amount; // -amount = positive spend
  }
  return out;
}

/**
 * Build the director-facing end-of-season financial report from a finished
 * corps' budget ledger (pure). The leftover `balance` is what the refund
 * returns to the primary CorpsCoin wallet — a corps operating account is swept
 * back to its parent at archival, never left to vanish. Line items reconcile:
 * committed + earned - spent === refunded.
 */
function buildSeasonFinancialReport(state, { seasonUid, seasonIndex } = {}) {
  const budget = (state && state.budget) || initBudget();
  const committed = Math.max(0, budget.committed || 0);
  const earned = Math.max(0, budget.earned || 0);
  const spent = Math.max(0, budget.spent || 0);
  const refunded = Math.max(0, budget.balance || 0);
  const byCategory = spendByCategory(budget);
  const lineItems = SPEND_CATEGORIES.filter((category) => byCategory[category] > 0).map(
    (category) => ({
      category,
      label: SPEND_CATEGORY_LABELS[category],
      amount: byCategory[category],
    })
  );
  return {
    seasonUid: seasonUid || state.seasonUid || null,
    seasonIndex: seasonIndex ?? null,
    corpsName: (state && state.corpsName) || null,
    committed,
    earned,
    spent,
    refunded,
    lineItems,
    // Operating spend (everything except staff salaries) — the basis for next
    // season's estimate, since staff payroll is re-derived exactly at re-reg.
    operatingSpend: SPEND_CATEGORIES.filter((c) => c !== "staff").reduce(
      (sum, c) => sum + (byCategory[c] || 0),
      0
    ),
    staffSpend: byCategory.staff || 0,
    generatedAt: new Date().toISOString(),
  };
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
  CHAMPIONSHIP_WEEK_DAYS,
  CHAMPIONSHIP_DAYS_BY_DIVISION,
  CHAMPIONSHIP_EVENT_BY_DAY,
  CHAMPIONSHIP_ADVANCEMENT,
  championshipDaysFor,
  championshipEventFor,
  advancingUids,
  maxPicksForWeek,
  easternNightFor,
  loadEasternAssignments,
  loadScheduleShowsByDay,
  loadScheduleLocations,
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
  budgetCategoryOf,
  spendByCategory,
  buildSeasonFinancialReport,
  SPEND_CATEGORIES,
  SPEND_CATEGORY_LABELS,
  applyBalanceOverrides,
  applyCurveOverrides,
  curvesShapeValid,
  curves,
  balance,
};
