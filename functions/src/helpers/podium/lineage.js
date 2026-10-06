/**
 * Podium corps lineages — which corps a career record belongs to (§5.13).
 *
 * A director's career doc holds ONE live corps plus the banked lineages of the
 * corps they retired or replaced (`retiredCareers`). History always follows
 * the corps that made it (owner direction, 2026-10): a corps is its name, a
 * new name is a new corps with no history, and a finished season — with its
 * reputation, class seat, staff, home, and budget — belongs only to the corps
 * that played it. These pure helpers answer "whose is this?" for every place
 * that moves a season or a seat between records: the boundary sweep,
 * registration, retire, and un-retire (helpers/podium/career.js).
 */

const engine = require("./engine");
const divisions = require("./divisions");

/**
 * The profile display fields that ARE the corps' look — its logo and uniforms.
 * They belong to the corps, not the director: a retired or replaced corps takes
 * them into its banked lineage (`identity`), a newly founded corps starts
 * without them, and an un-retired corps gets its own back.
 */
const IDENTITY_FIELDS = [
  "avatarUrl",
  "avatarSource",
  "avatarGeneratedAt",
  "uniform",
  "uniformAlt",
  "uniformGuard",
  "uniformDesign",
];

/**
 * Snapshot a corps' identity for banking (pure): its look from the profile
 * display copy, plus its home and show concept from the corps' last season
 * state when that state is its own. Null when there is nothing to keep.
 */
function captureIdentity(profileCorps, ownState) {
  const identity = {};
  for (const field of IDENTITY_FIELDS) {
    if (profileCorps && profileCorps[field] != null) identity[field] = profileCorps[field];
  }
  if (ownState) {
    if (ownState.home) identity.home = ownState.home;
    if (ownState.location) identity.location = ownState.location;
    if (ownState.showConcept) identity.showConcept = ownState.showConcept;
  }
  return Object.keys(identity).length > 0 ? identity : null;
}

/** Case- and spacing-insensitive corps-name key (matches the name registry). */
function corpsNameKey(name) {
  return typeof name === "string" ? name.trim().replace(/\s+/g, " ").toLowerCase() : "";
}

/**
 * True when a registration names the career's corps — its identity. A corps
 * with a new name is a new corps (owner direction, 2026-10): it holds none of
 * the old one's history, so a different name founds fresh rather than renaming.
 * Capitalization and spacing are not a new name.
 */
function isSameCorps(careerData, corpsName) {
  const current = corpsNameKey(careerData && careerData.corpsName);
  return current !== "" && current === corpsNameKey(corpsName);
}

/** True when a career holds a corps (vs. the blank slate after a retire). */
function hasActiveCorps(careerData) {
  return Boolean(careerData && (careerData.seasonsPlayed > 0 || careerData.corpsName));
}

/** True when a lineage has banked `seasonUid` into its record. */
function lineagePlayed(lineage, seasonUid) {
  if (!lineage || !seasonUid) return false;
  if (lineage.lastSeasonUid === seasonUid) return true;
  return (lineage.history || []).some((entry) => entry && entry.seasonUid === seasonUid);
}

/**
 * Which corps a finished season belongs to (pure) — the guard that keeps
 * history attached to the corps that made it:
 *   "active"     the live career banked it (continuing corps)
 *   "retired"    a banked lineage did (the corps was retired or replaced)
 *   "unarchived" nobody has yet — it is the live career's own, still to sweep
 * A season a retired lineage owns must never be re-applied to the live career:
 * that is how a newly founded corps would inherit its predecessor's
 * reputation, staff, and division.
 */
function seasonOwner(careerData, seasonUid) {
  if (lineagePlayed(careerData, seasonUid)) return "active";
  const retired = (careerData && careerData.retiredCareers) || [];
  if (retired.some((lineage) => lineagePlayed(lineage, seasonUid))) return "retired";
  return "unarchived";
}

/** Index into `retiredCareers` of the lineage that played `seasonUid`, or -1. */
function retiredLineageIndexFor(careerData, seasonUid) {
  const retired = (careerData && careerData.retiredCareers) || [];
  for (let i = retired.length - 1; i >= 0; i--) {
    if (lineagePlayed(retired[i], seasonUid)) return i;
  }
  return -1;
}

/**
 * The lineage an unswept finished season belongs to (pure): "active", or the
 * index into `retiredCareers` of the corps that fielded it. Normally the live
 * corps — but one retired or replaced before the boundary sweep reached it is
 * already banked, and its last season must land on ITS record, matched by
 * name (the corps' identity), never on whichever corps is live now.
 */
function lineageForUnsweptSeason(careerData, state) {
  const key = corpsNameKey(state && state.corpsName);
  const retired = (careerData && careerData.retiredCareers) || [];
  const active = hasActiveCorps(careerData);
  if (active && (!key || corpsNameKey(careerData.corpsName) === key)) return "active";
  for (let i = retired.length - 1; i >= 0; i--) {
    if (key && corpsNameKey(retired[i] && retired[i].corpsName) === key) return i;
  }
  // No name match: a live corps keeps it (a pre-2026-10 rename); a blank slate
  // means the corps that played it was the one most recently banked.
  if (!active && retired.length > 0) return retired.length - 1;
  return "active";
}

