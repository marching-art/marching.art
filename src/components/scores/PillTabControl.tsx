// =============================================================================
// PILL TAB CONTROL (Design System) — top-level tab strip for the Scores shell.
// Extracted from pages/ScoresParts.jsx; behavior unchanged.
// =============================================================================

import { useEffect, useRef, useState } from 'react';

export interface PillTab {
  id: string;
  label: string;
  /** Accent color for the active state; defaults to the interactive accent. */
  accent?: 'green' | 'yellow';
}

export const PillTabControl = ({
  tabs,
  activeTab,
  onTabChange,
  haptic,
}: {
  tabs: PillTab[];
  activeTab: string;
  onTabChange: (id: string) => void;
  haptic?: (kind: string) => void;
}) => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollRight, setCanScrollRight] = useState(false);

  // Right-edge fade hint when tabs overflow off-screen (matches DataTable's
  // scroll-hint pattern) — without it, off-screen tabs are undiscoverable.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const checkScroll = () => {
      const hasMore = el.scrollWidth > el.clientWidth;
      const notAtEnd = el.scrollLeft < el.scrollWidth - el.clientWidth - 1;
      setCanScrollRight(hasMore && notAtEnd);
    };
    checkScroll();
    window.addEventListener('resize', checkScroll);
    el.addEventListener('scroll', checkScroll);
    return () => {
      window.removeEventListener('resize', checkScroll);
      el.removeEventListener('scroll', checkScroll);
    };
  }, [tabs]);

  return (
    <div className="relative">
      <div
        ref={scrollRef}
        className="flex items-center overflow-x-auto scrollbar-hide bg-transparent border-b border-line"
      >
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => {
              haptic?.('medium');
              onTabChange(tab.id);
            }}
            className={`px-3 sm:px-4 py-2.5 min-h-touch text-[10px] font-bold uppercase tracking-wider transition-all whitespace-nowrap flex-shrink-0 border-b-2 -mb-px ${
              activeTab === tab.id
                ? tab.accent === 'green'
                  ? 'text-green-400 border-green-500'
                  : tab.accent === 'yellow'
                    ? 'text-interactive border-interactive'
                    : 'text-white border-interactive'
                : 'text-muted hover:text-secondary border-transparent'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>
      {canScrollRight && (
        <div
          className="absolute top-0 right-0 bottom-0 w-6 pointer-events-none bg-gradient-to-l from-[#0a0a0a] to-transparent"
          aria-hidden="true"
        />
      )}
    </div>
  );
};

export default PillTabControl;
