/**
 * Avatar Generation Triggers
 *
 * Generates AI-powered avatars/icons for fantasy corps when uniform design is saved.
 * Uses Gemini image generation with director-provided uniform customization.
 *
 * Trigger: Firestore update on user profile when uniformDesign changes
 */

const { onDocumentWritten } = require("firebase-functions/v2/firestore");
const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { logger } = require("firebase-functions/v2");
const { defineSecret } = require("firebase-functions/params");
const { getDb } = require("../config");
const {
  buildCorpsAvatarPrompt,
  generateImageWithImagen,
  initializeGemini,
} = require("../helpers/newsGeneration");
const { uploadFromUrl } = require("../helpers/mediaService");

// Define secrets
const geminiApiKey = defineSecret("GOOGLE_GENERATIVE_AI_API_KEY");
const cloudinaryCloudName = defineSecret("CLOUDINARY_CLOUD_NAME");
const cloudinaryApiKey = defineSecret("CLOUDINARY_API_KEY");
const cloudinaryApiSecret = defineSecret("CLOUDINARY_API_SECRET");

// =============================================================================
// CONSTANTS
// =============================================================================

const CORPS_CLASSES = ["soundSport", "aClass", "open", "world"];

// =============================================================================
// FIRESTORE TRIGGER: Corps Uniform Design Updated
// =============================================================================

/**
 * Trigger avatar generation when a user updates their corps uniform design
 * Listens to changes in the user's profile document
 */
exports.onUniformDesignUpdated = onDocumentWritten(
  {
    document: "artifacts/marching-art/users/{userId}/profile/data",
    timeoutSeconds: 120,
    memory: "512MiB",
    secrets: [geminiApiKey, cloudinaryCloudName, cloudinaryApiKey, cloudinaryApiSecret],
  },
  async (event) => {
    const beforeData = event.data?.before?.data();
    const afterData = event.data?.after?.data();

    if (!afterData) {
      logger.info("Document deleted, skipping avatar generation");
      return;
    }

    const userId = event.params.userId;

    // Check each corps class for uniform design changes
    for (const corpsClass of CORPS_CLASSES) {
      const beforeCorps = beforeData?.corps?.[corpsClass];
      const afterCorps = afterData?.corps?.[corpsClass];

      // Skip if no corps in this class
      if (!afterCorps) continue;

      const beforeDesign = beforeCorps?.uniformDesign;
      const afterDesign = afterCorps?.uniformDesign;

      // Check if uniform design was added or changed
      const designChanged = hasUniformDesignChanged(beforeDesign, afterDesign);

      if (designChanged) {
        logger.info(`Uniform design changed for ${corpsClass}, generating avatar`, {
          userId,
          corpsClass,
          corpsName: afterCorps.corpsName,
        });

        try {
          await generateAndSaveAvatar({
            userId,
            corpsClass,
            corpsName: afterCorps.corpsName || afterCorps.name,
            location: afterCorps.location,
            uniformDesign: afterDesign,
          });
        } catch (error) {
          logger.error(`Failed to generate avatar for ${corpsClass}:`, error);
          // Don't throw - allow other corps to still be processed
        }
      }
    }
  }
);

/**
 * Check if uniform design has meaningfully changed
 * Compares key fields that would affect the avatar
 */
function hasUniformDesignChanged(before, after) {
  // If after is null/undefined, no generation needed
  if (!after) return false;

  // If before is null/undefined but after has data, it's new
  if (!before && after.primaryColor) return true;

  // Check for changes in key fields that affect avatar appearance
  const keyFields = [
    "primaryColor",
    "secondaryColor",
    "accentColor",
    "style",
    "mascotOrEmblem",
    "avatarStyle",    // logo vs performer
    "avatarSection",  // drumMajor, hornline, drumline, colorGuard
  ];

  for (const field of keyFields) {
    if (before?.[field] !== after?.[field]) {
      return true;
    }
  }

  // Check theme keywords array
  const beforeKeywords = (before?.themeKeywords || []).sort().join(",");
  const afterKeywords = (after?.themeKeywords || []).sort().join(",");
  if (beforeKeywords !== afterKeywords) {
    return true;
  }

  return false;
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

  // Generate image using Gemini Flash for faster avatar generation
  const imageData = await generateImageWithImagen(prompt, {
    model: "gemini-3-flash-preview",
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
  const profileRef = db.doc(`artifacts/marching-art/users/${userId}/profile/data`);

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
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "User must be authenticated");
    }

    const { corpsClass } = request.data || {};

    if (!corpsClass || !CORPS_CLASSES.includes(corpsClass)) {
      throw new HttpsError("invalid-argument", "Valid corpsClass is required");
    }

    const db = getDb();
    const userId = request.auth.uid;

    // Fetch user's profile
    const profileDoc = await db
      .doc(`artifacts/marching-art/users/${userId}/profile/data`)
      .get();

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
      throw new HttpsError("internal", error.message || "Failed to generate avatar");
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
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "User must be authenticated");
    }

    // Check admin status
    if (!request.auth.token?.admin) {
      throw new HttpsError("permission-denied", "Only admins can regenerate all avatars");
    }

    const db = getDb();
    const { limit = 10 } = request.data || {};

    try {
      // Get users with corps that have uniform designs
      const usersRef = db.collection("artifacts/marching-art/users");
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
      throw new HttpsError("internal", error.message);
    }
  }
);
