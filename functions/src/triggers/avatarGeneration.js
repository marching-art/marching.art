/**
 * Avatar Generation
 *
 * Generates AI-powered avatars/icons for fantasy corps when uniform design is saved.
 * Uses Gemini image generation with director-provided uniform customization.
 *
 * Invoked explicitly via the generateCorpsAvatar callable after a design save
 * (Profile.jsx / useDashboardModals.js). There is deliberately NO Firestore
 * trigger on the profile doc: that doc is written by every gameplay action and
 * nightly batch job, so a trigger here billed one 512MiB invocation per profile
 * write (~2×users/night from scoring + rivals alone) just to diff uniformDesign
 * and early-return.
 */

const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { logger } = require("firebase-functions/v2");
const { defineSecret } = require("firebase-functions/params");
const { FieldValue } = require("firebase-admin/firestore");
const { getDb } = require("../config");
const { paths } = require("../helpers/paths");
const {
  buildCorpsAvatarPrompt,
  generateImageWithImagen,
  initializeGemini,
} = require("../helpers/newsGeneration");
const { FREE_IMAGE_MODEL } = require("../helpers/geminiService");
const { uploadFromUrl, buildOptimizedUrl } = require("../helpers/mediaService");
const {
  assertAuth,
  assertAdmin,
  assertWriteBudget,
  assertDocId,
} = require("../helpers/callableGuards");

// Define secrets
const geminiApiKey = defineSecret("GOOGLE_GENERATIVE_AI_API_KEY");
const cloudinaryCloudName = defineSecret("CLOUDINARY_CLOUD_NAME");
const cloudinaryApiKey = defineSecret("CLOUDINARY_API_KEY");
const cloudinaryApiSecret = defineSecret("CLOUDINARY_API_SECRET");

// =============================================================================
// CONSTANTS
// =============================================================================

// Canonical class keys, matching how corps are stored in the profile's
// `corps` map (registration writes 'worldClass'/'openClass', not 'world'/'open').
const CORPS_CLASSES = [
  "soundSport",
  "aClass",
  "openClass",
  "worldClass",
  "podiumClass",
];

// Custom (director-supplied URL) avatars. The source image is fetched
// server-side, size-capped, then re-hosted and re-encoded — it is never
// hot-linked, both because the app CSP (img-src) only allows a handful of
// hosts and because re-hosting is what lets us enforce a reasonable file
// size and a square crop the display can rely on.
const MAX_AVATAR_SOURCE_BYTES = 5 * 1024 * 1024; // 5 MB
const AVATAR_FETCH_TIMEOUT_MS = 15000;
// Delivered edge length. Cloudinary crops to a square and re-encodes with
// auto quality/format, so the delivered asset stays small regardless of the
// source, and the fixed dimensions fit the existing avatar box (object-cover).
const CUSTOM_AVATAR_EDGE_PX = 512;

/**
 * Fetch a director-supplied image URL into a base64 data URL, enforcing a hard
 * byte cap and an image content-type. Streams the body so a server that lies
 * about (or omits) Content-Length can't make us buffer an unbounded response.
 *
 * @param {string} imageUrl
 * @returns {Promise<string>} `data:image/...;base64,...`
 * @throws {HttpsError} invalid-argument for any bad/oversized/non-image URL.
 */
