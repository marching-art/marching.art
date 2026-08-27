// Corps Identity Shop — client catalog mirror + display helpers.
// Ids and prices must stay in sync with functions/src/helpers/shopCatalog.js
// (the server validates every purchase/equip against its own copy; this
// mirror only drives display).

export const SHOP_ITEMS = [
  // --- Director titles: flair shown on the profile next to the level title ---
  {
    id: 'title_laureate',
    type: 'title',
    name: 'Laureate',
    price: null,
    grantOnly: true,
    description: 'Season reward ladder exclusive — reach Tier 12 in a single season',
    textClass: 'text-emerald-400',
  },
  {
    id: 'title_earned_not_given',
    type: 'title',
    name: 'Earned, Not Given',
    price: null,
    grantOnly: true,
    description: 'Unlocked a competition class early through XP — the hard way',
    textClass: 'text-amber-400',
  },
  // Legacy milestone titles — granted by makeLegacyEndowment as a director's
  // cumulative endowment total crosses each threshold (src/utils/legacy.ts).
  // Grant-only: they mark coin actually given away, so they cannot be bought.
  {
    id: 'title_legacy_patron',
    type: 'title',
    name: 'Patron',
    price: null,
    grantOnly: true,
    description: 'Endowed 5,000 CC to the corps that come after you',
    textClass: 'text-sky-400',
  },
  {
    id: 'title_legacy_benefactor',
    type: 'title',
    name: 'Benefactor',
    price: null,
    grantOnly: true,
    description: 'Endowed 25,000 CC across your career',
    textClass: 'text-teal-400',
  },
  {
    id: 'title_legacy_guarantor',
    type: 'title',
    name: 'Guarantor',
    price: null,
    grantOnly: true,
    description: 'Endowed 100,000 CC across your career',
    textClass: 'text-indigo-400',
  },
  {
    id: 'title_legacy_cornerstone',
    type: 'title',
    name: 'Cornerstone',
    price: null,
    grantOnly: true,
    description: 'Endowed 250,000 CC across your career',
    textClass: 'text-fuchsia-400',
  },
  {
    id: 'title_legacy_founding',
    type: 'title',
    name: 'Founding Legacy',
    price: null,
    grantOnly: true,
    description: 'Endowed 1,000,000 CC — a career\u2019s work given back',
    textClass: 'text-rose-400',
  },
  {
    id: 'title_showcase_champion',
    type: 'title',
    name: 'Showcase Champion',
    price: null,
    grantOnly: true,
    description: 'Won a monthly Showcase — the community voted, this design took it',
    textClass: 'text-pink-400',
  },
  {
    id: 'title_section_leader',
    type: 'title',
    name: 'Section Leader',
    price: 1000,
    description: 'Flair displayed on your public profile',
    textClass: 'text-cyan-400',
  },
  {
    id: 'title_drum_major',
    type: 'title',
    name: 'Drum Major',
    price: 2500,
    description: 'Flair displayed on your public profile',
    textClass: 'text-purple-400',
  },
  {
    id: 'title_the_maestro',
    type: 'title',
    name: 'The Maestro',
    price: 5000,
    description: 'Flair displayed on your public profile',
    textClass: 'text-orange-400',
  },
  {
    id: 'title_corps_legend',
    type: 'title',
    name: 'Corps Legend',
    price: 10000,
    description: 'The rarest flair in the activity',
    textClass: 'text-yellow-400',
  },

  // --- Profile frames: border around your profile avatar ---
  {
    id: 'frame_bronze',
    type: 'frame',
    name: 'Bronze Frame',
    price: 750,
    description: 'Bronze border around your profile avatar',
    frameClass: 'ring-2 ring-orange-700',
  },
  {
    id: 'frame_silver',
    type: 'frame',
    name: 'Silver Frame',
    price: 1500,
    description: 'Silver border around your profile avatar',
    frameClass: 'ring-2 ring-charcoal-300',
  },
  {
    id: 'frame_gold',
    type: 'frame',
    name: 'Gold Frame',
    price: 3000,
    description: 'Gold border around your profile avatar',
    frameClass: 'ring-2 ring-yellow-400',
  },
  {
    id: 'frame_championship',
    type: 'frame',
    name: 'Championship Frame',
    price: 7500,
    description: 'A double gold ring for true contenders',
    frameClass: 'ring-4 ring-yellow-400 ring-offset-2 ring-offset-[#0a0a0a]',
  },

  // --- Corps card themes: dashboard scorecard accent ---
  {
    id: 'theme_midnight',
    type: 'cardTheme',
    name: 'Midnight Blue',
    price: 1500,
    description: 'Deep blue accent on your season scorecard',
    cardClass: 'border-interactive bg-gradient-to-br from-[#0a1a2e] to-[#1a1a1a]',
    swatchClass: 'bg-gradient-to-br from-[#0a1a2e] to-interactive',
  },
  {
    id: 'theme_crimson',
    type: 'cardTheme',
    name: 'Crimson Corps',
    price: 1500,
    description: 'Crimson accent on your season scorecard',
    cardClass: 'border-red-800 bg-gradient-to-br from-[#2e0a0a] to-[#1a1a1a]',
    swatchClass: 'bg-gradient-to-br from-[#2e0a0a] to-red-700',
  },
  {
    id: 'theme_gold_standard',
    type: 'cardTheme',
    name: 'Gold Standard',
    price: 3500,
    description: 'Championship gold accent on your season scorecard',
    cardClass: 'border-yellow-600 bg-gradient-to-br from-[#2e240a] to-[#1a1a1a]',
    swatchClass: 'bg-gradient-to-br from-[#2e240a] to-yellow-600',
  },
  {
    id: 'theme_aurora',
    type: 'cardTheme',
    name: 'Aurora',
    price: 5000,
    description: 'Teal-to-violet shimmer on your season scorecard',
    cardClass: 'border-teal-500 bg-gradient-to-br from-[#0a2e2a] via-[#1a1a2e] to-[#1a1a1a]',
    swatchClass: 'bg-gradient-to-br from-teal-500 via-indigo-600 to-purple-600',
  },
  {
    id: 'theme_harbor_mist',
    type: 'cardTheme',
    name: 'Harbor Mist',
    price: 1500,
    description: 'Misty teal drifting across your season scorecard',
    cardClass: 'border-teal-600 bg-gradient-to-br from-[#0a2422] to-[#1a1a1a]',
    swatchClass: 'bg-gradient-to-br from-[#0a2422] via-teal-700 to-teal-400',
  },
  {
    id: 'theme_evergreen',
    type: 'cardTheme',
    name: 'Evergreen',
    price: 1500,
    description: 'Deep forest green accent on your season scorecard',
    cardClass: 'border-emerald-800 bg-gradient-to-br from-[#0a2216] to-[#1a1a1a]',
    swatchClass: 'bg-gradient-to-br from-[#0a2216] to-emerald-600',
  },
  {
    id: 'theme_graphite',
    type: 'cardTheme',
    name: 'Slate Graphite',
    price: 1500,
    description: 'Brushed graphite finish on your season scorecard',
    cardClass: 'border-slate-500 bg-gradient-to-br from-[#1a1f2e] to-[#1a1a1a]',
    swatchClass: 'bg-gradient-to-br from-slate-700 via-slate-500 to-slate-300',
  },
  {
    id: 'theme_amethyst',
    type: 'cardTheme',
    name: 'Amethyst',
    price: 3500,
    description: 'Royal purple gleam on your season scorecard',
    cardClass: 'border-purple-700 bg-gradient-to-br from-[#1e0a2e] to-[#1a1a1a]',
    swatchClass: 'bg-gradient-to-br from-[#1e0a2e] via-purple-700 to-fuchsia-500',
  },
  {
    id: 'theme_rose_quartz',
    type: 'cardTheme',
    name: 'Rose Quartz',
    price: 3500,
    description: 'Soft rose shimmer on your season scorecard',
    cardClass: 'border-rose-500 bg-gradient-to-br from-[#2e0a1c] to-[#1a1a1a]',
    swatchClass: 'bg-gradient-to-br from-[#2e0a1c] via-rose-600 to-pink-400',
  },
  {
    id: 'theme_glacier',
    type: 'cardTheme',
    name: 'Glacier',
    price: 5000,
    description: 'Glacial cyan-to-blue sweep on your season scorecard',
    cardClass: 'border-cyan-400 bg-gradient-to-br from-[#0a2230] via-[#12202e] to-[#1a1a1a]',
    swatchClass: 'bg-gradient-to-br from-cyan-300 via-sky-500 to-blue-700',
  },

  // --- Seasonal rotation: purchasable only while the tagged season runs ---
  // (`seasonal` matches game-settings/season.status; the server enforces the
  // gate, this mirror drives the "limited" badge + disabled state.)
  {
    id: 'theme_summer_tour',
    type: 'cardTheme',
    name: 'Summer Tour',
    price: 2500,
    seasonal: 'live-season',
    description: 'Sun-baked asphalt and stadium lights — live season exclusive',
    cardClass: 'border-amber-500 bg-gradient-to-br from-[#2e1c0a] via-[#1a1a1a] to-[#1a1a1a]',
    swatchClass: 'bg-gradient-to-br from-amber-500 via-orange-600 to-red-600',
  },
  {
    id: 'theme_off_circuit',
    type: 'cardTheme',
    name: 'Off-Season Circuit',
    price: 2500,
    seasonal: 'off-season',
    description: 'Rehearsal-hall glow for the grind months — off-season exclusive',
    cardClass: 'border-sky-600 bg-gradient-to-br from-[#0a1c2e] via-[#12122e] to-[#1a1a1a]',
    swatchClass: 'bg-gradient-to-br from-sky-600 via-charcoal-500 to-indigo-800',
  },

  // --- Uniform Studio packs (design houses): entitlements, not equippables ---
  {
    id: 'pack_texture_atelier',
    type: 'uniformPack',
    name: 'Texture Atelier',
    price: 1500,
    description:
      'Maison Verdier — the iridescent angle-shift sheen and the lam\u00e9 shimmer weave, unlocked for every design you save',
  },
  {
    id: 'pack_military_outfitters',
    type: 'uniformPack',
    name: 'Military Outfitters Collection',
    price: 2500,
    description:
      'Blackwell & Sons — the fur busby with its colored bag, and the one-shoulder cavalry cape',
  },
];

