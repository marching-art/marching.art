// =============================================================================
// STUDIO HEADWEAR CONTROLS — the headwear section of the editor
// =============================================================================
// Split out of StudioEditor.tsx (max-lines guardrail) once the busby joined
// the hat roster. Edits flow back through onPatch, which the editor routes
// through withDerivedFlags. packLabel comes from the editor so the 🔒
// design-house marks stay consistent across every gated control.

import React from 'react';
import type { FigureConfig, UniformColorway } from '../../types/uniform';
import {
  HAT_ORNAMENT_OPTIONS,
  HAT_TYPE_OPTIONS,
  PLUME_TYPE_OPTIONS,
} from '../../data/uniformCatalog';
import { FIGURE_HAIR_COLORS } from '../../data/uniformRenderTheme';
import { darkenHex } from '../../utils/uniform';
import { ChannelRow, LABEL, Pills, SECTION_LABEL, SwatchRow, Toggle } from './StudioControls';

export default function HeadwearSection({
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
  return (
    <section>
      <h3 className={SECTION_LABEL}>Headwear</h3>
      <Pills
        options={HAT_TYPE_OPTIONS.map((o) => ({
          value: o.value,
          label: o.value === 'busby' ? packLabel(o.label, 'pack_military_outfitters') : o.label,
        }))}
        value={figure.hatType ?? null}
        onSelect={(v) =>
          onPatch(
            v
              ? {
                  hatType: v,
                  hat: figure.hat || {
                    body: darkenHex(colorway.primary, 0.55),
                    band: colorway.secondary,
                  },
                  plume:
                    v === 'campaign'
                      ? null
                      : figure.plume || { type: 'upright', color: colorway.accent },
                }
              : { hatType: null, hat: null, plume: null }
          )
        }
      />
      {figure.hatType && figure.hat && (
        <div className="grid grid-cols-2 gap-2 mt-2">
          <ChannelRow
            label="Hat body"
            value={figure.hat.body}
            onChange={(v) => onPatch({ hat: { ...figure.hat!, body: v || '' } })}
          />
          <ChannelRow
            label="Hat band"
            value={figure.hat.band}
            onChange={(v) => onPatch({ hat: { ...figure.hat!, band: v } })}
            clearable
          />
          {figure.hatType !== 'campaign' && figure.hat.ornament !== 'none' && (
            <ChannelRow
              label="Ornament color"
              value={figure.hat.emblem}
              onChange={(v) => onPatch({ hat: { ...figure.hat!, emblem: v } })}
              clearable
            />
          )}
          {figure.hatType === 'aussie' && (
            <Toggle
              label="Lift other side"
              checked={Boolean(figure.hat.flip)}
              onChange={(v) => onPatch({ hat: { ...figure.hat!, flip: v } })}
            />
          )}
        </div>
      )}
      {figure.hatType && figure.hatType !== 'campaign' && figure.hat && (
        <div className="mt-2">
          <span className={LABEL}>Ornament</span>
          <Pills
            options={HAT_ORNAMENT_OPTIONS.map((o) => ({ value: o.value, label: o.label }))}
            value={
              figure.hat.ornament ||
              (figure.hatType === 'pith'
                ? 'disc'
                : figure.hatType === 'contour' || figure.hatType === 'busby'
                  ? 'none'
                  : 'sunburst')
            }
            onSelect={(v) => onPatch({ hat: { ...figure.hat!, ornament: v } })}
          />
        </div>
      )}
      {figure.hatType && figure.hatType !== 'campaign' && (
        <div className="mt-2 space-y-1">
          <Pills
            options={PLUME_TYPE_OPTIONS.map((o) => ({ value: o.value, label: o.label }))}
            value={figure.plume?.type ?? null}
            onSelect={(v) =>
              onPatch({
                plume: v ? { type: v, color: figure.plume?.color || colorway.accent } : null,
              })
            }
          />
          {figure.plume && (
            <div className="flex items-center gap-4">
              <div className="flex-1">
                <ChannelRow
                  label="Plume"
                  value={figure.plume.color}
                  onChange={(v) => onPatch({ plume: { ...figure.plume!, color: v || '' } })}
                />
              </div>
              <div className="flex-1">
                <ChannelRow
                  label="Plume tip"
                  value={figure.plume.accent}
                  onChange={(v) => onPatch({ plume: { ...figure.plume!, accent: v } })}
                  clearable
                />
              </div>
              {figure.plume.type === 'upright' && (
                <Toggle
                  label="Mylar sparkle"
                  checked={Boolean(figure.plume.mylar)}
                  onChange={(v) => onPatch({ plume: { ...figure.plume!, mylar: v } })}
                />
              )}
            </div>
          )}
        </div>
      )}
      {!figure.hatType && (
        <div className="mt-2">
          <SwatchRow
            label="Hair"
            colors={FIGURE_HAIR_COLORS}
            value={figure.hair}
            onSelect={(hex) => onPatch({ hair: hex })}
          />
        </div>
      )}
    </section>
  );
}
