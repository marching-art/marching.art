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
    frameClass: 'ring-2 ring-gray-300',
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
    cardClass: 'border-[#0057B8] bg-gradient-to-br from-[#0a1a2e] to-[#1a1a1a]',
    swatchClass: 'bg-gradient-to-br from-[#0a1a2e] to-[#0057B8]',
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
];

export const SHOP_SECTIONS = [
  { type: 'title', label: 'Director Titles' },
  { type: 'frame', label: 'Profile Frames' },
  { type: 'cardTheme', label: 'Corps Card Themes' },
];

export function getShopItem(itemId) {
  return SHOP_ITEMS.find((item) => item.id === itemId) || null;
}

/** Resolve a profile's equipped cosmetic for a slot to its catalog entry */
export function getEquippedCosmetic(profile, slot) {
  const itemId = profile?.cosmetics?.equipped?.[slot];
  return itemId ? getShopItem(itemId) : null;
}

export function isOwned(profile, itemId) {
  return (profile?.cosmetics?.owned || []).includes(itemId);
}
