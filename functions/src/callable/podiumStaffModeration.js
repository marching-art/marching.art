/**
 * Admin moderation of Podium staff names (helpers/podium/staffNames.js).
 *
 *   listPodiumStaffNames     — page through the game-wide registry (newest
 *                              first, or a canonical-prefix search) so an
 *                              admin can review what directors have named
 *                              their staff.
 *   moderatePodiumStaffName  — act on one director:
 *       clear   remove an inappropriate name (registry doc deleted, staffer
 *               goes back to their role, director notified) and record a
 *               STRIKE; STRIKES_TO_REVOKE strikes revoke naming automatically.
 *       revoke  turn naming off for the director outright (also clears
 *               every name they currently hold).
 *       restore turn naming back on (strikes are kept on the record).
 *
 * All admin-only, audited (by + at on the profile's moderation.staffNaming),
 * and reversible: a clear never touches the staffer's tenure or contract.
 */

const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { logger } = require("firebase-functions/v2");
const { getDb } = require("../config");
const { assertAdmin, assertDocId } = require("../helpers/callableGuards");
const { createUserNotification } = require("../helpers/userNotifications");
const store = require("../helpers/podium/store");
const staffNames = require("../helpers/podium/staffNames");

const MAX_REASON = 300;
const PAGE_MAX = 100;
const ACTIONS = ["clear", "revoke", "restore"];

/** @param {unknown} raw */
function reasonOf(raw) {
  return typeof raw === "string" ? raw.trim().slice(0, MAX_REASON) : "";
}

/** A registry doc as the admin list shows it. */
function rowOf(doc) {
  const data = doc.data() || {};
  return {
    key: doc.id,
    name: data.name || null,
    uid: data.uid || null,
    staffId: data.staffId || null,
    specialty: data.specialty || null,
    corpsName: data.corpsName || null,
    claimedAt: data.claimedAt || null,
  };
}

/**
 * Page the registry. request.data: { limit?, search?, cursor? }. `search`
 * matches the canonical key prefix (so "jt" finds "J.T. Smith"); without it
 * the newest claims come first. `cursor` is the last row's key (search) or
 * claimedAt (default order) from the previous page.
 */
exports.listPodiumStaffNames = onCall({ cors: true }, async (request) => {
  assertAdmin(request);
  const db = getDb();
  const limit = Math.min(PAGE_MAX, Math.max(1, Number(request.data?.limit) || 50));
  const search = staffNames.keyFor(typeof request.data?.search === "string" ? request.data.search : "");
  const cursor = typeof request.data?.cursor === "string" ? request.data.cursor : null;

  let query = db.collection(staffNames.COLLECTION);
  if (search) {
    query = query.orderBy("key").startAt(search).endAt(`${search}\uf8ff`);
    if (cursor) query = query.startAfter(cursor);
  } else {
    query = query.orderBy("claimedAt", "desc");
    if (cursor) query = query.startAfter(cursor);
  }
  const snapshot = await query.limit(limit + 1).get();
  const docs = snapshot.docs.slice(0, limit);
  const rows = docs.map(rowOf);
  const last = rows[rows.length - 1];
  return {
    success: true,
    names: rows,
    nextCursor: snapshot.docs.length > limit && last ? (search ? last.key : last.claimedAt) : null,
  };
});

/**
 * Clear every name a director's current roster holds (registry docs deleted,
 * members un-named) in one transaction. Optionally restricted to one staffId.
 * Returns the names cleared. A missing/stale roster clears nothing — an
 * orphaned registry doc (claim with no matching staffer) is deleted when it
 * is the one the admin targeted by `key`.
 */
async function clearNames(db, uid, { staffId = null, key = null } = {}) {
  const sRef = store.stateRef(db, uid);
  return db.runTransaction(async (transaction) => {
    const orphanRef = key ? staffNames.nameRef(db, key) : null;
    const [snapshot, orphanSnapshot] = await Promise.all([
      transaction.get(sRef),
      orphanRef ? transaction.get(orphanRef) : Promise.resolve(null),
    ]);
    const state = snapshot.exists ? snapshot.data() : null;
    const roster = state && state.staff ? state.staff : {};
    const targets = Object.entries(roster).filter(
      ([, m]) => m && m.name && (!staffId || m.id === staffId)
    );
    const plan = staffNames.planRelease(
      db,
      targets.map(([, m]) => m)
    );
    const planSnapshots = await Promise.all(plan.map((e) => transaction.get(e.ref)));
    staffNames.applyRelease(transaction, plan, planSnapshots);
    const cleared = [];
    for (const [specialty, member] of targets) {
      cleared.push({ staffId: member.id, specialty, name: member.name });
      const { name: _name, nameKey: _nameKey, ...rest } = member;
      roster[specialty] = rest;
    }
    if (cleared.length > 0) {
      transaction.set(sRef, { staff: roster, updatedAt: new Date().toISOString() }, { merge: true });
    }
    // The targeted registry doc is gone either way: if the roster no longer
    // carries the staffer (released since the admin loaded the list, or a
    // claim left behind by an older write), delete the stray claim so the
    // name is free again.
    if (orphanSnapshot && orphanSnapshot.exists) {
      const claim = orphanSnapshot.data() || {};
      const stillPlanned = plan.some((e) => e.ref.path === orphanRef.path);
      if (!stillPlanned && claim.uid === uid) {
        transaction.delete(orphanRef);
        if (cleared.length === 0) {
          cleared.push({ staffId: claim.staffId || null, specialty: claim.specialty || null, name: claim.name || null, orphan: true });
        }
      }
    }
    return cleared;
  });
}

