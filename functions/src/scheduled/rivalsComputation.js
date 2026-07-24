/**
 * Rivals Computation
 *
 * For each user with a corps in a given class, finds the 2-3 closest competitors
 * (by totalSeasonScore) and writes the result onto the user's profile doc as
 * `rivals.<classKey>`. The Dashboard renders a "Rivals" panel from this data.
 *
 * Class bucketing: SoundSport is its own bucket. World/Open/A are pooled together
 * so users in adjacent classes can still appear as rivals when their class is sparse.
 * Within a bucket, same-class rivals are preferred and the bucket is only opened up
 * when the user has fewer than RIVAL_TARGET in-class candidates.
 *
 * Podium Class is its own bucket: Podium and fantasy scores are never compared or
 * cross-ranked (PODIUM.md §5.5). Inside the bucket, same-division rivals (Podium's
 * internal World/Open/A, §5.7) are preferred the same way the competitive bucket
 * prefers same-class.
 */

const { onSchedule } = require("firebase-functions/v2/scheduler");
const { paths } = require("../helpers/paths");
const { onCall } = require("firebase-functions/v2/https");
const { logger } = require("firebase-functions/v2");
const admin = require("firebase-admin");
const { getDb } = require("../config");
const { assertAdmin } = require("../helpers/callableGuards");
const { ENABLED_CLASSES } = require("../helpers/classRegistry");
const { processAllInPages } = require("../helpers/firestorePaging");

// Every enabled class competes for rivals — including podiumClass, which has
// no lineup (hasLineup: false) and so is absent from FANTASY_CLASSES.
const ALL_CLASSES = ENABLED_CLASSES;
const SOUNDSPORT_BUCKET = new Set(["soundSport"]);
const COMPETITIVE_BUCKET = new Set(["worldClass", "openClass", "aClass"]);
const PODIUM_BUCKET = new Set(["podiumClass"]);
const RIVAL_TARGET = 3;

// SoundSport scores are never revealed to users — only medal designations.
// Thresholds mirror src/components/Dashboard/sections/constants.js.
const SOUNDSPORT_MEDAL_TIERS = [
  { medal: "Gold", min: 90, rank: 3 },
  { medal: "Silver", min: 75, rank: 2 },
  { medal: "Bronze", min: 60, rank: 1 },
  { medal: "Participation", min: 0, rank: 0 },
];

function medalForScore(score) {
  for (const tier of SOUNDSPORT_MEDAL_TIERS) {
    if (score >= tier.min) return tier;
  }
  return SOUNDSPORT_MEDAL_TIERS[SOUNDSPORT_MEDAL_TIERS.length - 1];
}

function bucketFor(corpsClass) {
  if (SOUNDSPORT_BUCKET.has(corpsClass)) return "soundSport";
  if (COMPETITIVE_BUCKET.has(corpsClass)) return "competitive";
  if (PODIUM_BUCKET.has(corpsClass)) return "podium";
  return null;
}

/**
 * Preference group for rival picking. The competitive bucket prefers same-class
 * neighbors; the Podium bucket is single-class but multi-division, so the
 * analogous preference is the corps' division inside Podium.
 */
function rivalGroupOf(entry) {
  if (entry.corpsClass === "podiumClass") return `division:${entry.division || "aClass"}`;
  return entry.corpsClass;
}

/**
 * Build a flat list of all (user, class, corps) entries with a score, grouped by bucket.
 * Skips entries with no totalSeasonScore (corps not yet competing).
 */
function indexCorpsByBucket(profileDocs, userIds) {
  const byBucket = { soundSport: [], competitive: [], podium: [] };

  profileDocs.forEach((profileDoc, idx) => {
    if (!profileDoc.exists) return;
    const profile = profileDoc.data();
    const uid = userIds[idx];
    const username = profile.username;
    if (!username) return;
    const corps = profile.corps || {};

    for (const corpsClass of ALL_CLASSES) {
      const corpsData = corps[corpsClass];
      if (!corpsData) continue;
      const score = Number(corpsData.totalSeasonScore || 0);
      if (score <= 0) continue;
      const bucket = bucketFor(corpsClass);
      if (!bucket) continue;

      byBucket[bucket].push({
        uid,
        username,
        corpsClass,
        corpsName: corpsData.corpsName || corpsData.name || "Unnamed Corps",
        score,
        avatarUrl: corpsData.avatarUrl || null,
        // Podium's internal division (worldClass/openClass/aClass), written by
        // the nightly Podium processor onto the corps display copy.
        division: corpsClass === "podiumClass" ? corpsData.division || "aClass" : null,
      });
    }
  });

  // Pre-sort each bucket by score descending so rank-finding is a linear scan.
  for (const bucket of Object.keys(byBucket)) {
    byBucket[bucket].sort((a, b) => b.score - a.score);
  }
  return byBucket;
}

