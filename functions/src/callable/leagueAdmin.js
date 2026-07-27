/**
 * Commissioner controls that did not exist.
 *
 * A league was immutable from the moment it was created: there was no
 * `updateLeague*` callable anywhere in the backend, so a commissioner could not
 * fix a typo in the name, rewrite the description, flip the league between
 * public and private, or raise `maxMembers` when the league got popular. The
 * "Commissioner Settings" tab was a read-only display with one button on it.
 *
 * And there was no way to hand a league over. Every commissioner gate is
 * `creatorId === uid`, so the only exits were "run it forever" or "leave and
 * orphan it" (leaveLeague now auto-promotes, but a deliberate handover should
 * not require the commissioner to quit).
 *
 * Both are logged to the league activity feed. Commissioner powers change what
 * a league is; members are entitled to see that happen, for the same reason
 * removeLeagueMember has always been logged.
 */

const { onCall, HttpsError } = require("firebase-functions/v2/https");
const admin = require("firebase-admin");
const { logger } = require("firebase-functions/v2");
const { getDb } = require("../config");
const { paths } = require("../helpers/paths");
const { assertAuth, hasAdminClaim, assertWriteBudget, assertDocId } = require("../helpers/callableGuards");
const { createLeagueActivity } = require("../helpers/leagueHelpers");
const { createUserNotification } = require("../helpers/userNotifications");
const {
  isLeagueCommissioner,
  isLeagueOwner,
  MAX_CO_COMMISSIONERS,
} = require("../helpers/leaguePermissions");

const MAX_NAME_LENGTH = 50;
const MIN_NAME_LENGTH = 3;
const MAX_DESCRIPTION_LENGTH = 500;
/** A pinned note sits above everything else, so it stays short by design. */
const MAX_ANNOUNCEMENT_LENGTH = 280;
const MIN_MAX_MEMBERS = 2;
const MAX_MAX_MEMBERS = 50;

/** League "vibe" tags, the taxonomy the discovery cards already render. */
const LEAGUE_TAGS = ["competitive", "casual", "roleplay", "dynasty"];

/**
 * Validate the client's patch and return only the fields that actually change.
 *
 * Pure so the rules can be unit-tested without Firestore. Whitelisted keys
 * only — never spread a client object into a stored document.
 *
 * @param {Object} patch - client-supplied settings
 * @param {Object} league - the current league document data
 * @returns {{updates: Object, changes: Array<{field: string, from: *, to: *}>}}
 */
