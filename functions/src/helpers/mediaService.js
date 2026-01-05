/**
 * MediaService - Cloudinary Image Upload & Optimization
 *
 * Handles image uploads to Cloudinary with automatic optimization.
 * Includes fallback to placeholder images when uploads fail.
 *
 * Environment Variables Required:
 * - CLOUDINARY_CLOUD_NAME
 * - CLOUDINARY_API_KEY
 * - CLOUDINARY_API_SECRET
 */

const cloudinary = require("cloudinary").v2;
const { logger } = require("firebase-functions/v2");

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
 * @returns {string} Optimized Cloudinary URL
 */
function buildOptimizedUrl(publicId, options = {}) {
  const transformations = {
    ...DEFAULT_TRANSFORMATIONS,
    ...options,
  };

  return cloudinary.url(publicId, {
    transformation: [transformations],
    secure: true,
  });
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

  // Check if Cloudinary is configured
  if (!initializeCloudinary()) {
    logger.info("Cloudinary not configured, returning placeholder");
    return {
      success: false,
      url: getContextualPlaceholder({ newsCategory: category, headline }),
      isPlaceholder: true,
    };
  }

  try {
    // Generate unique public ID if not provided
    const finalPublicId = publicId || `news_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Upload using base64 data URI
    const base64Data = imageBuffer.toString("base64");
    const dataUri = `data:image/jpeg;base64,${base64Data}`;

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
    });

    // Return optimized URL
    return {
      success: true,
      url: buildOptimizedUrl(uploadResult.public_id),
      publicId: uploadResult.public_id,
      originalUrl: uploadResult.secure_url,
      width: uploadResult.width,
      height: uploadResult.height,
      format: uploadResult.format,
      bytes: uploadResult.bytes,
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

  // Check if Cloudinary is configured
  if (!initializeCloudinary()) {
    logger.info("Cloudinary not configured, returning placeholder");
    return {
      success: false,
      url: getContextualPlaceholder({ newsCategory: category, headline }),
      isPlaceholder: true,
    };
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
      sourceUrl: imageUrl,
    });

    return {
      success: true,
      url: buildOptimizedUrl(uploadResult.public_id),
      publicId: uploadResult.public_id,
      originalUrl: uploadResult.secure_url,
      width: uploadResult.width,
      height: uploadResult.height,
      format: uploadResult.format,
      bytes: uploadResult.bytes,
      isPlaceholder: false,
    };
  } catch (error) {
    logger.error("Cloudinary URL upload failed:", error);

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
