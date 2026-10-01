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
  pack_prism_forge: {
    name: "Prism Forge Collection",
    house: "Lumen & Vane",
    features: "the split panel, shatter print, light streak, glow cuffs & hems, knee plates and seams",
  },
  pack_wildwood: {
    name: "Wildwood Collection",
    house: "Alder & Moss",
    features: "the vein network, bioluminescent glow, gill fan, sheer drape and patina brocade print",
  },
  pack_ember_glass: {
    name: "Ember Glass Collection",
    house: "Kiln & Lantern",
    features: "the ember glass print, swept yoke and printed hat panel",
  },
};

/** Hats with a front face that can carry the Ember Glass panel. */
const PANEL_HATS = new Set(["shako", "pith", "contour"]);

/**
 * Whether the hat's front panel draws: a panel on a hat with a front face.
 * Mirrors hatShowsPanel in src/utils/uniform.ts. Pure.
 * @param {any} fig
 * @returns {boolean}
 */
function hatShowsPanel(fig) {
  return Boolean(fig && fig.hat && fig.hat.panel && PANEL_HATS.has(fig.hatType));
}

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
 * Whether a figure wears any Prism Forge piece (Lumen & Vane): the split
 * panel, the shatter print on any surface, the light streak, glow cuffs or
 * hems (a cuff counts only on a full sleeve, the one cut that shows it),
 * knee plates, or leg seams. Pure.
 * @param {any} fig
 * @returns {boolean}
 */
function usesPrismForge(fig) {
  const arms = [fig.armL, fig.armR];
  const legs = [fig.legL, fig.legR];
  const fills = [
    fig.torsoFill,
    fig.mockNeck,
    fig.torsoSplit && fig.torsoSplit.fill,
    hatShowsPanel(fig) ? fig.hat.panel : null,
    ...arms.map((a) => a && a.fill),
    ...legs.map((l) => l && l.fill),
  ];
  return Boolean(
    fig.torsoSplit ||
      fig.chest === "streak" ||
      fills.includes("url:shatter") ||
      arms.some((a) => a && a.cuffGlow && a.type === "sleeve") ||
      legs.some((l) => l && (l.hemGlow || l.kneePlate || l.seams))
  );
}

/**
 * Whether an arm's Wildwood veins land on anything: a sleeve (full, half or
 * detached), a gauntlet, or a glove. Mirrors armShowsVeins in
 * src/utils/uniform.ts. Pure.
 * @param {any} a
 * @returns {boolean}
 */
function armShowsVeins(a) {
  if (!a || !a.veins || a.type === "none") return false;
  return a.type !== "bare" || Boolean(a.gauntlet || a.glove);
}

/**
 * Whether a figure wears any Wildwood piece (Alder & Moss): the brocade print
 * on any surface, the gill fan, the sheer drape, or veins anywhere they show
 * (a vein glow only draws on a visible vein, so it never counts alone). Pure.
 * @param {any} fig
 * @returns {boolean}
 */
function usesWildwood(fig) {
  const arms = [fig.armL, fig.armR];
  const legs = [fig.legL, fig.legR];
  const fills = [
    fig.torsoFill,
    fig.mockNeck,
    fig.torsoSplit && fig.torsoSplit.fill,
    hatShowsPanel(fig) ? fig.hat.panel : null,
    ...arms.map((a) => a && a.fill),
    ...legs.map((l) => l && l.fill),
  ];
  return Boolean(
    fig.chest === "gill" ||
      fig.drape ||
      fig.veins ||
      fills.includes("url:brocade") ||
      arms.some(armShowsVeins) ||
      legs.some((l) => l && l.veins)
  );
}

/**
 * Whether a figure wears any Ember Glass piece (Kiln & Lantern): the ember
 * glass print on any surface, the swept yoke, or a hat front panel on a hat
 * that shows one. Pure.
 * @param {any} fig
 * @returns {boolean}
 */
function usesEmberGlass(fig) {
  const arms = [fig.armL, fig.armR];
  const legs = [fig.legL, fig.legR];
  const fills = [
    fig.torsoFill,
    fig.mockNeck,
    fig.torsoSplit && fig.torsoSplit.fill,
    ...arms.map((a) => a && a.fill),
    ...legs.map((l) => l && l.fill),
  ];
  return Boolean(fig.chest === "yoke" || hatShowsPanel(fig) || fills.includes("url:ember"));
}

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
  if (usesPrismForge(fig)) packs.add("pack_prism_forge");
  if (usesWildwood(fig)) packs.add("pack_wildwood");
  if (usesEmberGlass(fig)) packs.add("pack_ember_glass");
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
  armShowsVeins,
  hatShowsPanel,
  requiredPacksFor,
  missingPacksFor,
  missingPacksMessage,
};
