// =============================================================================
// STUDIO PRISM CONTROLS — the Prism Forge split-panel torso editor
// =============================================================================
// Split out of StudioEditor.tsx (max-lines guardrail). The split panel covers
// one side of the torso along the light-streak diagonal; it can be a solid
// color, the shatter print, or the Wildwood patina brocade. Edits flow back through onPatch, which the
// editor routes through withDerivedFlags (so the shatter def is defined only
// while something wears it).

import React from 'react';
import type { FigureConfig, TorsoSplitConfig, UniformColorway } from '../../types/uniform';
import { ChannelRow, Pills, Toggle } from './StudioControls';
import { LABEL } from './studioTokens';

export default function TorsoSplitControls({
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
  const split = figure.torsoSplit || null;
  const patchSplit = (next: Partial<TorsoSplitConfig>) =>
    split && onPatch({ torsoSplit: { ...split, ...next } });
  return (
    <div className="mt-2">
      <Toggle
        label={packLabel('Split panel', 'pack_prism_forge')}
        checked={Boolean(split)}
        onChange={(v) =>
          onPatch({ torsoSplit: v ? { color: colorway.secondary, fill: null, flip: false } : null })
        }
      />
      {split && (
        <div className="space-y-1 mt-1">
          <span className={LABEL}>Panel fabric</span>
          <Pills
            options={[
              { value: 'solid', label: 'Solid' },
              { value: 'shatter', label: packLabel('Shatter print', 'pack_prism_forge') },
              { value: 'brocade', label: packLabel('Patina brocade', 'pack_wildwood') },
            ]}
            value={split.fill?.startsWith('url:') ? split.fill.slice(4) : 'solid'}
            onSelect={(v) => patchSplit({ fill: v === 'solid' ? null : `url:${v}` })}
          />
          <div className="grid grid-cols-2 gap-2">
            {!split.fill && (
              <ChannelRow
                label="Panel"
                value={split.color}
                onChange={(v) => v && patchSplit({ color: v })}
              />
            )}
            <Toggle
              label="Other side"
              checked={Boolean(split.flip)}
              onChange={(v) => patchSplit({ flip: v })}
            />
          </div>
        </div>
      )}
    </div>
  );
}
