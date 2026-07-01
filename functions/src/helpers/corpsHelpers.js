// Pure corps helpers extracted from callable/corps.js: name normalization,
// profanity check, duplicate-winner resolution, and persistent-identity /
// retired-record builders. Unit-tested in corpsHelpers.test.js.

const admin = require("firebase-admin");

// Class tier ordering for duplicate-name conflict resolution: lower index =
// higher tier. When two corps share a name, the higher-tier corps wins and
// the loser is flagged for rename.
const CLASS_PRIORITY = {
  worldClass: 0,
  openClass: 1,
  aClass: 2,
  soundSport: 3,
};

const VALID_CLASSES = ["worldClass", "openClass", "aClass", "soundSport"];

const normalizeCorpsName = (name) => (name || "").toLowerCase().trim();

const isProfaneCorpsName = (text) => /fuck|shit|damn/.test((text || "").toLowerCase());

/**
 * Pick the winner from a group of corps that share a name.
 * Higher class tier wins. Ties broken by oldest createdAt; final fallback is
 * the corps that has a corpsnames reservation.
 */
function pickDuplicateWinner(group) {
  return [...group].sort((a, b) => {
    const tierDiff = CLASS_PRIORITY[a.corpsClass] - CLASS_PRIORITY[b.corpsClass];
    if (tierDiff !== 0) return tierDiff;
    const aMs = a.createdAt?.toMillis ? a.createdAt.toMillis() : 0;
    const bMs = b.createdAt?.toMillis ? b.createdAt.toMillis() : 0;
    if (aMs !== bMs) return aMs - bMs;
    if (a.hasReservation && !b.hasReservation) return -1;
    if (!a.hasReservation && b.hasReservation) return 1;
    return 0;
  })[0];
}

// Director-designed branding and ensemble identity that must persist with a
// corps across seasons and through retire/unretire — it is NEVER season data.
const PERSISTENT_IDENTITY_FIELDS = [
  "uniformDesign",
  "avatarUrl",
  "avatarGeneratedAt",
  "ensembleInfo",
  "description",
  "biography",
  "showConcept",
];

/** Copy persistent identity fields from a corps object (omitting undefined). */
function pickPersistentIdentity(corps) {
  const out = {};
  if (!corps) return out;
  for (const field of PERSISTENT_IDENTITY_FIELDS) {
    if (corps[field] !== undefined) out[field] = corps[field];
  }
  return out;
}

/**
 * Build a retired-corps record, preserving the director's branding and
 * ensemble identity so a future unretire restores the corps unchanged.
 */
function buildRetiredRecord(corpsClass, corps) {
  return {
    corpsClass,
    corpsName: corps.corpsName,
    location: corps.location,
    seasonHistory: corps.seasonHistory || [],
    weeklyTrades: corps.weeklyTrades || null,
    totalSeasons: corps.seasonHistory?.length || 0,
    bestSeasonScore: Math.max(...(corps.seasonHistory?.map((s) => s.totalSeasonScore) || [0])),
    totalShows: (corps.seasonHistory || []).reduce((sum, s) => sum + (s.showsAttended || 0), 0),
    ...pickPersistentIdentity(corps),
    retiredAt: admin.firestore.FieldValue.serverTimestamp(),
  };
}

module.exports = {
  CLASS_PRIORITY,
  VALID_CLASSES,
  normalizeCorpsName,
  isProfaneCorpsName,
  pickDuplicateWinner,
  PERSISTENT_IDENTITY_FIELDS,
  pickPersistentIdentity,
  buildRetiredRecord,
};
