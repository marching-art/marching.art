// =============================================================================
// STUDIO WILDWOOD CONTROLS — the Wildwood torso pieces (Alder & Moss)
// =============================================================================
// Split out of StudioEditor.tsx (max-lines guardrail). The torso vein network,
// the bioluminescent vein glow (one color for every vein on the figure — the
// torso, sleeves and legs), and the sheer drape. Arm/leg veins live with the
// limb controls, the gill fan with the chest, and the brocade print with the
// torso prints. Edits flow back through onPatch, which the editor routes
// through withDerivedFlags (so the glow filter is defined only while a vein
// actually glows).

import React from 'react';
import type { FigureConfig, UniformColorway } from '../../types/uniform';
import { METAL_HEX } from '../../data/uniformCatalog';
import { VEIN_GLOW_DEFAULT } from '../../data/uniformRenderTheme';
import { figureShowsVeins } from '../../utils/uniform';
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
  const veins = figure.veins || null;
  const drape = figure.drape || null;
  const anyVeins = figureShowsVeins(figure);
  return (
    <div className="mt-2 space-y-1">
      <div className="flex flex-wrap gap-3">
        <Toggle
          label={packLabel('Vein network', WILDWOOD)}
          checked={Boolean(veins)}
          onChange={(v) =>
            onPatch({ veins: v ? { color: METAL_HEX[colorway.metal] || METAL_HEX.gold } : null })
          }
        />
        <Toggle
          label={packLabel('Sheer drape', WILDWOOD)}
          checked={Boolean(drape)}
          onChange={(v) => onPatch({ drape: v ? { color: colorway.secondary } : null })}
        />
        {anyVeins && (
          <Toggle
            label={packLabel('Bioluminescent', WILDWOOD)}
            checked={Boolean(figure.veinGlow)}
            onChange={(v) => onPatch({ veinGlow: v ? VEIN_GLOW_DEFAULT : null })}
          />
        )}
      </div>
      <div className="grid grid-cols-2 gap-2">
        {veins && (
          <>
            <ChannelRow
              label="Veins"
              value={veins.color}
              onChange={(v) => v && onPatch({ veins: { ...veins, color: v } })}
            />
            <Toggle
              label="Veins other side"
              checked={Boolean(veins.flip)}
              onChange={(v) => onPatch({ veins: { ...veins, flip: v } })}
            />
          </>
        )}
        {anyVeins && figure.veinGlow && (
          <ChannelRow
            label="Vein glow"
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