/**
 * Pick rivals for a single corps entry. Prefers same-group neighbors (class in
 * the competitive bucket, division in the Podium bucket); falls back to
 * bucket-mates only if needed to reach RIVAL_TARGET.
 */
function pickRivalsForEntry(entry, bucketEntries) {
  const others = bucketEntries.filter(
    (e) => e.uid !== entry.uid,
  );
  if (others.length === 0) return [];

  const entryGroup = rivalGroupOf(entry);
  const sameGroup = others.filter((e) => rivalGroupOf(e) === entryGroup);
  const otherGroup = others.filter((e) => rivalGroupOf(e) !== entryGroup);

  const byCloseness = (a, b) =>
    Math.abs(a.score - entry.score) - Math.abs(b.score - entry.score);

  const picks = [];
  for (const candidate of [...sameGroup].sort(byCloseness)) {
    if (picks.length >= RIVAL_TARGET) break;
    picks.push(candidate);
  }
  if (picks.length < RIVAL_TARGET) {
    for (const candidate of [...otherGroup].sort(byCloseness)) {
      if (picks.length >= RIVAL_TARGET) break;
      picks.push(candidate);
    }
  }

  // Compute global rank within the bucket once for context.
  const bucketRankByUid = new Map();
  bucketEntries.forEach((e, i) => bucketRankByUid.set(`${e.uid}:${e.corpsClass}`, i + 1));
  const userRank = bucketRankByUid.get(`${entry.uid}:${entry.corpsClass}`) || null;

  return picks.map((rival) => {
    const base = {
      uid: rival.uid,
      username: rival.username,
      corpsName: rival.corpsName,
      corpsClass: rival.corpsClass,
      avatarUrl: rival.avatarUrl,
      bucketRank: bucketRankByUid.get(`${rival.uid}:${rival.corpsClass}`) || null,
      userBucketRank: userRank,
      ...(rival.division ? { division: rival.division } : {}),
    };

    // SoundSport never reveals raw scores. Surface medal tier and the user's
    // own medal so the dashboard / email can render a relative comparison
    // without leaking numeric scores.
    if (rival.corpsClass === "soundSport" || entry.corpsClass === "soundSport") {
      const rivalMedal = medalForScore(rival.score);
      const userMedal = medalForScore(entry.score);
      return {
        ...base,
        medal: rivalMedal.medal,
        medalRank: rivalMedal.rank,
        userMedal: userMedal.medal,
        userMedalRank: userMedal.rank,
      };
    }

    return {
      ...base,
      score: rival.score,
      scoreDelta: Number((rival.score - entry.score).toFixed(3)),
    };
  });
}

