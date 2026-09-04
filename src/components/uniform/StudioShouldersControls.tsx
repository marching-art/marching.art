// =============================================================================
// STUDIO SHOULDERS CONTROLS — the shoulders & neck section of the editor
// =============================================================================
// Split out of StudioEditor.tsx (max-lines guardrail), following the chest and
// headwear sections. Edits flow back through onPatch, which the editor routes
// through withDerivedFlags.

import React from 'react';
import type { FigureConfig, UniformColorway } from '../../types/uniform';
import { NECK_OPTIONS } from '../../data/uniformCatalog';
import { darkenHex, safeHex } from '../../utils/uniform';
import { ChannelRow, Pills, SECTION_LABEL, Toggle } from './StudioControls';

export default function ShouldersSection({
  figure,
  colorway,
  onPatch,
  packLabel,
}: {
  figure: FigureConfig;
  colorway: UniformColorway;
  onPatch: (patch: Partial<FigureConfig>) => void;
  /** Adds the 🔒 mark to design-house pack content the director does not own. */
  packLabel: (label: string, packId: string) => string;
}) {
  const neckValue = figure.cowl
    ? 'cowl'
    : figure.mockNeck
      ? 'mock'
      : figure.collar
        ? 'collar'
        : figure.crew
          ? 'crew'
          : 'none';

  const setNeck = (v: string) => {
    onPatch({
      collar: v === 'collar' ? safeHex(figure.jacket || colorway.primary) : null,
      collarTrim: v === 'collar' ? colorway.secondary : null,
      mockNeck: v === 'mock' ? safeHex(figure.jacket || colorway.primary) : null,
      cowl: v === 'cowl' ? darkenHex(colorway.primary, 0.25) : null,
      crew: v === 'crew',
    });
  };

  return (
    <section>
      <h3 className={SECTION_LABEL}>Shoulders &amp; neck</h3>
      <Pills
        options={NECK_OPTIONS.map((o) => ({ value: o.value, label: o.label }))}
        value={neckValue}
        onSelect={setNeck}
      />
      <div className="grid grid-cols-2 gap-2 mt-2">
        {neckValue === 'collar' && (
          <>
            <ChannelRow
              label="Collar"
              value={figure.collar}
              onChange={(v) => onPatch({ collar: v })}
            />
            <ChannelRow
              label="Collar trim"
              value={figure.collarTrim}
              onChange={(v) => onPatch({ collarTrim: v })}
              clearable
            />
          </>
        )}
        {neckValue === 'mock' && (
          <ChannelRow
            label="Mock neck"
            value={
              typeof figure.mockNeck === 'string' && !figure.mockNeck.startsWith('url:')
                ? figure.mockNeck
                : null
            }
            onChange={(v) => onPatch({ mockNeck: v })}
          />
        )}
        {neckValue === 'cowl' && (
          <ChannelRow label="Cowl" value={figure.cowl} onChange={(v) => onPatch({ cowl: v })} />
        )}
      </div>
      <div className="flex flex-wrap gap-3 mt-1">
        <Toggle
          label="Epaulets"
          checked={Boolean(figure.epaulet)}
          onChange={(v) => onPatch({ epaulet: v ? colorway.secondary : null })}
        />
        <Toggle
          label="Suspenders"
          checked={Boolean(figure.suspenders)}
          onChange={(v) => onPatch({ suspenders: v ? darkenHex(colorway.secondary, 0.3) : null })}
        />
        <Toggle
          label="Neckerchief"
          checked={Boolean(figure.scarf)}
          onChange={(v) => onPatch({ scarf: v ? colorway.accent : null })}
        />
        <Toggle
          label="Sequin tie"
          checked={Boolean(figure.tie)}
          onChange={(v) => onPatch({ tie: v ? colorway.accent : null })}
        />
        <Toggle
          label={packLabel('Shoulder cape', 'pack_military_outfitters')}
          checked={Boolean(figure.cape)}
          onChange={(v) =>
            onPatch({
              cape: v
                ? {
                    color: colorway.secondary,
                    lining: colorway.accent,
                  }
                : null,
            })
          }
        />
        {figure.cape && (
          <Toggle
            label="Other shoulder"
            checked={figure.cape.side === 'right'}
            onChange={(v) => onPatch({ cape: { ...figure.cape!, side: v ? 'right' : 'left' } })}
          />
        )}
        <Toggle
          label={packLabel('Drum major cord', 'title_drum_major')}
          checked={Boolean(figure.aiguillette)}
          onChange={(v) => onPatch({ aiguillette: v ? colorway.accent : null })}
        />
      </div>
      <div className="grid grid-cols-2 gap-2">
        {figure.epaulet && (
          <ChannelRow
            label="Epaulets"
            value={figure.epaulet}
            onChange={(v) => onPatch({ epaulet: v })}
          />
        )}
        {figure.suspenders && (
          <ChannelRow
            label="Suspenders"
            value={figure.suspenders}
            onChange={(v) => onPatch({ suspenders: v })}
          />
        )}
        {figure.scarf && (
          <ChannelRow
            label="Neckerchief"
            value={figure.scarf}
            onChange={(v) => onPatch({ scarf: v })}
          />
        )}
        {figure.tie && (
          <ChannelRow label="Tie" value={figure.tie} onChange={(v) => onPatch({ tie: v })} />
        )}
        {figure.aiguillette && (
          <ChannelRow
            label="Cord"
            value={figure.aiguillette}
            onChange={(v) => onPatch({ aiguillette: v })}
          />
        )}
        {figure.cape && (
          <>
            <ChannelRow
              label="Cape"
              value={figure.cape.color}
              onChange={(v) => onPatch({ cape: { ...figure.cape!, color: v || '' } })}
            />
            <ChannelRow
              label="Cape lining"
              value={figure.cape.lining}
              onChange={(v) => onPatch({ cape: { ...figure.cape!, lining: v } })}
              clearable
            />
          </>
        )}
      </div>
    </section>
  );
}
