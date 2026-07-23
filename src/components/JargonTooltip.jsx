// @ts-nocheck -- grandfathered before checkJs; remove when this file is typed or cleaned up
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
import { JARGON_DEFINITIONS } from './jargonDefinitions';

// =============================================================================
// TOOLTIP COMPONENT
// =============================================================================

const JargonTooltip = ({ termKey, children, enabled = true, className = '' }) => {
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
  const handleTouch = useCallback(
    (e) => {
      e.preventDefault();
      if (isVisible) {
        setIsVisible(false);
      } else {
        calculatePosition();
        setIsVisible(true);
      }
    },
    [isVisible, calculatePosition]
  );

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
        className={`relative cursor-help border-b border-dotted border-charcoal-500 hover:border-interactive hover:text-white transition-colors ${className}`}
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
              <div className="bg-surface-card border border-line rounded-none p-3 shadow-xl">
                <p className="text-xs font-bold text-interactive uppercase tracking-wider mb-1">
                  {definition.term}
                </p>
                <p className="text-sm text-secondary leading-relaxed">{definition.definition}</p>
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
