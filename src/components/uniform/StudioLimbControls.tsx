// =============================================================================
// STUDIO LIMB CONTROLS — per-side arm & leg editors
// =============================================================================
// Split out of StudioEditor.tsx (max-lines guardrail). Each side edits one
// ArmConfig/LegConfig via onPatch; the editor decides whether a patch applies
// to one side or both (the "link sides" toggle).

import React from 'react';
import type { ArmConfig, LegConfig, UniformColorway } from '../../types/uniform';
import { ARM_TYPE_OPTIONS, METAL_HEX } from '../../data/uniformCatalog';
import { ChannelRow, Pills, Toggle } from './StudioControls';
import { LABEL } from './studioTokens';

/** Appends the 🔒 to design-house content the director doesn't own. */
type PackLabel = (label: string, packId: string) => string;
const PLAIN: PackLabel = (label) => label;
const PRISM = 'pack_prism_forge';
const WILDWOOD = 'pack_wildwood';

/** A two-color glow fade (Prism Forge cuffs and hems): [upper, edge]. */
function GlowPair({
  upperLabel,
  edgeLabel,
  value,
  onChange,
}: {
  upperLabel: string;
  edgeLabel: string;
  value: [string, string];
  onChange: (next: [string, string]) => void;
}) {
  return (
    <div className="grid grid-cols-2 gap-2">
      <ChannelRow
        label={upperLabel}
        value={value[0]}
        onChange={(v) => v && onChange([v, value[1]])}
      />
      <ChannelRow
        label={edgeLabel}
        value={value[1]}
        onChange={(v) => v && onChange([value[0], v])}
      />
    </div>
  );
}

export function ArmControls({
  title,
  arm,
  jacket,
  torsoFill,
  colorway,
  fade,
  onPatch,
  onFade,
  packLabel = PLAIN,
}: {
  title: string;
  arm: ArmConfig;
  jacket: string | null | undefined;
  /** The torso's print reference, offered as "Torso print" on the sleeve. */
  torsoFill?: string | null;
  colorway: UniformColorway;
  /** [top, bottom] colors when this sleeve wears a director fade. */
  fade: [string, string] | null;
  onPatch: (patch: Partial<ArmConfig>) => void;
  onFade: (stops: [string, string] | null) => void;
  packLabel?: PackLabel;
}) {
  const torsoPrint = torsoFill?.startsWith('url:') ? torsoFill : null;
  const wearsPrint = Boolean(torsoPrint && arm.fill === torsoPrint);
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
            ...(torsoPrint ? [{ value: 'print', label: 'Torso print' }] : []),
          ]}
          value={fade ? 'fade' : wearsPrint ? 'print' : 'solid'}
          onSelect={(v) =>
            v === 'print'
              ? onPatch({ fill: torsoPrint, color: null })
              : onFade(
                  v === 'fade' ? [arm.color || jacket || colorway.primary, colorway.accent] : null
                )
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
      {arm.type !== 'bare' && !fade && !wearsPrint && (
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
            label="Sequins"
            checked={Boolean(arm.sequin)}
            onChange={(v) => onPatch({ sequin: v })}
          />
          <Toggle
            label="Glow line"
            checked={Boolean(arm.glowLine)}
            onChange={(v) => onPatch({ glowLine: v ? colorway.secondary : null })}
          />
          <Toggle
            label={packLabel('Glow cuff', PRISM)}
            checked={Boolean(arm.cuffGlow)}
            onChange={(v) =>
              onPatch({ cuffGlow: v ? [colorway.secondary, colorway.accent] : null })
            }
          />
        </div>
      )}
      {arm.type === 'half' && (
        <div className="flex flex-wrap gap-3">
          <Toggle
            label="Sequins"
            checked={Boolean(arm.sequin)}
            onChange={(v) => onPatch({ sequin: v })}
          />
        </div>
      )}
      {arm.type === 'sleeve' && arm.glowLine && (
        <ChannelRow
          label="Glow line"
          value={arm.glowLine}
          onChange={(v) => v && onPatch({ glowLine: v })}
        />
      )}
      {arm.type !== 'none' && (
        <Toggle
          label={packLabel(arm.type === 'bare' ? 'Veins (gauntlet/glove)' : 'Veins', WILDWOOD)}
          checked={Boolean(arm.veins)}
          onChange={(v) =>
            onPatch({ veins: v ? METAL_HEX[colorway.metal] || METAL_HEX.gold : null })
          }
        />
      )}
      {arm.type !== 'none' && arm.veins && (
        <ChannelRow
          label="Arm veins"
          value={arm.veins}
          onChange={(v) => v && onPatch({ veins: v })}
        />
      )}
      {arm.type === 'sleeve' && arm.cuffGlow && (
        <GlowPair
          upperLabel="Cuff glow"
          edgeLabel="Wrist edge"
          value={arm.cuffGlow}
          onChange={(cuffGlow) => onPatch({ cuffGlow })}
        />
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
  colorway,
  onPatch,
  packLabel = PLAIN,
}: {
  title: string;
  leg: LegConfig;
  torsoPrint: string | null;
  torsoFill: string | null | undefined;
  colorway: UniformColorway;
  onPatch: (patch: Partial<LegConfig>) => void;
  packLabel?: PackLabel;
}) {
  const metal = colorway.metal === 'gold' ? METAL_HEX.gold : METAL_HEX.silver;
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
        <Toggle
          label="Sequins"
          checked={Boolean(leg.sequin)}
          onChange={(v) => onPatch({ sequin: v })}
        />
        <Toggle
          label={packLabel('Seams', PRISM)}
          checked={Boolean(leg.seams)}
          onChange={(v) => onPatch({ seams: v ? metal : null })}
        />
        <Toggle
          label={packLabel('Knee plate', PRISM)}
          checked={Boolean(leg.kneePlate)}
          onChange={(v) => onPatch({ kneePlate: v ? metal : null })}
        />
        <Toggle
          label={packLabel('Glow hem', PRISM)}
          checked={Boolean(leg.hemGlow)}
          onChange={(v) => onPatch({ hemGlow: v ? [colorway.secondary, colorway.accent] : null })}
        />
        <Toggle
          label={packLabel('Veins', WILDWOOD)}
          checked={Boolean(leg.veins)}
          onChange={(v) => onPatch({ veins: v ? metal : null })}
        />
      </div>
      {(leg.seams || leg.kneePlate || leg.veins) && (
        <div className="grid grid-cols-2 gap-2">
          {leg.veins && (
            <ChannelRow
              label="Leg veins"
              value={leg.veins}
              onChange={(v) => v && onPatch({ veins: v })}
            />
          )}
          {leg.seams && (
            <ChannelRow label="Seams" value={leg.seams} onChange={(v) => onPatch({ seams: v })} />
          )}
          {leg.kneePlate && (
            <ChannelRow
              label="Knee plate"
              value={leg.kneePlate}
              onChange={(v) => onPatch({ kneePlate: v })}
            />
          )}
        </div>
      )}
      {leg.hemGlow && (
        <GlowPair
          upperLabel="Hem glow"
          edgeLabel="Hem edge"
          value={leg.hemGlow}
          onChange={(hemGlow) => onPatch({ hemGlow })}
        />
      )}
    </div>
  );
}
