// =============================================================================
// GAME SHELL COMPONENT (Dense Layout)
// =============================================================================
// App-like layout with fixed top nav, sidebar on desktop, bottom nav on mobile
// Dense padding optimized for data-heavy dashboard views

import React, { useEffect, createContext, useContext } from 'react';
import { Link, useLocation } from 'react-router-dom';
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
// TOP NAV COMPONENT
// =============================================================================

const TopNav = () => (
  <header
    className="fixed top-0 left-0 right-0 z-30 h-14 bg-[#1A1A1A] border-b border-[#333] lg:pl-56"
    role="banner"
  >
    <div className="h-full max-w-7xl mx-auto px-4 flex items-center justify-between">
      {/* Mobile Logo */}
      <Link to="/dashboard" className="lg:hidden flex items-center gap-2">
        <img
          src="/logo192.webp"
          alt="marching.art"
          className="w-8 h-8 rounded-lg"
        />
        <span className="font-display font-bold text-yellow-400">Marching</span>
        <span className="font-display font-bold text-yellow-50/90">.art</span>
      </Link>

      {/* Desktop: empty space or future breadcrumbs */}
      <div className="hidden lg:block" />

      {/* Spacer for alignment */}
      <div className="w-8 lg:hidden" />
    </div>
  </header>
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
      <div className="min-h-screen w-screen bg-[#0A0A0A] text-cream font-sans overscroll-contain touch-manipulation">
        {/* Fixed Top Navigation */}
        <TopNav />

        {/* Desktop Sidebar */}
        <aside className="hidden lg:flex fixed left-0 top-0 bottom-0 z-40">
          <CommandRail />
        </aside>

        {/* Main Content Area */}
        <main
          id="main-content"
          role="main"
          className="relative z-10 min-h-screen w-full lg:pl-56 pt-16 pb-20 lg:pb-4"
        >
          <div className="max-w-7xl mx-auto px-4">
            <AnimatePresence mode="wait">
              <motion.div
                key={location.pathname}
                initial="initial"
                animate="in"
                exit="out"
                variants={pageVariants}
                transition={pageTransition}
                className="w-full"
              >
                {children}
              </motion.div>
            </AnimatePresence>
          </div>
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
