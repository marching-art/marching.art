// =============================================================================
// DESIGN EXCHANGE — the opt-in uniform gallery (docs/UNIFORM_STUDIO.md §7.3)
// =============================================================================
// Publish a saved wardrobe design to a world-readable gallery; browse is a
// direct Firestore read (rules: public read, callable-only writes). Likes and
// save-a-copy carry counters on the entry plus per-user marker docs so both
// stay one-per-user; unique saves pay the creator a small CorpsCoin reward,
// hard-capped per day (a faucet — capped and instrumented with its own
// economyStats transaction type). Entries carry a report button; repeated
// reports surface entries for the admin takedown callable.
//
// An entry is the same pure-structured snapshot a uniform code carries:
// {schema, name, colorway, figure} — validated at publish, never aiHints
// (private prompt prose stays private).

const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { logger } = require("firebase-functions/v2");
const { FieldValue } = require("firebase-admin/firestore");
const { getDb } = require("../config");
const { paths } = require("../helpers/paths");
const {
  assertAuth,
  assertAdmin,
  assertWriteBudget,
} = require("../helpers/callableGuards");
const {
  addCoinHistoryEntryToTransaction,
  TRANSACTION_TYPES,
} = require("../helpers/economy");
const {
  DESIGN_ID_RE,
  MAX_WARDROBE_DESIGNS,
  validateDesign,
  sanitizeDesign,
} = require("../helpers/uniformValidation");
const { missingPacksFor, missingPacksMessage } = require("../helpers/uniformEntitlements");

// Entry ids are `${creatorUid}_${designId}` — deterministic, so re-publishing
// a design updates its entry instead of duplicating it.
const ENTRY_ID_RE = /^[A-Za-z0-9_-]{1,160}$/;

/** Creator reward per unique save, and the per-creator daily faucet cap. */
const EXCHANGE_SAVE_REWARD = 10;
const EXCHANGE_DAILY_CAP = 100;

/** Max designs one director can have published at once. */
const MAX_PUBLISHED_PER_USER = 10;

const MAX_REPORT_REASON = 200;

/** @param {import("firebase-functions/v2/https").CallableRequest} request */
function entryIdFrom(request) {
  const { entryId } = request.data || {};
  if (!entryId || !ENTRY_ID_RE.test(String(entryId))) {
    throw new HttpsError("invalid-argument", "Invalid gallery entry id.");
  }
  return String(entryId);
}

/** UTC day stamp for the payout ledger, e.g. "2026-08-26". */
const dayStamp = () => new Date().toISOString().slice(0, 10);

/**
 * Publish (or refresh) one of the caller's saved designs to the gallery.
 * Re-publishing the same design updates the snapshot in place and keeps its
 * counters.
 */
const publishUniformDesign = onCall({ cors: true }, async (request) => {
  const uid = assertAuth(request);
  const { designId } = request.data || {};
  if (!designId || !DESIGN_ID_RE.test(String(designId))) {
    throw new HttpsError("invalid-argument", "Invalid design id.");
  }

  const db = getDb();
  await assertWriteBudget(db, uid, "designExchange");

  const designDoc = await db.doc(paths.userWardrobeDesign(uid, String(designId))).get();
  if (!designDoc.exists) {
    throw new HttpsError("not-found", "That design is not in your wardrobe.");
  }
  const design = designDoc.data();
  const errors = validateDesign(design);
  if (errors.length > 0) {
    throw new HttpsError("invalid-argument", `Design failed validation: ${errors[0]}`);
  }
  const clean = sanitizeDesign(design);

  const entryId = `${uid}_${designDoc.id}`;
  const entryRef = db.doc(paths.exchangeEntry(entryId));
  const existing = await entryRef.get();

  if (!existing.exists) {
    const publishedSnap = await db
      .collection(paths.exchangeEntries())
      .where("creatorUid", "==", uid)
      .count()
      .get();
    if (publishedSnap.data().count >= MAX_PUBLISHED_PER_USER) {
      throw new HttpsError(
        "resource-exhausted",
        `You can have ${MAX_PUBLISHED_PER_USER} designs in the Exchange. Unpublish one first.`
      );
    }
  }

  const profileDoc = await db.doc(paths.userProfile(uid)).get();
  const creatorName = (profileDoc.exists && profileDoc.data().username) || "a director";

  const now = new Date().toISOString();
  await entryRef.set({
    design: {
      schema: 2,
      name: clean.name,
      colorway: clean.colorway,
      figure: clean.figure,
    },
    designName: clean.name,
    designId: designDoc.id,
    creatorUid: uid,
    creatorName,
    // counters survive a re-publish; a fresh entry starts at zero
    likes: existing.exists ? existing.data().likes || 0 : 0,
    saves: existing.exists ? existing.data().saves || 0 : 0,
    reports: existing.exists ? existing.data().reports || 0 : 0,
    createdAt: existing.exists ? existing.data().createdAt || now : now,
    updatedAt: now,
  });
  logger.info(`Exchange entry ${entryId} published`, { uid });
  return { entryId, message: existing.exists ? "Gallery entry updated." : "Published to the Design Exchange." };
});

