// =============================================================================
// STUDIO COLOR POPOVER — swatch-first color picking for every channel
// =============================================================================
// The native <input type="color"> is the worst interaction in the Studio on
// phones: it opens an OS dialog that covers the doll, once per channel, dozens
// of times per design. This popover inverts the order the way the loved dye
// systems do (docs/UNIFORM_STUDIO.md §4.3): the corps colorway first (nudges
// coherent designs), then the named silk-swatch library, then the free native
// picker as the always-available escape hatch — hue is never gated.
//
// Selections apply live and keep the popover open so directors can try colors
// against the doll; outside click / Escape / Done closes. Rendered through a
// portal with fixed positioning clamped to the viewport so it never gets
// clipped by the page's scroll container.

import React, { useContext, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check } from 'lucide-react';
import { METAL_HEX, NAMED_COLORS } from '../../data/uniformCatalog';
import { safeHex } from '../../utils/uniform';
import { useFocusTrap } from '../../hooks/useFocusTrap';
import { StudioColorwayContext } from './studioColorContext';

const POPOVER_WIDTH = 272;
const VIEWPORT_MARGIN = 8;

export interface StudioColorPopoverProps {
  /** Channel name, e.g. "Plume" — used for the dialog label. */
  label: string;
  value: string | null | undefined;
  onChange: (hex: string) => void;
  /** Present only for clearable channels; clears and closes. */
  onClear?: () => void;
  /** The trigger button — the popover anchors to (and clamps around) it. */
  anchorRef: React.RefObject<HTMLElement | null>;
  onClose: () => void;
}

function nearestName(hex: string): string {
  const h = safeHex(hex);
  return NAMED_COLORS.find((c) => c.hex === h)?.name || h;
}

