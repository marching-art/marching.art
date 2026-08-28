// =============================================================================
// STUDIO CONTROLS — shared micro-controls for the Uniform Studio editor
// =============================================================================
// Small presentational pieces in the app's uppercase-label grammar, split out
// of StudioEditor.tsx so that file stays under the max-lines guardrail.

import React, { useRef, useState } from 'react';
import type { FigureConfig, PrintColorKey } from '../../types/uniform';
import { NAMED_COLORS, PRINT_COLOR_SLOTS, UNIFORM_PRESETS } from '../../data/uniformCatalog';
import { printColorValues, safeHex } from '../../utils/uniform';
import UniformFigure from './UniformFigure';
import StudioColorPopover from './StudioColorPopover';
import { LABEL } from './studioTokens';
export { LABEL, SECTION_LABEL } from './studioTokens';

/**
 * The horizontal strip of preset thumbnails. Cheap to re-render: presets are
 * static and UniformFigure is memoized, so every thumb is a memo hit.
 */
export function PresetStrip({ onLoad }: { onLoad: (presetId: string) => void }) {
  return (
    <div className="flex gap-2 overflow-x-auto scrollbar-thin pb-2">
      {UNIFORM_PRESETS.map((preset) => (
        <button
          key={preset.id}
          type="button"
          onClick={() => onLoad(preset.id)}
          className="flex-shrink-0 w-16 border border-line bg-background hover:border-interactive p-1"
          title={`${preset.label} (${preset.era === 'classic' ? 'Heritage' : 'Show'} line)`}
        >
          <UniformFigure figure={preset.figure} label={`${preset.label} preset`} />
          <span className="block text-[8px] uppercase tracking-wider text-muted truncate mt-1">
            {preset.label}
          </span>
        </button>
      ))}
    </div>
  );
}

export function Pills<T extends string | null>({
  options,
  value,
  onSelect,
}: {
  options: ReadonlyArray<{ readonly value: T; readonly label: string }>;
  value: T;
  onSelect: (v: T) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1">
      {options.map((o) => (
        <button
          key={String(o.value)}
          type="button"
          onClick={() => onSelect(o.value)}
          className={`px-2.5 py-1.5 text-[11px] font-bold uppercase tracking-wider border rounded-none min-h-touch sm:min-h-0 ${
            value === o.value
              ? 'bg-interactive border-interactive text-white'
              : 'bg-background border-line text-muted hover:border-interactive hover:text-white'
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function nearestName(hex: string): string {
  const h = safeHex(hex);
  const exact = NAMED_COLORS.find((c) => c.hex === h);
  if (exact) return exact.name;
  return h;
}

/**
 * One color channel. The trigger is a swatch + name button that opens the
 * swatch-first popover (colorway chips → named library → free custom hue);
 * the popover replaces the old bare native input, which on phones opened an
 * OS dialog over the doll for every single channel.
 */
export function ChannelRow({
  label,
  value,
  onChange,
  clearable,
}: {
  label: string;
  value: string | null | undefined;
  onChange: (v: string | null) => void;
  clearable?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const hex = safeHex(value || undefined);
  return (
    <div className="flex items-center gap-2 py-1">
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={`${label} color`}
        className="flex items-center gap-2 flex-1 min-w-0 text-left group min-h-touch sm:min-h-0"
      >
        <span
          aria-hidden="true"
          className="w-9 h-9 border border-line group-hover:border-interactive flex-shrink-0"
          style={
            value
              ? { backgroundColor: hex }
              : {
                  // empty-channel crosshatch so "no color yet" reads at a glance
                  backgroundImage:
                    'linear-gradient(45deg, transparent 44%, rgba(128,128,128,.8) 44%, rgba(128,128,128,.8) 56%, transparent 56%)',
                }
          }
        />
        <span className="flex-1 min-w-0">
          <span className="block text-[10px] font-bold text-muted uppercase tracking-wider">
            {label}
          </span>
          <span className="block text-xs text-white truncate font-mono">
            {value ? nearestName(value) : '—'}
          </span>
        </span>
      </button>
      {clearable && value != null && (
        <button
          type="button"
          onClick={() => onChange(null)}
          className="px-2 py-1 text-[10px] uppercase tracking-wider border border-line text-muted hover:text-white hover:border-interactive"
        >
          None
        </button>
      )}
      {open && (
        <StudioColorPopover
          label={label}
          value={value}
          onChange={(v) => onChange(v)}
          onClear={clearable ? () => onChange(null) : undefined}
          anchorRef={triggerRef}
          onClose={() => setOpen(false)}
        />
      )}
    </div>
  );
}

export function Toggle({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex items-center gap-2 py-1 cursor-pointer text-xs text-white">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="w-4 h-4 bg-background border border-line rounded-none accent-interactive"
      />
      <span className="text-[11px] font-bold uppercase tracking-wider text-muted">{label}</span>
    </label>
  );
}

/**
 * One picker per color slot of a procedural surface (burst, op-art,
 * pinstripe, plaid, foil). Values show the director's overrides merged over
 * the stock palette, so editing starts from what is actually rendering.
 */
export function PrintColorRows({
  figure,
  surface,
  onSlot,
}: {
  figure: FigureConfig;
  surface: PrintColorKey;
  onSlot: (surface: PrintColorKey, index: number, hex: string) => void;
}) {
  const values = printColorValues(figure, surface);
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
      {PRINT_COLOR_SLOTS[surface].map((slot, i) => (
        <ChannelRow
          key={slot}
          label={slot}
          value={values[i]}
          onChange={(v) => {
            if (v) onSlot(surface, i, v);
          }}
        />
      ))}
    </div>
  );
}

export function SwatchRow({
  label,
  colors,
  value,
  onSelect,
}: {
  label: string;
  colors: string[];
  value: string | null | undefined;
  onSelect: (hex: string) => void;
}) {
  return (
    <div className="py-1">
      <span className={LABEL}>{label}</span>
      <div className="flex flex-wrap gap-1">
        {colors.map((hex) => (
          <button
            key={hex}
            type="button"
            aria-label={`${label} ${nearestName(hex)}`}
            onClick={() => onSelect(hex)}
            style={{ backgroundColor: hex }}
            className={`w-7 h-7 border rounded-none ${
              safeHex(value || undefined) === hex
                ? 'border-interactive ring-1 ring-interactive'
                : 'border-line-strong hover:border-interactive'
            }`}
          />
        ))}
      </div>
    </div>
  );
}