/** Remove one of the caller's own gallery entries (markers included). */
const unpublishUniformDesign = onCall({ cors: true }, async (request) => {
  const uid = assertAuth(request);
  const entryId = entryIdFrom(request);

  const db = getDb();
  await assertWriteBudget(db, uid, "designExchange");

  const entryRef = db.doc(paths.exchangeEntry(entryId));
  const entryDoc = await entryRef.get();
  if (!entryDoc.exists) {
    throw new HttpsError("not-found", "That gallery entry no longer exists.");
  }
  if (entryDoc.data().creatorUid !== uid) {
    throw new HttpsError("permission-denied", "You can only unpublish your own designs.");
  }
  await db.recursiveDelete(entryRef);
  return { message: "Removed from the Design Exchange." };
});

/** Toggle the caller's like on a gallery entry. */
const likeExchangeDesign = onCall({ cors: true }, async (request) => {
  const uid = assertAuth(request);
  const entryId = entryIdFrom(request);
  const liked = request.data?.liked !== false;

  const db = getDb();
  await assertWriteBudget(db, uid, "designExchange");

  const entryRef = db.doc(paths.exchangeEntry(entryId));
  const likeRef = db.doc(paths.exchangeLike(entryId, uid));

  const result = await db.runTransaction(async (tx) => {
    const [entryDoc, likeDoc] = await Promise.all([tx.get(entryRef), tx.get(likeRef)]);
    if (!entryDoc.exists) {
      throw new HttpsError("not-found", "That gallery entry no longer exists.");
    }
    if (liked === likeDoc.exists) return { liked }; // already in the asked state
    if (liked) {
      tx.set(likeRef, { likedAt: new Date().toISOString() });
      tx.update(entryRef, { likes: FieldValue.increment(1) });
    } else {
      tx.delete(likeRef);
      tx.update(entryRef, { likes: FieldValue.increment(-1) });
    }
    return { liked };
  });
  return { ...result, message: result.liked ? "Liked." : "Like removed." };
});

/**
 * Save a gallery design into the caller's wardrobe (a copy, with
 * attribution). The FIRST save per user bumps the entry's save counter and
 * pays the creator a small CorpsCoin reward, capped per creator per day;
 * saving again just makes another copy.
 */
