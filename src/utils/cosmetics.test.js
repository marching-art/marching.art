// Catalog invariants + helper behavior for the Corps Identity Shop client
// mirror. The server validates every purchase against its own catalog
// (functions/src/helpers/shopCatalog.js); these tests keep the display mirror
// internally consistent so a bad entry can't silently break the shop UI.
import { describe, it, expect } from 'vitest';
import { SHOP_ITEMS, SHOP_SECTIONS, getShopItem, getEquippedCosmetic, isOwned } from './cosmetics';

describe('SHOP_ITEMS catalog', () => {
  it('has unique ids', () => {
    const ids = SHOP_ITEMS.map((item) => item.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('only uses types that have a shop section', () => {
    const sectionTypes = new Set(SHOP_SECTIONS.map((s) => s.type));
    for (const item of SHOP_ITEMS) {
      expect(sectionTypes.has(item.type)).toBe(true);
    }
  });

  it('gives every purchasable item a positive price and every grant-only item none', () => {
    for (const item of SHOP_ITEMS) {
      if (item.grantOnly) {
        expect(item.price).toBeNull();
      } else {
        expect(item.price).toBeGreaterThan(0);
      }
    }
  });

  it('gives every item the display class its type requires', () => {
    for (const item of SHOP_ITEMS) {
      if (item.type === 'title') expect(item.textClass).toBeTruthy();
      if (item.type === 'frame') expect(item.frameClass).toBeTruthy();
      if (item.type === 'cardTheme') {
        expect(item.cardClass).toBeTruthy();
        expect(item.swatchClass).toBeTruthy();
      }
    }
  });

  it('includes the ladder-exclusive Laureate title as grant-only', () => {
    const laureate = getShopItem('title_laureate');
    expect(laureate).not.toBeNull();
    expect(laureate.grantOnly).toBe(true);
  });
});

describe('getShopItem', () => {
  it('finds items by id', () => {
    expect(getShopItem('frame_gold')?.name).toBe('Gold Frame');
  });

  it('returns null for unknown ids', () => {
    expect(getShopItem('not_a_real_item')).toBeNull();
  });
});

describe('getEquippedCosmetic', () => {
  const profile = {
    cosmetics: {
      owned: ['title_drum_major', 'theme_midnight'],
      equipped: { title: 'title_drum_major', cardTheme: 'theme_midnight', frame: null },
    },
  };

  it('resolves an equipped slot to its catalog entry', () => {
    expect(getEquippedCosmetic(profile, 'title')?.id).toBe('title_drum_major');
    expect(getEquippedCosmetic(profile, 'cardTheme')?.cardClass).toBeTruthy();
  });

  it('returns null for empty slots and missing profiles', () => {
    expect(getEquippedCosmetic(profile, 'frame')).toBeNull();
    expect(getEquippedCosmetic(null, 'title')).toBeNull();
    expect(getEquippedCosmetic({}, 'title')).toBeNull();
  });
});

describe('isOwned', () => {
  it('reflects the owned list and tolerates missing cosmetics', () => {
    const profile = { cosmetics: { owned: ['frame_bronze'] } };
    expect(isOwned(profile, 'frame_bronze')).toBe(true);
    expect(isOwned(profile, 'frame_gold')).toBe(false);
    expect(isOwned({}, 'frame_bronze')).toBe(false);
    expect(isOwned(null, 'frame_bronze')).toBe(false);
  });
});
