// =============================================================================
// GAME SHELL COMPONENT
// =============================================================================
// Immersive "Stadium Console" wrapper that transforms the app from a website
// to a game HUD. Features atmospheric lighting, command rail, and fixed viewport.

import React, { useState, useEffect, createContext, useContext } from 'react';
import { useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { analyticsHelpers } from '../../firebase';
import CommandRail from '../CommandRail';
import BottomNav from '../BottomNav';

// =============================================================================
// SHELL CONTEXT - For managing sidebar state across components
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
    y: 20
  },
  in: {
    opacity: 1,
    y: 0
  },
  out: {
    opacity: 0,
    y: -20
  }
};

const pageTransition = {
  type: 'tween',
  ease: 'anticipate',
  duration: 0.5
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

  // Log page views
  useEffect(() => {
    analyticsHelpers.logPageView(location.pathname);
  }, [location]);

  const shellContextValue = {
    isRailExpanded,
    toggleRail,
    railWidth: isRailExpanded ? 240 : 80
  };

  // Calculate grid template columns based on rail state
  // Desktop: Sidebar (fixed width) + Main Content (flex-1)
  // Mobile: Full width (sidebar hidden, bottom nav visible)
  const gridCols = isRailExpanded ? '240px 1fr' : '80px 1fr';

  return (
    <ShellContext.Provider value={shellContextValue}>
      {/* =================================================================
          ONE-SCREEN GAME UI: Global Console Wrapper
          Fixed viewport - browser window NEVER scrolls
          ================================================================= */}
      <div className="h-screen w-screen overflow-hidden bg-stadium-black text-cream font-sans">

        {/* Atmospheric Background Layer */}
        <AtmosphericBackground />

        {/* =================================================================
            VIEWPORT CONSTRAINT: Console Frame for Ultra-Wide Monitors
            - Max width 1920px keeps the "console" feel on large screens
            - Centered with subtle border framing on desktop
            ================================================================= */}
        <div className="h-full w-full">
          {/* =================================================================
              APP SHELL LAYOUT: CSS Grid Structure
              - Mobile: Single column (100vw) with bottom nav
              - Desktop: Sidebar (fixed) + Main Content (1fr)
              ================================================================= */}
          <div
            className="relative z-10 h-full w-full grid grid-cols-1 lg:grid-cols-[var(--sidebar-width)_1fr]"
            style={{ '--sidebar-width': isRailExpanded ? '240px' : '80px' }}
          >

          {/* Desktop Command Rail - Fixed Width Sidebar */}
          <motion.aside
            className="hidden lg:flex flex-col h-full relative z-20 border-r border-white/5"
            initial={false}
            animate={{ width: isRailExpanded ? 240 : 80 }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
          >
            <CommandRail
              isExpanded={isRailExpanded}
              onToggle={toggleRail}
            />
          </motion.aside>

          {/* =================================================================
              MAIN CONTENT AREA: Canvas Logic
              - Position: relative (for absolute children)
              - Uses h-full flex flex-col for proper height management
              - Work Surface handles internal scrolling ONLY
              ================================================================= */}
          <main className="relative h-full w-full overflow-hidden flex flex-col pb-20 lg:pb-0">
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
                {/* =============================================================
                    WORK SURFACE: Page Content Container
                    - flex-1: Takes remaining height after top bar
                    - overflow-hidden: Frame remains static
                    - Internal scroll via .hud-scroll applied to scrollable areas
                    ============================================================= */}
                <div className="flex-1 overflow-hidden">
                  {children}
                </div>
              </motion.div>
            </AnimatePresence>
          </main>

          {/* Mobile Bottom Navigation - Fixed at bottom, hidden on desktop */}
          <div className="lg:hidden fixed bottom-0 left-0 right-0 z-30">
            <BottomNav />
          </div>
        </div>
        </div>
      </div>
    </ShellContext.Provider>
  );
};

export default GameShell;
