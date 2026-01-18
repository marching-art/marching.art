/**
 * MediaService - Cloudinary Image Upload & Optimization
 *
 * Handles image uploads to Cloudinary with automatic optimization.
 * Falls back to Firebase Storage when Cloudinary is not configured.
 * Includes fallback to placeholder images when all uploads fail.
 *
 * Environment Variables Required for Cloudinary:
 * - CLOUDINARY_CLOUD_NAME
 * - CLOUDINARY_API_KEY
 * - CLOUDINARY_API_SECRET
 *
 * Firebase Storage is used as fallback (no additional config needed)
 */

const cloudinary = require("cloudinary").v2;
const { logger } = require("firebase-functions/v2");
const admin = require("firebase-admin");

// =============================================================================
// CLOUDINARY CONFIGURATION
// =============================================================================

let isConfigured = false;

/**
 * Initialize Cloudinary with environment credentials
 * Uses lazy initialization to avoid errors when env vars aren't set
 */
function initializeCloudinary() {
  if (isConfigured) return true;

  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  const apiKey = process.env.CLOUDINARY_API_KEY;
  const apiSecret = process.env.CLOUDINARY_API_SECRET;

  if (!cloudName || !apiKey || !apiSecret) {
    logger.warn("Cloudinary credentials not configured. Using fallback images.");
    return false;
  }

  cloudinary.config({
    cloud_name: cloudName,
    api_key: apiKey,
    api_secret: apiSecret,
    secure: true,
  });

  isConfigured = true;
  logger.info("Cloudinary initialized successfully");
  return true;
}

// =============================================================================
// FIREBASE STORAGE FALLBACK
// =============================================================================

/**
 * Upload image to Firebase Storage (fallback when Cloudinary is not configured)
 * @param {string} base64Data - Base64 encoded image data (with or without data URL prefix)
 * @param {Object} options - Upload options
 * @param {string} options.folder - Storage folder path
 * @param {string} options.publicId - Custom file name (optional)
 * @returns {Promise<Object>} Upload result with public URL
 */
async function uploadToFirebaseStorage(base64Data, options = {}) {
  const {
    folder = "marching-art/news",
    publicId,
  } = options;

  try {
    const bucket = admin.storage().bucket();

    // Parse base64 data URL
    let imageBuffer;
    let mimeType = "image/jpeg";

    if (base64Data.startsWith("data:")) {
      const matches = base64Data.match(/^data:([^;]+);base64,(.+)$/);
      if (matches) {
        mimeType = matches[1];
        imageBuffer = Buffer.from(matches[2], "base64");
      } else {
        throw new Error("Invalid base64 data URL format");
      }
    } else {
      imageBuffer = Buffer.from(base64Data, "base64");
    }

    // Generate unique file name
    const extension = mimeType.split("/")[1] || "jpg";
    const fileName = publicId || `news_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const filePath = `${folder}/${fileName}.${extension}`;

    // Upload to Firebase Storage
    const file = bucket.file(filePath);
    await file.save(imageBuffer, {
      metadata: {
        contentType: mimeType,
        cacheControl: "public, max-age=31536000", // Cache for 1 year
      },
    });

    // Make the file publicly accessible
    await file.makePublic();

    // Get the public URL with cache-busting timestamp
    const timestamp = Date.now();
    const publicUrl = `https://storage.googleapis.com/${bucket.name}/${filePath}?v=${timestamp}`;

    logger.info("Image uploaded to Firebase Storage:", {
      filePath,
      url: publicUrl,
      bytes: imageBuffer.length,
      version: timestamp,
    });

    return {
      success: true,
      url: publicUrl,
      filePath,
      bytes: imageBuffer.length,
      version: timestamp,
      isPlaceholder: false,
    };
  } catch (error) {
    logger.error("Firebase Storage upload failed:", error);
    return {
      success: false,
      error: error.message,
    };
  }
}

// =============================================================================
// PLACEHOLDER IMAGES
// =============================================================================

/**
 * High-quality placeholder images for corps action shots
 * Using marching band and drum corps related images from Unsplash
 *
 * Categories:
 * - brass: Hornline/brass section shots
 * - percussion: Drumline/pit percussion shots
 * - guard: Color guard/winterguard shots
 * - full_corps: Full corps ensemble shots
 * - stadium: Stadium/venue atmosphere shots
 */
