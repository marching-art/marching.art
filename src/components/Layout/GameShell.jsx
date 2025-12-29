// =============================================================================
// GAME SHELL - ESPN DATA GRID LAYOUT
// =============================================================================
// Strict data terminal layout: fixed headers, scrollable content
// Laws enforced: No glow, no shadow, tight spacing

import React, { useEffect, useState, createContext, useContext, useRef } from 'react';
import { Link, useLocation, NavLink } from 'react-router-dom';
import { analyticsHelpers } from '../../firebase';
import BottomNav from '../BottomNav';
import { useSeasonStore } from '../../store/seasonStore';
import { formatSeasonName } from '../../utils/season';
import { useTickerData } from '../../hooks/useTickerData';
import {
  LayoutDashboard,
  Calendar,
  Trophy,
  Users,
  User,
  ChevronDown,
  TrendingUp,
  TrendingDown,
  Minus,
  Music,
  Eye,
  Sparkles,
  ChevronLeft,
  ChevronRight
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

const TopNav = () => {
  const seasonData = useSeasonStore((state) => state.seasonData);

  // Format the season name for display
  const getDisplaySeasonName = () => {
    if (!seasonData?.name) return 'Loading Season...';

    const name = seasonData.name;

    // For live seasons (e.g., "live_2024-25"), display as "2024 Live Season"
    if (name.startsWith('live_')) {
      const yearPart = name.replace('live_', '').split('-')[0];
      return `${yearPart} Live Season`;
    }

    // For off-seasons (e.g., "finale_2024-25"), display as "Finale 2024-25"
    return formatSeasonName(name);
  };

  return (
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

      {/* Season Selector */}
      <div className="hidden md:flex items-center gap-1 px-3 py-1.5 bg-[#0a0a0a] border border-[#333] rounded text-xs text-gray-300">
        <span>{getDisplaySeasonName()}</span>
        <ChevronDown className="w-3 h-3 opacity-50" />
      </div>

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
};

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
// TICKER BAR - Fixed h-8 (Sub Nav) - Sports Stats Style
// =============================================================================

// Ticker section types for cycling through different data
const TICKER_SECTIONS = ['scores', 'leaders', 'captions', 'movers'];

const TickerBar = () => {
  const { tickerData, captionStats, loading, hasData, displayDay } = useTickerData();
  const [activeSection, setActiveSection] = useState(0);
  const scrollRef = useRef(null);

  // Auto-cycle through sections every 8 seconds
  useEffect(() => {
    if (!hasData) return;

    const interval = setInterval(() => {
      setActiveSection(prev => (prev + 1) % TICKER_SECTIONS.length);
    }, 8000);

    return () => clearInterval(interval);
  }, [hasData]);

  // Navigate between sections
  const goToPrev = () => {
    setActiveSection(prev => (prev - 1 + TICKER_SECTIONS.length) % TICKER_SECTIONS.length);
  };

  const goToNext = () => {
    setActiveSection(prev => (prev + 1) % TICKER_SECTIONS.length);
  };

  // Trend indicator component
  const TrendIndicator = ({ trend }) => {
    if (trend === 'up') return <TrendingUp className="w-3 h-3 text-green-500" />;
    if (trend === 'down') return <TrendingDown className="w-3 h-3 text-red-500" />;
    return <Minus className="w-3 h-3 text-gray-500" />;
  };

  // Section label badge
  const SectionBadge = ({ label, icon: Icon, color = 'gray' }) => (
    <div className={`flex items-center gap-1.5 px-2 py-0.5 bg-${color}-500/20 border border-${color}-500/30 rounded text-[10px] font-bold uppercase tracking-wider`}>
      <Icon className={`w-3 h-3 text-${color}-400`} />
      <span className={`text-${color}-400`}>{label}</span>
    </div>
  );

  // Loading state
  if (loading) {
    return (
      <div className="fixed top-12 w-full h-8 bg-black border-b border-[#333] z-40 flex items-center overflow-hidden">
        <div className="flex items-center gap-4 px-4 text-xs">
          <span className="text-gray-500 animate-pulse">Loading scores...</span>
        </div>
      </div>
    );
  }

  // No data state
  if (!hasData) {
    return (
      <div className="fixed top-12 w-full h-8 bg-black border-b border-[#333] z-40 flex items-center overflow-hidden">
        <div className="flex items-center gap-4 px-4 text-xs">
          <span className="text-gray-500">No scores available yet</span>
        </div>
      </div>
    );
  }

  // Get current section content
  const renderSectionContent = () => {
    const section = TICKER_SECTIONS[activeSection];

    switch (section) {
      case 'scores':
        // Yesterday's top scores
        return (
          <>
            <div className="flex-shrink-0 flex items-center gap-1 sm:gap-1.5 px-1.5 sm:px-2 py-0.5 bg-blue-500/20 border border-blue-500/30 rounded text-[9px] sm:text-[10px] font-bold uppercase tracking-wider">
              <Trophy className="w-3 h-3 text-blue-400" />
              <span className="text-blue-400 whitespace-nowrap">{tickerData.dayLabel} Scores</span>
            </div>
            <div className="w-px h-4 bg-[#333]" />
            {tickerData.yesterdayScores.slice(0, 8).map((item, idx) => (
              <div key={idx} className="flex items-center gap-1.5 sm:gap-2 flex-shrink-0">
                <span className="text-gray-400 font-medium text-[11px] sm:text-xs whitespace-nowrap">{item.fullName}</span>
                <span className="text-white tabular-nums font-mono text-[11px] sm:text-xs">{item.score}</span>
                {idx < Math.min(tickerData.yesterdayScores.length, 8) - 1 && (
                  <div className="w-px h-3 bg-[#333] ml-0.5 sm:ml-1" />
                )}
              </div>
            ))}
          </>
        );

      case 'leaders':
        // Season leaders with trends
        return (
          <>
            <div className="flex-shrink-0 flex items-center gap-1 sm:gap-1.5 px-1.5 sm:px-2 py-0.5 bg-gold-500/20 border border-gold-500/30 rounded text-[9px] sm:text-[10px] font-bold uppercase tracking-wider">
              <TrendingUp className="w-3 h-3 text-gold-400" />
              <span className="text-gold-400 whitespace-nowrap">Season Leaders</span>
            </div>
            <div className="w-px h-4 bg-[#333]" />
            {tickerData.seasonLeaders.slice(0, 8).map((item, idx) => (
              <div key={idx} className="flex items-center gap-1.5 sm:gap-2 flex-shrink-0">
                <span className="text-gray-500 text-[9px] sm:text-[10px] font-mono">#{idx + 1}</span>
                <span className="text-gray-400 font-medium text-[11px] sm:text-xs whitespace-nowrap">{item.fullName}</span>
                <span className={`tabular-nums font-mono text-[11px] sm:text-xs ${
                  item.trend === 'up' ? 'text-green-400' :
                  item.trend === 'down' ? 'text-red-400' :
                  'text-white'
                }`}>
                  {item.score}
                </span>
                <TrendIndicator trend={item.trend} />
                {idx < Math.min(tickerData.seasonLeaders.length, 8) - 1 && (
                  <div className="w-px h-3 bg-[#333] ml-0.5 sm:ml-1" />
                )}
              </div>
            ))}
          </>
        );

      case 'captions':
        // Caption leaders (GE, Visual, Music)
        return (
          <>
            <div className="flex-shrink-0 flex items-center gap-1 sm:gap-1.5 px-1.5 sm:px-2 py-0.5 bg-purple-500/20 border border-purple-500/30 rounded text-[9px] sm:text-[10px] font-bold uppercase tracking-wider">
              <Sparkles className="w-3 h-3 text-purple-400" />
              <span className="text-purple-400 whitespace-nowrap">Caption Leaders</span>
            </div>
            <div className="w-px h-4 bg-[#333]" />

            {/* GE Leader */}
            {tickerData.captionLeaders.ge && (
              <div className="flex items-center gap-1.5 sm:gap-2 flex-shrink-0">
                <span className="text-amber-400 text-[9px] sm:text-[10px] font-bold">GE</span>
                <span className="text-gray-400 font-medium text-[11px] sm:text-xs whitespace-nowrap">{tickerData.captionLeaders.ge.fullName}</span>
                <span className="text-amber-300 tabular-nums font-mono text-[11px] sm:text-xs">{tickerData.captionLeaders.ge.score}</span>
              </div>
            )}
            <div className="w-px h-3 bg-[#333]" />

            {/* Visual Leader */}
            {tickerData.captionLeaders.visual && (
              <div className="flex items-center gap-1.5 sm:gap-2 flex-shrink-0">
                <span className="text-cyan-400 text-[9px] sm:text-[10px] font-bold">VIS</span>
                <span className="text-gray-400 font-medium text-[11px] sm:text-xs whitespace-nowrap">{tickerData.captionLeaders.visual.fullName}</span>
                <span className="text-cyan-300 tabular-nums font-mono text-[11px] sm:text-xs">{tickerData.captionLeaders.visual.score}</span>
              </div>
            )}
            <div className="w-px h-3 bg-[#333]" />

            {/* Music Leader */}
            {tickerData.captionLeaders.music && (
              <div className="flex items-center gap-1.5 sm:gap-2 flex-shrink-0">
                <span className="text-pink-400 text-[9px] sm:text-[10px] font-bold">MUS</span>
                <span className="text-gray-400 font-medium text-[11px] sm:text-xs whitespace-nowrap">{tickerData.captionLeaders.music.fullName}</span>
                <span className="text-pink-300 tabular-nums font-mono text-[11px] sm:text-xs">{tickerData.captionLeaders.music.score}</span>
              </div>
            )}

            {/* Top 3 from each caption - hidden on mobile for space */}
            <div className="hidden sm:block w-px h-4 bg-[#333]" />
            {captionStats.topGE.slice(0, 3).map((item, idx) => (
              <div key={`ge-${idx}`} className="hidden sm:flex items-center gap-1 flex-shrink-0 text-[10px]">
                <span className="text-gray-600">{idx + 1}.</span>
                <span className="text-gray-500">{item.name}</span>
                <span className="text-amber-400/60 tabular-nums">{item.latestGE.toFixed(1)}</span>
              </div>
            ))}
          </>
        );

      case 'movers':
        // Biggest movers (up/down)
        if (tickerData.biggestMovers.length === 0) {
          return (
            <>
              <div className="flex-shrink-0 flex items-center gap-1 sm:gap-1.5 px-1.5 sm:px-2 py-0.5 bg-green-500/20 border border-green-500/30 rounded text-[9px] sm:text-[10px] font-bold uppercase tracking-wider">
                <TrendingUp className="w-3 h-3 text-green-400" />
                <span className="text-green-400 whitespace-nowrap">Daily Movers</span>
              </div>
              <div className="w-px h-4 bg-[#333]" />
              <span className="text-gray-500 text-[11px] sm:text-xs">No significant moves today</span>
            </>
          );
        }

        return (
          <>
            <div className="flex-shrink-0 flex items-center gap-1 sm:gap-1.5 px-1.5 sm:px-2 py-0.5 bg-green-500/20 border border-green-500/30 rounded text-[9px] sm:text-[10px] font-bold uppercase tracking-wider">
              <TrendingUp className="w-3 h-3 text-green-400" />
              <span className="text-green-400 whitespace-nowrap">Daily Movers</span>
            </div>
            <div className="w-px h-4 bg-[#333]" />
            {tickerData.biggestMovers.map((item, idx) => (
              <div key={idx} className="flex items-center gap-1.5 sm:gap-2 flex-shrink-0">
                <span className="text-gray-400 font-medium text-[11px] sm:text-xs whitespace-nowrap">{item.fullName}</span>
                <span className={`tabular-nums font-mono text-[11px] sm:text-xs ${
                  item.direction === 'up' ? 'text-green-400' : 'text-red-400'
                }`}>
                  {item.direction === 'up' ? '+' : ''}{item.change}
                </span>
                <TrendIndicator trend={item.direction} />
                {idx < tickerData.biggestMovers.length - 1 && (
                  <div className="w-px h-3 bg-[#333] ml-0.5 sm:ml-1" />
                )}
              </div>
            ))}
          </>
        );

      default:
        return null;
    }
  };

  return (
    <div className="fixed top-12 w-full h-9 sm:h-8 bg-black border-b border-[#333] z-40 flex items-center overflow-hidden">
      {/* Navigation arrows - desktop only */}
      <button
        onClick={goToPrev}
        className="hidden md:flex items-center justify-center w-6 h-full bg-[#111] border-r border-[#333] hover:bg-[#222] transition-colors"
        aria-label="Previous section"
      >
        <ChevronLeft className="w-4 h-4 text-gray-500" />
      </button>

      {/* Ticker content */}
      <div
        ref={scrollRef}
        className="flex-1 flex items-center gap-2 sm:gap-3 px-2 sm:px-3 text-xs overflow-x-auto scrollbar-hide"
      >
        {renderSectionContent()}
      </div>

      {/* Navigation arrows - desktop only */}
      <button
        onClick={goToNext}
        className="hidden md:flex items-center justify-center w-6 h-full bg-[#111] border-l border-[#333] hover:bg-[#222] transition-colors"
        aria-label="Next section"
      >
        <ChevronRight className="w-4 h-4 text-gray-500" />
      </button>

      {/* Section indicator dots */}
      <div className="hidden md:flex items-center gap-1 px-2 border-l border-[#333]">
        {TICKER_SECTIONS.map((_, idx) => (
          <button
            key={idx}
            onClick={() => setActiveSection(idx)}
            className={`w-1.5 h-1.5 rounded-full transition-colors ${
              idx === activeSection ? 'bg-blue-500' : 'bg-gray-600 hover:bg-gray-500'
            }`}
            aria-label={`Go to section ${idx + 1}`}
          />
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
      <div className="min-h-screen w-full bg-[#0a0a0a] text-white font-sans">
        {/* Fixed Top Navigation */}
        <TopNav />

        {/* Fixed Ticker Bar */}
        <TickerBar />

        {/* Main Content Area - Fixed position fills space between headers and footer */}
        <main
          id="main-content"
          role="main"
          className="fixed top-[84px] sm:top-20 bottom-20 lg:bottom-4 left-0 right-0 bg-[#0a0a0a] overflow-hidden"
        >
          <div className="h-full w-full overflow-hidden">
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
