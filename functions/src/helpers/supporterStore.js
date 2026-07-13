// Firestore write layer for Buy Me a Coffee supporters. Shared by the webhook
// (real-time) and the nightly reconcile job so both apply state identically.
//
// A supporter doc (artifacts/{ns}/supporters/{emailHash}) is the source of
// truth for who supports and at what tier; when it is linked to a marching.art
// account (uid set) we mirror a small server-only `supporter` object onto that
// user's profile so their flair renders. The doc also carries the wall
// preferences (anonymous, message) and a displayName/username snapshot so the
// public wall is a single query with no per-row profile fan-out.

const admin = require("firebase-admin");
const { paths } = require("./paths");

/**
 * The server-only object mirrored onto profile.supporter for flair rendering
 * and the settings panel. Includes the wall preferences (anonymous, message)
 * so the client can show their current state without a second read.
 */
function buildProfileSupporter({ tier, emailHash, since, anonymous = false, message = null }) {
  return {
    tier,
    source: "bmac",
    emailHash,
    since: since ?? null,
    anonymous: anonymous === true,
    message: tier === "corps_angel" ? message ?? null : null,
  };
}

/**
 * Upsert an active supporter and, if the doc is already linked to a user,
 * refresh their profile flair. Preserves link + wall preferences across
 * updates.
 * @param {FirebaseFirestore.Firestore} db
 * @param {object} parsed output of parseSupporterEvent (active)
 */
async function applyActiveSupport(db, parsed) {
  const ref = db.doc(paths.supporter(parsed.emailHash));
  await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const existing = snap.exists ? snap.data() : null;
    const now = admin.firestore.FieldValue.serverTimestamp();
    const since = existing?.since ?? now;

    tx.set(
      ref,
      {
        emailHash: parsed.emailHash,
        email: parsed.email,
        payerName: parsed.payerName || existing?.payerName || "",
        tier: parsed.tier,
        coffeeAmount: parsed.monthlyAmount,
        currency: parsed.currency || "USD",
        levelName: parsed.levelName ?? existing?.levelName ?? null,
        active: true,
        anonymous: existing?.anonymous ?? false,
        message: existing?.message ?? null,
        uid: existing?.uid ?? null,
        displayName: existing?.displayName ?? null,
        username: existing?.username ?? null,
        lastEventId: parsed.eventId ?? existing?.lastEventId ?? null,
        since,
        createdAt: existing?.createdAt ?? now,
        updatedAt: now,
      },
      { merge: true }
    );

    if (existing?.uid) {
      tx.set(
        db.doc(paths.userProfile(existing.uid)),
        {
          supporter: buildProfileSupporter({
            tier: parsed.tier,
            emailHash: parsed.emailHash,
            since,
            anonymous: existing?.anonymous ?? false,
            message: existing?.message ?? null,
          }),
        },
        { merge: true }
      );
    }
  });
}

/**
 * Mark a supporter inactive (cancelled/paused/expired) and strip the linked
 * user's flair. The doc is kept for history and to preserve their wall
 * preferences if they resubscribe.
 * @param {FirebaseFirestore.Firestore} db
 * @param {string} emailHash
 */
async function applyInactiveSupport(db, emailHash) {
  const ref = db.doc(paths.supporter(emailHash));
  await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) return;
    const existing = snap.data();
    tx.set(
      ref,
      { active: false, tier: null, updatedAt: admin.firestore.FieldValue.serverTimestamp() },
      { merge: true }
    );
    if (existing.uid) {
      tx.set(
        db.doc(paths.userProfile(existing.uid)),
        { supporter: null },
        { merge: true }
      );
    }
  });
}

module.exports = {
  buildProfileSupporter,
  applyActiveSupport,
  applyInactiveSupport,
};
