// Buy Me a Coffee supporter callables + webhook.
//
// Flow: BMAC hosts the payment → BMAC notifies us (webhook, verified by
// HMAC-SHA256) → we upsert a supporter doc keyed by the hashed payer email →
// the supporter links that email to their marching.art account → we mirror a
// server-only `supporter` tier onto their profile (flair) and list them on the
// public Supporters wall. Discord roles are handled natively by BMAC and never
// touch this code.
//
// Nothing here grants CorpsCoin, XP, unlocks, or any competitive edge — the
// perks are cosmetic recognition only (donation-only, no pay-to-win).

const { onCall, onRequest, HttpsError } = require("firebase-functions/v2/https");
const { logger } = require("firebase-functions/v2");
const { defineSecret } = require("firebase-functions/params");
const { getDb } = require("../config");
const { paths } = require("../helpers/paths");
const { assertAuth } = require("../helpers/callableGuards");
const {
  hashEmail,
  parseSupporterEvent,
  parseOneTimeEvent,
  verifyWebhookSignature,
  SUPPORTER_TIERS,
  TIER_RANK,
} = require("../helpers/bmacSupporters");
const {
  applyActiveSupport,
  applyInactiveSupport,
  applyOneTimeSupport,
  revokeOneTimeSupport,
  buildProfileSupporter,
} = require("../helpers/supporterStore");
const { sanitizeBannerMessage } = require("../helpers/prestigeCatalog");

const bmacWebhookSecret = defineSecret("BMAC_WEBHOOK_SECRET");

// ---------------------------------------------------------------------------
// Webhook (real-time membership lifecycle)
// ---------------------------------------------------------------------------

/**
 * Public HTTPS endpoint BMAC posts membership events to. Verifies the
 * HMAC-SHA256 signature against the raw body before trusting anything, then
 * upserts / revokes the supporter. Always answers 200 for a verified event
 * (even ones we ignore) so BMAC doesn't retry indefinitely.
 */
exports.bmacWebhook = onRequest(
  { secrets: [bmacWebhookSecret], cors: false },
  async (req, res) => {
    if (req.method !== "POST") {
      res.status(405).send("Method Not Allowed");
      return;
    }

    const signature = req.get("x-signature-sha256");
    const secret = bmacWebhookSecret.value();
    // req.rawBody is the exact bytes BMAC signed; JSON.parse of req.body would
    // re-serialize differently and break verification.
    if (!verifyWebhookSignature(req.rawBody, signature, secret)) {
      logger.warn("BMAC webhook: signature verification failed");
      res.status(401).send("Invalid signature");
      return;
    }

    let body;
    try {
      body =
        req.body && typeof req.body === "object"
          ? req.body
          : JSON.parse(req.rawBody.toString("utf8"));
    } catch (err) {
      logger.warn("BMAC webhook: unparseable body", err.message);
      res.status(400).send("Bad Request");
      return;
    }

    const parsed = parseSupporterEvent(body);
    const oneTime = parsed ? null : parseOneTimeEvent(body);
    if (!parsed && !oneTime) {
      // Verified but not a support lifecycle event we act on.
      res.status(200).send("Ignored");
      return;
    }

    try {
      const db = getDb();
      if (parsed) {
        // Recurring membership / monthly support.
        if (parsed.active && parsed.tier) {
          await applyActiveSupport(db, parsed);
        } else {
          // Cancelled/paused, or an active plan below the lowest tier floor.
          await applyInactiveSupport(db, parsed.emailHash);
        }
        logger.info("BMAC webhook processed", {
          type: parsed.type,
          tier: parsed.tier,
          active: parsed.active,
        });
      } else {
        // One-time donation → permanent 'friend' recognition.
        if (oneTime.active) {
          await applyOneTimeSupport(db, oneTime);
        } else {
          await revokeOneTimeSupport(db, oneTime.emailHash);
        }
        logger.info("BMAC webhook processed", {
          type: oneTime.type,
          oneTime: oneTime.active,
        });
      }
      res.status(200).send("OK");
    } catch (err) {
      logger.error("BMAC webhook: processing error", err);
      // 500 so BMAC retries — the failure is on our side, not a bad request.
      res.status(500).send("Processing error");
    }
  }
);

// ---------------------------------------------------------------------------
// Link an account to a BMAC support (manual claim)
// ---------------------------------------------------------------------------

/**
 * Bind the signed-in user to the supporter record for the email they donated
 * with (often a PayPal email that differs from their login), then grant flair.
 * Snapshots displayName/username onto the supporter doc so the wall needs no
 * per-row profile reads.
 */
