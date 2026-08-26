// =============================================================================
// STUDIO LIMB CONTROLS — per-side arm & leg editors
// =============================================================================
// Split out of StudioEditor.tsx (max-lines guardrail). Each side edits one
// ArmConfig/LegConfig via onPatch; the editor decides whether a patch applies
// to one side or both (the "link sides" toggle).

import React from 'react';
import type { ArmConfig, LegConfig, UniformColorway } from '../../types/uniform';
import { ARM_TYPE_OPTIONS } from '../../data/uniformCatalog';
import { ChannelRow, Pills, Toggle } from './StudioControls';
import { LABEL } from './studioTokens';

export function ArmControls({
  title,
  arm,
  jacket,
  colorway,
  fade,
  onPatch,
  onFade,
}: {
  title: string;
  arm: ArmConfig;
  jacket: string | null | undefined;
  colorway: UniformColorway;
  /** [top, bottom] colors when this sleeve wears a director fade. */
  fade: [string, string] | null;
  onPatch: (patch: Partial<ArmConfig>) => void;
  onFade: (stops: [string, string] | null) => void;
}) {
  return (
    <div className="space-y-1">
      <span className={LABEL}>{title}</span>
      <Pills
        options={ARM_TYPE_OPTIONS.map((o) => ({ value: o.value, label: o.label }))}
        value={arm.type === 'none' ? 'sleeve' : arm.type}
        onSelect={(v) => onPatch({ type: v as ArmConfig['type'] })}
      />
      {arm.type !== 'bare' && (
        <Pills
          options={[
            { value: 'solid', label: 'Solid' },
            { value: 'fade', label: 'Color fade' },
          ]}
          value={fade ? 'fade' : 'solid'}
          onSelect={(v) =>
            onFade(v === 'fade' ? [arm.color || jacket || colorway.primary, colorway.accent] : null)
          }
        />
      )}
      {arm.type !== 'bare' && fade && (
        <div className="grid grid-cols-2 gap-2">
          <ChannelRow
            label="Fade top"
            value={fade[0]}
            onChange={(v) => v && onFade([v, fade[1]])}
          />
          <ChannelRow
            label="Fade bottom"
            value={fade[1]}
            onChange={(v) => v && onFade([fade[0], v])}
          />
        </div>
      )}
      {arm.type !== 'bare' && !fade && (
        <ChannelRow
          label="Sleeve"
          value={arm.fill?.startsWith('url:') ? null : arm.color || jacket}
          onChange={(v) => onPatch({ color: v, fill: null })}
        />
      )}
      {arm.type === 'sleeve' && (
        <div className="flex flex-wrap gap-3">
          <Toggle
            label="Detached"
            checked={Boolean(arm.detached)}
            onChange={(v) => onPatch({ detached: v })}
          />
          <Toggle
            label="Patent"
            checked={Boolean(arm.patent)}
            onChange={(v) => onPatch({ patent: v })}
          />
          <Toggle
            label="Glow line"
            checked={Boolean(arm.glowLine)}
            onChange={(v) => onPatch({ glowLine: v ? colorway.secondary : null })}
          />
        </div>
      )}
      <div className="flex flex-wrap gap-3">
        <Toggle
          label="Gauntlet"
          checked={Boolean(arm.gauntlet)}
          onChange={(v) => onPatch({ gauntlet: v ? { color: colorway.accent } : null })}
        />
        {arm.gauntlet && (
          <Toggle
            label="Sequin gauntlet"
            checked={Boolean(arm.gauntlet.sequin)}
            onChange={(v) => onPatch({ gauntlet: { ...arm.gauntlet!, sequin: v } })}
          />
        )}
        <Toggle
          label="Glove"
          checked={Boolean(arm.glove)}
          onChange={(v) => onPatch({ glove: v ? colorway.accent : null })}
        />
      </div>
      {arm.gauntlet && (
        <ChannelRow
          label="Gauntlet"
          value={arm.gauntlet.color}
          onChange={(v) => onPatch({ gauntlet: { ...arm.gauntlet!, color: v || '' } })}
        />
      )}
      {arm.glove && (
        <ChannelRow label="Glove" value={arm.glove} onChange={(v) => onPatch({ glove: v })} />
      )}
    </div>
  );
}

export function LegControls({
  title,
  leg,
  torsoPrint,
  torsoFill,
  onPatch,
}: {
  title: string;
  leg: LegConfig;
  torsoPrint: string | null;
  torsoFill: string | null | undefined;
  onPatch: (patch: Partial<LegConfig>) => void;
}) {
  const fillValue =
    leg.fill === 'url:plaid'
      ? 'plaid'
      : leg.fill === 'url:foil'
        ? 'foil'
        : leg.fill && torsoPrint
          ? 'match'
          : null;
  const fillOptions: Array<{ value: string | null; label: string }> = [
    { value: null, label: 'Solid' },
    ...(torsoPrint ? [{ value: 'match', label: 'Match torso print' }] : []),
    { value: 'plaid', label: 'Plaid' },
    { value: 'foil', label: 'Foil' },
  ];
  return (
    <div className="space-y-1">
      <span className={LABEL}>{title}</span>
      <Pills
        options={fillOptions}
        value={fillValue}
        onSelect={(v) =>
          onPatch({
            fill:
              v === null
                ? null
                : v === 'match'
                  ? torsoFill
                  : v === 'plaid'
                    ? 'url:plaid'
                    : 'url:foil',
            foil: v === 'foil',
          })
        }
      />
      {!leg.fill && (
        <ChannelRow label="Trousers" value={leg.color} onChange={(v) => onPatch({ color: v })} />
      )}
      <ChannelRow
        label="Leg stripe"
        value={leg.stripe}
        onChange={(v) => onPatch({ stripe: v })}
        clearable
      />
      <div className="flex flex-wrap gap-3">
        <Toggle
          label="Flare"
          checked={Boolean(leg.flare)}
          onChange={(v) => onPatch({ flare: v, tattered: v ? false : leg.tattered })}
        />
        <Toggle
          label="Tattered hem"
          checked={Boolean(leg.tattered)}
          onChange={(v) => onPatch({ tattered: v, flare: v ? false : leg.flare })}
        />
      </div>
    </div>
  );
}
