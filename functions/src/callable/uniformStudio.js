// =============================================================================
// UNIFORM STUDIO — wardrobe callables (save / equip / delete)
// =============================================================================
// Designs live at users/{uid}/wardrobe/{designId} (owner-read via the rules
// catch-all; all writes come through here). Equipping copies a bounded
// snapshot onto the profile at corps.{class}.uniform — a field pinned
// server-only in firestore.rules — and refreshes the v1 prose fields so the
// existing AI avatar / news-image prompt pipeline keeps working unchanged.
// Saving a design NEVER triggers avatar generation and never touches the
// profile picture: those stay separate, explicit actions.

const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { logger } = require("firebase-functions/v2");
const { FieldValue } = require("firebase-admin/firestore");
const { getDb } = require("../config");
const { paths } = require("../helpers/paths");
const { assertAuth, assertWriteBudget } = require("../helpers/callableGuards");
const { toCanonicalClass } = require("../helpers/economy");
const {
  DESIGN_ID_RE,
  MAX_WARDROBE_DESIGNS,
  UNIFORM_CODE_RE,
  generateUniformCode,
  validateDesign,
  sanitizeDesign,
  deriveV1Compat,
} = require("../helpers/uniformValidation");
const { missingPacksFor, missingPacksMessage } = require("../helpers/uniformEntitlements");

/**
 * Resolve the stored key for a corps class on this profile, tolerating the
 * legacy short keys ('world'/'open') some older profiles still carry.
 * @param {Record<string, any>} corpsMap
 * @param {string} corpsClass
 * @returns {string|null}
 */
function resolveStoredClassKey(corpsMap, corpsClass) {
  const canonical = toCanonicalClass(corpsClass);
  if (!canonical) return null;
  if (corpsMap[canonical]?.corpsName) return canonical;
  const legacy = canonical === "worldClass" ? "world" : canonical === "openClass" ? "open" : null;
  if (legacy && corpsMap[legacy]?.corpsName) return legacy;
  return null;
}

/**
 * Write a sanitized design doc, converting any unexpected Firestore write
 * failure into a clean HttpsError. Without this a rejected write (e.g. a
 * payload shape Firestore can't store) escapes as a non-HttpsError and the
 * client sees a bare "INTERNAL (500)"; here it is logged and reported as a
 * retryable error instead. HttpsErrors (none are thrown below today) pass
 * through unchanged.
 * @param {FirebaseFirestore.DocumentReference} ref
 * @param {string} uid
 * @param {Record<string, unknown>} data
 */
async function persistDesign(ref, uid, data) {
  try {
    await ref.set(data);
  } catch (err) {
    if (err instanceof HttpsError) throw err;
    logger.error(`Failed to persist wardrobe design for ${uid}`, err);
    throw new HttpsError("internal", "Could not save your design. Please try again.");
  }
}

/**
 * Save a design to the caller's wardrobe. Creates when designId is omitted
 * (enforcing the wardrobe cap); overwrites the caller's own design otherwise.
 */
