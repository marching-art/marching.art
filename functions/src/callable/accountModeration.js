// Account-level moderation — the enforcement counterpart to the integrity
// signals dashboard (helpers/integrityStats.js). Where that job surfaces
// likely alt/abuse clusters, this lets an admin ACT on a confirmed one by
// restricting the account from the zero-sum surfaces (Showcase entries/votes,
// league prediction pools, daily predictions) via the moderation.restricted
// profile field the assertNotRestricted guard reads.
//
// Deliberately a soft, reversible restriction, not a ban: the account keeps
// its identity, cosmetics, and read access; only the farmable/collusion-prone
// actions are blocked. Admin-only, audited (by + at), and flippable back off —
// so a false call is a one-click undo, never a locked-out director.

const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { logger } = require("firebase-functions/v2");
const { getDb } = require("../config");
const { paths } = require("../helpers/paths");
const { assertAdmin, assertDocId } = require("../helpers/callableGuards");

const MAX_REASON = 500;

/**
 * Restrict or un-restrict an account from the zero-sum surfaces.
 * Admin-only. request.data: { uid, restricted, reason? }.
 */
exports.setAccountRestriction = onCall(async (request) => {
  const adminUid = assertAdmin(request);
  const uid = assertDocId(request.data?.uid, "uid");
  const restricted = request.data?.restricted === true;
  const reason =
    typeof request.data?.reason === "string" ? request.data.reason.trim().slice(0, MAX_REASON) : "";

  const db = getDb();
  const profileRef = db.doc(paths.userProfile(uid));
  const snap = await profileRef.get();
  if (!snap.exists) {
    throw new HttpsError("not-found", "No such director profile.");
  }

  const moderation = {
    restricted,
    reason: restricted ? reason || null : null,
    by: adminUid,
    at: new Date(),
  };
  await profileRef.set({ moderation }, { merge: true });

  logger.info(
    `Account ${uid} ${restricted ? "restricted" : "unrestricted"} by admin ${adminUid}` +
      (restricted && reason ? ` (${reason})` : "") +
      "."
  );
  return { success: true, uid, restricted };
});