function buildLeagueSettingsUpdate(patch, league) {
  const updates = {};
  const changes = [];
  const note = (field, from, to) => {
    if (from === to) return;
    changes.push({ field, from: from ?? null, to });
  };

  if (patch.name !== undefined) {
    if (typeof patch.name !== "string") {
      throw new HttpsError("invalid-argument", "League name must be text.");
    }
    const name = patch.name.trim();
    if (name.length < MIN_NAME_LENGTH) {
      throw new HttpsError(
        "invalid-argument",
        `League name must be at least ${MIN_NAME_LENGTH} characters long.`
      );
    }
    if (name.length > MAX_NAME_LENGTH) {
      throw new HttpsError(
        "invalid-argument",
        `League name must be ${MAX_NAME_LENGTH} characters or fewer.`
      );
    }
    if (name !== league.name) {
      updates.name = name;
      note("name", league.name, name);
    }
  }

  if (patch.description !== undefined) {
    if (typeof patch.description !== "string" || patch.description.length > MAX_DESCRIPTION_LENGTH) {
      throw new HttpsError(
        "invalid-argument",
        `League description must be text of ${MAX_DESCRIPTION_LENGTH} characters or fewer.`
      );
    }
    const description = patch.description.trim();
    if (description !== league.description) {
      updates.description = description;
      note("description", league.description, description);
    }
  }

  if (patch.isPublic !== undefined) {
    if (typeof patch.isPublic !== "boolean") {
      throw new HttpsError("invalid-argument", "Visibility must be true or false.");
    }
    if (patch.isPublic !== league.isPublic) {
      updates.isPublic = patch.isPublic;
      note("isPublic", league.isPublic, patch.isPublic);
    }
  }

  if (patch.maxMembers !== undefined) {
    if (
      !Number.isInteger(patch.maxMembers) ||
      patch.maxMembers < MIN_MAX_MEMBERS ||
      patch.maxMembers > MAX_MAX_MEMBERS
    ) {
      throw new HttpsError(
        "invalid-argument",
        `Max members must be a whole number between ${MIN_MAX_MEMBERS} and ${MAX_MAX_MEMBERS}.`
      );
    }
    // Never below the current roster: a cap that has already been exceeded
    // would make the league permanently "full" while showing an impossible
    // count, and would strand any pending invitation.
    const roster = (league.members || []).length;
    if (patch.maxMembers < roster) {
      throw new HttpsError(
        "failed-precondition",
        `This league already has ${roster} members, so the cap cannot be set below ${roster}.`
      );
    }
    if (patch.maxMembers !== league.maxMembers) {
      updates.maxMembers = patch.maxMembers;
      note("maxMembers", league.maxMembers, patch.maxMembers);
    }
  }

  if (patch.tag !== undefined) {
    if (patch.tag !== null && !LEAGUE_TAGS.includes(patch.tag)) {
      throw new HttpsError(
        "invalid-argument",
        `League type must be one of: ${LEAGUE_TAGS.join(", ")}.`
      );
    }
    if (patch.tag !== league.tag) {
      updates.tag = patch.tag;
      note("tag", league.tag, patch.tag);
    }
  }

  if (patch.finalsSize !== undefined) {
    if (!Number.isInteger(patch.finalsSize) || patch.finalsSize < 1 || patch.finalsSize > MAX_MAX_MEMBERS) {
      throw new HttpsError(
        "invalid-argument",
        `Finals size must be a whole number between 1 and ${MAX_MAX_MEMBERS}.`
      );
    }
    if (patch.finalsSize !== league.settings?.finalsSize) {
      updates["settings.finalsSize"] = patch.finalsSize;
      note("finalsSize", league.settings?.finalsSize, patch.finalsSize);
    }
  }

  if (patch.announcement !== undefined) {
    if (patch.announcement !== null && typeof patch.announcement !== "string") {
      throw new HttpsError("invalid-argument", "An announcement must be text.");
    }
    const announcement = patch.announcement === null ? null : patch.announcement.trim();
    if (announcement && announcement.length > MAX_ANNOUNCEMENT_LENGTH) {
      throw new HttpsError(
        "invalid-argument",
        `An announcement must be ${MAX_ANNOUNCEMENT_LENGTH} characters or fewer.`
      );
    }
    const next = announcement || null;
    if (next !== (league.announcement?.text ?? null)) {
      updates.announcement = next ? { text: next } : null;
      note("announcement", league.announcement?.text ?? null, next);
    }
  }

  // Deliberately NOT editable: entryFee. The pool is escrow — every member
  // paid the fee that was advertised when they joined, and the removal refund
  // is clamped to it. Changing it mid-season would let a commissioner alter
  // what members already paid for.

  return { updates, changes };
}

