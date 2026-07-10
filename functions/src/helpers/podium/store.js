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
  hydrateState,
  dehydrateState,
  curves,
  balance,
};
