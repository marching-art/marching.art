// =============================================================================
// UNIFORM STUDIO — equipped-design preview snapshots
// =============================================================================
// The Studio client rasterizes the figure it just rendered (src/utils/
// uniformPreview.ts) and sends the PNG with the equip call. This module
// validates that payload and re-hosts it next to the corps avatars, so the
// news/avatar image pipeline (helpers/uniformReference) can hand the image
// models a picture of the exact design instead of prose alone.
//
// The preview is strictly optional: an older client, a browser without canvas,
// or a failed upload all leave the snapshot without `previewUrl`, and every
// consumer falls back to the exhaustive prose spec.

const { logger } = require("firebase-functions/v2");
const { uploadFromUrl } = require("./mediaService");

/** A 2x rasterized figure is ~30–120 KB; this caps a hostile payload. */
const MAX_PREVIEW_BYTES = 400 * 1024;
const PREVIEW_DATA_URL_RE = /^data:image\/png;base64,[A-Za-z0-9+/]+={0,2}$/;

/**
 * Validate a client-supplied preview PNG data URL.
 * @param {unknown} previewPng
 * @returns {string|null} an error message, or null when valid.
 */
function validatePreviewPng(previewPng) {
  if (typeof previewPng !== "string") return "previewPng must be a PNG data URL";
  if (previewPng.length > MAX_PREVIEW_BYTES * 1.4) return "previewPng is too large";
  if (!PREVIEW_DATA_URL_RE.test(previewPng)) return "previewPng must be a PNG data URL";
  const bytes = Math.floor((previewPng.length - previewPng.indexOf(",") - 1) * 0.75);
  if (bytes > MAX_PREVIEW_BYTES) return "previewPng is too large";
  return null;
}

/**
 * Re-host a validated preview PNG. Same folder family as the corps avatars,
 * one stable public id per (uid, class, slot) so re-equipping overwrites
 * rather than orphans. Never throws — returns null when storage is
 * unavailable so an equip never fails because of its optional picture.
 *
 * @param {{ uid: string, classKey: string, slot: string, previewPng: string }} params
 * @returns {Promise<string|null>}
 */
async function storeUniformPreview({ uid, classKey, slot, previewPng }) {
  try {
    const result = await uploadFromUrl(previewPng, {
      folder: "uniform_previews",
      publicId: `uniform_${uid}_${classKey}_${slot}`,
    });
    if (result && result.success && result.url && !result.isPlaceholder) {
      return result.url;
    }
    logger.warn("Uniform preview upload did not land; equipping without a preview", {
      uid,
      classKey,
      slot,
      error: result && result.error,
    });
    return null;
  } catch (err) {
    logger.warn("Uniform preview upload threw; equipping without a preview", {
      uid,
      classKey,
      slot,
      error: /** @type {Error} */ (err).message,
    });
    return null;
  }
}

module.exports = {
  validatePreviewPng,
  storeUniformPreview,
  MAX_PREVIEW_BYTES,
};
