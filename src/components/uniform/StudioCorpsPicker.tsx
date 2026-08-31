// =============================================================================
// STUDIO CORPS PICKER — which corps am I dressing?
// =============================================================================
// A compact dropdown in the Studio header showing the active corps (name +
// class), replacing the old chip strip that lined every corps up across the
// screen and grew a horizontal scrollbar. One corps renders as a static
// label; more than one opens a menu. The page owns the actual switch (and
// its unsaved-changes confirm) via onSelect.

import React, { useEffect, useRef, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { getClassDisplay } from '../Profile/directorProfileHelpers';
import { useEscapeKey } from '../../hooks/useEscapeKey';
import type { CorpsOption } from './studioInit';

export interface StudioCorpsPickerProps {
  options: CorpsOption[];
  activeClass?: string;
  onSelect: (classKey: string) => void;
}

export default function StudioCorpsPicker({
  options,
  activeClass,
  onSelect,
}: StudioCorpsPickerProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  useEscapeKey(() => setOpen(false), open);

  // Light-dismiss on any pointer press outside the picker.
  useEffect(() => {
    if (!open) return;
    const onPress = (e: PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('pointerdown', onPress);
    return () => document.removeEventListener('pointerdown', onPress);
  }, [open]);

  const active = options.find((o) => o.classKey === activeClass) || options[0];
  if (!active) return null;

  const label = (o: CorpsOption) => (
    <>
      <span className="truncate">{o.corps.corpsName}</span>
      <span className={`flex-shrink-0 ${getClassDisplay(o.classKey).color}`}>
        {getClassDisplay(o.classKey).name}
      </span>
    </>
  );

  // A single corps needs no menu — just say who we're dressing.
  if (options.length < 2) {
    return (
      <div className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider border border-line text-white max-w-full">
        {label(active)}
      </div>
    );
  }

  return (
    <div ref={rootRef} className="relative max-w-full">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Switch corps"
        className={`flex items-center gap-1.5 px-3 py-1.5 min-h-touch sm:min-h-0 text-[11px] font-bold uppercase tracking-wider border text-white max-w-full ${
          open ? 'border-interactive' : 'border-line hover:border-interactive'
        }`}
      >
        {label(active)}
        <ChevronDown
          className={`w-3.5 h-3.5 flex-shrink-0 text-muted transition-transform ${open ? 'rotate-180' : ''}`}
        />
      </button>
      {open && (
        <div
          role="menu"
          aria-label="Corps"
          className="absolute right-0 top-full mt-1 z-40 min-w-full w-max max-w-[80vw] bg-surface-card border border-line-strong"
        >
          {options.map((o) => (
            <button
              key={o.classKey}
              type="button"
              role="menuitemradio"
              aria-checked={o.classKey === active.classKey}
              onClick={() => {
                setOpen(false);
                onSelect(o.classKey);
              }}
              className={`w-full flex items-center justify-between gap-3 px-3 py-2 min-h-touch sm:min-h-0 text-[11px] font-bold uppercase tracking-wider text-left border-b border-line last:border-b-0 ${
                o.classKey === active.classKey
                  ? 'bg-interactive/10 text-white'
                  : 'text-muted hover:text-white hover:bg-white/5'
              }`}
            >
              {label(o)}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