const saveExchangeDesign = onCall({ cors: true }, async (request) => {
  const uid = assertAuth(request);
  const entryId = entryIdFrom(request);

  const db = getDb();
  await assertWriteBudget(db, uid, "designExchange");

  const entryRef = db.doc(paths.exchangeEntry(entryId));
  const entryDoc = await entryRef.get();
  if (!entryDoc.exists) {
    throw new HttpsError("not-found", "That gallery entry no longer exists.");
  }
  const entry = entryDoc.data();

  // Pack gate: a copy is a wardrobe write like any other — keeping a gated
  // design requires its pack (helpers/uniformEntitlements).
  if (missingPacksFor(entry.design && entry.design.figure, undefined).length > 0) {
    const saverProfile = await db.doc(paths.userProfile(uid)).get();
    const owned = saverProfile.exists ? saverProfile.data().cosmetics?.owned : undefined;
    const missing = missingPacksFor(entry.design.figure, owned);
    if (missing.length > 0) {
      throw new HttpsError("failed-precondition", missingPacksMessage(missing));
    }
  }

  const col = db.collection(paths.userWardrobe(uid));
  const countSnap = await col.count().get();
  if (countSnap.data().count >= MAX_WARDROBE_DESIGNS) {
    throw new HttpsError(
      "resource-exhausted",
      `Your wardrobe is full (${MAX_WARDROBE_DESIGNS} designs). Delete one to save another.`
    );
  }

  // The copy first: the saver always gets their design, even if the
  // marker/payout transaction below retries or the payout is capped out.
  const now = new Date().toISOString();
  const copyRef = col.doc();
  await copyRef.set({
    schema: 2,
    name: entry.design.name,
    colorway: entry.design.colorway,
    figure: entry.design.figure,
    importedFrom: {
      creatorUid: entry.creatorUid,
      creatorName: entry.creatorName,
      entryId,
    },
    createdAt: now,
    updatedAt: now,
  });

  // Marker + counter + capped creator payout, atomically.
  const saveRef = db.doc(paths.exchangeSave(entryId, uid));
  const payoutRef = db.doc(paths.exchangePayout(entry.creatorUid));
  const creatorProfileRef = db.doc(paths.userProfile(entry.creatorUid));
  const paid = await db.runTransaction(async (tx) => {
    const [saveDoc, entryNow] = await Promise.all([tx.get(saveRef), tx.get(entryRef)]);
    if (saveDoc.exists || !entryNow.exists) return 0; // repeat save / entry gone
    const selfSave = entry.creatorUid === uid;
    let pay = 0;
    let payoutDoc = null;
    let creatorDoc = null;
    if (!selfSave) {
      [payoutDoc, creatorDoc] = await Promise.all([
        tx.get(payoutRef),
        tx.get(creatorProfileRef),
      ]);
      const today = dayStamp();
      const ledger = payoutDoc.exists ? payoutDoc.data() : {};
      const earnedToday = ledger.day === today ? ledger.earned || 0 : 0;
      pay = Math.max(0, Math.min(EXCHANGE_SAVE_REWARD, EXCHANGE_DAILY_CAP - earnedToday));
      if (pay > 0 && creatorDoc.exists) {
        const newBalance = (creatorDoc.data().corpsCoin || 0) + pay;
        tx.update(creatorProfileRef, { corpsCoin: newBalance });
        addCoinHistoryEntryToTransaction(tx, db, entry.creatorUid, {
          type: TRANSACTION_TYPES.DESIGN_EXCHANGE_SAVE,
          amount: pay,
          balance: newBalance,
          description: `"${entry.designName}" was saved from the Design Exchange`,
        });
        tx.set(payoutRef, { day: today, earned: earnedToday + pay });
      } else {
        pay = 0;
      }
    }
    tx.set(saveRef, { savedAt: new Date().toISOString() });
    tx.update(entryRef, { saves: FieldValue.increment(1) });
    return pay;
  });

  logger.info(`Exchange entry ${entryId} saved by ${uid}`, { paid });
  return {
    designId: copyRef.id,
    message: `Saved to your wardrobe — design by ${entry.creatorName}.`,
  };
});

/** Report a gallery entry (one report per user per entry). */
const reportExchangeDesign = onCall({ cors: true }, async (request) => {
  const uid = assertAuth(request);
  const entryId = entryIdFrom(request);
  const reason = String(request.data?.reason || "").slice(0, MAX_REPORT_REASON);

  const db = getDb();
  await assertWriteBudget(db, uid, "designExchange");

  const entryRef = db.doc(paths.exchangeEntry(entryId));
  const reportRef = db.doc(paths.exchangeReport(entryId, uid));
  await db.runTransaction(async (tx) => {
    const [entryDoc, reportDoc] = await Promise.all([tx.get(entryRef), tx.get(reportRef)]);
    if (!entryDoc.exists) {
      throw new HttpsError("not-found", "That gallery entry no longer exists.");
    }
    if (reportDoc.exists) return; // one report per user
    tx.set(reportRef, { reason, reportedAt: new Date().toISOString() });
    tx.update(entryRef, { reports: FieldValue.increment(1) });
  });
  logger.info(`Exchange entry ${entryId} reported`, { uid });
  return { message: "Thanks — the entry has been flagged for review." };
});

/** Admin takedown: remove any gallery entry (markers included). */
const adminRemoveExchangeDesign = onCall({ cors: true }, async (request) => {
  assertAdmin(request);
  const entryId = entryIdFrom(request);
  const db = getDb();
  const entryRef = db.doc(paths.exchangeEntry(entryId));
  const entryDoc = await entryRef.get();
  if (!entryDoc.exists) {
    throw new HttpsError("not-found", "That gallery entry no longer exists.");
  }
  await db.recursiveDelete(entryRef);
  logger.info(`Exchange entry ${entryId} removed by admin`);
  return { message: "Entry removed." };
});

module.exports = {
  publishUniformDesign,
  unpublishUniformDesign,
  likeExchangeDesign,
  saveExchangeDesign,
  reportExchangeDesign,
  adminRemoveExchangeDesign,
  // constants exported for tests
  EXCHANGE_SAVE_REWARD,
  EXCHANGE_DAILY_CAP,
  MAX_PUBLISHED_PER_USER,
};
