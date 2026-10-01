// =============================================================================
// STUDIO WILDWOOD CONTROLS — the Wildwood torso pieces (Alder & Moss)
// =============================================================================
// Split out of StudioEditor.tsx (max-lines guardrail). The torso branchwork,
// the bioluminescent glow (one color for every branch on the figure — the
// torso, sleeves and legs), and the sheer drape. Arm/leg branchwork lives with the
// limb controls, the gill fan with the chest, and the brocade print with the
// torso prints. Edits flow back through onPatch, which the editor routes
// through withDerivedFlags (so the glow filter is defined only while a branch
// actually glows).

import React from 'react';
import type { FigureConfig, UniformColorway } from '../../types/uniform';
import { METAL_HEX } from '../../data/uniformCatalog';
import { BRANCH_GLOW_DEFAULT } from '../../data/uniformRenderTheme';
import { figureShowsBranchwork } from '../../utils/uniform';
import { ChannelRow, Toggle } from './StudioControls';

const WILDWOOD = 'pack_wildwood';

export default function WildwoodTorsoControls({
  figure,
  colorway,
  onPatch,
  packLabel,
}: {
  figure: FigureConfig;
  colorway: UniformColorway;
  onPatch: (patch: Partial<FigureConfig>) => void;
  packLabel: (label: string, packId: string) => string;
}) {
  const branches = figure.veins || null;
  const drape = figure.drape || null;
  const anyBranchwork = figureShowsBranchwork(figure);
  return (
    <div className="mt-2 space-y-1">
      <div className="flex flex-wrap gap-3">
        <Toggle
          label={packLabel('Branchwork', WILDWOOD)}
          checked={Boolean(branches)}
          onChange={(v) =>
            onPatch({ veins: v ? { color: METAL_HEX[colorway.metal] || METAL_HEX.gold } : null })
          }
        />
        <Toggle
          label={packLabel('Sheer drape', WILDWOOD)}
          checked={Boolean(drape)}
          onChange={(v) => onPatch({ drape: v ? { color: colorway.secondary } : null })}
        />
        {anyBranchwork && (
          <Toggle
            label={packLabel('Bioluminescent', WILDWOOD)}
            checked={Boolean(figure.veinGlow)}
            onChange={(v) => onPatch({ veinGlow: v ? BRANCH_GLOW_DEFAULT : null })}
          />
        )}
      </div>
      <div className="grid grid-cols-2 gap-2">
        {branches && (
          <>
            <ChannelRow
              label="Branchwork"
              value={branches.color}
              onChange={(v) => v && onPatch({ veins: { ...branches, color: v } })}
            />
            <Toggle
              label="Branchwork other side"
              checked={Boolean(branches.flip)}
              onChange={(v) => onPatch({ veins: { ...branches, flip: v } })}
            />
          </>
        )}
        {anyBranchwork && figure.veinGlow && (
          <ChannelRow
            label="Branchwork glow"
            value={figure.veinGlow}
            onChange={(v) => v && onPatch({ veinGlow: v })}
          />
        )}
        {drape && (
          <>
            <ChannelRow
              label="Drape"
              value={drape.color}
              onChange={(v) => v && onPatch({ drape: { ...drape, color: v } })}
            />
            <Toggle
              label="Drape other side"
              checked={Boolean(drape.flip)}
              onChange={(v) => onPatch({ drape: { ...drape, flip: v } })}
            />
          </>
        )}
      </div>
    </div>
  );
}
