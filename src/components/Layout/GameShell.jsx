// =============================================================================
// GAME SHELL COMPONENT (Simplified)
// =============================================================================
// Simple layout wrapper with fixed sidebar on desktop and bottom nav on mobile
// No collapsible rail - straightforward navigation

import React, { useEffect, createContext, useContext } from 'react';
import { useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { analyticsHelpers } from '../../firebase';
import CommandRail from '../CommandRail';
import BottomNav from '../BottomNav';

// =============================================================================
// SHELL CONTEXT
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
  initial: { opacity: 0, y: 8 },
  in: { opacity: 1, y: 0 },
  out: { opacity: 0, y: -8 }
};

const pageTransition = {
  type: 'tween',
  ease: [0.25, 0.1, 0.25, 1.0],
  duration: 0.25
};

// =============================================================================
// ATMOSPHERIC BACKGROUND
// =============================================================================

const AtmosphericBackground = () => (
  <div className="fixed inset-0 pointer-events-none z-0">
    {/* Stadium floodlight gradient */}
    <div
      className="absolute inset-0"
      style={{
        background: `
          radial-gradient(
            ellipse 120% 50% at 50% -5%,
            rgba(234, 179, 8, 0.08) 0%,
            rgba(234, 179, 8, 0.04) 25%,
            transparent 50%
          )
        `
      }}
    />
    {/* Grid overlay */}
    <div
      className="absolute inset-0"
      style={{
        backgroundImage: `
          linear-gradient(to right, rgba(255, 255, 255, 0.02) 1px, transparent 1px),
          linear-gradient(to bottom, rgba(255, 255, 255, 0.02) 1px, transparent 1px)
        `,
        backgroundSize: '20px 20px'
      }}
    />
    {/* Vignette */}
    <div
      className="absolute inset-0"
      style={{
        background: `
          radial-gradient(
            ellipse 85% 75% at 50% 50%,
            transparent 25%,
            rgba(0, 0, 0, 0.1) 50%,
            rgba(0, 0, 0, 0.3) 85%,
            rgba(0, 0, 0, 0.4) 100%
          )
        `
      }}
    />
  </div>
);

// =============================================================================
// GAME SHELL COMPONENT
// =============================================================================

const GameShell = ({ children }) => {
  const location = useLocation();

  // Log page views
  useEffect(() => {
    analyticsHelpers.logPageView(location.pathname);
  }, [location]);

  const shellContextValue = {
    navWidth: 224, // 14rem = 224px (w-56)
  };

  return (
    <ShellContext.Provider value={shellContextValue}>
      <div className="h-dvh w-screen overflow-hidden bg-slate-950 text-cream font-sans">
        {/* Background */}
        <AtmosphericBackground />

        {/* Desktop Sidebar */}
        <aside className="hidden lg:flex fixed left-0 top-0 bottom-0 z-20">
          <CommandRail />
        </aside>

        {/* Main Content Area */}
        <main className="relative z-10 h-full w-full lg:pl-56 pb-20 lg:pb-0 overflow-hidden">
          <AnimatePresence mode="wait">
            <motion.div
              key={location.pathname}
              initial="initial"
              animate="in"
              exit="out"
              variants={pageVariants}
              transition={pageTransition}
              className="h-full w-full flex flex-col overflow-hidden"
            >
              <div className="flex-1 overflow-hidden">
                {children}
              </div>
            </motion.div>
          </AnimatePresence>
        </main>

        {/* Mobile Bottom Navigation */}
        <div className="lg:hidden fixed bottom-0 left-0 right-0 z-30">
          <BottomNav />
        </div>
      </div>
    </ShellContext.Provider>
  );
};

export default GameShell;