/**
 * Uniform Studio packs are ENTITLEMENTS: owning one unlocks its content in
 * the Studio (save-time check is server-side, helpers/uniformEntitlements).
 * They are never equipped, so the Shop shows an "In your Studio" chip once
 * owned instead of an Equip button.
 */
export const SHOP_SECTIONS = [
  { type: 'title', label: 'Director Titles' },
  { type: 'frame', label: 'Profile Frames' },
  { type: 'cardTheme', label: 'Corps Card Themes' },
  { type: 'uniformPack', label: 'Uniform Studio Packs' },
];

/**
 * @typedef {Object} CosmeticProfile
 * @property {{ equipped?: Record<string, string|null>, owned?: string[] }} [cosmetics]
 */

/** @param {string} itemId */
export function getShopItem(itemId) {
  return SHOP_ITEMS.find((item) => item.id === itemId) || null;
}

/**
 * Resolve a profile's equipped cosmetic for a slot to its catalog entry
 * @param {CosmeticProfile|null|undefined} profile
 * @param {string} slot
 */
export function getEquippedCosmetic(profile, slot) {
  const itemId = profile?.cosmetics?.equipped?.[slot];
  return itemId ? getShopItem(itemId) : null;
}

/**
 * @param {CosmeticProfile|null|undefined} profile
 * @param {string} itemId
 */
export function isOwned(profile, itemId) {
  return (profile?.cosmetics?.owned || []).includes(itemId);
}

/**
 * True when an item can be purchased right now: evergreen items always,
 * seasonal items only while the matching season type is running. Ownership
 * and equipping are never gated — only the register. An unknown/unloaded
 * season status (null) counts as available so the shop doesn't flash the
 * "returns next season" state before the season store hydrates — the server
 * enforces the real gate on purchase either way.
 *
 * @param {{ seasonal?: string|null }|null|undefined} item
 * @param {string|null|undefined} seasonStatus
 */
export function isSeasonallyAvailable(item, seasonStatus) {
  return !item?.seasonal || seasonStatus == null || item.seasonal === seasonStatus;
}

/**
 * Short badge label for a seasonal item ("Live season only" / etc.)
 * @param {{ seasonal?: string|null }|null|undefined} item
 */
export function seasonalLabel(item) {
  if (!item?.seasonal) return null;
  return item.seasonal === 'live-season' ? 'Live season only' : 'Off-season only';
}