exports.linkBmacSupport = onCall({ cors: true }, async (request) => {
  const uid = assertAuth(request);
  const email = (request.data?.email || "").trim();
  const emailHash = hashEmail(email);
  if (!emailHash) {
    throw new HttpsError("invalid-argument", "Enter the email you supported with.");
  }

  const db = getDb();
  const supporterRef = db.doc(paths.supporter(emailHash));
  const profileRef = db.doc(paths.userProfile(uid));

  try {
    return await db.runTransaction(async (tx) => {
      const [supporterSnap, profileSnap] = await Promise.all([
        tx.get(supporterRef),
        tx.get(profileRef),
      ]);

      if (!supporterSnap.exists || !supporterSnap.data().active) {
        throw new HttpsError(
          "not-found",
          "We couldn't find an active membership for that email. It can take a " +
            "minute after joining — and make sure it's the exact email you paid with."
        );
      }
      const supporter = supporterSnap.data();
      if (supporter.uid && supporter.uid !== uid) {
        throw new HttpsError(
          "already-exists",
          "That support is already linked to another account."
        );
      }

      const profile = profileSnap.exists ? profileSnap.data() : {};
      const displayName = profile.displayName || profile.username || "Director";
      const username = profile.username || null;

      tx.set(
        supporterRef,
        { uid, displayName, username },
        { merge: true }
      );
      tx.set(
        profileRef,
        {
          supporter: buildProfileSupporter({
            tier: supporter.tier,
            emailHash,
            since: supporter.since,
            anonymous: supporter.anonymous ?? false,
            message: supporter.message ?? null,
          }),
        },
        { merge: true }
      );

      logger.info("BMAC support linked", { uid, tier: supporter.tier });
      return { success: true, tier: supporter.tier };
    });
  } catch (err) {
    if (err instanceof HttpsError) throw err;
    logger.error("linkBmacSupport error", err);
    throw new HttpsError("internal", "Couldn't link your support. Try again.");
  }
});

// ---------------------------------------------------------------------------
// Wall preferences
// ---------------------------------------------------------------------------

/** Resolve the caller's linked supporter doc + their profile ref, or throw. */
async function requireLinkedSupporter(db, uid, tx) {
  const profileRef = db.doc(paths.userProfile(uid));
  const profileSnap = await tx.get(profileRef);
  const emailHash = profileSnap.data()?.supporter?.emailHash;
  if (!emailHash) {
    throw new HttpsError("failed-precondition", "Link your support first.");
  }
  const ref = db.doc(paths.supporter(emailHash));
  const snap = await tx.get(ref);
  if (!snap.exists || snap.data().uid !== uid) {
    throw new HttpsError("failed-precondition", "Link your support first.");
  }
  return { ref, data: snap.data(), profileRef };
}

/** Opt out of (or back into) being named on the public Supporters wall. */
exports.setSupporterVisibility = onCall({ cors: true }, async (request) => {
  const uid = assertAuth(request);
  const anonymous = request.data?.anonymous === true;
  const db = getDb();
  await db.runTransaction(async (tx) => {
    const { ref, profileRef } = await requireLinkedSupporter(db, uid, tx);
    tx.set(ref, { anonymous }, { merge: true });
    // Deep-merge keeps the rest of profile.supporter intact.
    tx.set(profileRef, { supporter: { anonymous } }, { merge: true });
  });
  return { success: true, anonymous };
});

/** Set the short message shown beside a Corps Angel on the wall. */
exports.setSupporterMessage = onCall({ cors: true }, async (request) => {
  const uid = assertAuth(request);
  const raw = request.data?.message ?? "";
  const message = raw === "" ? null : sanitizeBannerMessage(raw);
  if (raw !== "" && message === null) {
    throw new HttpsError("invalid-argument", "Keep it to 60 characters, no control characters.");
  }
  const db = getDb();
  await db.runTransaction(async (tx) => {
    const { ref, data, profileRef } = await requireLinkedSupporter(db, uid, tx);
    if (data.tier !== "corps_angel") {
      throw new HttpsError("permission-denied", "A wall message is a Corps Angel perk.");
    }
    tx.set(ref, { message }, { merge: true });
    tx.set(profileRef, { supporter: { message } }, { merge: true });
  });
  return { success: true };
});

// ---------------------------------------------------------------------------
// Public Supporters wall
// ---------------------------------------------------------------------------

/**
 * Return the active supporters for the public wall, highest tier first. Emails
 * and payer names never leave the server — anonymous supporters are counted
 * but unnamed; named supporters expose only displayName/username/message.
 */
exports.getSupportersWall = onCall({ cors: true }, async () => {
  const db = getDb();
  const snap = await db
    .collection(paths.supporters())
    .where("active", "==", true)
    .limit(1000)
    .get();

  let anonymousCount = 0;
  const named = [];
  snap.forEach((doc) => {
    const s = doc.data();
    if (!s.tier || !s.uid) return; // unlinked active supports aren't shown
    if (s.anonymous) {
      anonymousCount += 1;
      return;
    }
    named.push({
      uid: s.uid,
      tier: s.tier,
      displayName: s.displayName || "Director",
      username: s.username || null,
      message: s.tier === "corps_angel" ? s.message || null : null,
    });
  });

  named.sort(
    (a, b) =>
      (TIER_RANK[b.tier] ?? -1) - (TIER_RANK[a.tier] ?? -1) ||
      (a.displayName || "").localeCompare(b.displayName || "")
  );

  return {
    supporters: named,
    anonymousCount,
    tiers: SUPPORTER_TIERS,
  };
});