export default function StudioColorPopover({
  label,
  value,
  onChange,
  onClear,
  anchorRef,
  onClose,
}: StudioColorPopoverProps) {
  const colorway = useContext(StudioColorwayContext);
  const panelRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const current = value ? safeHex(value) : null;

  useFocusTrap(panelRef, true);

  // Position after mount (needs the panel's real height), clamped on-screen.
  useLayoutEffect(() => {
    const anchor = anchorRef.current;
    const panel = panelRef.current;
    if (!anchor || !panel) return;
    const a = anchor.getBoundingClientRect();
    const panelH = panel.offsetHeight || 320;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const left = Math.max(VIEWPORT_MARGIN, Math.min(a.left, vw - POPOVER_WIDTH - VIEWPORT_MARGIN));
    // Below the anchor when it fits; otherwise pin to the viewport bottom.
    // Never flip above: on mobile the doll is pinned at the top, and covering
    // it would defeat live color preview — the paper-doll loop wins over
    // classic popover flipping.
    let top = a.bottom + 6;
    if (top + panelH > vh - VIEWPORT_MARGIN) {
      top = Math.max(VIEWPORT_MARGIN, vh - panelH - VIEWPORT_MARGIN);
    }
    setPos({ top, left });
  }, [anchorRef]);

  // Outside click / Escape close. Scrolling the page closes too (cheaper and
  // calmer than live re-anchoring while the popover is open) — but only after
  // a grace period: opening the popover often triggers residual scrolling
  // itself (a smooth scroll still settling from section navigation, or the
  // browser nudging the focused trigger into view), and those must not
  // insta-close it.
  const openedAt = useRef(Date.now());
  React.useEffect(() => {
    const onPointerDown = (e: PointerEvent) => {
      const t = e.target as Node;
      if (panelRef.current?.contains(t)) return;
      if (anchorRef.current?.contains(t)) return;
      onClose();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
      }
    };
    const onScroll = (e: Event) => {
      // ignore scrolls inside the popover itself (the swatch grid)
      if (panelRef.current?.contains(e.target as Node)) return;
      if (Date.now() - openedAt.current < 600) return;
      onClose();
    };
    document.addEventListener('pointerdown', onPointerDown, true);
    document.addEventListener('keydown', onKey, true);
    window.addEventListener('scroll', onScroll, true);
    window.addEventListener('resize', onClose);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown, true);
      document.removeEventListener('keydown', onKey, true);
      window.removeEventListener('scroll', onScroll, true);
      window.removeEventListener('resize', onClose);
    };
  }, [anchorRef, onClose]);

  if (typeof document === 'undefined') return null;

  const colorwayChips = colorway
    ? [
        { name: 'Primary', hex: safeHex(colorway.primary) },
        { name: 'Secondary', hex: safeHex(colorway.secondary) },
        { name: 'Accent', hex: safeHex(colorway.accent) },
        { name: 'Hardware', hex: METAL_HEX[colorway.metal] },
      ]
    : [];

  return createPortal(
    <div
      ref={panelRef}
      role="dialog"
      aria-label={`${label} color picker`}
      tabIndex={-1}
      className="fixed z-[120] bg-surface-card border border-line-strong p-3"
      style={{
        width: POPOVER_WIDTH,
        maxWidth: `calc(100vw - ${VIEWPORT_MARGIN * 2}px)`,
        top: pos?.top ?? -9999,
        left: pos?.left ?? -9999,
      }}
    >
      {/* Header: what's being edited + what it currently is */}
      <div className="flex items-center gap-2 pb-2 border-b border-line">
        <span
          aria-hidden="true"
          className="w-6 h-6 border border-line-strong flex-shrink-0"
          style={{ backgroundColor: current || 'transparent' }}
        />
        <div className="flex-1 min-w-0">
          <span className="block text-[10px] font-bold text-muted uppercase tracking-wider">
            {label}
          </span>
          <span className="block text-xs text-white truncate font-mono">
            {current ? nearestName(current) : '—'}
          </span>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider border border-line text-muted hover:text-white hover:border-interactive min-h-touch sm:min-h-0"
        >
          Done
        </button>
      </div>

      {/* Corps colorway first — one tap keeps the design coherent */}
      {colorwayChips.length > 0 && (
        <div className="mt-2">
          <span className="block text-[10px] font-bold text-muted uppercase tracking-wider mb-1">
            Corps colorway
          </span>
          <div className="grid grid-cols-4 gap-1">
            {colorwayChips.map((chip) => (
              <button
                key={chip.name}
                type="button"
                onClick={() => onChange(chip.hex)}
                aria-label={`${chip.name} (${nearestName(chip.hex)})`}
                className="border border-line-strong hover:border-interactive p-1"
              >
                <span
                  aria-hidden="true"
                  className="block h-6 relative"
                  style={{ backgroundColor: chip.hex }}
                >
                  {current === chip.hex && (
                    <Check className="w-3.5 h-3.5 absolute inset-0 m-auto text-white mix-blend-difference" />
                  )}
                </span>
                <span className="block text-[8px] uppercase tracking-wider text-muted truncate mt-0.5">
                  {chip.name}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* The silk-swatch library — real names, always free */}
      <div className="mt-2">
        <span className="block text-[10px] font-bold text-muted uppercase tracking-wider mb-1">
          Silk swatches
        </span>
        <div className="grid grid-cols-8 gap-1 max-h-44 overflow-y-auto scroll-momentum pr-0.5">
          {NAMED_COLORS.map((c) => (
            <button
              key={c.hex}
              type="button"
              onClick={() => onChange(c.hex)}
              aria-label={c.name}
              aria-pressed={current === c.hex}
              title={c.name}
              className={`aspect-square border ${
                current === c.hex
                  ? 'border-interactive ring-1 ring-interactive'
                  : 'border-line-strong hover:border-interactive'
              }`}
              style={{ backgroundColor: c.hex }}
            />
          ))}
        </div>
      </div>

      {/* Free hue escape hatch + clear */}
      <div className="flex items-center gap-2 mt-2 pt-2 border-t border-line">
        <label className="flex-1 flex items-center gap-2 cursor-pointer">
          <input
            type="color"
            aria-label={`${label} custom color`}
            value={current || safeHex(undefined)}
            onChange={(e) => onChange(e.target.value)}
            className="w-9 h-9 bg-background border border-line rounded-none cursor-pointer p-0.5 flex-shrink-0"
          />
          <span className="text-[10px] font-bold text-muted uppercase tracking-wider">
            Custom hue
          </span>
        </label>
        {onClear && (
          <button
            type="button"
            onClick={() => {
              onClear();
              onClose();
            }}
            className="px-2 py-1.5 text-[10px] font-bold uppercase tracking-wider border border-line text-muted hover:text-white hover:border-interactive"
          >
            None
          </button>
        )}
      </div>
    </div>,
    document.body
  );
}
