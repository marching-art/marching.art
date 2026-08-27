// =============================================================================
// UNIFORM PACK ENTITLEMENTS — which designs need which shop packs
// =============================================================================
// The design-house layer (docs/UNIFORM_STUDIO.md §8.2/§8.4). The free floor is
// absolute: every feature that ever shipped free stays free, and packs gate
// only content BORN premium. The Studio previews everything ("try on free");
// this module is the single map from gated figure features to the shop item
// that unlocks them, enforced at every wardrobe WRITE (saveUniformDesign and
// the Exchange's save-a-copy) — so nothing gated can be kept, equipped, or
// re-shared without the pack, while browsing and previewing stay open.
//
// Mirrored client-side in src/utils/uniformPacks.ts (advisory banner only —
// the server is the gate); the mirror test keeps the ids in lock-step.

/** Pack metadata, keyed by the shopCatalog item id. */
const UNIFORM_PACKS = {
  pack_texture_atelier: {
    name: "Texture Atelier",
    house: "Maison Verdier",
    features: "iridescent & lamé finishes",
  },
  pack_military_outfitters: {
    name: "Military Outfitters Collection",
    house: "Blackwell & Sons",
    features: "the busby and the shoulder cape",
  },
};

/**
 * Which pack item ids a figure's features require. Pure.
 * @param {any} figure a validated FigureConfig.
 * @returns {string[]}
 */
function requiredPacksFor(figure) {
  const packs = new Set();
  const fig = figure || {};
  if (fig.iridescent || fig.lame) packs.add("pack_texture_atelier");
  if (fig.hatType === "busby" || fig.cape) packs.add("pack_military_outfitters");
  return [...packs];
}

/**
 * The packs a figure needs that the owner does NOT hold.
 * @param {any} figure
 * @param {string[] | undefined} owned profile cosmetics.owned.
 * @returns {string[]}
 */
function missingPacksFor(figure, owned) {
  const have = new Set(Array.isArray(owned) ? owned : []);
  return requiredPacksFor(figure).filter((id) => !have.has(id));
}

/**
 * Player-facing message naming what's missing.
 * @param {string[]} missing pack item ids.
 */
function missingPacksMessage(missing) {
  const names = missing
    .map((id) => {
      const pack = UNIFORM_PACKS[/** @type {keyof typeof UNIFORM_PACKS} */ (id)];
      return pack ? `${pack.name} (${pack.house})` : id;
    })
    .join(", ");
  return `This design uses ${names} — unlock the pack in the Shop to save it. Previewing in the Studio is always free.`;
}

module.exports = { UNIFORM_PACKS, requiredPacksFor, missingPacksFor, missingPacksMessage };
