// =============================================================================
// UNIFORM STUDIO — rendered-figure reference images for the image models
// =============================================================================
// When a director equips a design, the Studio client rasterizes the exact
// figure it drew and equipUniformDesign re-hosts it as `previewUrl` on the
// equipped snapshot (helpers/uniformPreview). Both Gemini image models accept
// reference images, and a picture of the design is the one description that
// cannot lose a detail in translation: which shoulder the sash crosses, where
// the stripe runs, how the two-tone plume is dyed. This module turns those
// stored snapshots back into the `referenceImages` option generateImageWithImagen
// takes, with a caption that tells the model the image is a flat schematic to
// reproduce on real performers — not a style to copy.
//
// Never throws: a missing, slow, or oversized preview simply yields no
// reference and the prompt's exhaustive prose spec carries the design alone.

const { logger } = require("firebase-functions/v2");

/** A rendered figure is a few tens of KB; anything larger is not ours. */
const MAX_REFERENCE_BYTES = 2 * 1024 * 1024;
const FETCH_TIMEOUT_MS = 8000;

const CORPS_CAPTION =
  "the director's OWN rendered illustration of the corps uniform — a flat, front-facing schematic drawn by the marching.art Uniform Studio (the sides of the drawing are the viewer's left and right). It is the ground truth for the garment cut, every color and exactly where it sits, the chest treatment (sash/baldric/braid/panel/buttons/swash), the neck, shoulders, waist, each sleeve, gauntlet and glove, each trouser leg and stripe, the shoes, and the headwear and plume. Dress every brass, percussion, and drum-major performer in EXACTLY this design, rendered as real tailored fabric, sequins, and metal under stadium light. Do NOT copy the drawing's flat illustration style, proportions, or face — only the uniform it depicts.";

const GUARD_CAPTION =
  "the director's OWN rendered illustration of the COLOR GUARD's show costume (same flat Studio schematic). Only guard members wear this design; reproduce it exactly, as real fabric, on any guard performer in frame, and never blend it with the corps uniform.";

/**
 * Fetch an https image into the `{ data, mimeType }` shape the image models
 * take, with a hard byte cap and timeout. Returns null on any failure.
 *
 * Only the URLs equipUniformDesign itself wrote (our Cloudinary / Storage
 * hosts) ever reach here, so there is no user-controlled destination.
 *
 * @param {unknown} url
 * @returns {Promise<{ data: string, mimeType: string } | null>}
 */
async function fetchImageAsBase64(url) {
  if (typeof url !== "string" || !/^https:\/\//i.test(url)) return null;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      redirect: "follow",
      headers: { "User-Agent": "marching.art-uniform-reference/1.0" },
    });
    if (!response.ok) return null;
    const contentType = (response.headers.get("content-type") || "").split(";")[0].trim().toLowerCase();
    if (!contentType.startsWith("image/")) return null;
    const declared = Number(response.headers.get("content-length"));
    if (Number.isFinite(declared) && declared > MAX_REFERENCE_BYTES) return null;
    const buffer = Buffer.from(await response.arrayBuffer());
    if (buffer.length === 0 || buffer.length > MAX_REFERENCE_BYTES) return null;
    return {
      data: buffer.toString("base64"),
      mimeType: contentType === "image/jpg" ? "image/jpeg" : contentType,
    };
  } catch (err) {
    logger.warn("Uniform reference image fetch failed:", /** @type {Error} */ (err).message);
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Reference images for a resolved corps design (`resolveCorpsUniform` output:
 * the equipped snapshot, optionally with a `.guard` sub-design). Each carries
 * the caption generateImageWithImagen prints next to it.
 *
 * @param {object|null|undefined} design
 * @returns {Promise<Array<{ data: string, mimeType: string, caption: string }>>}
 */
async function loadUniformReferenceImages(design) {
  if (!design || typeof design !== "object") return [];
  const out = [];
  const corps = await fetchImageAsBase64(design.previewUrl);
  if (corps) out.push({ ...corps, caption: CORPS_CAPTION });
  const guard = design.guard && (await fetchImageAsBase64(design.guard.previewUrl));
  if (guard) out.push({ ...guard, caption: GUARD_CAPTION });
  if (out.length > 0) {
    logger.info("Attached Uniform Studio reference image(s)", { count: out.length });
  }
  return out;
}

module.exports = {
  loadUniformReferenceImages,
  fetchImageAsBase64,
  MAX_REFERENCE_BYTES,
  CORPS_CAPTION,
  GUARD_CAPTION,
};