const saveUniformDesign = onCall({ cors: true }, async (request) => {
  const uid = assertAuth(request);
  const { designId, design } = request.data || {};

  const errors = validateDesign(design);
  if (errors.length > 0) {
    throw new HttpsError("invalid-argument", `Invalid design: ${errors.slice(0, 3).join("; ")}`);
  }
  if (designId != null && !DESIGN_ID_RE.test(String(designId))) {
    throw new HttpsError("invalid-argument", "Invalid design id.");
  }

  const db = getDb();
  await assertWriteBudget(db, uid, "uniformStudio");

  // Pack gate (helpers/uniformEntitlements): previewing gated content is
  // free everywhere, KEEPING it requires the pack — checked at every
  // wardrobe write, only paying the profile read when the design is gated.
  const requiredCheck = missingPacksFor(design.figure, undefined);
  if (requiredCheck.length > 0) {
    const profileDoc = await db.doc(paths.userProfile(uid)).get();
    const owned = profileDoc.exists ? profileDoc.data().cosmetics?.owned : undefined;
    const missing = missingPacksFor(design.figure, owned);
    if (missing.length > 0) {
      throw new HttpsError("failed-precondition", missingPacksMessage(missing));
    }
  }

  const clean = sanitizeDesign(design);
  const now = new Date().toISOString();
  const col = db.collection(paths.userWardrobe(uid));

  if (designId) {
    const ref = col.doc(String(designId));
    const doc = await ref.get();
    if (!doc.exists) {
      throw new HttpsError("not-found", "That design no longer exists.");
    }
    const prior = doc.data();
    await persistDesign(ref, uid, {
      ...clean,
      createdAt: prior.createdAt || now,
      // keep the minted share code stable across edits (mintUniformCode owns it)
      ...(prior.shareCode ? { shareCode: prior.shareCode } : {}),
      // keep Design Exchange attribution on a saved copy across edits
      ...(prior.importedFrom ? { importedFrom: prior.importedFrom } : {}),
      updatedAt: now,
    });
    return { designId: ref.id, message: "Design saved." };
  }

  const countSnap = await col.count().get();
  if (countSnap.data().count >= MAX_WARDROBE_DESIGNS) {
    throw new HttpsError(
      "resource-exhausted",
      `Your wardrobe is full (${MAX_WARDROBE_DESIGNS} designs). Delete one to save another.`
    );
  }
  const ref = col.doc();
  await persistDesign(ref, uid, { ...clean, createdAt: now, updatedAt: now });
  logger.info(`Wardrobe design created for ${uid}`, { designId: ref.id });
  return { designId: ref.id, message: "Design saved to your wardrobe." };
});

/**
 * Equip a saved design on one of the caller's corps. The default (primary)
 * slot writes the renderable snapshot to corps.{class}.uniform and refreshes
 * the v1 prose fields the AI pipeline reads. slot:"alternate" fills the
 * optional second look at corps.{class}.uniformAlt (finals week / exhibition
 * — the home/away pattern, docs/UNIFORM_STUDIO.md §6) and leaves the primary
 * identity — including the prose fields — untouched. slot:"guard" dresses
 * the color guard at corps.{class}.uniformGuard — the SHOW's look, not the
 * corps': it is archived with the season and reset at rollover alongside the
 * show concept (hornline wears the identity, the guard wears the show,
 * docs/UNIFORM_STUDIO.md §6). Passing designId:null with slot "alternate" or
 * "guard" clears that slot. Does NOT touch avatarUrl or profileAvatarCorps.
 */
const equipUniformDesign = onCall({ cors: true }, async (request) => {
  const uid = assertAuth(request);
  const { designId, corpsClass, slot } = request.data || {};
  if (slot != null && slot !== "primary" && slot !== "alternate" && slot !== "guard") {
    throw new HttpsError("invalid-argument", "Invalid uniform slot.");
  }
  const slotField =
    slot === "alternate" ? "uniformAlt" : slot === "guard" ? "uniformGuard" : null;
  const clearingSlot = slotField != null && designId == null;
  if (!clearingSlot && (!designId || !DESIGN_ID_RE.test(String(designId)))) {
    throw new HttpsError("invalid-argument", "Invalid design id.");
  }

  const db = getDb();
  await assertWriteBudget(db, uid, "uniformStudio");

  const profileRef = db.doc(paths.userProfile(uid));
  const profileDoc = await profileRef.get();
  if (!profileDoc.exists) {
    throw new HttpsError("not-found", "User profile not found.");
  }
  const corpsMap = profileDoc.data().corps || {};
  const storedKey = resolveStoredClassKey(corpsMap, String(corpsClass || ""));
  if (!storedKey) {
    throw new HttpsError("failed-precondition", "You have no registered corps in that class.");
  }

  if (clearingSlot) {
    await profileRef.update({ [`corps.${storedKey}.${slotField}`]: FieldValue.delete() });
    return {
      message: slot === "guard" ? "Guard look cleared." : "Alternate look cleared.",
    };
  }

  const designDoc = await db.doc(paths.userWardrobeDesign(uid, String(designId))).get();
  if (!designDoc.exists) {
    throw new HttpsError("not-found", "That design is not in your wardrobe.");
  }
  const design = designDoc.data();

  const snapshot = {
    designId: designDoc.id,
    name: design.name,
    colorway: design.colorway,
    figure: design.figure,
    equippedAt: new Date().toISOString(),
  };

  if (slotField) {
    await profileRef.update({ [`corps.${storedKey}.${slotField}`]: snapshot });
    return {
      message: slot === "guard" ? "Guard look equipped." : "Alternate look equipped.",
    };
  }

  const v1Compat = deriveV1Compat(design, corpsMap[storedKey].uniformDesign);
  await profileRef.update({
    [`corps.${storedKey}.uniform`]: snapshot,
    [`corps.${storedKey}.uniformDesign`]: v1Compat,
  });
  return { message: "Design equipped." };
});

