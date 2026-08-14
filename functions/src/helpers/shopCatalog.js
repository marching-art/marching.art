/**
 * Corps Identity Shop — server-side catalog (v1).
 *
 * Purely cosmetic CorpsCoin sinks: director titles (flair under your name),
 * profile frames (avatar border), and corps card themes (dashboard scorecard
 * accent). Nothing here touches scoring or competition.
 *
 * Prices are anchored to weekly income (~800-1,200 CC for an active player):
 * entry tier ~1 week of casual play, top shelf several weeks of saving.
 *
 * The client mirror (display names, CSS classes, previews) lives in
 * src/utils/cosmetics.js — keep ids in sync. Purchases and equips are
 * validated server-side in callable/shop.js against THIS catalog; the client
 * mirror is display-only.
 */

const SHOP_CATALOG = [
  // --- Director titles (shown as flair on the profile) ---
  // grantOnly items can never be purchased — they are awarded by game systems
  // (title_laureate: season reward ladder tier 12).
  { id: 'title_laureate', type: 'title', name: 'Laureate', price: null, grantOnly: true },
  // Granted when a class is unlocked EARLY via XP level (the "did it the
  // hard way" recognition-asymmetry mark — seasons-completed and CorpsCoin
  // unlocks never receive it). Granted by the daily achievement sweep.
  { id: 'title_earned_not_given', type: 'title', name: 'Earned, Not Given', price: null, grantOnly: true },
  // Legacy milestone titles, granted by makeLegacyEndowment when a director's
  // cumulative endowment total crosses a threshold (helpers/legacyCatalog.js).
  // Grant-only: they mark coin actually given away, so buying one directly
  // would defeat the point.
  { id: 'title_legacy_patron', type: 'title', name: 'Patron', price: null, grantOnly: true },
  { id: 'title_legacy_benefactor', type: 'title', name: 'Benefactor', price: null, grantOnly: true },
  { id: 'title_legacy_guarantor', type: 'title', name: 'Guarantor', price: null, grantOnly: true },
  { id: 'title_legacy_cornerstone', type: 'title', name: 'Cornerstone', price: null, grantOnly: true },
  { id: 'title_legacy_founding', type: 'title', name: 'Founding Legacy', price: null, grantOnly: true },
  { id: 'title_section_leader', type: 'title', name: 'Section Leader', price: 1000 },
  { id: 'title_drum_major', type: 'title', name: 'Drum Major', price: 2500 },
  { id: 'title_the_maestro', type: 'title', name: 'The Maestro', price: 5000 },
  { id: 'title_corps_legend', type: 'title', name: 'Corps Legend', price: 10000 },

  // --- Profile frames (avatar border on the profile) ---
  { id: 'frame_bronze', type: 'frame', name: 'Bronze Frame', price: 750 },
  { id: 'frame_silver', type: 'frame', name: 'Silver Frame', price: 1500 },
  { id: 'frame_gold', type: 'frame', name: 'Gold Frame', price: 3000 },
  { id: 'frame_championship', type: 'frame', name: 'Championship Frame', price: 7500 },

  // --- Corps card themes (dashboard scorecard accent) ---
  { id: 'theme_midnight', type: 'cardTheme', name: 'Midnight Blue', price: 1500 },
  { id: 'theme_crimson', type: 'cardTheme', name: 'Crimson Corps', price: 1500 },
  { id: 'theme_gold_standard', type: 'cardTheme', name: 'Gold Standard', price: 3500 },
  { id: 'theme_aurora', type: 'cardTheme', name: 'Aurora', price: 5000 },
  { id: 'theme_fogwalker', type: 'cardTheme', name: 'Fogwalker Teal', price: 1500 },
  { id: 'theme_evergreen', type: 'cardTheme', name: 'Evergreen', price: 1500 },
  { id: 'theme_graphite', type: 'cardTheme', name: 'Slate Graphite', price: 1500 },
  { id: 'theme_amethyst', type: 'cardTheme', name: 'Amethyst', price: 3500 },
  { id: 'theme_rose_quartz', type: 'cardTheme', name: 'Rose Quartz', price: 3500 },
  { id: 'theme_glacier', type: 'cardTheme', name: 'Glacier', price: 5000 },

  // --- Seasonal rotation (WS6.2) ---
  // `seasonal` names the game-settings/season.status during which the item
  // can be PURCHASED (validated server-side in callable/shop.js). Ownership
  // is forever — the gate only closes the register, making each theme a
  // collectible you had to be there for. Rotate this set over time.
  { id: 'theme_summer_tour', type: 'cardTheme', name: 'Summer Tour', price: 2500, seasonal: 'live-season' },
  { id: 'theme_off_circuit', type: 'cardTheme', name: 'Off-Season Circuit', price: 2500, seasonal: 'off-season' },
];

/** Equip slot per item type — one equipped item per slot */
const TYPE_TO_SLOT = {
  title: 'title',
  frame: 'frame',
  cardTheme: 'cardTheme',
};

/** @param {string} itemId */
function getShopItem(itemId) {
  return SHOP_CATALOG.find((item) => item.id === itemId) || null;
}

module.exports = {
  SHOP_CATALOG,
  TYPE_TO_SLOT,
  getShopItem,
};
