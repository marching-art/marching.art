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
  pack_tailors_cut: {
    name: "The Tailors' Cut",
    house: "Harrow & Finch",
    features: "the long coat silhouette",
  },
  pack_plumassier: {
    name: "Plumassier Collection",
    house: "Casa Roldán",
    features: "the quill fan and cascade willow plumes",
  },
};

/**
 * Prestige regalia gated on NON-pack shop items (titles). Same ownership
 * check — cosmetics.owned holds every item kind — but a different player
 * story: the regalia comes with the rank, not off a rack, so the missing-item
 * message names the title rather than a design house.
 */
const PRESTIGE_UNLOCKS = {
  title_drum_major: {
    name: "the Drum Major's aiguillette",
    requires: "the Drum Major title",
  },
};

/**
 * Which shop item ids (packs + prestige titles) a figure's features require.
 * Pure.
 * @param {any} figure a validated FigureConfig.
 * @returns {string[]}
 */
function requiredPacksFor(figure) {
  const packs = new Set();
  const fig = figure || {};
  if (fig.iridescent || fig.lame) packs.add("pack_texture_atelier");
  if (fig.hatType === "busby" || fig.cape) packs.add("pack_military_outfitters");
  if (fig.torsoStyle === "longcoat") packs.add("pack_tailors_cut");
  if (fig.plume && (fig.plume.type === "fan" || fig.plume.type === "cascade")) {
    packs.add("pack_plumassier");
  }
  if (fig.aiguillette) packs.add("title_drum_major");
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
 * @param {string[]} missing pack/title item ids.
 */
function missingPacksMessage(missing) {
  const names = missing
    .map((id) => {
      const pack = UNIFORM_PACKS[/** @type {keyof typeof UNIFORM_PACKS} */ (id)];
      if (pack) return `${pack.name} (${pack.house})`;
      const prestige = PRESTIGE_UNLOCKS[/** @type {keyof typeof PRESTIGE_UNLOCKS} */ (id)];
      if (prestige) return `${prestige.name} (requires ${prestige.requires})`;
      return id;
    })
    .join(", ");
  return `This design uses ${names} — unlock ${missing.length > 1 ? "them" : "it"} in the Shop to save it. Previewing in the Studio is always free.`;
}

module.exports = {
  UNIFORM_PACKS,
  PRESTIGE_UNLOCKS,
  requiredPacksFor,
  missingPacksFor,
  missingPacksMessage,
};