async function updateRivalsLogic() {
  const db = getDb();
  logger.info("Computing rivals for active-season users…");

  // Rivals are derived from totalSeasonScore, which only exists on profiles
  // registered in the current season — so scan just those instead of reading
  // every profile ever created (the old listDocuments + getAll of the whole
  // users collection). Same activeSeasonId collection-group index the nightly
  // scoring scan uses; the select() projection keeps each doc small. Profiles
  // from past seasons keep their last-written rivals, which nothing renders
  // until they re-register (and then the next run covers them).
  const seasonDoc = await db.doc("game-settings/season").get();
  const activeSeasonId = seasonDoc.exists ? seasonDoc.data().seasonUid : null;
  if (!activeSeasonId) {
    logger.info("No active season; skipping rivals computation.");
    return { processed: 0 };
  }

  const profilesQuery = db
    .collectionGroup("profile")
    .where("activeSeasonId", "==", activeSeasonId)
    .select("username", "corps", "classRanks");
  const allDocs = await processAllInPages(profilesQuery, 1000, async (doc) => doc);
  // The collection group spans data namespaces; keep only this namespace's
  // profile docs (users/{uid}/profile/data under paths.users()).
  const usersPrefix = `${paths.users()}/`;
  const profileDocs = allDocs.filter((doc) => doc.ref.path.startsWith(usersPrefix));
  if (profileDocs.length === 0) {
    logger.info("No active-season users found; skipping rivals computation.");
    return { processed: 0 };
  }
  const userIds = profileDocs.map((doc) => doc.ref.parent.parent.id);

  const byBucket = indexCorpsByBucket(profileDocs, userIds);
  logger.info(
    `Indexed corps: soundSport=${byBucket.soundSport.length}, competitive=${byBucket.competitive.length}, podium=${byBucket.podium.length}`,
  );

  // Per-class ranks for the daily snapshot. Buckets mix classes (competitive
  // = world+open+A), so rank is counted within each entry's own class; the
  // bucket arrays are already sorted by score descending.
  const classRankByKey = new Map();
  for (const bucket of Object.keys(byBucket)) {
    const perClassCounters = new Map();
    for (const entry of byBucket[bucket]) {
      const nextRank = (perClassCounters.get(entry.corpsClass) || 0) + 1;
      perClassCounters.set(entry.corpsClass, nextRank);
      classRankByKey.set(`${entry.uid}:${entry.corpsClass}`, nextRank);
    }
  }

  // Previous snapshot (from the last run) feeds the dashboard's rank-change
  // arrow: previousRank - rank = places climbed since yesterday.
  const prevClassRanksByUid = new Map();
  profileDocs.forEach((profileDoc, idx) => {
    if (profileDoc.exists) {
      prevClassRanksByUid.set(userIds[idx], profileDoc.data().classRanks || {});
    }
  });

  // Group user's competing corps by uid so each user gets one batched write.
  const rivalsByUid = new Map();
  for (const bucket of Object.keys(byBucket)) {
    for (const entry of byBucket[bucket]) {
      const rivals = pickRivalsForEntry(entry, byBucket[bucket]);
      const existing = rivalsByUid.get(entry.uid) || {};
      existing[entry.corpsClass] = rivals;
      rivalsByUid.set(entry.uid, existing);
    }
  }

  let batch = db.batch();
  let writes = 0;
  let totalWritten = 0;
  const updatedAt = admin.firestore.FieldValue.serverTimestamp();

  for (const [uid, rivals] of rivalsByUid.entries()) {
    const ref = db.doc(paths.userProfile(uid));
    const prevRanks = prevClassRanksByUid.get(uid) || {};
    const classRanks = {};
    for (const corpsClass of Object.keys(rivals)) {
      const rank = classRankByKey.get(`${uid}:${corpsClass}`);
      if (rank) {
        classRanks[corpsClass] = {
          rank,
          previousRank: prevRanks[corpsClass]?.rank ?? null,
        };
      }
    }
    batch.set(
      ref,
      { rivals, classRanks, rivalsUpdatedAt: updatedAt },
      { merge: true },
    );
    writes += 1;
    totalWritten += 1;
    if (writes >= 400) {
      await batch.commit();
      batch = db.batch();
      writes = 0;
    }
  }
  if (writes > 0) {
    await batch.commit();
  }

  logger.info(`Wrote rivals for ${totalWritten} users.`);
  return { processed: totalWritten };
}

exports.scheduledRivalsUpdate = onSchedule(
  {
    // Run after the 2 AM ET score processor so scores reflect the latest day.
    schedule: "30 2 * * *",
    timeZone: "America/New_York",
    // Scans every active-season profile; the default 60s scheduler timeout
    // would cut the scan off (and retry it from zero) once the player base
    // grows. Same headroom the email/push population scans use.
    timeoutSeconds: 540,
    memory: "512MiB",
  },
  async () => {
    logger.info("Starting scheduled rivals update");
    await updateRivalsLogic();
    logger.info("Completed scheduled rivals update");
  },
);

exports.updateRivalsNow = onCall({ cors: true }, async (request) => {
  // Admin custom claim, like every other privileged callable. This used to
  // gate on profile.role — a profile field, i.e. a client-adjacent input —
  // instead of the claim only the Admin SDK can set.
  assertAdmin(request);
  const result = await updateRivalsLogic();
  return { success: true, ...result };
});

module.exports = {
  scheduledRivalsUpdate: exports.scheduledRivalsUpdate,
  updateRivalsNow: exports.updateRivalsNow,
  // Exported for unit tests.
  bucketFor,
  indexCorpsByBucket,
  pickRivalsForEntry,
};
