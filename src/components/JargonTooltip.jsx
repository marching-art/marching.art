/**
 * JargonTooltip Component
 *
 * Wraps insider terminology with a subtle tooltip that explains the term.
 * Shows dotted underline indicator. Tooltip appears on hover (desktop) or tap (mobile).
 * Can be globally disabled via useTooltipPreference hook.
 */

import React, { useState, useRef, useCallback, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { m, AnimatePresence } from 'framer-motion';

// =============================================================================
// JARGON DEFINITIONS
// =============================================================================
// Central dictionary of insider terms and their plain-English definitions

export const JARGON_DEFINITIONS = {
  director: {
    term: 'Director',
    definition: 'You! The manager of your fantasy corps. You draft performers and compete against other directors.',
  },
  caption: {
    term: 'Caption',
    definition: 'A scoring category, like a position in fantasy football. There are 8 captions: GE1, GE2, Visual Proficiency, Visual Analysis, Color Guard, Brass, Music Analysis, and Percussion.',
  },
  corps: {
    term: 'Corps',
    definition: 'Short for "drum and bugle corps" — elite marching ensembles that compete in DCI. Think marching band, but at the highest competitive level.',
  },
  ge: {
    term: 'GE (General Effect)',
    definition: 'How the performance feels emotionally. GE judges score the overall impact, entertainment value, and artistic merit of a show.',
  },
  dci: {
    term: 'DCI',
    definition: 'Drum Corps International — the governing body and competition circuit for elite drum and bugle corps in North America.',
  },
  worldClass: {
    term: 'World Class',
    definition: 'The top competitive division in DCI. Corps like Blue Devils, Carolina Crown, and Bluecoats compete here.',
  },
  openClass: {
    term: 'Open Class',
    definition: 'The second-tier competitive division in DCI. Smaller corps building toward World Class compete here.',
  },
  soundsport: {
    term: 'SoundSport',
    definition: 'The entry-level division in fantasy drum corps. New directors start here with a 90-point budget before leveling up.',
  },
  xp: {
    term: 'XP',
    definition: 'Experience points earned by playing. Gain XP to level up and unlock higher class divisions with bigger budgets.',
  },
  corpscoin: {
    term: 'CorpsCoin',
    definition: 'In-game currency earned through achievements. Use it to unlock special features and customizations.',
  },
};

// =============================================================================
// TOOLTIP COMPONENT
// =============================================================================

const JargonTooltip = ({
  termKey,
  children,
  enabled = true,
  className = '',
}) => {
  const [isVisible, setIsVisible] = useState(false);
  const [coords, setCoords] = useState({ top: 0, left: 0 });
  const triggerRef = useRef(null);
  const timeoutRef = useRef(null);

  const definition = JARGON_DEFINITIONS[termKey];

  // Calculate tooltip position
  const calculatePosition = useCallback(() => {
    if (!triggerRef.current) return;

    const rect = triggerRef.current.getBoundingClientRect();
    const tooltipWidth = 280;
    const offset = 8;

    let top = rect.bottom + offset;
    let left = rect.left + rect.width / 2 - tooltipWidth / 2;

    // Keep within viewport
    const padding = 12;
    if (left < padding) left = padding;
    if (left + tooltipWidth > window.innerWidth - padding) {
      left = window.innerWidth - tooltipWidth - padding;
    }

    // If tooltip would go below viewport, show above
    if (top + 100 > window.innerHeight) {
      top = rect.top - 100 - offset;
    }

    setCoords({ top, left });
  }, []);

  // Show tooltip with slight delay (prevents flicker on quick mouse movements)
  const showTooltip = useCallback(() => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => {
      calculatePosition();
      setIsVisible(true);
    }, 150);
  }, [calculatePosition]);

  // Hide tooltip
  const hideTooltip = useCallback(() => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => {
      setIsVisible(false);
    }, 100);
  }, []);

  // Handle touch (mobile)
  const handleTouch = useCallback((e) => {
    e.preventDefault();
    if (isVisible) {
      setIsVisible(false);
    } else {
      calculatePosition();
      setIsVisible(true);
    }
  }, [isVisible, calculatePosition]);

  // Close on scroll (mobile UX)
  useEffect(() => {
    if (isVisible) {
      const handleScroll = () => setIsVisible(false);
      window.addEventListener('scroll', handleScroll, { passive: true, capture: true });
      return () => window.removeEventListener('scroll', handleScroll, true);
    }
  }, [isVisible]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  // If tooltips disabled or no definition, just render children
  if (!enabled || !definition) {
    return <span className={className}>{children}</span>;
  }

  return (
    <>
      <span
        ref={triggerRef}
        className={`relative cursor-help border-b border-dotted border-gray-500 hover:border-[#0057B8] hover:text-white transition-colors ${className}`}
        onMouseEnter={showTooltip}
        onMouseLeave={hideTooltip}
        onTouchStart={handleTouch}
        role="button"
        tabIndex={0}
        aria-describedby={`tooltip-${termKey}`}
      >
        {children}
      </span>

      {createPortal(
        <AnimatePresence>
          {isVisible && (
            <m.div
              id={`tooltip-${termKey}`}
              role="tooltip"
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 4 }}
              transition={{ duration: 0.15 }}
              className="fixed pointer-events-none"
              style={{
                top: coords.top,
                left: coords.left,
                zIndex: 99999,
                width: 280,
              }}
              onMouseEnter={showTooltip}
              onMouseLeave={hideTooltip}
            >
              <div className="bg-[#1a1a1a] border border-[#333] rounded-sm p-3 shadow-xl">
                <p className="text-xs font-bold text-[#0057B8] uppercase tracking-wider mb-1">
                  {definition.term}
                </p>
                <p className="text-sm text-gray-300 leading-relaxed">
                  {definition.definition}
                </p>
              </div>
            </m.div>
          )}
        </AnimatePresence>,
        document.body
      )}
    </>
  );
};

export default JargonTooltip;