exports.updateLeagueSettings = onCall({ cors: true }, async (request) => {
  assertAuth(request);
  const { leagueId, settings } = request.data || {};
  const uid = request.auth.uid;

  if (!leagueId || typeof settings !== "object" || settings === null || Array.isArray(settings)) {
    throw new HttpsError("invalid-argument", "A league ID and a settings object are required.");
  }
  assertDocId(leagueId, "league ID");

  const db = getDb();
  await assertWriteBudget(db, uid, "leagueAdmin", { max: 40 });

  const leagueRef = db.doc(paths.league(leagueId));
  const leagueDoc = await leagueRef.get();
  if (!leagueDoc.exists) throw new HttpsError("not-found", "League not found.");

  const league = leagueDoc.data();
  if (!isLeagueCommissioner(league, uid) && !hasAdminClaim(request)) {
    throw new HttpsError("permission-denied", "Only a commissioner can change league settings.");
  }

  const { updates, changes } = buildLeagueSettingsUpdate(settings, league);
  if (changes.length === 0) {
    return { success: true, changed: 0, message: "Nothing to change." };
  }

  // The announcement carries who pinned it and when — a note with no author is
  // just text on the page, and members should be able to tell a stale pin from
  // a fresh one.
  if (updates.announcement) {
    updates.announcement = {
      ...updates.announcement,
      setBy: uid,
      setAt: admin.firestore.FieldValue.serverTimestamp(),
    };
  }

  await leagueRef.update(updates);

  await createLeagueActivity(db, leagueId, {
    type: "settings_changed",
    title: "League Settings Updated",
    message: `The commissioner updated: ${changes.map((c) => c.field).join(", ")}.`,
    userId: uid,
    metadata: { changes },
  });

  logger.info(`Commissioner ${uid} updated league ${leagueId}: ${changes.map((c) => c.field).join(", ")}`);
  return { success: true, changed: changes.length, message: "League settings updated." };
});

exports.transferCommissioner = onCall({ cors: true }, async (request) => {
  assertAuth(request);
  const { leagueId, newCommissionerUid } = request.data || {};
  const uid = request.auth.uid;

  if (!leagueId || !newCommissionerUid) {
    throw new HttpsError(
      "invalid-argument",
      "A league ID and the new commissioner's ID are required."
    );
  }
  assertDocId(leagueId, "league ID");

  const db = getDb();
  await assertWriteBudget(db, uid, "leagueAdmin", { max: 10, windowMs: 60 * 60 * 1000 });

  const leagueRef = db.doc(paths.league(leagueId));

  const leagueName = await db.runTransaction(async (transaction) => {
    const leagueDoc = await transaction.get(leagueRef);
    if (!leagueDoc.exists) throw new HttpsError("not-found", "League not found.");
    const league = leagueDoc.data();

    // Owner-only, deliberately: a co-commissioner who could transfer ownership
    // could hand the league to themselves and lock the owner out.
    if (!isLeagueOwner(league, uid) && !hasAdminClaim(request)) {
      throw new HttpsError(
        "permission-denied",
        "Only the league owner can hand the league over."
      );
    }
    if (newCommissionerUid === league.creatorId) {
      throw new HttpsError("failed-precondition", "That director is already the commissioner.");
    }
    // The new commissioner must be IN the league. Handing it to an outsider
    // recreates exactly the orphaned-league state this endpoint exists to fix.
    if (!(league.members || []).includes(newCommissionerUid)) {
      throw new HttpsError(
        "failed-precondition",
        "The new commissioner must be a member of this league."
      );
    }

    transaction.update(leagueRef, { creatorId: newCommissionerUid });
    return league.name || "your league";
  });

  const [successorDoc, previousDoc] = await Promise.all([
    db.doc(paths.userProfile(newCommissionerUid)).get(),
    db.doc(paths.userProfile(uid)).get(),
  ]);
  const successorName = successorDoc.exists
    ? successorDoc.data().displayName || successorDoc.data().username || "A director"
    : "A director";
  const previousName = previousDoc.exists
    ? previousDoc.data().displayName || previousDoc.data().username || "The commissioner"
    : "The commissioner";

  await createLeagueActivity(db, leagueId, {
    type: "commissioner_changed",
    title: "New Commissioner",
    message: `${previousName} handed the league over to ${successorName}.`,
    userId: uid,
    metadata: { previousCommissioner: uid, newCommissioner: newCommissionerUid },
  });

  await createUserNotification(db, newCommissionerUid, {
    leagueId,
    leagueName,
    type: "commissioner_changed",
    title: "You're the Commissioner",
    message: `${previousName} made you commissioner of ${leagueName}.`,
  });

  logger.info(`League ${leagueId} commissioner transferred from ${uid} to ${newCommissionerUid}.`);
  return { success: true, message: `${successorName} is now the commissioner.` };
});

