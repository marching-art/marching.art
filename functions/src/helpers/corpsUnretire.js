/**
 * Fantasy Division un-retire — the swap itself (pure).
 *
 * History follows the corps (owner direction, 2026-10 — docs/GAMEPLAY.md
 * "Your corps"): a retired corps returns with its own name, record, and look,
 * and the class's active corps (if any) is retired in its place, banked with
 * its record intact — the same swap season setup's unretire makes. Mid-season
 * the active corps must not have competed yet, and the returning name can't
 * clash with another of the director's active corps.
 */

const { HttpsError } = require("firebase-functions/v2/https");
const { hasCorpsCompeted } = require("./corpsEligibility");
const {
  CORPS_NAME_CLASSES,
  normalizeCorpsName,
  buildRetiredRecord,
  pickPersistentIdentity,
} = require("./corpsHelpers");

/**
 * Plan an un-retire against the director's profile. Throws HttpsError when it
 * can't happen. Returns { updatedCorps, updatedRetiredCorps, replaced } where
 * `replaced` names the active corps retired in the returning one's place.
 *
 * @param {{ profileData: any, corpsClass: string, retiredIndex: number, seasonUid?: string }} input
 */
function planUnretire({ profileData, corpsClass, retiredIndex, seasonUid }) {
  const retiredCorps = profileData.retiredCorps || [];
  const retiredRecord = retiredCorps[retiredIndex];
  const activeCorps = profileData.corps?.[corpsClass];
  const updatedRetiredCorps = retiredCorps.filter((_, index) => index !== retiredIndex);

  if (activeCorps?.corpsName) {
    if (activeCorps.mustRename) {
      throw new HttpsError(
        "failed-precondition",
        `"${activeCorps.corpsName}" conflicts with another director's corps and must be renamed first.`
      );
    }
    if (hasCorpsCompeted(activeCorps)) {
      throw new HttpsError(
        "failed-precondition",
        `"${activeCorps.corpsName}" has already competed this season. You can bring back ` +
          `${retiredRecord.corpsName} once the season ends.`
      );
    }
    updatedRetiredCorps.push(buildRetiredRecord(corpsClass, activeCorps));
  }

  // The returning corps can't share a name with another of this director's
  // active corps (every name-bearing class, incl. Podium).
  const returningKey = normalizeCorpsName(retiredRecord.corpsName || "");
  for (const cls of CORPS_NAME_CLASSES) {
    if (cls === corpsClass) continue;
    const otherName = profileData.corps?.[cls]?.corpsName;
    if (otherName && normalizeCorpsName(otherName) === returningKey) {
      throw new HttpsError(
        "already-exists",
        `You already have an active corps named "${otherName}". Each corps name must be unique.`
      );
    }
  }

  // Restore the corps, including the director's branding and ensemble
  // identity so it comes back exactly as it was retired.
  const updatedCorps = { ...profileData.corps };
  updatedCorps[corpsClass] = {
    corpsName: retiredRecord.corpsName,
    location: retiredRecord.location,
    seasonHistory: retiredRecord.seasonHistory || [],
    weeklyTrades: retiredRecord.weeklyTrades || null,
    ...pickPersistentIdentity(retiredRecord),
    // Registered for the live season, like every other way into a class.
    ...(seasonUid ? { seasonUid } : {}),
    // Reset season-specific data
    lineup: null,
    lineupKey: null,
    selectedShows: {},
    weeklyScores: {},
    totalSeasonScore: 0,
  };

  return { updatedCorps, updatedRetiredCorps, replaced: activeCorps?.corpsName || null };
}

module.exports = { planUnretire };
