import { describe, it, expect } from 'vitest';
import { planUniformMigration } from './uniformMigration';

const v2Snapshot = (extra: Record<string, unknown> = {}) => ({
  designId: 'd1',
  name: 'Studio Look',
  colorway: { primary: '#1f6b3a', secondary: '#14532d', accent: '#e0a516', metal: 'gold' },
  figure: { hatType: 'shako', jacket: '#1f6b3a' },
  equippedAt: '2026-08-20T00:00:00.000Z',
  ...extra,
});

const v1Design = (extra: Record<string, unknown> = {}) => ({
  primaryColor: 'crimson red',
  secondaryColor: 'gold',
  accentColor: 'cream',
  helmetStyle: 'shako',
  style: 'traditional',
  ...extra,
});

describe('planUniformMigration', () => {
  it('keeps an equipped v2 design untouched and only drops the legacy v1', () => {
    const plan = planUniformMigration({
      corps: {
        worldClass: {
          corpsName: 'A',
          uniform: v2Snapshot({ aiHints: { mascotOrEmblem: 'hawk' } }),
          uniformDesign: v1Design(),
        },
      },
    });
    // v2-first: never re-writes corps.worldClass.uniform.
    expect(plan.sets['corps.worldClass.uniform']).toBeUndefined();
    expect(plan.deletes).toContain('corps.worldClass.uniformDesign');
    expect(plan.migratedFromV1).toBe(0);
    expect(plan.droppedV1).toBe(1);
  });

  it('folds aiHints from v1 into a v2 snapshot that lacks them', () => {
    const plan = planUniformMigration({
      corps: {
        worldClass: {
          corpsName: 'A',
          uniform: v2Snapshot(), // no aiHints
          uniformDesign: v1Design({
            mascotOrEmblem: 'phoenix',
            themeKeywords: ['fire'],
            additionalNotes: 'LED plume',
          }),
        },
      },
    });
    expect(plan.sets['corps.worldClass.uniform.aiHints']).toEqual({
      mascotOrEmblem: 'phoenix',
      themeKeywords: ['fire'],
      additionalNotes: 'LED plume',
    });
    expect(plan.foldedAiHints).toBe(1);
    expect(plan.deletes).toContain('corps.worldClass.uniformDesign');
  });

  it('does not fold aiHints when the v2 snapshot already has them', () => {
    const plan = planUniformMigration({
      corps: {
        worldClass: {
          corpsName: 'A',
          uniform: v2Snapshot({ aiHints: { mascotOrEmblem: 'existing' } }),
          uniformDesign: v1Design({ mascotOrEmblem: 'ignored' }),
        },
      },
    });
    expect(plan.sets['corps.worldClass.uniform.aiHints']).toBeUndefined();
    expect(plan.foldedAiHints).toBe(0);
    expect(plan.deletes).toContain('corps.worldClass.uniformDesign');
  });

  it('migrates a legacy v1-only corps into a fresh equipped v2 snapshot', () => {
    const plan = planUniformMigration({
      corps: { openClass: { corpsName: 'Legacy Corps', uniformDesign: v1Design() } },
    });
    const snap = plan.sets['corps.openClass.uniform'] as any;
    expect(snap).toBeTruthy();
    expect(snap.migratedFrom).toBe('v1');
    // Real converter output: a hex colorway + a figure.
    expect(snap.colorway.primary).toMatch(/^#[0-9a-f]{6}$/i);
    expect(snap.figure).toBeTruthy();
    expect(plan.deletes).toContain('corps.openClass.uniformDesign');
    expect(plan.migratedFromV1).toBe(1);
  });

  it('produces a Firestore-clean migrated snapshot (no undefined values)', () => {
    const plan = planUniformMigration({
      corps: { worldClass: { corpsName: 'Legacy Corps', uniformDesign: v1Design() } },
    });
    const snap = plan.sets['corps.worldClass.uniform'];
    // Firestore rejects undefined anywhere in the value; a JSON round-trip in the
    // planner must have stripped the converter's optional undefined figure keys.
    const hasUndefined = (v: unknown): boolean => {
      if (v === undefined) return true;
      if (Array.isArray(v)) return v.some(hasUndefined);
      if (v && typeof v === 'object') return Object.values(v).some(hasUndefined);
      return false;
    };
    expect(hasUndefined(snap)).toBe(false);
  });

  it('drops an unusable v1 (no primary color) without creating a snapshot', () => {
    const plan = planUniformMigration({
      corps: { aClass: { corpsName: 'A', uniformDesign: { style: 'contemporary' } } },
    });
    expect(plan.sets['corps.aClass.uniform']).toBeUndefined();
    expect(plan.deletes).toContain('corps.aClass.uniformDesign');
    expect(plan.migratedFromV1).toBe(0);
  });

  it('reports no change for a corps with neither v1 nor v2', () => {
    const plan = planUniformMigration({ corps: { worldClass: { corpsName: 'A' } } });
    expect(plan.changed).toBe(false);
    expect(plan.deletes).toHaveLength(0);
    expect(Object.keys(plan.sets)).toHaveLength(0);
  });

  it('tolerates missing/empty profile data', () => {
    expect(planUniformMigration(null).changed).toBe(false);
    expect(planUniformMigration({}).changed).toBe(false);
    expect(planUniformMigration({ corps: {} }).changed).toBe(false);
  });
});
