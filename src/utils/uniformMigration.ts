// =============================================================================
// UNIFORM v1 → v2 BACKFILL PLANNER (pure)
// =============================================================================
// One-time migration logic that retires the legacy prose `uniformDesign` (v1)
// in favor of the equipped Uniform Studio (v2) snapshot as the single source of
// truth. Pure and side-effect free so it can be unit-tested; the Firestore I/O
// lives in scripts/migrateUniformsV1toV2.mts, driven by the GitHub Action.
//
// v2-FIRST SAFETY RULE: an equipped v2 `uniform` snapshot is authoritative and
// is NEVER overwritten by v1 data. v1 is only ever a *source* when a corps has
// no v2 design to protect. When both exist, v2 wins and v1 is simply dropped
// (after folding across any aiHints the snapshot was missing). This is what
// guarantees the migration can't clobber a design a director built in the new
// Studio.

import type { CorpsUniformDesign } from '../types';
import type { UniformDesignV2, UniformAiHints } from '../types/uniform';
import { migrateV1Design } from './uniform';

/** The changes to apply to one profile document. Dotted Firestore field paths. */
export interface UniformMigrationPlan {
  /** Whether anything changed (no writes when false). */
  changed: boolean;
  /** Field path → new value (map updates and equipped snapshots). */
  sets: Record<string, unknown>;
  /** Field paths to delete (the retired v1 `uniformDesign` fields). */
  deletes: string[];
  /** Count of corps whose look was converted from v1 to a fresh v2 snapshot. */
  migratedFromV1: number;
  /** Count of v2 snapshots that gained aiHints folded from their old v1. */
  foldedAiHints: number;
  /** Count of retired (deleted) v1 `uniformDesign` fields. */
  droppedV1: number;
}

/** Pull the three prose enrichments off a v1 design into a v2 aiHints object. */
function extractAiHints(v1: CorpsUniformDesign | undefined | null): UniformAiHints | null {
  if (!v1 || typeof v1 !== 'object') return null;
  const hints: UniformAiHints = {};
  if (v1.mascotOrEmblem) hints.mascotOrEmblem = v1.mascotOrEmblem;
  if (Array.isArray(v1.themeKeywords) && v1.themeKeywords.length) {
    hints.themeKeywords = v1.themeKeywords;
  }
  if (v1.additionalNotes) hints.additionalNotes = v1.additionalNotes;
  return Object.keys(hints).length ? hints : null;
}

/** Build the equipped-snapshot shape from a (freshly migrated) v2 design. */
function snapshotFromDesign(design: UniformDesignV2): Record<string, unknown> {
  return {
    designId: null,
    name: design.name,
    colorway: design.colorway,
    figure: design.figure,
    aiHints: design.aiHints || null,
    equippedAt: new Date().toISOString(),
    migratedFrom: 'v1',
  };
}

/**
 * Plan the v1→v2 migration for one profile document. Pure.
 *
 * @param profileData - a `profile/data` document's data.
 * @returns the sets/deletes to apply, plus counters for the run report.
 */
export function planUniformMigration(
  profileData: { corps?: Record<string, any> } | null | undefined
): UniformMigrationPlan {
  const corps = (profileData && profileData.corps) || {};
  const sets: Record<string, unknown> = {};
  const deletes: string[] = [];
  let migratedFromV1 = 0;
  let foldedAiHints = 0;
  let droppedV1 = 0;

  for (const [cls, c] of Object.entries(corps)) {
    if (!c || typeof c !== 'object') continue;

    const v1 = c.uniformDesign;
    const hasV1 = v1 && typeof v1 === 'object';
    const snap = c.uniform;
    const hasV2 = Boolean(snap && snap.colorway && typeof snap.colorway.primary === 'string');

    if (hasV2) {
      // v2-first: keep the equipped design untouched. Only fold in aiHints the
      // snapshot is missing, then retire the legacy v1.
      if (snap.aiHints == null && hasV1) {
        const hints = extractAiHints(v1);
        if (hints) {
          sets[`corps.${cls}.uniform.aiHints`] = hints;
          foldedAiHints++;
        }
      }
      if (hasV1) {
        deletes.push(`corps.${cls}.uniformDesign`);
        droppedV1++;
      }
      continue;
    }

    if (hasV1 && v1.primaryColor) {
      // Legacy corps: convert the prose design to a real v2 design and equip it.
      const design = migrateV1Design(v1 as CorpsUniformDesign, c.corpsName || c.name);
      sets[`corps.${cls}.uniform`] = snapshotFromDesign(design);
      deletes.push(`corps.${cls}.uniformDesign`);
      migratedFromV1++;
      droppedV1++;
    } else if (hasV1) {
      // v1 present but unusable (no primary color) → just drop it.
      deletes.push(`corps.${cls}.uniformDesign`);
      droppedV1++;
    }
  }

  const changed = Object.keys(sets).length > 0 || deletes.length > 0;
  return { changed, sets, deletes, migratedFromV1, foldedAiHints, droppedV1 };
}
