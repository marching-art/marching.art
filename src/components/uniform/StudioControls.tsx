// =============================================================================
// STUDIO CONTROLS — shared micro-controls for the Uniform Studio editor
// =============================================================================
// Small presentational pieces in the app's uppercase-label grammar, split out
// of StudioEditor.tsx so that file stays under the max-lines guardrail.

import React from 'react';
import { NAMED_COLORS } from '../../data/uniformCatalog';
import { safeHex } from '../../utils/uniform';
import { LABEL } from './studioTokens';
export { LABEL, SECTION_LABEL } from './studioTokens';

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
  const hex = safeHex(value || undefined);
  return (
    <div className="flex items-center gap-2 py-1">
      <input
        type="color"
        aria-label={`${label} color`}
        value={hex}
        onChange={(e) => onChange(e.target.value)}
        className="w-9 h-9 bg-background border border-line rounded-none cursor-pointer p-0.5"
      />
      <div className="flex-1 min-w-0">
        <span className="block text-[10px] font-bold text-muted uppercase tracking-wider">
          {label}
        </span>
        <span className="block text-xs text-white truncate font-mono">
          {value ? nearestName(value) : '—'}
        </span>
      </div>
      {clearable && value != null && (
        <button
          type="button"
          onClick={() => onChange(null)}
          className="px-2 py-1 text-[10px] uppercase tracking-wider border border-line text-muted hover:text-white hover:border-interactive"
        >
          None
        </button>
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