async function fetchImageAsDataUrl(imageUrl) {
  let parsed;
  try {
    parsed = new URL(imageUrl);
  } catch {
    throw new HttpsError("invalid-argument", "Enter a valid image URL.");
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new HttpsError("invalid-argument", "Image URL must start with http:// or https://.");
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), AVATAR_FETCH_TIMEOUT_MS);
  let response;
  try {
    response = await fetch(imageUrl, {
      signal: controller.signal,
      redirect: "follow",
      headers: { "User-Agent": "marching.art-avatar-fetch/1.0" },
    });
  } catch {
    clearTimeout(timeout);
    throw new HttpsError("invalid-argument", "Could not fetch that image URL. Check the link and try again.");
  }

  try {
    if (!response.ok) {
      throw new HttpsError("invalid-argument", `That image URL returned an error (HTTP ${response.status}).`);
    }
    const contentType = (response.headers.get("content-type") || "")
      .split(";")[0].trim().toLowerCase();
    if (!contentType.startsWith("image/")) {
      throw new HttpsError("invalid-argument", "That link is not an image. Use a direct link to a PNG, JPG, WEBP, or GIF.");
    }
    const declared = Number(response.headers.get("content-length"));
    if (Number.isFinite(declared) && declared > MAX_AVATAR_SOURCE_BYTES) {
      throw new HttpsError(
        "invalid-argument",
        `That image is too large (max ${Math.round(MAX_AVATAR_SOURCE_BYTES / 1024 / 1024)} MB).`
      );
    }

    // Stream with a running byte cap; abort the moment it's exceeded.
    const reader = response.body?.getReader?.();
    const chunks = [];
    let received = 0;
    if (reader) {
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        received += value.length;
        if (received > MAX_AVATAR_SOURCE_BYTES) {
          controller.abort();
          throw new HttpsError(
            "invalid-argument",
            `That image is too large (max ${Math.round(MAX_AVATAR_SOURCE_BYTES / 1024 / 1024)} MB).`
          );
        }
        chunks.push(value);
      }
    } else {
      // Runtime without a streamable body — fall back to a bounded arrayBuffer.
      const buf = Buffer.from(await response.arrayBuffer());
      if (buf.length > MAX_AVATAR_SOURCE_BYTES) {
        throw new HttpsError(
          "invalid-argument",
          `That image is too large (max ${Math.round(MAX_AVATAR_SOURCE_BYTES / 1024 / 1024)} MB).`
        );
      }
      chunks.push(buf);
      received = buf.length;
    }

    if (received === 0) {
      throw new HttpsError("invalid-argument", "That image URL returned no data.");
    }

    const buffer = Buffer.concat(chunks.map((c) => Buffer.from(c)));
    // Normalize to a MIME the Cloudinary/base64 upload path accepts.
    const mime = contentType === "image/jpg" ? "image/jpeg" : contentType;
    return `data:${mime};base64,${buffer.toString("base64")}`;
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Re-host a director-supplied image as a square corps avatar and persist it.
 * Reuses the same corps_avatars folder + publicId as AI avatars, so setting a
 * custom URL overwrites (rather than orphans) the generated one and vice versa.
 *
 * @returns {Promise<string>} The stored avatar URL.
 */
async function saveCustomAvatar({ userId, corpsClass, imageUrl }) {
  const dataUrl = await fetchImageAsDataUrl(imageUrl);

  const uploadResult = await uploadFromUrl(dataUrl, {
    folder: "corps_avatars",
    publicId: `avatar_${userId}_${corpsClass}`,
  });

  if (!uploadResult || uploadResult.isPlaceholder || !uploadResult.success) {
    throw new HttpsError(
      "internal",
      "We couldn't process that image. Try a different link or a smaller file."
    );
  }

  // When the upload landed in Cloudinary, deliver a square, auto-optimized
  // derivative (reduce/expand + crop edges + re-encode). The Firebase Storage
  // fallback has no server-side transform, so its (already size-capped) URL is
  // used directly and the display box's object-cover handles the crop.
  let avatarUrl = uploadResult.url;
  if (uploadResult.publicId) {
    avatarUrl = buildOptimizedUrl(
      uploadResult.publicId,
      {
        width: CUSTOM_AVATAR_EDGE_PX,
        height: CUSTOM_AVATAR_EDGE_PX,
        crop: "fill",
        gravity: "auto",
        fetch_format: "auto",
        quality: "auto:good",
      },
      uploadResult.version
    );
  }

  await getDb().doc(paths.userProfile(userId)).update({
    [`corps.${corpsClass}.avatarUrl`]: avatarUrl,
    [`corps.${corpsClass}.avatarSource`]: "custom",
    [`corps.${corpsClass}.avatarGeneratedAt`]: new Date().toISOString(),
    profileAvatarCorps: corpsClass,
  });

  return avatarUrl;
}

