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
const { getDb } = require("../config");
const { paths } = require("../helpers/paths");
const { assertAuth, assertWriteBudget } = require("../helpers/callableGuards");
const { toCanonicalClass } = require("../helpers/economy");
const {
  DESIGN_ID_RE,
  MAX_WARDROBE_DESIGNS,
  validateDesign,
  sanitizeDesign,
  deriveV1Compat,
} = require("../helpers/uniformValidation");

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

  const clean = sanitizeDesign(design);
  const now = new Date().toISOString();
  const col = db.collection(paths.userWardrobe(uid));

  if (designId) {
    const ref = col.doc(String(designId));
    const doc = await ref.get();
    if (!doc.exists) {
      throw new HttpsError("not-found", "That design no longer exists.");
    }
    await ref.set({ ...clean, createdAt: doc.data().createdAt || now, updatedAt: now });
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
  await ref.set({ ...clean, createdAt: now, updatedAt: now });
  logger.info(`Wardrobe design created for ${uid}`, { designId: ref.id });
  return { designId: ref.id, message: "Design saved to your wardrobe." };
});

/**
 * Equip a saved design on one of the caller's corps: writes the renderable
 * snapshot to corps.{class}.uniform and refreshes the v1 prose fields the AI
 * pipeline reads. Does NOT touch avatarUrl or profileAvatarCorps.
 */
const equipUniformDesign = onCall({ cors: true }, async (request) => {
  const uid = assertAuth(request);
  const { designId, corpsClass } = request.data || {};
  if (!designId || !DESIGN_ID_RE.test(String(designId))) {
    throw new HttpsError("invalid-argument", "Invalid design id.");
  }

  const db = getDb();
  await assertWriteBudget(db, uid, "uniformStudio");

  const designDoc = await db.doc(paths.userWardrobeDesign(uid, String(designId))).get();
  if (!designDoc.exists) {
    throw new HttpsError("not-found", "That design is not in your wardrobe.");
  }
  const design = designDoc.data();

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

  const snapshot = {
    designId: designDoc.id,
    name: design.name,
    colorway: design.colorway,
    figure: design.figure,
    equippedAt: new Date().toISOString(),
  };
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

module.exports = { saveUniformDesign, equipUniformDesign, deleteUniformDesign };
