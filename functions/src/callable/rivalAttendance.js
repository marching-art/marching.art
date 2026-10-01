/**
 * Rival attendance — which upcoming shows the caller's rivals are going to.
 *
 * Rivals are the closest competitors the nightly rivals job writes onto the
 * profile (`rivals.<class>`, scheduled/rivalsComputation.js) — by this season's
 * score, or last season's before anyone has scored. The Schedule page badges a
 * show "Rival attending" when one of them is on its bill, so a director can
 * chase (or dodge) a head-to-head while building the tour.
 *
 * Read-only and bounded: the caller's profile plus each distinct rival's
 * profile (fantasy picks) and, for Podium rivals, their podium state (day-based
 * picks) — at most a dozen docs. Show picks are already public through
 * getShowRegistrations' attendee roster; this only narrows them to rivals.
 * Auto-enrolled championship rounds are never in the picks, so they're never
 * badged (every corps marches them).
 */

const { onCall } = require("firebase-functions/v2/https");
const { paths } = require("../helpers/paths");
const { getDb } = require("../config");
const { assertAuth } = require("../helpers/callableGuards");
const podiumStore = require("../helpers/podium/store");

/** Show key the Schedule page matches on: week + event name (date-agnostic). */
function showKey(week, eventName) {
  return `${week}|${eventName}`;
}

/**
 * Index the rivals' upcoming picks by show. Pure; exported for tests.
 *
 * @param {Record<string, Array<object>>} rivalsByClass the caller's `profile.rivals`
 * @param {Map<string, object>} profilesByUid rival uid -> profile data
 * @param {Map<string, object>} podiumStatesByUid rival uid -> current-season podium state
 * @returns {Record<string, Array<object>>} `${week}|${eventName}` -> rival rows
 */
function indexRivalAttendance(rivalsByClass, profilesByUid, podiumStatesByUid) {
  /** @type {Record<string, Array<object>>} */
  const out = {};
  const seen = new Set();
  const add = (week, eventName, row) => {
    if (!eventName || !Number.isFinite(week)) return;
    const key = showKey(week, eventName);
    const dedupe = `${key}|${row.uid}|${row.corpsClass}`;
    if (seen.has(dedupe)) return;
    seen.add(dedupe);
    (out[key] = out[key] || []).push(row);
  };

  for (const [versusClass, rivals] of Object.entries(rivalsByClass || {})) {
    for (const rival of Array.isArray(rivals) ? rivals : []) {
      if (!rival || !rival.uid || !rival.corpsClass) continue;
      const row = {
        uid: rival.uid,
        username: rival.username || null,
        corpsName: rival.corpsName || "Unnamed Corps",
        corpsClass: rival.corpsClass,
        // Which of the caller's corps this is a rival OF.
        versusClass,
        scoreDelta: typeof rival.scoreDelta === "number" ? rival.scoreDelta : null,
        basis: rival.basis || "season",
      };

      if (rival.corpsClass === "podiumClass") {
        const state = podiumStatesByUid.get(rival.uid);
        for (const [dayKey, pick] of Object.entries((state && state.selectedShows) || {})) {
          const day = Number(dayKey);
          if (!Number.isInteger(day) || day < 1 || !pick || !pick.eventName) continue;
          add(Math.ceil(day / 7), pick.eventName, { ...row, day });
        }
        continue;
      }

      const profile = profilesByUid.get(rival.uid);
      const corps = profile && profile.corps && profile.corps[rival.corpsClass];
      for (const [weekKey, shows] of Object.entries((corps && corps.selectedShows) || {})) {
        const week = parseInt(String(weekKey).replace(/^week/, ""), 10);
        if (!Number.isFinite(week)) continue;
        for (const show of Array.isArray(shows) ? shows : []) {
          if (!show || typeof show.eventName !== "string") continue;
          add(week, show.eventName, { ...row, day: Number.isInteger(show.day) ? show.day : null });
        }
      }
    }
  }
  return out;
}

exports.indexRivalAttendance = indexRivalAttendance;

exports.getRivalShowAttendance = onCall({ cors: true }, async (request) => {
  const uid = assertAuth(request);
  const db = getDb();
  const [profileSnap, seasonSnap] = await Promise.all([
    db.doc(paths.userProfile(uid)).get(),
    db.doc("game-settings/season").get(),
  ]);
  const rivalsByClass = (profileSnap.exists && profileSnap.data().rivals) || {};
  const seasonUid = seasonSnap.exists ? seasonSnap.data().seasonUid : null;
  if (!seasonUid) return { shows: {} };

  const fantasyUids = new Set();
  const podiumUids = new Set();
  for (const rivals of Object.values(rivalsByClass)) {
    for (const rival of Array.isArray(rivals) ? rivals : []) {
      if (!rival || !rival.uid || rival.uid === uid) continue;
      (rival.corpsClass === "podiumClass" ? podiumUids : fantasyUids).add(rival.uid);
    }
  }
  if (fantasyUids.size === 0 && podiumUids.size === 0) return { shows: {} };

  const fantasyList = [...fantasyUids];
  const podiumList = [...podiumUids];
  const [profileDocs, podiumDocs] = await Promise.all([
    fantasyList.length
      ? db.getAll(...fantasyList.map((u) => db.doc(paths.userProfile(u))))
      : Promise.resolve([]),
    podiumList.length
      ? db.getAll(...podiumList.map((u) => podiumStore.stateRef(db, u)))
      : Promise.resolve([]),
  ]);

  const profilesByUid = new Map();
  profileDocs.forEach((doc, i) => {
    // A rival whose profile still points at last season has no live picks.
    if (doc.exists && doc.data().activeSeasonId === seasonUid) {
      profilesByUid.set(fantasyList[i], doc.data());
    }
  });
  const podiumStatesByUid = new Map();
  podiumDocs.forEach((doc, i) => {
    if (doc.exists && doc.data().seasonUid === seasonUid) {
      podiumStatesByUid.set(podiumList[i], doc.data());
    }
  });

  // Only the caller's own rivals entries are trusted inputs (written by the
  // rivals job); a rival removed since then simply drops out tomorrow.
  /** @type {Record<string, Array<object>>} */
  const ownRivals = {};
  for (const [cls, rivals] of Object.entries(rivalsByClass)) {
    ownRivals[cls] = (Array.isArray(rivals) ? rivals : []).filter((r) => r && r.uid !== uid);
  }
  return { shows: indexRivalAttendance(ownRivals, profilesByUid, podiumStatesByUid) };
});