module.exports.buildLeagueSettingsUpdate = buildLeagueSettingsUpdate;
module.exports.LEAGUE_TAGS = LEAGUE_TAGS;

/**
 * Add or remove a co-commissioner.
 *
 * Owner-only. A co-commissioner who could appoint other co-commissioners, or
 * remove the ones already there, could take the league over from the inside —
 * which is exactly the failure mode sharing the job is meant to avoid.
 */
exports.setCoCommissioner = onCall({ cors: true }, async (request) => {
  assertAuth(request);
  const { leagueId, memberId, grant } = request.data || {};
  const uid = request.auth.uid;

  if (!leagueId || !memberId || typeof grant !== "boolean") {
    throw new HttpsError(
      "invalid-argument",
      "A league ID, a member ID, and grant (boolean) are required."
    );
  }
  assertDocId(leagueId, "league ID");

  const db = getDb();
  await assertWriteBudget(db, uid, "leagueAdmin", { max: 20 });

  const leagueRef = db.doc(paths.league(leagueId));

  const outcome = await db.runTransaction(async (transaction) => {
    const leagueDoc = await transaction.get(leagueRef);
    if (!leagueDoc.exists) throw new HttpsError("not-found", "League not found.");
    const league = leagueDoc.data();

    if (!isLeagueOwner(league, uid) && !hasAdminClaim(request)) {
      throw new HttpsError(
        "permission-denied",
        "Only the league owner can change who the commissioners are."
      );
    }
    if (memberId === league.creatorId) {
      throw new HttpsError(
        "failed-precondition",
        "The league owner already has every commissioner power."
      );
    }
    if (!(league.members || []).includes(memberId)) {
      throw new HttpsError(
        "failed-precondition",
        "A commissioner has to be a member of the league."
      );
    }

    const existing = Array.isArray(league.commissioners) ? league.commissioners : [];
    const alreadyHas = existing.includes(memberId);
    if (grant === alreadyHas) {
      return { changed: false, grant };
    }
    if (grant && existing.length >= MAX_CO_COMMISSIONERS) {
      throw new HttpsError(
        "failed-precondition",
        `A league can have at most ${MAX_CO_COMMISSIONERS} co-commissioners.`
      );
    }

    transaction.update(leagueRef, {
      commissioners: grant
        ? admin.firestore.FieldValue.arrayUnion(memberId)
        : admin.firestore.FieldValue.arrayRemove(memberId),
    });
    return { changed: true, grant, leagueName: league.name || "your league" };
  });

  if (!outcome.changed) {
    return { success: true, changed: false, message: "Nothing to change." };
  }

  const memberDoc = await db.doc(paths.userProfile(memberId)).get();
  const memberName = memberDoc.exists
    ? memberDoc.data().displayName || memberDoc.data().username || "A director"
    : "A director";

  // Logged like every other commissioner action — members are entitled to see
  // who gained or lost power over their league.
  await createLeagueActivity(db, leagueId, {
    type: "commissioner_changed",
    title: outcome.grant ? "New Co-Commissioner" : "Co-Commissioner Removed",
    message: outcome.grant
      ? `${memberName} is now a co-commissioner.`
      : `${memberName} is no longer a co-commissioner.`,
    userId: uid,
    metadata: { memberId, grant: outcome.grant },
  });

  if (outcome.grant) {
    await createUserNotification(db, memberId, {
      leagueId,
      leagueName: outcome.leagueName,
      type: "commissioner_changed",
      title: "You're a Co-Commissioner",
      message: `You can now help run ${outcome.leagueName}.`,
    });
  }

  logger.info(
    `League ${leagueId}: ${uid} ${outcome.grant ? "granted" : "revoked"} co-commissioner for ${memberId}.`
  );
  return {
    success: true,
    changed: true,
    message: outcome.grant
      ? `${memberName} is now a co-commissioner.`
      : `${memberName} is no longer a co-commissioner.`,
  };
});
