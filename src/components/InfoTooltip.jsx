// src/components/InfoTooltip.jsx
import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Info, HelpCircle } from 'lucide-react';

/**
 * InfoTooltip - A reusable tooltip component for providing contextual help
 *
 * @param {string} content - The help text to display
 * @param {string} title - Optional title for the tooltip
 * @param {string} position - Position of the tooltip (top, bottom, left, right)
 * @param {string} variant - Visual variant (info, help)
 */
const InfoTooltip = ({
  content,
  title,
  position = 'top',
  variant = 'info',
  className = ''
}) => {
  const [isVisible, setIsVisible] = useState(false);

  const Icon = variant === 'help' ? HelpCircle : Info;

  const positionClasses = {
    top: 'bottom-full left-1/2 -translate-x-1/2 mb-2',
    bottom: 'top-full left-1/2 -translate-x-1/2 mt-2',
    left: 'right-full top-1/2 -translate-y-1/2 mr-2',
    right: 'left-full top-1/2 -translate-y-1/2 ml-2'
  };

  const arrowClasses = {
    top: 'top-full left-1/2 -translate-x-1/2 border-l-transparent border-r-transparent border-b-transparent border-t-charcoal-800',
    bottom: 'bottom-full left-1/2 -translate-x-1/2 border-l-transparent border-r-transparent border-t-transparent border-b-charcoal-800',
    left: 'left-full top-1/2 -translate-y-1/2 border-t-transparent border-b-transparent border-r-transparent border-l-charcoal-800',
    right: 'right-full top-1/2 -translate-y-1/2 border-t-transparent border-b-transparent border-l-transparent border-r-charcoal-800'
  };

  return (
    <div className={`relative inline-block ${className}`}>
      <button
        type="button"
        className="inline-flex items-center justify-center w-5 h-5 text-cream-500/60 hover:text-gold-500 transition-colors touch-manipulation"
        onMouseEnter={() => setIsVisible(true)}
        onMouseLeave={() => setIsVisible(false)}
        onClick={(e) => {
          e.preventDefault();
          setIsVisible(!isVisible);
        }}
        aria-label="More information"
      >
        <Icon className="w-4 h-4" />
      </button>

      <AnimatePresence>
        {isVisible && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.15 }}
            className={`absolute z-50 ${positionClasses[position]}`}
            onMouseEnter={() => setIsVisible(true)}
            onMouseLeave={() => setIsVisible(false)}
          >
            <div className="bg-charcoal-800 border border-cream-500/20 rounded-lg shadow-xl p-3 max-w-xs sm:max-w-sm">
              {title && (
                <p className="text-cream-100 font-semibold text-sm mb-1">{title}</p>
              )}
              <p className="text-cream-300 text-xs leading-relaxed">{content}</p>
            </div>
            <div
              className={`absolute w-0 h-0 border-4 ${arrowClasses[position]}`}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default InfoTooltip;
