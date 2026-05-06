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
 */

const { onSchedule } = require("firebase-functions/v2/scheduler");
const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { logger } = require("firebase-functions/v2");
const admin = require("firebase-admin");
const { getDb, dataNamespaceParam } = require("../config");

const ALL_CLASSES = ["worldClass", "openClass", "aClass", "soundSport"];
const SOUNDSPORT_BUCKET = new Set(["soundSport"]);
const COMPETITIVE_BUCKET = new Set(["worldClass", "openClass", "aClass"]);
const RIVAL_TARGET = 3;

function bucketFor(corpsClass) {
  if (SOUNDSPORT_BUCKET.has(corpsClass)) return "soundSport";
  if (COMPETITIVE_BUCKET.has(corpsClass)) return "competitive";
  return null;
}

/**
 * Build a flat list of all (user, class, corps) entries with a score, grouped by bucket.
 * Skips entries with no totalSeasonScore (corps not yet competing).
 */
function indexCorpsByBucket(profileDocs, userIds) {
  const byBucket = { soundSport: [], competitive: [] };

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
      });
    }
  });

  // Pre-sort each bucket by score descending so rank-finding is a linear scan.
  byBucket.soundSport.sort((a, b) => b.score - a.score);
  byBucket.competitive.sort((a, b) => b.score - a.score);
  return byBucket;
}

/**
 * Pick rivals for a single corps entry. Prefers same-class neighbors; falls back
 * to bucket-mates only if needed to reach RIVAL_TARGET.
 */
function pickRivalsForEntry(entry, bucketEntries) {
  const others = bucketEntries.filter(
    (e) => e.uid !== entry.uid,
  );
  if (others.length === 0) return [];

  const sameClass = others.filter((e) => e.corpsClass === entry.corpsClass);
  const otherClass = others.filter((e) => e.corpsClass !== entry.corpsClass);

  const byCloseness = (a, b) =>
    Math.abs(a.score - entry.score) - Math.abs(b.score - entry.score);

  const picks = [];
  for (const candidate of [...sameClass].sort(byCloseness)) {
    if (picks.length >= RIVAL_TARGET) break;
    picks.push(candidate);
  }
  if (picks.length < RIVAL_TARGET) {
    for (const candidate of [...otherClass].sort(byCloseness)) {
      if (picks.length >= RIVAL_TARGET) break;
      picks.push(candidate);
    }
  }

  // Compute global rank within the bucket once for context.
  const bucketRankByUid = new Map();
  bucketEntries.forEach((e, i) => bucketRankByUid.set(`${e.uid}:${e.corpsClass}`, i + 1));
  const userRank = bucketRankByUid.get(`${entry.uid}:${entry.corpsClass}`) || null;

  return picks.map((rival) => ({
    uid: rival.uid,
    username: rival.username,
    corpsName: rival.corpsName,
    corpsClass: rival.corpsClass,
    score: rival.score,
    scoreDelta: Number((rival.score - entry.score).toFixed(3)),
    avatarUrl: rival.avatarUrl,
    bucketRank: bucketRankByUid.get(`${rival.uid}:${rival.corpsClass}`) || null,
    userBucketRank: userRank,
  }));
}

async function updateRivalsLogic() {
  const db = getDb();
  const namespace = dataNamespaceParam.value();
  logger.info("Computing rivals for all users…");

  const usersRef = db.collection(`artifacts/${namespace}/users`);
  const usersSnapshot = await usersRef.select().get();
  if (usersSnapshot.empty) {
    logger.info("No users found; skipping rivals computation.");
    return { processed: 0 };
  }

  const userIds = usersSnapshot.docs.map((d) => d.id);
  const profileRefs = usersSnapshot.docs.map((d) =>
    d.ref.collection("profile").doc("data"),
  );

  // Batch-fetch profiles (Admin SDK getAll caps at 500).
  const profileDocs = [];
  for (let i = 0; i < profileRefs.length; i += 500) {
    const chunk = profileRefs.slice(i, i + 500);
    const docs = await db.getAll(...chunk);
    profileDocs.push(...docs);
  }

  const byBucket = indexCorpsByBucket(profileDocs, userIds);
  logger.info(
    `Indexed corps: soundSport=${byBucket.soundSport.length}, competitive=${byBucket.competitive.length}`,
  );

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
    const ref = db.doc(`artifacts/${namespace}/users/${uid}/profile/data`);
    batch.set(
      ref,
      { rivals, rivalsUpdatedAt: updatedAt },
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
  },
  async () => {
    logger.info("Starting scheduled rivals update");
    await updateRivalsLogic();
    logger.info("Completed scheduled rivals update");
  },
);

exports.updateRivalsNow = onCall({ cors: true }, async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Authentication required");
  }
  const db = getDb();
  const callerProfile = await db
    .doc(`artifacts/${dataNamespaceParam.value()}/users/${request.auth.uid}/profile/data`)
    .get();
  if (!callerProfile.exists || callerProfile.data().role !== "admin") {
    throw new HttpsError("permission-denied", "Admin access required");
  }
  const result = await updateRivalsLogic();
  return { success: true, ...result };
});

module.exports = {
  scheduledRivalsUpdate: exports.scheduledRivalsUpdate,
  updateRivalsNow: exports.updateRivalsNow,
};
