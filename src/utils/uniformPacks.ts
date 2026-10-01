// =============================================================================
// UNIFORM PACK ENTITLEMENTS — client mirror (advisory only)
// =============================================================================
// Mirrors functions/src/helpers/uniformEntitlements.js so the Studio can show
// which design-house packs a draft uses BEFORE the save round-trips. The
// server is the real gate (every wardrobe write re-checks ownership); this
// module only powers the "try on free, own to save" banner and the 🔒 labels.
// The mirror test keeps pack ids in lock-step with the shop catalog.

import type { FigureConfig } from '../types/uniform';
import { armShowsBranchwork, hatShowsPanel } from './uniform';

export interface UniformPackMeta {
  /** Shop item id — pack ids must match SHOP_ITEMS type 'uniformPack' in
   *  cosmetics.js; prestige ids name the gating title item. */
  id: string;
  /** 'pack' = design-house pack for sale; 'prestige' = comes with a title. */
  kind: 'pack' | 'prestige';
  name: string;
  /** The fictional design house (packs) or the gating rank (prestige). */
  house: string;
  /** Short player-facing list of what it unlocks. */
  features: string;
}

export const UNIFORM_PACKS: UniformPackMeta[] = [
  {
    id: 'pack_texture_atelier',
    kind: 'pack',
    name: 'Texture Atelier',
    house: 'Maison Verdier',
    features: 'iridescent & lamé finishes',
  },
  {
    id: 'pack_military_outfitters',
    kind: 'pack',
    name: 'Military Outfitters Collection',
    house: 'Blackwell & Sons',
    features: 'the busby and the shoulder cape',
  },
  {
    id: 'pack_tailors_cut',
    kind: 'pack',
    name: "The Tailors' Cut",
    house: 'Harrow & Finch',
    features: 'the long coat silhouette',
  },
  {
    id: 'pack_plumassier',
    kind: 'pack',
    name: 'Plumassier Collection',
    house: 'Casa Roldán',
    features: 'the quill fan and cascade willow plumes',
  },
  {
    id: 'pack_prism_forge',
    kind: 'pack',
    name: 'Prism Forge Collection',
    house: 'Lumen & Vane',
    features:
      'the split panel, shatter print, light streak, glow cuffs & hems, knee plates and seams',
  },
  {
    id: 'pack_wildwood',
    kind: 'pack',
    name: 'Wildwood Collection',
    house: 'Alder & Moss',
    features: 'branchwork, its bioluminescent glow, gill fan, sheer drape and patina brocade print',
  },
  {
    id: 'pack_ember_glass',
    kind: 'pack',
    name: 'Ember Glass Collection',
    house: 'Kiln & Lantern',
    features: 'the ember glass print, swept yoke and printed hat panel',
  },
  {
    id: 'title_drum_major',
    kind: 'prestige',
    name: "the Drum Major's aiguillette",
    house: 'the Drum Major title',
    features: 'the braided ceremonial cord',
  },
];

export function getUniformPack(id: string): UniformPackMeta | undefined {
  return UNIFORM_PACKS.find((p) => p.id === id);
}

/** Whether a figure wears any Prism Forge piece (Lumen & Vane). Pure. */
export function usesPrismForge(fig: FigureConfig): boolean {
  const arms = [fig.armL, fig.armR];
  const legs = [fig.legL, fig.legR];
  const fills = [
    fig.torsoFill,
    fig.mockNeck,
    fig.torsoSplit?.fill,
    hatShowsPanel(fig) ? fig.hat?.panel : null,
    ...arms.map((a) => a?.fill),
    ...legs.map((l) => l?.fill),
  ];
  return Boolean(
    fig.torsoSplit ||
    fig.chest === 'streak' ||
    fills.includes('url:shatter') ||
    arms.some((a) => a?.cuffGlow && a.type === 'sleeve') ||
    legs.some((l) => l?.hemGlow || l?.kneePlate || l?.seams)
  );
}

/**
 * Whether a figure wears any Wildwood piece (Alder & Moss): the brocade print
 * on any surface, the gill fan, the sheer drape, or branchwork anywhere it shows
 * (its glow counts only while some branchwork is visible to carry it). Pure.
 */
export function usesWildwood(fig: FigureConfig): boolean {
  const arms = [fig.armL, fig.armR];
  const legs = [fig.legL, fig.legR];
  const fills = [
    fig.torsoFill,
    fig.mockNeck,
    fig.torsoSplit?.fill,
    hatShowsPanel(fig) ? fig.hat?.panel : null,
    ...arms.map((a) => a?.fill),
    ...legs.map((l) => l?.fill),
  ];
  return Boolean(
    fig.chest === 'gill' ||
    fig.drape ||
    fig.veins ||
    fills.includes('url:brocade') ||
    arms.some((a) => armShowsBranchwork(a)) ||
    legs.some((l) => l?.veins)
  );
}

/**
 * Whether a figure wears any Ember Glass piece (Kiln & Lantern): the ember
 * glass print on any surface, the swept yoke, or a hat front panel on a hat
 * that shows one (a panel left on a campaign or aussie never counts). Pure.
 */
export function usesEmberGlass(fig: FigureConfig): boolean {
  const arms = [fig.armL, fig.armR];
  const legs = [fig.legL, fig.legR];
  const fills = [
    fig.torsoFill,
    fig.mockNeck,
    fig.torsoSplit?.fill,
    ...arms.map((a) => a?.fill),
    ...legs.map((l) => l?.fill),
  ];
  return Boolean(fig.chest === 'yoke' || hatShowsPanel(fig) || fills.includes('url:ember'));
}

/** Which shop item ids (packs + prestige titles) a figure requires. Pure. */
export function requiredPacksFor(figure: FigureConfig | undefined | null): string[] {
  const packs = new Set<string>();
  const fig = figure || ({} as FigureConfig);
  if (fig.iridescent || fig.lame) packs.add('pack_texture_atelier');
  if (fig.hatType === 'busby' || fig.cape) packs.add('pack_military_outfitters');
  if (fig.torsoStyle === 'longcoat') packs.add('pack_tailors_cut');
  if (fig.plume && (fig.plume.type === 'fan' || fig.plume.type === 'cascade')) {
    packs.add('pack_plumassier');
  }
  if (usesPrismForge(fig)) packs.add('pack_prism_forge');
  if (usesWildwood(fig)) packs.add('pack_wildwood');
  if (usesEmberGlass(fig)) packs.add('pack_ember_glass');
  if (fig.aiguillette) packs.add('title_drum_major');
  return [...packs];
}

/** The packs a figure needs that the director does NOT own. */
export function missingPacksFor(
  figure: FigureConfig | undefined | null,
  owned: string[] | undefined | null
): UniformPackMeta[] {
  const have = new Set(Array.isArray(owned) ? owned : []);
  return requiredPacksFor(figure)
    .filter((id) => !have.has(id))
    .map((id) => getUniformPack(id))
    .filter((p): p is UniformPackMeta => Boolean(p));
}
