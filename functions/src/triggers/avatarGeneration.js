// @ts-nocheck -- grandfathered when functions checkJs landed (functions/tsconfig.json); remove when this file is typed or cleaned up
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
const { getDb } = require("../config");
const { paths } = require("../helpers/paths");
const {
  buildCorpsAvatarPrompt,
  generateImageWithImagen,
  initializeGemini,
} = require("../helpers/newsGeneration");
const { FREE_IMAGE_MODEL } = require("../helpers/geminiService");
const { uploadFromUrl } = require("../helpers/mediaService");
const { assertAuth, assertAdmin } = require("../helpers/callableGuards");

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