/** Delete one of the caller's saved designs. Equipped snapshots are copies
 *  and stay in place until another design is equipped over them. */
const deleteUniformDesign = onCall({ cors: true }, async (request) => {
  const uid = assertAuth(request);
  const { designId } = request.data || {};
  if (!designId || !DESIGN_ID_RE.test(String(designId))) {
    throw new HttpsError("invalid-argument", "Invalid design id.");
  }

  const db = getDb();
  await assertWriteBudget(db, uid, "uniformStudio");

  const ref = db.doc(paths.userWardrobeDesign(uid, String(designId)));
  const doc = await ref.get();
  if (!doc.exists) {
    throw new HttpsError("not-found", "That design no longer exists.");
  }
  await ref.delete();
  return { message: "Design deleted." };
});

/**
 * Mint (or refresh) the share code for one of the caller's saved designs
 * (docs/UNIFORM_STUDIO.md §7.1). The code doc is a world-readable snapshot of
 * pure structured data — anyone entering the code imports the design as a new
 * draft with attribution. Re-minting the same design reuses its code and
 * refreshes the snapshot to the design's current state.
 */
const mintUniformCode = onCall({ cors: true }, async (request) => {
  const uid = assertAuth(request);
  const { designId } = request.data || {};
  if (!designId || !DESIGN_ID_RE.test(String(designId))) {
    throw new HttpsError("invalid-argument", "Invalid design id.");
  }

  const db = getDb();
  await assertWriteBudget(db, uid, "uniformStudio");

  const designRef = db.doc(paths.userWardrobeDesign(uid, String(designId)));
  const designDoc = await designRef.get();
  if (!designDoc.exists) {
    throw new HttpsError("not-found", "That design is not in your wardrobe.");
  }
  const design = designDoc.data();

  const profileDoc = await db.doc(paths.userProfile(uid)).get();
  const creatorName = (profileDoc.exists && profileDoc.data().username) || "a director";

  // Reuse the design's existing code so shared links stay stable; otherwise
  // roll until an unclaimed code is found (30^6 space — collisions are rare).
  let code = typeof design.shareCode === "string" && UNIFORM_CODE_RE.test(design.shareCode)
    ? design.shareCode
    : null;
  if (!code) {
    for (let attempt = 0; attempt < 5 && !code; attempt++) {
      const candidate = generateUniformCode();
      const existing = await db.doc(paths.uniformCode(candidate)).get();
      if (!existing.exists) code = candidate;
    }
    if (!code) {
      throw new HttpsError("internal", "Could not allocate a code — please try again.");
    }
  }

  const now = new Date().toISOString();
  await db.doc(paths.uniformCode(code)).set({
    design: {
      schema: 2,
      name: design.name,
      colorway: design.colorway,
      figure: design.figure,
    },
    creatorUid: uid,
    creatorName,
    designName: design.name,
    createdAt: now,
  });
  if (design.shareCode !== code) {
    await designRef.set({ shareCode: code, updatedAt: now }, { merge: true });
  }
  logger.info(`Uniform code ${code} minted for ${uid}`, { designId: String(designId) });
  return { code };
});

module.exports = {
  saveUniformDesign,
  equipUniformDesign,
  deleteUniformDesign,
  mintUniformCode,
};
