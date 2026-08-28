// =============================================================================
// STUDIO INIT — how the /studio draft seeds for a corps
// =============================================================================
// Split out of Studio.tsx (max-lines guardrail). Priority: the equipped v2
// design → a best-effort migration of the v1 prose design → the first preset
// (in which case the page offers the first-run gallery instead of silently
// committing to it).

import { designFromPreset, UNIFORM_PRESETS } from '../../data/uniformCatalog';
import { migrateV1Design } from '../../utils/uniform';
import type { EquippedUniform, UniformDesignV2 } from '../../types/uniform';
import type { CorpsData } from '../../types';

export interface CorpsOption {
  classKey: string;
  corps: CorpsData & { uniform?: EquippedUniform };
}

export function initialDesignFor(option: CorpsOption | undefined): {
  design: UniformDesignV2;
  migrated: boolean;
} {
  if (option?.corps.uniform) {
    const { designId: _id, equippedAt: _at, ...rest } = option.corps.uniform;
    return { design: { ...rest, schema: 2 }, migrated: false };
  }
  if (option?.corps.uniformDesign?.primaryColor) {
    return {
      design: migrateV1Design(option.corps.uniformDesign, option.corps.corpsName),
      migrated: true,
    };
  }
  return { design: designFromPreset(UNIFORM_PRESETS[0]), migrated: false };
}

/** A corps with no design at all — the first-run gallery case. */
export function isFreshCorps(option: CorpsOption | undefined): boolean {
  return Boolean(option) && !option?.corps.uniform && !option?.corps.uniformDesign?.primaryColor;
}
