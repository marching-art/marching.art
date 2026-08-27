// Design-house pack entitlements: the client mirror must agree with the
// server gate (functions/src/helpers/uniformEntitlements.js) AND with the
// shop catalog, or the Studio's advisory banner lies about what a save will
// do. The server remains the enforcement point — these tests keep the three
// id sets (client packs, server packs, shop items) in lock-step.
import { describe, it, expect } from 'vitest';
import { UNIFORM_PACKS, getUniformPack, missingPacksFor, requiredPacksFor } from './uniformPacks';
import { SHOP_ITEMS } from './cosmetics';
import type { FigureConfig } from '../types/uniform';

// Backend source of truth (plain CJS, no firebase imports).
import {
  UNIFORM_PACKS as SERVER_PACKS,
  PRESTIGE_UNLOCKS as SERVER_PRESTIGE,
  requiredPacksFor as serverRequiredPacksFor,
} from '../../functions/src/helpers/uniformEntitlements.js';

const FREE: FigureConfig = { skin: '#c9a074', jacket: '#6d1a26', hatType: 'shako' };

describe('requiredPacksFor', () => {
  it('requires nothing for a free-floor figure', () => {
    expect(requiredPacksFor(FREE)).toEqual([]);
    expect(requiredPacksFor(null)).toEqual([]);
    expect(requiredPacksFor(undefined)).toEqual([]);
  });

  it('maps the finishes to the Texture Atelier', () => {
    expect(requiredPacksFor({ ...FREE, iridescent: true })).toEqual(['pack_texture_atelier']);
    expect(requiredPacksFor({ ...FREE, lame: true })).toEqual(['pack_texture_atelier']);
    // both finishes still need only the one pack
    expect(requiredPacksFor({ ...FREE, iridescent: true, lame: true })).toEqual([
      'pack_texture_atelier',
    ]);
  });

  it('maps the busby and the cape to the Military Outfitters', () => {
    expect(requiredPacksFor({ ...FREE, hatType: 'busby' })).toEqual(['pack_military_outfitters']);
    expect(requiredPacksFor({ ...FREE, cape: { color: '#22355c' } })).toEqual([
      'pack_military_outfitters',
    ]);
  });

  it('lists both packs when a design draws on both houses', () => {
    const figure: FigureConfig = { ...FREE, lame: true, cape: { color: '#22355c' } };
    expect(requiredPacksFor(figure).sort()).toEqual([
      'pack_military_outfitters',
      'pack_texture_atelier',
    ]);
  });

  it('maps the aiguillette to the Drum Major title (prestige, not a pack)', () => {
    expect(requiredPacksFor({ ...FREE, aiguillette: '#d9a41c' })).toEqual(['title_drum_major']);
    expect(getUniformPack('title_drum_major')?.kind).toBe('prestige');
  });

  it("maps the long coat to the Tailors' Cut and premium plumes to the Plumassier", () => {
    expect(requiredPacksFor({ ...FREE, torsoStyle: 'longcoat' })).toEqual(['pack_tailors_cut']);
    expect(requiredPacksFor({ ...FREE, plume: { type: 'fan', color: '#b3121c' } })).toEqual([
      'pack_plumassier',
    ]);
    expect(requiredPacksFor({ ...FREE, plume: { type: 'cascade', color: '#f4f1ea' } })).toEqual([
      'pack_plumassier',
    ]);
    // the free floor holds: dress and the launch plumes need nothing
    expect(requiredPacksFor({ ...FREE, torsoStyle: 'dress' })).toEqual([]);
    expect(requiredPacksFor({ ...FREE, plume: { type: 'fountain', color: '#f4f1ea' } })).toEqual(
      []
    );
  });
});

describe('missingPacksFor', () => {
  const gated: FigureConfig = { ...FREE, iridescent: true, hatType: 'busby' };

  it('returns full metadata for every unowned pack', () => {
    const missing = missingPacksFor(gated, []);
    expect(missing.map((p) => p.id).sort()).toEqual([
      'pack_military_outfitters',
      'pack_texture_atelier',
    ]);
    for (const pack of missing) {
      expect(pack.name).toBeTruthy();
      expect(pack.house).toBeTruthy();
      expect(pack.features).toBeTruthy();
    }
  });

  it('drops packs the director owns and tolerates a missing owned list', () => {
    expect(missingPacksFor(gated, ['pack_texture_atelier']).map((p) => p.id)).toEqual([
      'pack_military_outfitters',
    ]);
    expect(missingPacksFor(gated, ['pack_texture_atelier', 'pack_military_outfitters'])).toEqual(
      []
    );
    expect(missingPacksFor(FREE, undefined)).toEqual([]);
    expect(missingPacksFor(gated, undefined)).toHaveLength(2);
  });
});

describe('server mirror', () => {
  const clientPacks = UNIFORM_PACKS.filter((p) => p.kind === 'pack');
  const clientPrestige = UNIFORM_PACKS.filter((p) => p.kind === 'prestige');

  it('carries exactly the server pack ids with matching metadata', () => {
    expect(clientPacks.map((p) => p.id).sort()).toEqual(Object.keys(SERVER_PACKS).sort());
    for (const pack of clientPacks) {
      const server = SERVER_PACKS[pack.id as keyof typeof SERVER_PACKS];
      expect(pack.name).toBe(server.name);
      expect(pack.house).toBe(server.house);
      expect(pack.features).toBe(server.features);
    }
  });

  it('carries exactly the server prestige unlock ids', () => {
    expect(clientPrestige.map((p) => p.id).sort()).toEqual(Object.keys(SERVER_PRESTIGE).sort());
    for (const item of clientPrestige) {
      const server = SERVER_PRESTIGE[item.id as keyof typeof SERVER_PRESTIGE];
      expect(item.name).toBe(server.name);
    }
  });

  it('matches the shop catalog: packs are uniformPack items, prestige ids are real items', () => {
    const shopIds = SHOP_ITEMS.filter((i) => i.type === 'uniformPack')
      .map((i) => i.id)
      .sort();
    expect(clientPacks.map((p) => p.id).sort()).toEqual(shopIds);
    for (const item of clientPrestige) {
      const shopItem = SHOP_ITEMS.find((i) => i.id === item.id);
      expect(shopItem, `${item.id} must exist in the shop catalog`).toBeTruthy();
      expect(shopItem?.type).not.toBe('uniformPack');
    }
    expect(getUniformPack('pack_texture_atelier')?.house).toBe('Maison Verdier');
    expect(getUniformPack('not_a_pack')).toBeUndefined();
  });

  it('agrees with the server gate on which figures need which packs', () => {
    const cases: FigureConfig[] = [
      FREE,
      { ...FREE, iridescent: true },
      { ...FREE, lame: true },
      { ...FREE, hatType: 'busby' },
      { ...FREE, cape: { color: '#22355c', lining: '#d9a41c', side: 'right' } },
      { ...FREE, aiguillette: '#d9a41c' },
      { ...FREE, torsoStyle: 'longcoat' },
      { ...FREE, plume: { type: 'fan', color: '#b3121c' } },
      { ...FREE, plume: { type: 'cascade', color: '#f4f1ea', accent: '#2f6fd0' } },
      {
        ...FREE,
        iridescent: true,
        lame: true,
        hatType: 'busby',
        cape: { color: '#22355c' },
        aiguillette: '#f4f2ec',
      },
    ];
    for (const figure of cases) {
      expect(requiredPacksFor(figure).sort()).toEqual(serverRequiredPacksFor(figure).sort());
    }
  });
});
