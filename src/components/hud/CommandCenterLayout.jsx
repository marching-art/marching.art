// =============================================================================
// COMMAND CENTER LAYOUT - 3-Column Holy Grail Grid
// =============================================================================
// Responsive grid layout for the high-density HUD dashboard.
//
// Desktop (lg+):
//   [Intelligence] [Command Center] [Logistics]
//      ~20-25%        Flexible         ~20-25%
//
// Mobile/Tablet:
//   Stacked vertically: Command -> Intelligence -> Logistics
//
// The layout uses CSS Grid with named areas for semantic placement.

import React from 'react';

// =============================================================================
// COLUMN COMPONENTS
// =============================================================================

/**
 * IntelligenceColumn - Left sidebar for data feeds, insights, leaderboard
 * Width: ~20-25% on desktop, full width on mobile (appears second)
 */
const IntelligenceColumn = ({ children, className = '' }) => (
  <aside
    className={`
      intelligence-column
      order-2 lg:order-1
      w-full lg:w-auto
      min-h-0 overflow-hidden
      flex flex-col
      ${className}
    `}
    style={{ gridArea: 'intelligence' }}
  >
    {children}
  </aside>
);

/**
 * CommandColumn - Center main content area
 * Width: Flexible (remaining space) on desktop, full width on mobile (appears first)
 */
const CommandColumn = ({ children, className = '' }) => (
  <main
    className={`
      command-column
      order-1 lg:order-2
      w-full lg:w-auto
      min-h-0 overflow-hidden
      flex flex-col
      ${className}
    `}
    style={{ gridArea: 'command' }}
  >
    {children}
  </main>
);

/**
 * LogisticsColumn - Right sidebar for staff, equipment, actions
 * Width: ~20-25% on desktop, full width on mobile (appears third)
 */
const LogisticsColumn = ({ children, className = '' }) => (
  <aside
    className={`
      logistics-column
      order-3
      w-full lg:w-auto
      min-h-0 overflow-hidden
      flex flex-col
      ${className}
    `}
    style={{ gridArea: 'logistics' }}
  >
    {children}
  </aside>
);

// =============================================================================
// COMMAND CENTER LAYOUT
// =============================================================================

/**
 * CommandCenterLayout - 3-column responsive grid container
 *
 * Desktop grid: [Intelligence 22%] [Command auto] [Logistics 22%]
 * Mobile: Stacked vertically with CSS order (Command first)
 *
 * @param {ReactNode} children - Should contain Intelligence, Command, and Logistics columns
 * @param {string} className - Additional CSS classes
 * @param {boolean} fullHeight - Lock to viewport height (default: true)
 */
const CommandCenterLayout = ({
  children,
  className = '',
  fullHeight = true,
}) => {
  return (
    <div
      className={`
        command-center-layout
        w-full
        ${fullHeight ? 'h-full' : ''}

        /* Mobile: Flex column layout */
        flex flex-col gap-2 p-2

        /* Desktop: CSS Grid Holy Grail */
        lg:grid lg:gap-1 lg:p-1

        ${className}
      `}
      style={{
        // CSS Grid for desktop (lg+)
        // Defined via Tailwind lg: prefix but grid-template needs inline style
      }}
    >
      {/* Inject grid styles for desktop via CSS class */}
      <style>{`
        @media (min-width: 1024px) {
          .command-center-layout {
            display: grid;
            grid-template-columns: minmax(240px, 22%) minmax(0, 1fr) minmax(240px, 22%);
            grid-template-rows: minmax(0, 1fr);
            grid-template-areas: "intelligence command logistics";
          }
        }

        @media (min-width: 1280px) {
          .command-center-layout {
            grid-template-columns: minmax(280px, 20%) minmax(0, 1fr) minmax(280px, 20%);
          }
        }

        @media (min-width: 1536px) {
          .command-center-layout {
            grid-template-columns: minmax(320px, 18%) minmax(0, 1fr) minmax(320px, 18%);
          }
        }
      `}</style>
      {children}
    </div>
  );
};

// =============================================================================
// PANEL WRAPPER - Consistent styling for column content
// =============================================================================

/**
 * Panel - Glassmorphism wrapper for content within columns
 * Provides consistent styling and optional header
 */
const Panel = ({
  title,
  subtitle,
  actions,
  children,
  className = '',
  scrollable = false,
  noPadding = false,
  variant = 'default',
}) => {
  const variantStyles = {
    default: 'bg-black/40 border-white/8',
    elevated: 'bg-black/50 border-white/10',
    accent: 'bg-black/40 border-gold-500/20',
    sunken: 'bg-black/60 border-white/5',
  };

  return (
    <div
      className={`
        flex flex-col overflow-hidden
        backdrop-blur-md rounded-lg border
        ${variantStyles[variant] || variantStyles.default}
        ${className}
      `}
    >
      {/* Panel Header */}
      {(title || actions) && (
        <div className="shrink-0 px-3 py-2 border-b border-white/5 flex items-center justify-between">
          <div>
            <h3 className="text-xs font-display font-bold text-cream/80 uppercase tracking-wider">
              {title}
            </h3>
            {subtitle && (
              <span className="text-[10px] text-cream/40 font-data">
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
      )}

      {/* Panel Content */}
      <div
        className={`
          flex-1 min-h-0
          ${scrollable ? 'overflow-y-auto overflow-x-hidden hud-scroll' : 'overflow-hidden'}
          ${noPadding ? '' : 'p-3'}
        `}
      >
        {children}
      </div>
    </div>
  );
};

// =============================================================================
// EXPORTS
// =============================================================================

export {
  CommandCenterLayout,
  IntelligenceColumn,
  CommandColumn,
  LogisticsColumn,
  Panel,
};

export default CommandCenterLayout;
