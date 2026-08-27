// =============================================================================
// UNIFORM PACK ENTITLEMENTS — client mirror (advisory only)
// =============================================================================
// Mirrors functions/src/helpers/uniformEntitlements.js so the Studio can show
// which design-house packs a draft uses BEFORE the save round-trips. The
// server is the real gate (every wardrobe write re-checks ownership); this
// module only powers the "try on free, own to save" banner and the 🔒 labels.
// The mirror test keeps pack ids in lock-step with the shop catalog.

import type { FigureConfig } from '../types/uniform';

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

/** Which shop item ids (packs + prestige titles) a figure requires. Pure. */
export function requiredPacksFor(figure: FigureConfig | undefined | null): string[] {
  const packs = new Set<string>();
  const fig = figure || ({} as FigureConfig);
  if (fig.iridescent || fig.lame) packs.add('pack_texture_atelier');
  if (fig.hatType === 'busby' || fig.cape) packs.add('pack_military_outfitters');
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