/**
 * Generate avatar image and save URL to corps data
 */
async function generateAndSaveAvatar({ userId, corpsClass, corpsName, location, uniformDesign }) {
  const db = getDb();

  // Initialize Gemini
  initializeGemini();

  // Build the avatar prompt using the uniform design
  const prompt = buildCorpsAvatarPrompt(corpsName, location, uniformDesign);

  logger.info("Generating avatar with prompt", {
    corpsName,
    location,
    hasUniformDesign: !!uniformDesign?.primaryColor,
  });

  // Uniform/logo avatars always use the FREE-tier image model (Gemini 2.5 Flash
  // Image, 500 RPD free quota) — avatars are user-triggered and high-volume, so
  // they must never bill against the paid model reserved for the nightly
  // fantasy-corps article image. 1:1 aspect ratio for square avatars.
  const imageData = await generateImageWithImagen(prompt, {
    model: FREE_IMAGE_MODEL,
    aspectRatio: "1:1",
  });

  if (!imageData) {
    logger.warn("No image generated for avatar, skipping save");
    return null;
  }

  // Upload to Cloudinary (or Firebase Storage fallback)
  let avatarUrl = null;

  if (imageData.startsWith("data:")) {
    try {
      const uploadResult = await uploadFromUrl(imageData, {
        folder: "corps_avatars",
        publicId: `avatar_${userId}_${corpsClass}`,
        transformation: [
          { width: 256, height: 256, crop: "fill", gravity: "center" },
          { quality: "auto:good", fetch_format: "auto" },
        ],
      });

      // Check if upload was successful
      if (uploadResult.success && uploadResult.url && !uploadResult.isPlaceholder) {
        avatarUrl = uploadResult.url;
        logger.info("Avatar uploaded successfully", {
          url: avatarUrl,
          publicId: uploadResult.publicId,
        });
      } else {
        // Upload failed but didn't throw - store base64 as fallback
        logger.warn("Avatar upload failed, storing base64 data URL as fallback", {
          isPlaceholder: uploadResult.isPlaceholder,
          error: uploadResult.error,
        });
        avatarUrl = imageData;
      }
    } catch (uploadError) {
      logger.error("Failed to upload avatar:", uploadError);
      // Store base64 as fallback rather than failing completely
      avatarUrl = imageData;
    }
  } else if (imageData.startsWith("http")) {
    // Already a URL, use directly
    avatarUrl = imageData;
  }

  if (!avatarUrl) {
    logger.warn("No valid avatar URL, skipping save");
    return null;
  }

  // Save avatar URL back to the user's profile
  const profileRef = db.doc(paths.userProfile(userId));

  await profileRef.update({
    [`corps.${corpsClass}.avatarUrl`]: avatarUrl,
    [`corps.${corpsClass}.avatarGeneratedAt`]: new Date().toISOString(),
  });

  logger.info("Avatar saved successfully", {
    userId,
    corpsClass,
    corpsName,
    avatarUrl,
  });

  return avatarUrl;
}

// =============================================================================
// CALLABLE FUNCTION: Manual Avatar Generation
// =============================================================================

/**
 * Manually trigger avatar generation for a specific corps
 * Useful for regenerating or fixing avatars
 */