const PLACEHOLDER_IMAGES = {
  brass: [
    // Marching band brass section images
    "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=1200&q=80&auto=format", // Marching band
    "https://images.unsplash.com/photo-1598387993441-a364f854c3e1?w=1200&q=80&auto=format", // Brass instruments
    "https://images.unsplash.com/photo-1576485290814-1c72aa4bbb8e?w=1200&q=80&auto=format", // Marching band on field
  ],
  percussion: [
    // Drumline and percussion images
    "https://images.unsplash.com/photo-1485579149621-3123dd979885?w=1200&q=80&auto=format", // Marching snare drums
    "https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=1200&q=80&auto=format", // Drums
  ],
  guard: [
    // Color guard / flags images
    "https://images.unsplash.com/photo-1587560699334-cc4ff634909a?w=1200&q=80&auto=format", // Flags/performance
  ],
  full_corps: [
    // Football field / marching ensemble images
    "https://images.unsplash.com/photo-1566577739112-5180d4bf9390?w=1200&q=80&auto=format", // Football field at night
    "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=1200&q=80&auto=format", // Marching band
    "https://images.unsplash.com/photo-1576485290814-1c72aa4bbb8e?w=1200&q=80&auto=format", // Marching band formation
  ],
  stadium: [
    // Stadium at night / football field atmosphere
    "https://images.unsplash.com/photo-1566577739112-5180d4bf9390?w=1200&q=80&auto=format", // Stadium lights at night
    "https://images.unsplash.com/photo-1544465544-1b71aee9dfa3?w=1200&q=80&auto=format", // Football stadium
  ],
  default: [
    // Default to stadium/field images (NOT concerts)
    "https://images.unsplash.com/photo-1566577739112-5180d4bf9390?w=1200&q=80&auto=format", // Football field at night
  ],
};

/**
 * Get a random placeholder image URL
 * @param {string} category - Image category (brass, percussion, guard, full_corps, stadium)
 * @returns {string} Optimized placeholder image URL
 */
function getPlaceholderImage(category = "default") {
  const images = PLACEHOLDER_IMAGES[category] || PLACEHOLDER_IMAGES.default;
  const randomIndex = Math.floor(Math.random() * images.length);
  return images[randomIndex];
}

/**
 * Get placeholder based on article content/category
 * @param {Object} options - Options for selecting placeholder
 * @param {string} options.newsCategory - News category (dci, fantasy, analysis)
 * @param {string} options.headline - Article headline for context
 * @returns {string} Appropriate placeholder image URL
 */
function getContextualPlaceholder({ newsCategory, headline = "" }) {
  const headlineLower = headline.toLowerCase();

  // Match headline keywords to image categories
  if (headlineLower.includes("brass") || headlineLower.includes("hornline")) {
    return getPlaceholderImage("brass");
  }
  if (headlineLower.includes("percussion") || headlineLower.includes("drumline")) {
    return getPlaceholderImage("percussion");
  }
  if (headlineLower.includes("guard") || headlineLower.includes("color guard")) {
    return getPlaceholderImage("guard");
  }
  if (headlineLower.includes("stadium") || headlineLower.includes("finals")) {
    return getPlaceholderImage("stadium");
  }

  // Default to full corps shots
  return getPlaceholderImage("full_corps");
}

// =============================================================================
// CLOUDINARY UPLOAD FUNCTIONS
// =============================================================================

/**
 * Default Cloudinary transformation options for optimal performance
 * - auto format: Serves WebP/AVIF when supported
 * - auto quality: Optimizes quality based on content
 * - width: Constrains max width for web delivery
 */
const DEFAULT_TRANSFORMATIONS = {
  fetch_format: "auto",
  quality: "auto",
  width: 1200,
  crop: "limit",
};

/**
 * Build optimized Cloudinary URL with transformations
 * @param {string} publicId - Cloudinary public ID
 * @param {Object} options - Additional transformation options
 * @param {string|number} version - Optional Cloudinary version for cache-busting
 * @returns {string} Optimized Cloudinary URL
 */
function buildOptimizedUrl(publicId, options = {}, version = null) {
  const transformations = {
    ...DEFAULT_TRANSFORMATIONS,
    ...options,
  };

  const urlOptions = {
    transformation: [transformations],
    secure: true,
  };

  // Include version for cache-busting when provided
  if (version) {
    urlOptions.version = version;
  }

  return cloudinary.url(publicId, urlOptions);
}

