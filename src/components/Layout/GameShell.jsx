// =============================================================================
// GAME SHELL COMPONENT - AAA SIMULATION HUD
// =============================================================================
// The "Director's Tablet" - A fixed-viewport game HUD that transforms the app
// from a website into a cockpit. Implements the One-Screen Rule with Bento Grid.
//
// Core Design Philosophies:
// 1. ONE-SCREEN RULE (100dvh) - No window-level scrolling
// 2. ZERO "WEB" WHITESPACE - Borders instead of margins/padding
// 3. BENTO-GRID LAYOUT - 12-column modular grid topology
//
// Grid Layout (Desktop):
// - header: Global Ticker (56px) - Season clock, resources, alerts
// - nav: Command Rail (80px/240px) - Persistent sidebar navigation
// - main: Main Stage (flexible) - Primary content area
// - inspect: Inspector Panel (3 cols) - Context-sensitive details
// - ticker: World Ticker (32px) - Scrolling news marquee

import React, { useState, useEffect, createContext, useContext } from 'react';
import { useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { analyticsHelpers } from '../../firebase';
import CommandRail from '../CommandRail';
import BottomNav from '../BottomNav';
import GlobalTicker from '../hud/GlobalTicker';
import WorldTicker from '../hud/WorldTicker';
import InspectorPanel, { InspectorProvider } from '../hud/InspectorPanel';

// =============================================================================
// SHELL CONTEXT - For managing HUD state across components
// =============================================================================

const ShellContext = createContext(null);

export const useShell = () => {
  const context = useContext(ShellContext);
  if (!context) {
    throw new Error('useShell must be used within a GameShell');
  }
  return context;
};

// =============================================================================
// PAGE TRANSITION ANIMATIONS
// =============================================================================

const pageVariants = {
  initial: {
    opacity: 0,
    y: 12
  },
  in: {
    opacity: 1,
    y: 0
  },
  out: {
    opacity: 0,
    y: -12
  }
};

const pageTransition = {
  type: 'tween',
  ease: [0.25, 0.1, 0.25, 1.0], // Snappy, mechanical feel
  duration: 0.35
};

// =============================================================================
// ATMOSPHERIC BACKGROUND LAYER
// =============================================================================

const AtmosphericBackground = () => {
  return (
    <div className="fixed inset-0 pointer-events-none z-0">
      {/* Primary stadium floodlight gradient - top center */}
      <div
        className="absolute inset-0"
        style={{
          background: `
            radial-gradient(
              ellipse 120% 50% at 50% -5%,
              rgba(234, 179, 8, 0.12) 0%,
              rgba(234, 179, 8, 0.06) 25%,
              transparent 50%
            )
          `
        }}
      />

      {/* Secondary subtle ambient glow */}
      <div
        className="absolute inset-0"
        style={{
          background: `
            radial-gradient(
              ellipse 80% 40% at 50% 0%,
              rgba(250, 204, 21, 0.08) 0%,
              transparent 40%
            )
          `
        }}
      />

      {/* 20x20 Tactical Grid Overlay - 3% opacity */}
      <div
        className="absolute inset-0"
        style={{
          backgroundImage: `
            linear-gradient(to right, rgba(255, 255, 255, 0.03) 1px, transparent 1px),
            linear-gradient(to bottom, rgba(255, 255, 255, 0.03) 1px, transparent 1px)
          `,
          backgroundSize: '20px 20px'
        }}
      />

      {/* Noise/Grain Texture - OLED/Carbon Fiber feel */}
      <div
        className="absolute inset-0 opacity-[0.025] mix-blend-overlay"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`
        }}
      />

      {/* Enhanced Vignette - Darker edges for tactical focus */}
      <div
        className="absolute inset-0"
        style={{
          background: `
            radial-gradient(
              ellipse 85% 75% at 50% 50%,
              transparent 25%,
              rgba(0, 0, 0, 0.12) 50%,
              rgba(0, 0, 0, 0.35) 85%,
              rgba(0, 0, 0, 0.5) 100%
            )
          `
        }}
      />
    </div>
  );
};

// =============================================================================
// GAME SHELL COMPONENT
// =============================================================================

const GameShell = ({ children }) => {
  const location = useLocation();
  const [isRailExpanded, setIsRailExpanded] = useState(false);
  const [showInspector, setShowInspector] = useState(true);
  const [showTicker, setShowTicker] = useState(true);
  const [showHeader, setShowHeader] = useState(true);

  // Persist rail expansion preference
  useEffect(() => {
    const savedPreference = localStorage.getItem('commandRailExpanded');
    if (savedPreference !== null) {
      setIsRailExpanded(savedPreference === 'true');
    }
  }, []);

  const toggleRail = () => {
    const newState = !isRailExpanded;
    setIsRailExpanded(newState);
    localStorage.setItem('commandRailExpanded', String(newState));
  };

  const toggleInspector = () => {
    setShowInspector((prev) => !prev);
  };

  // Log page views
  useEffect(() => {
    analyticsHelpers.logPageView(location.pathname);
  }, [location]);

  const shellContextValue = {
    isRailExpanded,
    toggleRail,
    railWidth: isRailExpanded ? 240 : 80,
    showInspector,
    toggleInspector,
    showTicker,
    setShowTicker,
    showHeader,
    setShowHeader,
  };

  // Calculate grid classes based on state
  const gridClasses = [
    'bento-grid-container',
    showHeader && showTicker ? 'with-header-ticker' : showHeader ? 'with-header' : showTicker ? 'with-ticker' : '',
    showInspector ? 'desktop-layout' : 'no-inspector',
    isRailExpanded ? 'nav-expanded' : '',
  ].filter(Boolean).join(' ');

  return (
    <ShellContext.Provider value={shellContextValue}>
      <InspectorProvider>
        {/* =================================================================
            ONE-SCREEN GAME UI: Global Console Wrapper
            Fixed viewport - browser window NEVER scrolls
            Uses 100dvh for mobile browser compatibility
            ================================================================= */}
        <div className="h-dvh w-screen overflow-hidden bg-stadium-black text-cream font-sans">

          {/* Atmospheric Background Layer */}
          <AtmosphericBackground />

          {/* =================================================================
              BENTO GRID CONTAINER
              12-column CSS Grid with 1px gap borders
              Named areas: header, nav, main, inspect, ticker
              ================================================================= */}
          <div
            className={`relative z-10 h-full w-full ${gridClasses}`}
            style={{
              '--nav-width': isRailExpanded ? '240px' : '80px',
            }}
          >
            {/* HEADER ZONE: Global Ticker */}
            {showHeader && (
              <div className="bento-area-header hidden lg:block">
                <GlobalTicker />
              </div>
            )}

            {/* NAV ZONE: Command Rail (Desktop) */}
            <motion.aside
              className="bento-area-nav hidden lg:flex flex-col h-full relative z-20"
              initial={false}
              animate={{ width: isRailExpanded ? 240 : 80 }}
              transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            >
              <CommandRail
                isExpanded={isRailExpanded}
                onToggle={toggleRail}
              />
            </motion.aside>

            {/* MAIN ZONE: Primary Content Area */}
            <main className="bento-area-main relative h-full w-full overflow-hidden flex flex-col pb-20 lg:pb-0">
              <AnimatePresence mode="wait">
                <motion.div
                  key={location.pathname}
                  initial="initial"
                  animate="in"
                  exit="out"
                  variants={pageVariants}
                  transition={pageTransition}
                  className="h-full w-full flex flex-col"
                >
                  {/* Work Surface: Page Content Container
                      - flex-1: Takes remaining height
                      - overflow-hidden: Frame remains static
                      - Internal scroll via .hud-scroll applied to scrollable areas
                  */}
                  <div className="flex-1 overflow-hidden">
                    {children}
                  </div>
                </motion.div>
              </AnimatePresence>
            </main>

            {/* INSPECT ZONE: Inspector Panel (Desktop) */}
            {showInspector && (
              <div className="bento-area-inspect hidden lg:block">
                <InspectorPanel />
              </div>
            )}

            {/* TICKER ZONE: World Ticker */}
            {showTicker && (
              <div className="bento-area-ticker hidden lg:block">
                <WorldTicker />
              </div>
            )}
          </div>

          {/* Mobile Bottom Navigation - Fixed at bottom, hidden on desktop */}
          <div className="lg:hidden fixed bottom-0 left-0 right-0 z-30">
            <BottomNav />
          </div>
        </div>
      </InspectorProvider>
    </ShellContext.Provider>
  );
};

export default GameShell;