/**
 * Merge `patch` into whichever lineage played `seasonUid` (pure) — the live
 * career or a banked one. Returns the career unchanged when none did.
 */
function patchSeasonLineage(careerData, seasonUid, patch) {
  const owner = seasonOwner(careerData, seasonUid);
  if (owner === "active") return { ...careerData, ...patch };
  if (owner === "retired") {
    const index = retiredLineageIndexFor(careerData, seasonUid);
    const retired = [...careerData.retiredCareers];
    retired[index] = { ...retired[index], ...patch };
    return { ...careerData, retiredCareers: retired };
  }
  return careerData;
}

/** True when any lineage on the career already refunded `seasonUid`'s budget. */
function seasonRefunded(careerData, seasonUid) {
  if (!careerData || !seasonUid) return false;
  const lineages = [careerData, ...(careerData.retiredCareers || [])];
  return lineages.some((lineage) => lineage && lineage.lastRefundedSeasonUid === seasonUid);
}

/** The lineage that played `seasonUid` (live or banked), or null. */
function lineageThatPlayed(careerData, seasonUid) {
  const owner = seasonOwner(careerData, seasonUid);
  if (owner === "active") return careerData;
  if (owner === "retired") {
    return careerData.retiredCareers[retiredLineageIndexFor(careerData, seasonUid)];
  }
  return null;
}

/**
 * Seasons a lineage has sat out as of `currentIndex` (pure) — every season
 * between the last one it played and this one, whether it spent them dormant
 * or retired. The one timeline both registration and un-retire read, so the
 * time away is charged exactly once.
 */
function missedSeasonsFor(lineage, currentIndex) {
  if (!lineage || lineage.lastPlayedIndex == null || currentIndex == null) return 0;
  return Math.max(0, currentIndex - lineage.lastPlayedIndex - 1);
}

/**
 * Apply dormancy decay for missed seasons (pure). The engine guarantees the
 * return-weaker invariant.
 */
function applyDormancy(career, missedSeasons, cfg) {
  if (!missedSeasons || missedSeasons <= 0) return career;
  return {
    ...career,
    reputation: engine.updateReputation(career.reputation, 0, { dormantSeasons: missedSeasons }, cfg),
  };
}

/**
 * Where a corps lands if it takes the field at `currentIndex` (pure): its
 * reputation after the dormancy of the seasons it sat out, and the class that
 * earns it — the published re-entry rule (§5.13), so a corps away for one
 * season (the grace window) keeps its class, and a longer absence re-enters at
 * the class its decayed reputation supports, never above the seat it held.
 */
function projectReturn(lineage, currentIndex, cfg) {
  const missedSeasons = missedSeasonsFor(lineage, currentIndex);
  const reputationBefore = (lineage && lineage.reputation) || 0;
  const reputationAfter = applyDormancy(
    { reputation: reputationBefore, historicalPeak: (lineage && lineage.historicalPeak) || 0 },
    missedSeasons,
    cfg
  ).reputation;
  const division = divisions.divisionForRegistration(
    lineage,
    missedSeasons,
    cfg,
    reputationAfter
  );
  return { missedSeasons, reputationBefore, reputationAfter, division };
}

/**
 * Bank a live career lineage for retirement (pure, §5.13 "attached to the corps,
 * not the director"). Retiring preserves the whole lineage — reputation,
 * historical peak, trophy history, division, and its look — so it can be
 * un-retired later; it just steps off the active roster. Staff are per-season
 * employment (§5.6) and simply lapse, so they are not banked. `retiredAtIndex`
 * records when it stepped away (display only — the time away is always counted
 * from `lastPlayedIndex`, see missedSeasonsFor).
 */
function bankLineage(careerData, retiredAtIndex, identity) {
  const banked = { ...careerData };
  delete banked.retiredCareers;
  delete banked.pendingAssessment;
  banked.retiredAtIndex = retiredAtIndex;
  banked.retiredAt = new Date().toISOString();
  if (identity) banked.identity = identity;
  return banked;
}

/**
 * Restore a retired lineage as an active career (pure, §5.13 comeback arc).
 * The career comes back exactly as it was banked: the dormancy of its time away
 * is charged ONCE, when it takes the field at registration (which counts the
 * same missedSeasonsFor timeline), so the projection returned here is what the
 * director is shown before confirming — not a second charge. Returns
 * { career, identity, missedSeasons, reputationBefore, reputationAfter, division }.
 */
function restoreLineage(banked, currentIndex, cfg) {
  const projection = projectReturn(banked, currentIndex, cfg);
  const restored = { ...banked };
  delete restored.retiredAtIndex;
  delete restored.retiredAt;
  // `identity` stays on the career until the corps takes the field, so the
  // registration screen can greet it with its own home and show concept.
  return { career: restored, identity: banked.identity || null, ...projection };
}

module.exports = {
  IDENTITY_FIELDS,
  captureIdentity,
  corpsNameKey,
  isSameCorps,
  hasActiveCorps,
  lineagePlayed,
  seasonOwner,
  retiredLineageIndexFor,
  lineageForUnsweptSeason,
  patchSeasonLineage,
  seasonRefunded,
  lineageThatPlayed,
  missedSeasonsFor,
  applyDormancy,
  projectReturn,
  bankLineage,
  restoreLineage,
};