/**
 * Upload an image buffer to Cloudinary
 * @param {Buffer} imageBuffer - Image data as Buffer
 * @param {Object} options - Upload options
 * @param {string} options.folder - Cloudinary folder path
 * @param {string} options.publicId - Custom public ID (optional)
 * @param {string} options.category - Image category for fallback
 * @returns {Promise<Object>} Upload result with URL
 */
async function uploadImage(imageBuffer, options = {}) {
  const {
    folder = "marching-art/news",
    publicId,
    category = "default",
    headline = "",
  } = options;

  // Upload using base64 data URI
  const base64Data = imageBuffer.toString("base64");
  const dataUri = `data:image/jpeg;base64,${base64Data}`;

  // Check if Cloudinary is configured
  if (!initializeCloudinary()) {
    logger.info("Cloudinary not configured, trying Firebase Storage fallback");

    // Try Firebase Storage as fallback
    const storageResult = await uploadToFirebaseStorage(dataUri, {
      folder,
      publicId,
    });

    if (storageResult.success) {
      logger.info("Image uploaded to Firebase Storage (Cloudinary fallback)");
      return storageResult;
    }

    logger.warn("Firebase Storage fallback also failed:", storageResult.error);
    return {
      success: false,
      url: getContextualPlaceholder({ newsCategory: category, headline }),
      isPlaceholder: true,
    };
  }

  try {
    // Generate unique public ID if not provided
    const finalPublicId = publicId || `news_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    const uploadResult = await cloudinary.uploader.upload(dataUri, {
      folder,
      public_id: finalPublicId,
      resource_type: "image",
      overwrite: true,
      // Apply default transformations on upload
      transformation: [
        { fetch_format: "auto", quality: "auto" },
      ],
    });

    logger.info("Image uploaded successfully:", {
      publicId: uploadResult.public_id,
      url: uploadResult.secure_url,
      bytes: uploadResult.bytes,
      version: uploadResult.version,
    });

    // Return optimized URL with version for cache-busting
    return {
      success: true,
      url: buildOptimizedUrl(uploadResult.public_id, {}, uploadResult.version),
      publicId: uploadResult.public_id,
      originalUrl: uploadResult.secure_url,
      width: uploadResult.width,
      height: uploadResult.height,
      format: uploadResult.format,
      bytes: uploadResult.bytes,
      version: uploadResult.version,
      isPlaceholder: false,
    };
  } catch (error) {
    logger.error("Cloudinary upload failed:", error);

    // Return fallback placeholder
    return {
      success: false,
      url: getContextualPlaceholder({ newsCategory: category, headline }),
      error: error.message,
      isPlaceholder: true,
    };
  }
}

/**
 * Upload image from URL to Cloudinary
 * @param {string} imageUrl - Source image URL
 * @param {Object} options - Upload options
 * @returns {Promise<Object>} Upload result with URL
 */
async function uploadFromUrl(imageUrl, options = {}) {
  const {
    folder = "marching-art/news",
    publicId,
    category = "default",
    headline = "",
  } = options;

  // Validate input
  if (!imageUrl || typeof imageUrl !== "string") {
    logger.error("Cloudinary upload: Invalid imageUrl provided", {
      type: typeof imageUrl,
      hasValue: !!imageUrl,
    });
    return {
      success: false,
      url: getContextualPlaceholder({ newsCategory: category, headline }),
      error: "Invalid image URL provided",
      isPlaceholder: true,
    };
  }

  // For base64 data URLs, validate format first
  const isBase64 = imageUrl.startsWith("data:");

  // Check if Cloudinary is configured
  if (!initializeCloudinary()) {
    logger.info("Cloudinary not configured, trying Firebase Storage fallback");

    // For base64 images, try Firebase Storage as fallback
    if (isBase64) {
      const storageResult = await uploadToFirebaseStorage(imageUrl, {
        folder,
        publicId,
      });

      if (storageResult.success) {
        logger.info("Image uploaded to Firebase Storage (Cloudinary fallback)");
        return storageResult;
      }

      logger.warn("Firebase Storage fallback also failed:", storageResult.error);
    }

    // Return placeholder if all uploads fail
    return {
      success: false,
      url: getContextualPlaceholder({ newsCategory: category, headline }),
      isPlaceholder: true,
    };
  }
  if (isBase64) {
    const base64Regex = /^data:image\/(jpeg|jpg|png|gif|webp);base64,/;
    if (!base64Regex.test(imageUrl)) {
      logger.error("Cloudinary upload: Invalid base64 data URL format", {
        prefix: imageUrl.substring(0, 50),
      });
      return {
        success: false,
        url: getContextualPlaceholder({ newsCategory: category, headline }),
        error: "Invalid base64 data URL format",
        isPlaceholder: true,
      };
    }
    logger.info("Uploading base64 image to Cloudinary", {
      dataLength: imageUrl.length,
      estimatedSizeKB: Math.round(imageUrl.length * 0.75 / 1024),
    });
  }

  try {
    const finalPublicId = publicId || `news_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    const uploadResult = await cloudinary.uploader.upload(imageUrl, {
      folder,
      public_id: finalPublicId,
      resource_type: "image",
      overwrite: true,
      transformation: [
        { fetch_format: "auto", quality: "auto" },
      ],
    });

    logger.info("Image uploaded from URL successfully:", {
      publicId: uploadResult.public_id,
      sourceType: isBase64 ? "base64" : "url",
      version: uploadResult.version,
    });

    // Return optimized URL with version for cache-busting
    return {
      success: true,
      url: buildOptimizedUrl(uploadResult.public_id, {}, uploadResult.version),
      publicId: uploadResult.public_id,
      originalUrl: uploadResult.secure_url,
      width: uploadResult.width,
      height: uploadResult.height,
      format: uploadResult.format,
      bytes: uploadResult.bytes,
      version: uploadResult.version,
      isPlaceholder: false,
    };
  } catch (error) {
    // Log error details separately for Firebase Functions compatibility
    logger.error("Cloudinary URL upload failed - Error details:", String(error));
    logger.error("Cloudinary error properties:", JSON.stringify({
      message: error?.message || "no message",
      name: error?.name || "no name",
      http_code: error?.http_code || "no http_code",
      cloudinaryError: error?.error || "no error property",
      sourceType: isBase64 ? "base64" : "url",
      sourceLength: imageUrl?.length || 0,
      folder,
      publicId: publicId || "(auto-generated)",
    }));
    // Also log the full error object
    logger.error("Full error object:", JSON.stringify(error, Object.getOwnPropertyNames(error || {})));

    return {
      success: false,
      url: getContextualPlaceholder({ newsCategory: category, headline }),
      error: error.message,
      isPlaceholder: true,
    };
  }
}

