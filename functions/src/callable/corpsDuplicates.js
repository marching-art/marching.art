// Duplicate-corps-name detection and admin sweep. Extracted from callable/corps.js.

const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { getDb, dataNamespaceParam } = require("../config");
const admin = require("firebase-admin");
const { logger } = require("firebase-functions/v2");
const { normalizeCorpsName, pickDuplicateWinner, CORPS_NAME_CLASSES } = require("../helpers/corpsHelpers");
const { assertAuth, assertAdmin } = require("../helpers/callableGuards");

/**
 * Detect corps in this user's profile that must be renamed because they share
 * a name with a higher-priority corps owned by another director. The result
 * comes from the `mustRename` flag the admin sweep writes onto each loser
 * corps. The frontend hard-blocks corps actions while this returns any
 * entries.
 */
exports.detectMyDuplicateCorps = onCall({ cors: true }, async (request) => {
  const uid = assertAuth(request);
  const db = getDb();
  const userProfileRef = db.doc(`artifacts/${dataNamespaceParam.value()}/users/${uid}/profile/data`);

  const profileDoc = await userProfileRef.get();
  if (!profileDoc.exists) {
    return { duplicates: [] };
  }
  const corps = profileDoc.data().corps || {};

  const duplicates = [];
  for (const cls of CORPS_NAME_CLASSES) {
    const c = corps[cls];
    if (c?.mustRename && c?.corpsName) {
      duplicates.push({
        corpsClass: cls,
        corpsName: c.corpsName,
        conflictsWith: c.duplicateConflict || null,
      });
    }
  }

  return { duplicates };
});

/**
 * Admin-only: scan every active corps across all directors, group by
 * normalized name, and flag every corps that is not the per-name winner with
 * `mustRename: true` plus a `duplicateConflict` payload pointing at the
 * winning corps. Idempotent — re-running clears stale flags from corps that
 * no longer conflict.
 *
 * Winner rule: highest class tier (podiumClass > worldClass > openClass >
 * aClass > soundSport). Ties broken by oldest createdAt, then by presence of
 * a corpsnames reservation. Podium ranks top because a Podium corps has no
 * self-service rename flow, so the colliding fantasy corps must be the loser.
 */
exports.sweepDuplicateCorps = onCall({ cors: true, timeoutSeconds: 540 }, async (request) => {
  assertAdmin(request);

  const db = getDb();

  try {
    const profilesSnapshot = await db.collectionGroup("profile").get();

    // Pull every active corps and tag with a stable id we can write back to.
    const allCorps = [];
    for (const profileDoc of profilesSnapshot.docs) {
      const data = profileDoc.data();
      const profileUid = profileDoc.ref.parent.parent?.id;
      if (!profileUid) continue;
      const corps = data.corps || {};
      for (const cls of CORPS_NAME_CLASSES) {
        const c = corps[cls];
        if (c?.corpsName) {
          allCorps.push({
            uid: profileUid,
            profileRef: profileDoc.ref,
            corpsClass: cls,
            corpsName: c.corpsName,
            createdAt: c.createdAt || null,
            hadMustRename: !!c.mustRename,
          });
        }
      }
    }

    // Cross-reference reservations so the tiebreaker can prefer corps that
    // own a corpsnames slot. Read the entire collection — small dataset.
    const reservationsSnap = await db.collection("corpsnames").get();
    const reservationByKey = new Map();
    reservationsSnap.forEach((doc) => {
      reservationByKey.set(doc.id, doc.data());
    });

    const seasonDoc = await db.doc("game-settings/season").get();
    const seasonId = seasonDoc.exists ? (seasonDoc.data().seasonUid || "default") : "default";
    for (const corps of allCorps) {
      const key = `${seasonId}_${normalizeCorpsName(corps.corpsName)}`;
      const reservation = reservationByKey.get(key);
      corps.hasReservation = !!reservation && reservation.uid === corps.uid;
    }

    // Group by normalized name to find collisions.
    const byName = new Map();
    for (const corps of allCorps) {
      const key = normalizeCorpsName(corps.corpsName);
      if (!byName.has(key)) byName.set(key, []);
      byName.get(key).push(corps);
    }

    const winnersByCorps = new Map();
    const losers = [];
    const uidsTouched = new Set();
    for (const [, group] of byName) {
      if (group.length <= 1) continue;
      const winner = pickDuplicateWinner(group);
      for (const corps of group) {
        if (corps === winner) continue;
        winnersByCorps.set(corps, winner);
        losers.push(corps);
        uidsTouched.add(corps.uid);
      }
    }

    // Apply writes in batches: flag losers, clear stale flags from corps that
    // are no longer in conflict.
    let batch = db.batch();
    let batchCount = 0;
    const flushIfFull = async () => {
      if (batchCount >= 400) {
        await batch.commit();
        batch = db.batch();
        batchCount = 0;
      }
    };

    let flagged = 0;
    let cleared = 0;

    for (const loser of losers) {
      const winner = winnersByCorps.get(loser);
      batch.update(loser.profileRef, {
        [`corps.${loser.corpsClass}.mustRename`]: true,
        [`corps.${loser.corpsClass}.duplicateConflict`]: {
          winnerUid: winner.uid,
          winnerCorpsClass: winner.corpsClass,
          winnerCorpsName: winner.corpsName,
          flaggedAt: admin.firestore.FieldValue.serverTimestamp(),
        },
      });
      batchCount++;
      flagged++;
      await flushIfFull();
    }

    // Clear stale `mustRename` flags from corps that no longer have a
    // duplicate (e.g. the conflicting corps was renamed/retired since the
    // last sweep).
    const losersById = new Set(losers.map((l) => `${l.uid}:${l.corpsClass}`));
    for (const corps of allCorps) {
      const id = `${corps.uid}:${corps.corpsClass}`;
      if (corps.hadMustRename && !losersById.has(id)) {
        batch.update(corps.profileRef, {
          [`corps.${corps.corpsClass}.mustRename`]: admin.firestore.FieldValue.delete(),
          [`corps.${corps.corpsClass}.duplicateConflict`]: admin.firestore.FieldValue.delete(),
        });
        batchCount++;
        cleared++;
        await flushIfFull();
      }
    }

    if (batchCount > 0) {
      await batch.commit();
    }

    logger.info(`Duplicate corps sweep: scanned=${allCorps.length} flagged=${flagged} cleared=${cleared} directorsAffected=${uidsTouched.size}`);

    return {
      success: true,
      message: `Sweep complete: ${flagged} flagged, ${cleared} cleared, ${uidsTouched.size} directors affected (scanned ${allCorps.length} corps).`,
      scanned: allCorps.length,
      flagged,
      cleared,
      directorsAffected: uidsTouched.size,
      losers: losers.map((l) => ({
        uid: l.uid,
        corpsClass: l.corpsClass,
        corpsName: l.corpsName,
        winner: {
          uid: winnersByCorps.get(l).uid,
          corpsClass: winnersByCorps.get(l).corpsClass,
          corpsName: winnersByCorps.get(l).corpsName,
        },
      })),
    };
  } catch (error) {
    logger.error("Failed to sweep duplicate corps:", error);
    if (error instanceof HttpsError) throw error;
    throw new HttpsError("internal", `Sweep failed: ${error.message}`);
  }
});

