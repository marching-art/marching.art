// =============================================================================
// GAME SHELL - ESPN DATA GRID LAYOUT
// =============================================================================
// Strict data terminal layout: fixed headers, scrollable content
// Laws enforced: No glow, no shadow, tight spacing

import React, { useEffect, createContext, useContext } from 'react';
import { Link, useLocation, NavLink } from 'react-router-dom';
import { analyticsHelpers } from '../../firebase';
import BottomNav from '../BottomNav';
import {
  LayoutDashboard,
  Calendar,
  Trophy,
  Users,
  User,
  ChevronDown
} from 'lucide-react';

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
// TOP NAV - Fixed h-12
// =============================================================================

const TopNav = () => (
  <nav className="fixed top-0 w-full h-12 bg-[#1a1a1a] border-b border-[#333] z-50 flex items-center px-4">
    {/* Logo */}
    <Link to="/dashboard" className="flex items-center gap-2 mr-6">
      <img
        src="/logo192.webp"
        alt="marching.art"
        className="w-7 h-7 rounded"
      />
      <span className="hidden sm:block font-bold text-sm text-white">MARCHING.ART</span>
    </Link>

    {/* League Selector (placeholder) */}
    <button className="hidden md:flex items-center gap-1 px-3 py-1.5 bg-[#0a0a0a] border border-[#333] rounded text-xs text-gray-300 hover:border-[#555]">
      <span>2024 DCI Season</span>
      <ChevronDown className="w-3 h-3" />
    </button>

    {/* Spacer */}
    <div className="flex-1" />

    {/* Desktop Nav Links */}
    <div className="hidden lg:flex items-center gap-1">
      <NavItem to="/dashboard" icon={LayoutDashboard} label="Dashboard" />
      <NavItem to="/schedule" icon={Calendar} label="Schedule" />
      <NavItem to="/scores" icon={Trophy} label="Scores" />
      <NavItem to="/leagues" icon={Users} label="Leagues" />
      <NavItem to="/profile" icon={User} label="Profile" />
    </div>
  </nav>
);

// Nav Item Component
const NavItem = ({ to, icon: Icon, label }) => (
  <NavLink
    to={to}
    className={({ isActive }) =>
      `flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded transition-colors ${
        isActive
          ? 'bg-[#0057B8] text-white'
          : 'text-gray-400 hover:text-white hover:bg-white/5'
      }`
    }
  >
    <Icon className="w-4 h-4" />
    <span>{label}</span>
  </NavLink>
);

// =============================================================================
// TICKER BAR - Fixed h-8 (Sub Nav)
// =============================================================================

const TickerBar = () => {
  // Placeholder ticker data
  const tickerItems = [
    { name: 'BD', score: '98.20', trend: 'up' },
    { name: 'CC', score: '97.55', trend: 'down' },
    { name: 'BAC', score: '96.80', trend: 'up' },
    { name: 'SCV', score: '95.40', trend: 'neutral' },
    { name: 'CAV', score: '94.25', trend: 'up' },
    { name: 'PR', score: '93.10', trend: 'down' },
  ];

  return (
    <div className="fixed top-12 w-full h-8 bg-black border-b border-[#333] z-40 flex items-center overflow-hidden">
      <div className="flex items-center gap-4 px-4 text-xs font-data">
        <span className="text-gray-500 uppercase tracking-wider text-[10px] font-bold">Live</span>
        <div className="w-px h-4 bg-[#333]" />
        {tickerItems.map((item, idx) => (
          <div key={idx} className="flex items-center gap-2">
            <span className="text-gray-400 font-medium">{item.name}</span>
            <span className={`tabular-nums ${
              item.trend === 'up' ? 'text-green-500' :
              item.trend === 'down' ? 'text-red-500' :
              'text-gray-300'
            }`}>
              {item.score}
            </span>
            {item.trend === 'up' && <span className="text-green-500 text-[10px]">▲</span>}
            {item.trend === 'down' && <span className="text-red-500 text-[10px]">▼</span>}
            {idx < tickerItems.length - 1 && <div className="w-px h-3 bg-[#333] ml-2" />}
          </div>
        ))}
      </div>
    </div>
  );
};

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
    headerHeight: 80, // 48px (h-12) + 32px (h-8) = 80px total
  };

  return (
    <ShellContext.Provider value={shellContextValue}>
      <div className="min-h-screen w-screen bg-[#0a0a0a] text-white font-sans">
        {/* Fixed Top Navigation */}
        <TopNav />

        {/* Fixed Ticker Bar */}
        <TickerBar />

        {/* Main Content Area - Pads for fixed headers (h-12 + h-8 = 80px = pt-20) */}
        <main
          id="main-content"
          role="main"
          className="pt-20 pb-20 lg:pb-4 min-h-screen w-full bg-[#0a0a0a]"
        >
          <div className="w-full px-2 md:px-4">
            {children}
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