/**
 * Act on a director's staff names. request.data:
 *   { uid, action: "clear" | "revoke" | "restore", staffId?, key?, reason? }
 * `clear` targets one staffer (staffId, and/or the registry key from the
 * list) — a strike; `revoke` clears everything they hold and disables
 * naming; `restore` re-enables it.
 */
exports.moderatePodiumStaffName = onCall({ cors: true }, async (request) => {
  const adminUid = assertAdmin(request);
  const uid = assertDocId(request.data?.uid, "uid");
  const action = request.data?.action;
  if (!ACTIONS.includes(action)) {
    throw new HttpsError("invalid-argument", `action must be one of ${ACTIONS.join(", ")}.`);
  }
  const reason = reasonOf(request.data?.reason);
  const staffId = typeof request.data?.staffId === "string" && request.data.staffId ? request.data.staffId : null;
  const key = typeof request.data?.key === "string" ? staffNames.keyFor(request.data.key) : null;
  if (action === "clear" && !staffId && !key) {
    throw new HttpsError("invalid-argument", "clear needs the staffId or the registry key.");
  }

  const db = getDb();
  const profileRef = store.profileRef(db, uid);
  const profileSnapshot = await profileRef.get();
  if (!profileSnapshot.exists) {
    throw new HttpsError("not-found", "No such director profile.");
  }

  let cleared = [];
  if (action === "clear" || action === "revoke") {
    cleared = await clearNames(db, uid, action === "clear" ? { staffId, key } : {});
    if (action === "clear" && cleared.length === 0) {
      throw new HttpsError("not-found", "That staffer no longer carries a name.");
    }
  }

  // The privilege record: a clear is a strike (auto-revokes at the
  // threshold); revoke/restore are explicit. Re-read inside the update so
  // two admins acting at once don't lose a strike.
  const privilege = await db.runTransaction(async (transaction) => {
    const fresh = await transaction.get(profileRef);
    const profile = fresh.exists ? fresh.data() : {};
    let next;
    if (action === "clear") {
      next = staffNames.strike(profile, {
        name: cleared[0].name,
        staffId: cleared[0].staffId,
        reason: reason || null,
        by: adminUid,
      });
    } else {
      next = staffNames.setRevoked(profile, {
        revoked: action === "revoke",
        reason: reason || null,
        by: adminUid,
      });
    }
    transaction.set(profileRef, { moderation: { staffNaming: next } }, { merge: true });
    return next;
  });

  // Tell the director what happened and why (never fails the action).
  const clearedNames = cleared.map((c) => c.name).filter(Boolean);
  if (action === "restore") {
    await createUserNotification(db, uid, {
      type: "staff_naming_restored",
      title: "Staff naming restored",
      message: "You can name your Podium staff again. Keep it appropriate — repeat removals disable naming for good.",
      link: "/podium",
      dedupeKey: `staff_naming_restored_${Date.now()}`,
    });
  } else {
    const which = clearedNames.length ? ` (${clearedNames.map((n) => `"${n}"`).join(", ")})` : "";
    await createUserNotification(db, uid, {
      type: "staff_name_removed",
      title: privilege.revoked ? "Staff naming disabled" : "A staff name was removed",
      message: privilege.revoked
        ? `An admin removed your staff name${clearedNames.length > 1 ? "s" : ""}${which} and disabled staff naming on your account` +
          (privilege.reason ? `: ${privilege.reason}` : "") +
          ". Your staff keep working under their roles."
        : `An admin removed your staff name${which}` +
          (reason ? ` — ${reason}` : "") +
          `. That's strike ${privilege.strikes} of ${staffNames.STRIKES_TO_REVOKE}; at ${staffNames.STRIKES_TO_REVOKE}, staff naming is disabled on your account.`,
      link: "/podium",
      dedupeKey: `staff_name_${action}_${Date.now()}`,
    });
  }

  logger.info(
    `[podium] staff-name ${action} on ${uid} by admin ${adminUid}` +
      (clearedNames.length ? ` cleared ${clearedNames.join(", ")}` : "") +
      (reason ? ` (${reason})` : "") +
      ` — strikes ${privilege.strikes}, revoked ${privilege.revoked}`
  );
  return {
    success: true,
    uid,
    action,
    cleared,
    staffNaming: {
      revoked: privilege.revoked,
      strikes: privilege.strikes,
      reason: privilege.reason || null,
    },
  };
});

/**
 * Give back every name a director's staff hold — for account deletion, where
 * the roster doc itself is about to go. Query-based (no roster read), never
 * throws.
 * @param {FirebaseFirestore.Firestore} db
 * @param {string} uid
 * @returns {Promise<number>} claims deleted
 */
async function releaseAllStaffNamesFor(db, uid) {
  try {
    const snapshot = await db.collection(staffNames.COLLECTION).where("uid", "==", uid).get();
    if (snapshot.empty) return 0;
    const batch = db.batch();
    snapshot.docs.forEach((doc) => batch.delete(doc.ref));
    await batch.commit();
    return snapshot.size;
  } catch (error) {
    logger.warn(`[podium] staff-name release on delete failed for ${uid}: ${error.message}`);
    return 0;
  }
}

module.exports.releaseAllStaffNamesFor = releaseAllStaffNamesFor;
