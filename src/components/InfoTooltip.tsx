// =============================================================================
// INFO TOOLTIP COMPONENT (TypeScript)
// =============================================================================
// A reusable tooltip component for providing contextual help
// Uses a Portal to ensure tooltip renders above all other content

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Info, HelpCircle } from 'lucide-react';

// =============================================================================
// TYPES
// =============================================================================

export type TooltipPosition = 'top' | 'bottom' | 'left' | 'right';
export type TooltipVariant = 'info' | 'help';

export interface InfoTooltipProps {
  /** The help text to display */
  content: string;
  /** Optional title for the tooltip */
  title?: string;
  /** Position of the tooltip */
  position?: TooltipPosition;
  /** Visual variant (info or help icon) */
  variant?: TooltipVariant;
  /** Additional CSS classes */
  className?: string;
}

interface TooltipCoords {
  top: number;
  left: number;
}

// =============================================================================
// COMPONENT
// =============================================================================

const InfoTooltip: React.FC<InfoTooltipProps> = ({
  content,
  title,
  position = 'bottom',
  variant = 'info',
  className = '',
}) => {
  const [isVisible, setIsVisible] = useState(false);
  const [coords, setCoords] = useState<TooltipCoords>({ top: 0, left: 0 });
  const buttonRef = useRef<HTMLButtonElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);

  const Icon = variant === 'help' ? HelpCircle : Info;

  const calculatePosition = useCallback(() => {
    if (!buttonRef.current) return;

    const rect = buttonRef.current.getBoundingClientRect();
    const tooltipWidth = 280; // max-w-xs approximate
    const tooltipHeight = 80; // approximate height
    const offset = 8;

    let top = 0;
    let left = 0;

    switch (position) {
      case 'top':
        top = rect.top - tooltipHeight - offset;
        left = rect.left + rect.width / 2 - tooltipWidth / 2;
        break;
      case 'bottom':
        top = rect.bottom + offset;
        left = rect.left + rect.width / 2 - tooltipWidth / 2;
        break;
      case 'left':
        top = rect.top + rect.height / 2 - tooltipHeight / 2;
        left = rect.left - tooltipWidth - offset;
        break;
      case 'right':
        top = rect.top + rect.height / 2 - tooltipHeight / 2;
        left = rect.right + offset;
        break;
    }

    // Keep tooltip within viewport
    const padding = 8;
    if (left < padding) left = padding;
    if (left + tooltipWidth > window.innerWidth - padding) {
      left = window.innerWidth - tooltipWidth - padding;
    }
    if (top < padding) top = padding;

    setCoords({ top, left });
  }, [position]);

  useEffect(() => {
    if (isVisible) {
      calculatePosition();
      window.addEventListener('scroll', calculatePosition, true);
      window.addEventListener('resize', calculatePosition);
      return () => {
        window.removeEventListener('scroll', calculatePosition, true);
        window.removeEventListener('resize', calculatePosition);
      };
    }
  }, [isVisible, calculatePosition]);

  const handleMouseEnter = () => {
    setIsVisible(true);
  };

  const handleMouseLeave = () => {
    setIsVisible(false);
  };

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsVisible(!isVisible);
  };

  return (
    <div className={`relative inline-block ${className}`}>
      <button
        ref={buttonRef}
        type="button"
        className="inline-flex items-center justify-center w-5 h-5 text-cream-500/60 hover:text-gold-500 transition-colors touch-manipulation"
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        onClick={handleClick}
        aria-label="More information"
      >
        <Icon className="w-4 h-4" />
      </button>

      {createPortal(
        <AnimatePresence>
          {isVisible && (
            <motion.div
              ref={tooltipRef}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.15 }}
              className="fixed pointer-events-auto"
              style={{
                top: coords.top,
                left: coords.left,
                zIndex: 99999,
              }}
              onMouseEnter={handleMouseEnter}
              onMouseLeave={handleMouseLeave}
            >
              <div className="bg-charcoal-800 border border-cream-500/20 rounded-lg shadow-xl p-3 max-w-xs sm:max-w-sm">
                {title && (
                  <p className="text-cream-100 font-semibold text-sm mb-1">{title}</p>
                )}
                <p className="text-cream-300 text-xs leading-relaxed">{content}</p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>,
        document.body
      )}
    </div>
  );
};

export default InfoTooltip;