/**
 * Delete an image from Cloudinary
 * @param {string} publicId - Cloudinary public ID to delete
 * @returns {Promise<boolean>} Success status
 */
async function deleteImage(publicId) {
  if (!initializeCloudinary()) {
    return false;
  }

  try {
    await cloudinary.uploader.destroy(publicId);
    logger.info("Image deleted:", publicId);
    return true;
  } catch (error) {
    logger.error("Failed to delete image:", error);
    return false;
  }
}

/**
 * Generate responsive image URLs for different sizes
 * @param {string} publicId - Cloudinary public ID
 * @returns {Object} Object with URLs for different sizes
 */
function getResponsiveUrls(publicId) {
  if (!publicId) {
    const placeholder = getPlaceholderImage("full_corps");
    return {
      thumbnail: placeholder,
      small: placeholder,
      medium: placeholder,
      large: placeholder,
      original: placeholder,
    };
  }

  return {
    thumbnail: buildOptimizedUrl(publicId, { width: 150, height: 150, crop: "fill" }),
    small: buildOptimizedUrl(publicId, { width: 400 }),
    medium: buildOptimizedUrl(publicId, { width: 800 }),
    large: buildOptimizedUrl(publicId, { width: 1200 }),
    original: buildOptimizedUrl(publicId, {}),
  };
}

// =============================================================================
// EXPORTS
// =============================================================================

module.exports = {
  // Core upload functions
  uploadImage,
  uploadFromUrl,
  uploadToFirebaseStorage,
  deleteImage,

  // URL builders
  buildOptimizedUrl,
  getResponsiveUrls,

  // Placeholder functions
  getPlaceholderImage,
  getContextualPlaceholder,

  // Configuration
  initializeCloudinary,

  // Constants
  PLACEHOLDER_IMAGES,
  DEFAULT_TRANSFORMATIONS,
};