exports.generateCorpsAvatar = onCall(
  {
    timeoutSeconds: 60,
    memory: "512MiB",
    secrets: [geminiApiKey, cloudinaryCloudName, cloudinaryApiKey, cloudinaryApiSecret],
  },
  async (request) => {
    assertAuth(request);

    const { corpsClass } = request.data || {};

    if (!corpsClass || !CORPS_CLASSES.includes(corpsClass)) {
      throw new HttpsError("invalid-argument", "Valid corpsClass is required");
    }

    const db = getDb();
    const userId = request.auth.uid;

    // Abuse throttle: each call bills a Gemini image generation + Cloudinary
    // upload, so it needs a tight per-uid budget (well above any human rate).
    await assertWriteBudget(db, userId, "avatarGen", {
      max: 5,
      windowMs: 60 * 60 * 1000,
    });

    // Fetch user's profile
    const profileDoc = await db.doc(paths.userProfile(userId)).get();

    if (!profileDoc.exists) {
      throw new HttpsError("not-found", "User profile not found");
    }

    const profile = profileDoc.data();
    const corps = profile.corps?.[corpsClass];

    if (!corps) {
      throw new HttpsError("not-found", `No corps found in ${corpsClass}`);
    }

    try {
      const avatarUrl = await generateAndSaveAvatar({
        userId,
        corpsClass,
        corpsName: corps.corpsName || corps.name,
        location: corps.location,
        uniformDesign: corps.uniformDesign,
      });

      if (!avatarUrl) {
        throw new HttpsError("internal", "Failed to generate avatar image");
      }

      return {
        success: true,
        avatarUrl,
        message: "Avatar generated successfully",
      };
    } catch (error) {
      logger.error("Error in manual avatar generation:", error);
      if (error instanceof HttpsError) throw error;
      throw new HttpsError("internal", "Failed to generate avatar.");
    }
  }
);

/**
 * Regenerate avatars for all corps (admin only)
 * Useful for batch regeneration after updating prompts
 */
exports.regenerateAllAvatars = onCall(
  {
    timeoutSeconds: 300,
    memory: "1GiB",
    secrets: [geminiApiKey, cloudinaryCloudName, cloudinaryApiKey, cloudinaryApiSecret],
  },
  async (request) => {
    assertAdmin(request);

    const db = getDb();
    const { limit = 10 } = request.data || {};

    try {
      // Get users with corps that have uniform designs
      const usersRef = db.collection(paths.users());
      const profileDocs = await usersRef.listDocuments();

      let processed = 0;
      let generated = 0;
      let errors = 0;

      for (const userDoc of profileDocs) {
        if (processed >= limit) break;

        const profileRef = userDoc.collection("profile").doc("data");
        const profile = await profileRef.get();

        if (!profile.exists) continue;

        const data = profile.data();
        const userId = userDoc.id;

        for (const corpsClass of CORPS_CLASSES) {
          const corps = data.corps?.[corpsClass];
          if (!corps?.uniformDesign?.primaryColor) continue;

          try {
            await generateAndSaveAvatar({
              userId,
              corpsClass,
              corpsName: corps.corpsName || corps.name,
              location: corps.location,
              uniformDesign: corps.uniformDesign,
            });
            generated++;
          } catch (err) {
            logger.error(`Error regenerating avatar for ${userId}/${corpsClass}:`, err);
            errors++;
          }

          processed++;
          if (processed >= limit) break;
        }
      }

      return {
        success: true,
        processed,
        generated,
        errors,
        message: `Processed ${processed} corps, generated ${generated} avatars, ${errors} errors`,
      };
    } catch (error) {
      logger.error("Error in batch avatar regeneration:", error);
      if (error instanceof HttpsError) throw error;
      throw new HttpsError("internal", "Batch avatar regeneration failed.");
    }
  }
);

// =============================================================================
// CALLABLE FUNCTION: Custom Avatar From URL (director-supplied)
// =============================================================================

/**
 * Set a corps avatar from a director-supplied image URL, in place of the AI
 * art. The source is fetched, size-checked, cropped to a square and re-hosted
 * (see saveCustomAvatar). Gated by the per-account customAvatarBanned flag an
 * admin can set.
 */
