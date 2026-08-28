// =============================================================================
// STUDIO SECTION TABS — the mobile slot-tab strip
// =============================================================================
// Horizontal, scrollable tab strip under the pinned canvas: the editor's
// sections plus the Wardrobe pseudo-tab. Roving tabindex with arrow-key
// navigation (Left/Right/Home/End), and the active tab keeps itself scrolled
// into view — figure taps can activate a tab that's off-screen.

import React, { useEffect, useRef } from 'react';
import { STUDIO_SECTIONS, type StudioTabId } from './studioSections';

const TABS: ReadonlyArray<{ id: StudioTabId; label: string }> = [
  ...STUDIO_SECTIONS,
  { id: 'wardrobe', label: 'Wardrobe' },
];

export interface StudioSectionTabsProps {
  active: StudioTabId;
  onSelect: (id: StudioTabId) => void;
  className?: string;
}

export default function StudioSectionTabs({
  active,
  onSelect,
  className = '',
}: StudioSectionTabsProps) {
  const refs = useRef<Array<HTMLButtonElement | null>>([]);

  useEffect(() => {
    const i = TABS.findIndex((t) => t.id === active);
    const el = refs.current[i];
    if (el && typeof el.scrollIntoView === 'function') {
      el.scrollIntoView({ inline: 'center', block: 'nearest', behavior: 'smooth' });
    }
  }, [active]);

  const onKeyDown = (e: React.KeyboardEvent, index: number) => {
    let next: number | null = null;
    if (e.key === 'ArrowRight') next = (index + 1) % TABS.length;
    else if (e.key === 'ArrowLeft') next = (index - 1 + TABS.length) % TABS.length;
    else if (e.key === 'Home') next = 0;
    else if (e.key === 'End') next = TABS.length - 1;
    if (next === null) return;
    e.preventDefault();
    refs.current[next]?.focus();
    onSelect(TABS[next].id);
  };

  return (
    <div
      role="tablist"
      aria-label="Uniform editor sections"
      className={`flex gap-1 overflow-x-auto scroll-momentum border-b border-line bg-background ${className}`}
    >
      {TABS.map((tab, i) => {
        const selected = tab.id === active;
        return (
          <button
            key={tab.id}
            ref={(el) => {
              refs.current[i] = el;
            }}
            type="button"
            role="tab"
            aria-selected={selected}
            tabIndex={selected ? 0 : -1}
            onClick={() => onSelect(tab.id)}
            onKeyDown={(e) => onKeyDown(e, i)}
            className={`px-3 py-2.5 min-h-touch text-[11px] font-bold uppercase tracking-wider whitespace-nowrap border-b-2 -mb-px ${
              selected
                ? 'border-interactive text-white'
                : 'border-transparent text-muted hover:text-white'
            }`}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}
