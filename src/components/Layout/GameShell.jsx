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

      {/* Vignette effect for depth */}
      <div
        className="absolute inset-0"
        style={{
          background: `
            radial-gradient(
              ellipse 100% 100% at 50% 50%,
              transparent 40%,
              rgba(0, 0, 0, 0.3) 100%
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

  return (
    <ShellContext.Provider value={shellContextValue}>
      {/* Global Console Wrapper */}
      <div className="h-screen w-screen overflow-hidden bg-stadium-black text-cream font-sans">

        {/* Atmospheric Background Layer */}
        <AtmosphericBackground />

        {/* Main Console Layout */}
        <div className="relative z-10 flex h-full w-full">

          {/* Desktop Command Rail - Hidden on Mobile */}
          <motion.div
            className="hidden lg:block shrink-0 relative z-20"
            initial={false}
            animate={{ width: isRailExpanded ? 240 : 80 }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
          >
            <CommandRail
              isExpanded={isRailExpanded}
              onToggle={toggleRail}
            />
          </motion.div>

          {/* Main Viewport - Fixed container with internal scroll */}
          <main className="flex-1 h-full overflow-hidden relative pb-20 lg:pb-0">
            <AnimatePresence mode="wait">
              <motion.div
                key={location.pathname}
                initial="initial"
                animate="in"
                exit="out"
                variants={pageVariants}
                transition={pageTransition}
                className="h-full w-full"
              >
                {/* Viewport Container - Pages must use w-full h-full */}
                <div className="h-full w-full overflow-y-auto overflow-x-hidden hud-scroll">
                  {children}
                </div>
              </motion.div>
            </AnimatePresence>
          </main>

          {/* Mobile Bottom Navigation - Hidden on Desktop */}
          <div className="lg:hidden fixed bottom-0 left-0 right-0 z-30">
            <BottomNav />
          </div>
        </div>
      </div>
    </ShellContext.Provider>
  );
};

export default GameShell;
