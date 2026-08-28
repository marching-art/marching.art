// =============================================================================
// PRESET GALLERY — "pick a starting look"
// =============================================================================
// Paper-doll apps onboard by choosing, not configuring: when a corps has no
// design yet the Studio opens this full-screen chooser instead of silently
// loading a preset above a wall of controls. Reachable any time after via the
// Presets section's "See all". Grouped by line (Heritage / Show); picking is
// an ordinary undoable edit, and skipping keeps the default draft.

import React, { useRef } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { UNIFORM_PRESETS, type UniformPreset } from '../../data/uniformCatalog';
import UniformFigure from './UniformFigure';
import { useFocusTrap } from '../../hooks/useFocusTrap';

export interface PresetGalleryProps {
  /** First run shows "Start from scratch" instead of a bare close. */
  firstRun: boolean;
  onPick: (preset: UniformPreset) => void;
  onClose: () => void;
}

function Line({
  title,
  note,
  presets,
  onPick,
}: {
  title: string;
  note: string;
  presets: UniformPreset[];
  onPick: (preset: UniformPreset) => void;
}) {
  return (
    <section className="mt-5">
      <h3 className="text-[10px] font-bold text-muted uppercase tracking-wider border-b border-line pb-1 mb-1">
        {title}
      </h3>
      <p className="text-[11px] text-muted mb-3">{note}</p>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
        {presets.map((preset) => (
          <button
            key={preset.id}
            type="button"
            onClick={() => onPick(preset)}
            className="bg-surface-card border border-line hover:border-interactive p-2 group"
          >
            <div className="max-w-[120px] mx-auto group-hover:opacity-90">
              <UniformFigure figure={preset.figure} label={`${preset.label} preset`} />
            </div>
            <span className="block text-[10px] font-bold uppercase tracking-wider text-white truncate mt-2">
              {preset.label}
            </span>
          </button>
        ))}
      </div>
    </section>
  );
}

export default function PresetGallery({ firstRun, onPick, onClose }: PresetGalleryProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  useFocusTrap(panelRef, true);

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  if (typeof document === 'undefined') return null;

  const heritage = UNIFORM_PRESETS.filter((p) => p.era === 'classic');
  const show = UNIFORM_PRESETS.filter((p) => p.era === 'modern');

  return createPortal(
    <div
      ref={panelRef}
      role="dialog"
      aria-modal="true"
      aria-label="Choose a starting look"
      tabIndex={-1}
      className="fixed inset-0 z-[110] bg-background overflow-y-auto scroll-momentum"
    >
      <div className="max-w-4xl mx-auto px-4 py-6 pb-24">
        <div className="flex items-start gap-3">
          <div className="flex-1">
            <h2 className="text-sm font-bold uppercase tracking-wider text-white">
              Choose a starting look
            </h2>
            <p className="text-xs text-muted mt-1">
              Every piece can be changed after — presets are starting points, never locked sets.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex items-center gap-1.5 px-3 py-2 min-h-touch border border-line text-muted text-[11px] font-bold uppercase tracking-wider hover:text-white hover:border-interactive"
          >
            {firstRun ? (
              'Start from scratch'
            ) : (
              <>
                <X className="w-3.5 h-3.5" />
                Close
              </>
            )}
          </button>
        </div>

        <Line
          title="Heritage line"
          note="The classic corps silhouettes — braid, sashes, shakos, and satin."
          presets={heritage}
          onPick={onPick}
        />
        <Line
          title="Show line"
          note="The modern costume era — prints, asymmetry, foil, and flow."
          presets={show}
          onPick={onPick}
        />
      </div>
    </div>,
    document.body
  );
}
