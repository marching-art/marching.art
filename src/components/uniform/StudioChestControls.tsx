// =============================================================================
// STUDIO CHEST CONTROLS — the chest-treatment section of the editor
// =============================================================================
// Split out of StudioEditor.tsx (max-lines guardrail) once direction, two-tone,
// fade, and button-color options outgrew the inline section. Edits flow back
// through onPatch, which the editor routes through withDerivedFlags.

import React from 'react';
import type { ChestBadge, FigureConfig, UniformColorway } from '../../types/uniform';
import { CHEST_BADGE_OPTIONS, CHEST_OPTIONS, CHEST_SHAPE_OPTIONS } from '../../data/uniformCatalog';
import { darkenHex, safeHex } from '../../utils/uniform';
import { ChannelRow, Pills, SECTION_LABEL, Toggle } from './StudioControls';

export default function ChestSection({
  figure,
  colorway,
  onPatch,
}: {
  figure: FigureConfig;
  colorway: UniformColorway;
  onPatch: (patch: Partial<FigureConfig>) => void;
}) {
  const isBand = figure.chest === 'sash' || figure.chest === 'baldric' || figure.chest === 'swash';
  const hasButtons = figure.chest === 'braid' || figure.chest === 'buttons';
  const shapeable = figure.chest === 'sash' || figure.chest === 'baldric';
  const bandShape = figure.chestShape || 'band';
  const badge = figure.chestBadge || null;
  const patchBadge = (next: Partial<ChestBadge>) =>
    badge && onPatch({ chestBadge: { ...badge, ...next } });
  return (
    <section>
      <h3 className={SECTION_LABEL}>Chest</h3>
      <Pills
        options={CHEST_OPTIONS.map((o) => ({ value: o.value, label: o.label }))}
        value={figure.chest || 'none'}
        onSelect={(v) => {
          onPatch({
            chest: v as FigureConfig['chest'],
            chestFade: v === 'sash' || v === 'baldric' || v === 'swash' ? figure.chestFade : null,
            braid: v === 'braid' ? figure.braid || colorway.secondary : figure.braid,
            sash: v === 'sash' ? figure.sash || colorway.secondary : figure.sash,
            baldric: v === 'baldric' ? figure.baldric || colorway.secondary : figure.baldric,
            panel:
              v === 'plastron' || v === 'vinylPanel'
                ? figure.panel || colorway.secondary
                : figure.panel,
            panelTrim:
              v === 'plastron' || v === 'vinylPanel'
                ? figure.panelTrim || darkenHex(colorway.secondary, 0.4)
                : figure.panelTrim,
            swash: v === 'swash' ? figure.swash || colorway.secondary : figure.swash,
          });
        }}
      />
      {shapeable && (
        <div className="mt-2">
          <Pills
            options={CHEST_SHAPE_OPTIONS.map((o) => ({ value: o.value, label: o.label }))}
            value={bandShape}
            onSelect={(v) => onPatch({ chestShape: v as FigureConfig['chestShape'] })}
          />
        </div>
      )}
      <div className="grid grid-cols-2 gap-2 mt-2">
        {figure.chest === 'braid' && (
          <ChannelRow label="Braid" value={figure.braid} onChange={(v) => onPatch({ braid: v })} />
        )}
        {figure.chest === 'sash' && (
          <>
            <ChannelRow label="Sash" value={figure.sash} onChange={(v) => onPatch({ sash: v })} />
            <Toggle
              label="Sequin sash"
              checked={Boolean(figure.sashSequin)}
              onChange={(v) => onPatch({ sashSequin: v })}
            />
          </>
        )}
        {figure.chest === 'baldric' && (
          <>
            <ChannelRow
              label="Baldric"
              value={figure.baldric}
              onChange={(v) => onPatch({ baldric: v })}
            />
            {/* colors the band's center stripe / the blade's inner triangle */}
            {bandShape !== 'tapered' && (
              <ChannelRow
                label={bandShape === 'triangles' ? 'Inner triangle' : 'Center stripe'}
                value={figure.baldricCenter}
                onChange={(v) => onPatch({ baldricCenter: v })}
                clearable
              />
            )}
            <Toggle
              label="Sequin baldric"
              checked={Boolean(figure.baldricSequin)}
              onChange={(v) => onPatch({ baldricSequin: v })}
            />
          </>
        )}
        {(figure.chest === 'plastron' || figure.chest === 'vinylPanel') && (
          <>
            <ChannelRow
              label="Panel"
              value={figure.panel}
              onChange={(v) => onPatch({ panel: v })}
            />
            <ChannelRow
              label="Panel trim"
              value={figure.panelTrim}
              onChange={(v) => onPatch({ panelTrim: v })}
              clearable
            />
          </>
        )}
        {figure.chest === 'swash' && (
          <>
            <ChannelRow
              label="Swash"
              value={figure.swash}
              onChange={(v) => onPatch({ swash: v })}
            />
            <ChannelRow
              label="Leg band"
              value={figure.swashLegColor}
              onChange={(v) => onPatch({ swashLegColor: v })}
              clearable
            />
            {/* the two halves are independent: torso only, leg only, or both */}
            <Toggle
              label="Torso part"
              checked={figure.swashTop !== false}
              onChange={(v) => onPatch({ swashTop: v, swashBottom: v ? figure.swashBottom : true })}
            />
            <Toggle
              label="Leg part"
              checked={figure.swashBottom !== false}
              onChange={(v) => onPatch({ swashBottom: v, swashTop: v ? figure.swashTop : true })}
            />
            <Toggle
              label="Sequin swash"
              checked={figure.swashSequin !== false}
              onChange={(v) => onPatch({ swashSequin: v })}
            />
          </>
        )}
        {hasButtons && (
          <ChannelRow
            label="Buttons"
            value={figure.buttonColor}
            onChange={(v) => onPatch({ buttonColor: v })}
            clearable
          />
        )}
        {isBand && (
          <>
            <Toggle
              label="Other shoulder"
              checked={Boolean(figure.chestReverse)}
              onChange={(v) => onPatch({ chestReverse: v })}
            />
            <Toggle
              label="Color fade"
              checked={Boolean(figure.chestFade)}
              onChange={(v) => {
                const band =
                  (figure.chest === 'sash'
                    ? figure.sash
                    : figure.chest === 'baldric'
                      ? figure.baldric
                      : figure.swash) || colorway.secondary;
                onPatch({ chestFade: v ? [safeHex(band), darkenHex(band, 0.55)] : null });
              }}
            />
            {figure.chestFade && (
              <>
                <ChannelRow
                  label="Fade top"
                  value={figure.chestFade[0]}
                  onChange={(v) => v && onPatch({ chestFade: [v, figure.chestFade![1]] })}
                />
                <ChannelRow
                  label="Fade bottom"
                  value={figure.chestFade[1]}
                  onChange={(v) => v && onPatch({ chestFade: [figure.chestFade![0], v] })}
                />
              </>
            )}
          </>
        )}
      </div>
      <h3 className={`${SECTION_LABEL} mt-3`}>Chest badge</h3>
      <Pills
        options={CHEST_BADGE_OPTIONS.map((o) => ({ value: o.value, label: o.label }))}
        value={badge?.shape ?? null}
        onSelect={(v) =>
          onPatch({
            chestBadge: v
              ? {
                  shape: v as ChestBadge['shape'],
                  color: badge?.color || colorway.accent,
                  accent: badge?.accent ?? null,
                  flip: badge?.flip ?? false,
                }
              : null,
          })
        }
      />
      {badge && (
        <div className="grid grid-cols-2 gap-2 mt-2">
          <ChannelRow
            label="Badge"
            value={badge.color}
            onChange={(v) => v && patchBadge({ color: v })}
          />
          <ChannelRow
            label="Badge detail"
            value={badge.accent}
            onChange={(v) => patchBadge({ accent: v })}
            clearable
          />
          <Toggle
            label="Other breast"
            checked={Boolean(badge.flip)}
            onChange={(v) => patchBadge({ flip: v })}
          />
        </div>
      )}
    </section>
  );
}
