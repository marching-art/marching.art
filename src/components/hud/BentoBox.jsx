// =============================================================================
// BENTO BOX COMPONENT
// =============================================================================
// Modular wrapper for HUD grid cells. Provides consistent styling, headers,
// internal scrolling, and zero-whitespace borders per the Game HUD spec.
//
// Key Features:
// - Zero padding/margin separation - uses borders for visual distinction
// - Internal scrolling only - preserves One-Screen Rule
// - Consistent glassmorphism styling
// - Optional header with title and actions

import React from 'react';
import { motion } from 'framer-motion';

// =============================================================================
// BENTO BOX VARIANTS
// =============================================================================

const variants = {
  // Standard module - default glass panel
  default: {
    background: 'rgba(17, 17, 17, 0.6)',
    border: '1px solid rgba(255, 255, 255, 0.08)',
  },
  // Elevated module - slightly brighter for focus areas
  elevated: {
    background: 'rgba(26, 26, 26, 0.7)',
    border: '1px solid rgba(255, 255, 255, 0.1)',
  },
  // Accent module - gold border highlight
  accent: {
    background: 'rgba(17, 17, 17, 0.6)',
    border: '1px solid rgba(250, 204, 21, 0.3)',
  },
  // Sunken module - deeper for secondary content
  sunken: {
    background: 'rgba(5, 5, 5, 0.6)',
    border: '1px solid rgba(255, 255, 255, 0.05)',
  },
  // Transparent - for overlays
  transparent: {
    background: 'transparent',
    border: 'none',
  },
};

// =============================================================================
// BENTO HEADER COMPONENT
// =============================================================================

const BentoHeader = ({ title, subtitle, actions, variant = 'default' }) => {
  const isAccent = variant === 'accent';

  return (
    <div className="flex items-center justify-between px-3 py-2 border-b border-white/5 shrink-0">
      <div className="flex flex-col">
        <h3 className={`
          text-xs font-display font-bold uppercase tracking-wider
          ${isAccent ? 'text-gold-400' : 'text-cream/80'}
        `}>
          {title}
        </h3>
        {subtitle && (
          <span className="text-[10px] text-cream/40 font-mono">
            {subtitle}
          </span>
        )}
      </div>
      {actions && (
        <div className="flex items-center gap-1">
          {actions}
        </div>
      )}
    </div>
  );
};

// =============================================================================
// BENTO BOX COMPONENT
// =============================================================================

/**
 * BentoBox - A modular container for the Game HUD Bento Grid
 *
 * @param {string} title - Optional header title (uppercase, tracking-wider)
 * @param {string} subtitle - Optional subtitle (monospace, muted)
 * @param {ReactNode} actions - Optional header actions (buttons, icons)
 * @param {string} variant - Visual variant: default | elevated | accent | sunken | transparent
 * @param {boolean} scrollable - Enable internal scrolling (default: false)
 * @param {string} className - Additional CSS classes for the outer container
 * @param {string} contentClassName - Additional CSS classes for the content area
 * @param {boolean} noPadding - Remove default content padding (for full-bleed content)
 * @param {string} gridArea - CSS grid-area value for placement
 * @param {ReactNode} children - Content to render inside the box
 */
const BentoBox = ({
  title,
  subtitle,
  actions,
  variant = 'default',
  scrollable = false,
  className = '',
  contentClassName = '',
  noPadding = false,
  gridArea,
  children,
}) => {
  const variantStyles = variants[variant] || variants.default;

  const boxStyle = {
    ...variantStyles,
    backdropFilter: variant !== 'transparent' ? 'blur(12px)' : undefined,
    WebkitBackdropFilter: variant !== 'transparent' ? 'blur(12px)' : undefined,
    gridArea: gridArea || undefined,
  };

  const hasHeader = title || actions;

  return (
    <motion.div
      className={`
        relative flex flex-col overflow-hidden
        ${className}
      `}
      style={boxStyle}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
    >
      {/* Header */}
      {hasHeader && (
        <BentoHeader
          title={title}
          subtitle={subtitle}
          actions={actions}
          variant={variant}
        />
      )}

      {/* Content Area */}
      <div
        className={`
          flex-1 min-h-0
          ${scrollable ? 'overflow-y-auto overflow-x-hidden hud-scroll' : 'overflow-hidden'}
          ${noPadding ? '' : 'p-3'}
          ${contentClassName}
        `}
      >
        {children}
      </div>
    </motion.div>
  );
};

// =============================================================================
// BENTO GRID CONTAINER
// =============================================================================

/**
 * BentoGrid - The master 12-column grid container for the HUD
 * Implements the One-Screen Rule with 100dvh viewport lock
 *
 * Grid Layout (Desktop):
 * - header: spans 12 columns (56px fixed height)
 * - nav: spans ~1 column (80px collapsed / 240px expanded)
 * - main: spans 11 columns (flexible)
 * - ticker: spans 12 columns (32px fixed height)
 */
const BentoGrid = ({
  children,
  className = '',
  showTicker = false,
  showHeader = false,
}) => {
  return (
    <div
      className={`
        bento-grid-container
        w-full h-full
        ${className}
      `}
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(12, minmax(0, 1fr))',
        gridTemplateRows: showHeader && showTicker
          ? '56px minmax(0, 1fr) 32px'
          : showHeader
          ? '56px minmax(0, 1fr)'
          : showTicker
          ? 'minmax(0, 1fr) 32px'
          : 'minmax(0, 1fr)',
        gap: '1px',
        backgroundColor: 'rgba(31, 41, 55, 0.3)', // Border color via gap
      }}
    >
      {children}
    </div>
  );
};

// =============================================================================
// EXPORTS
// =============================================================================

export { BentoBox, BentoGrid, BentoHeader };
export default BentoBox;