exports.setCorpsAvatarFromUrl = onCall(
  {
    timeoutSeconds: 60,
    memory: "512MiB",
    secrets: [cloudinaryCloudName, cloudinaryApiKey, cloudinaryApiSecret],
  },
  async (request) => {
    const userId = assertAuth(request);

    const { corpsClass, imageUrl } = request.data || {};

    if (!corpsClass || !CORPS_CLASSES.includes(corpsClass)) {
      throw new HttpsError("invalid-argument", "Valid corpsClass is required");
    }
    if (typeof imageUrl !== "string" || imageUrl.trim().length < 8 || imageUrl.length > 2048) {
      throw new HttpsError("invalid-argument", "Enter a valid image URL.");
    }

    const db = getDb();

    // Same abuse throttle as generation: each call bills a remote fetch + a
    // Cloudinary upload, so keep a tight per-uid budget well above human rate.
    await assertWriteBudget(db, userId, "avatarGen", {
      max: 10,
      windowMs: 60 * 60 * 1000,
    });

    const profileDoc = await db.doc(paths.userProfile(userId)).get();
    if (!profileDoc.exists) {
      throw new HttpsError("not-found", "User profile not found");
    }

    const profile = profileDoc.data();

    // An admin can revoke a director's ability to apply their own URL art.
    if (profile.customAvatarBanned === true) {
      throw new HttpsError(
        "permission-denied",
        "An administrator has disabled custom avatar links for your account."
      );
    }

    const corps = profile.corps?.[corpsClass];
    if (!corps) {
      throw new HttpsError("not-found", `No corps found in ${corpsClass}`);
    }

    try {
      const avatarUrl = await saveCustomAvatar({ userId, corpsClass, imageUrl: imageUrl.trim() });
      return { success: true, avatarUrl, message: "Custom avatar saved." };
    } catch (error) {
      if (error instanceof HttpsError) throw error;
      logger.error("Error setting custom avatar from URL:", error);
      throw new HttpsError("internal", "Failed to save custom avatar.");
    }
  }
);

// =============================================================================
// CALLABLE FUNCTION: Admin Avatar Moderation
// =============================================================================

/**
 * Admin moderation for corps avatars:
 *  - removeAvatar: clear the stored avatar (a single corpsClass, or every corps
 *    when corpsClass is omitted) — strips both AI-generated and custom art.
 *  - banCustomAvatar (bool): set/unset the per-account block on applying a
 *    director-supplied URL. Server-only per Firestore rules, so a banned user
 *    cannot lift it themselves.
 */
exports.adminModerateCorpsAvatar = onCall({ timeoutSeconds: 60 }, async (request) => {
  assertAdmin(request);

  const { userId, corpsClass, removeAvatar, banCustomAvatar } = request.data || {};
  assertDocId(userId, "userId");
  if (corpsClass != null && !CORPS_CLASSES.includes(corpsClass)) {
    throw new HttpsError("invalid-argument", "Invalid corpsClass.");
  }
  if (removeAvatar !== true && typeof banCustomAvatar !== "boolean") {
    throw new HttpsError("invalid-argument", "Nothing to update.");
  }

  const db = getDb();
  const profileRef = db.doc(paths.userProfile(userId));
  const snap = await profileRef.get();
  if (!snap.exists) {
    throw new HttpsError("not-found", "User profile not found");
  }
  const profile = snap.data();

  const updates = {};
  let removedCount = 0;

  if (removeAvatar === true) {
    const classes = corpsClass ? [corpsClass] : Object.keys(profile.corps || {});
    for (const cls of classes) {
      const corps = profile.corps?.[cls];
      if (!corps || corps.avatarUrl === undefined) continue;
      updates[`corps.${cls}.avatarUrl`] = FieldValue.delete();
      updates[`corps.${cls}.avatarSource`] = FieldValue.delete();
      removedCount++;
    }
  }

  if (typeof banCustomAvatar === "boolean") {
    updates.customAvatarBanned = banCustomAvatar;
  }

  if (Object.keys(updates).length === 0) {
    return { success: true, removedCount: 0, message: "No matching avatars to remove." };
  }

  await profileRef.update(updates);

  const parts = [];
  if (removeAvatar === true) parts.push(`removed ${removedCount} avatar(s)`);
  if (typeof banCustomAvatar === "boolean") {
    parts.push(banCustomAvatar ? "banned custom avatar links" : "restored custom avatar links");
  }

  logger.info("adminModerateCorpsAvatar", { admin: request.auth.uid, userId, removedCount, banCustomAvatar });

  return {
    success: true,
    removedCount,
    customAvatarBanned: typeof banCustomAvatar === "boolean" ? banCustomAvatar : undefined,
    message: `Done: ${parts.join(", ")}.`,
  };
});
