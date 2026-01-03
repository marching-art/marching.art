// =============================================================================
// GAME SHELL - ESPN DATA GRID LAYOUT
// =============================================================================
// Strict data terminal layout: fixed headers, scrollable content
// Laws enforced: No glow, no shadow, tight spacing

import React, { useEffect, useState, createContext, useContext, useRef, useMemo } from 'react';
import { Link, useLocation, NavLink } from 'react-router-dom';
import { analyticsHelpers, adminHelpers } from '../../firebase';
import { useAuth } from '../../App';
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
  TrendingUp,
  TrendingDown,
  Minus,
  Music,
  Eye,
  Sparkles,
  Shield,
  Newspaper
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
// TOP NAV - Clean, minimal header focused on navigation
// =============================================================================

const TopNav = () => {
  const seasonData = useSeasonStore((state) => state.seasonData);
  const { user } = useAuth();
  const [isAdmin, setIsAdmin] = useState(false);

  // Check if user is admin
  useEffect(() => {
    if (user) {
      adminHelpers.isAdmin().then(setIsAdmin);
    } else {
      setIsAdmin(false);
    }
  }, [user]);

  // Format the season name for display - compact version
  const getSeasonLabel = () => {
    if (!seasonData?.name) return null;
    const name = seasonData.name;
    if (name.startsWith('live_')) {
      const yearPart = name.replace('live_', '').split('-')[0];
      return yearPart;
    }
    return formatSeasonName(name).replace(' Season', '');
  };

  const seasonLabel = getSeasonLabel();

  return (
    <nav className="fixed top-0 w-full h-12 bg-[#1a1a1a] border-b border-[#333] z-50 flex items-center px-2 sm:px-4">
      {/* Logo + Brand */}
      <Link to="/dashboard" className="flex items-center gap-2 mr-4">
        <img
          src="/logo192.svg"
          alt="marching.art"
          className="w-7 h-7 rounded"
        />
        <div className="flex flex-col">
          <span className="hidden sm:block font-bold text-sm text-white leading-tight">MARCHING.ART</span>
          {/* Season badge - subtle, integrated */}
          {seasonLabel && (
            <span className="hidden sm:block text-[9px] text-gray-500 uppercase tracking-wider leading-tight">
              {seasonLabel}
            </span>
          )}
        </div>
      </Link>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Desktop Nav Links - centered feel */}
      <div className="hidden lg:flex items-center gap-1">
        <NavItem to="/" icon={Newspaper} label="News" />
        <NavItem to="/dashboard" icon={LayoutDashboard} label="Dashboard" />
        <NavItem to="/schedule" icon={Calendar} label="Schedule" />
        <NavItem to="/scores" icon={Trophy} label="Scores" />
        <NavItem to="/leagues" icon={Users} label="Leagues" />
        <NavItem to="/profile" icon={User} label="Profile" />
        {isAdmin && <NavItem to="/admin" icon={Shield} label="Admin" />}
      </div>
    </nav>
  );
};

// Nav Item Component - with touch target sizing
const NavItem = ({ to, icon: Icon, label }) => (
  <NavLink
    to={to}
    className={({ isActive }) =>
      `relative flex items-center gap-2 px-3 py-2.5 min-h-touch text-sm font-medium transition-all duration-150 press-feedback ${
        isActive
          ? 'text-white'
          : 'text-gray-400 hover:text-white'
      }`
    }
  >
    {({ isActive }) => (
      <>
        <Icon className={`w-5 h-5 transition-colors duration-150 ${isActive ? 'text-yellow-400' : ''}`} />
        <span>{label}</span>
        {/* Active indicator - bottom bar */}
        {isActive && (
          <span className="absolute bottom-0 left-3 right-3 h-0.5 bg-yellow-400 rounded-full" />
        )}
      </>
    )}
  </NavLink>
);

// =============================================================================
// TICKER BAR - Fixed h-8 (Sub Nav) - Sports Stats Style
// =============================================================================

// Class colors for styling
const CLASS_COLORS = {
  worldClass: { bg: 'blue', text: 'blue' },
  openClass: { bg: 'emerald', text: 'emerald' },
  aClass: { bg: 'orange', text: 'orange' },
};

// Medal colors for SoundSport
const MEDAL_COLORS = {
  Gold: 'text-yellow-400',
  Silver: 'text-gray-300',
  Bronze: 'text-amber-600',
};

const TickerBar = () => {
  const { tickerData, captionStats, loading, hasData } = useTickerData();
  const [activeSection, setActiveSection] = useState(0);
  const scrollRef = useRef(null);

  // Build dynamic sections based on available data
  const tickerSections = useMemo(() => {
    const sections = [];

    // Add sections for each class that has data
    for (const classKey of tickerData.availableClasses || []) {
      const classData = tickerData.byClass?.[classKey];
      if (classData?.scores?.length > 0) {
        sections.push({ type: 'scores', classKey, label: classData.label });
      }
    }

    // Add SoundSport medals if any
    if (tickerData.soundSportMedals?.length > 0) {
      sections.push({ type: 'soundsport', classKey: null, label: 'SoundSport' });
    }

    // Add leaders for each class
    for (const classKey of tickerData.availableClasses || []) {
      const classData = tickerData.byClass?.[classKey];
      if (classData?.leaders?.length > 0) {
        sections.push({ type: 'leaders', classKey, label: classData.label });
      }
    }

    // Add combined caption leaders by type (GE, VIS, MUS)
    if (tickerData.combinedCaptionLeaders?.ge?.length > 0) {
      sections.push({ type: 'captions_ge', classKey: null, label: 'GE' });
    }
    if (tickerData.combinedCaptionLeaders?.visual?.length > 0) {
      sections.push({ type: 'captions_vis', classKey: null, label: 'Visual' });
    }
    if (tickerData.combinedCaptionLeaders?.music?.length > 0) {
      sections.push({ type: 'captions_mus', classKey: null, label: 'Music' });
    }

    // Add movers for each class
    for (const classKey of tickerData.availableClasses || []) {
      const classData = tickerData.byClass?.[classKey];
      if (classData?.movers?.length > 0) {
        sections.push({ type: 'movers', classKey, label: classData.label });
      }
    }

    return sections;
  }, [tickerData]);

  // Auto-cycle through sections every 8 seconds
  useEffect(() => {
    if (!hasData || tickerSections.length === 0) return;

    const interval = setInterval(() => {
      setActiveSection(prev => (prev + 1) % tickerSections.length);
    }, 8000);

    return () => clearInterval(interval);
  }, [hasData, tickerSections.length]);

  // Reset activeSection if it's out of bounds
  useEffect(() => {
    if (activeSection >= tickerSections.length && tickerSections.length > 0) {
      setActiveSection(0);
    }
  }, [activeSection, tickerSections.length]);

  // Trend indicator component
  const TrendIndicator = ({ trend }) => {
    if (trend === 'up') return <TrendingUp className="w-3 h-3 text-green-500" />;
    if (trend === 'down') return <TrendingDown className="w-3 h-3 text-red-500" />;
    return <Minus className="w-3 h-3 text-gray-500" />;
  };

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
  if (!hasData || tickerSections.length === 0) {
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
    const section = tickerSections[activeSection];
    if (!section) return null;

    const { type, classKey, label } = section;
    const classData = classKey ? tickerData.byClass?.[classKey] : null;
    const colors = classKey ? CLASS_COLORS[classKey] : { bg: 'purple', text: 'purple' };

    switch (type) {
      case 'scores':
        // Class-specific scores
        return (
          <>
            <div className={`flex-shrink-0 flex items-center gap-1 sm:gap-1.5 px-1.5 sm:px-2 py-0.5 bg-${colors.bg}-500/20 border border-${colors.bg}-500/30 rounded text-[9px] sm:text-[10px] font-bold uppercase tracking-wider`}>
              <Trophy className={`w-3 h-3 text-${colors.text}-400`} />
              <span className={`text-${colors.text}-400 whitespace-nowrap`}>{label} {tickerData.dayLabel}</span>
            </div>
            <div className="w-px h-4 bg-[#333]" />
            {classData?.scores?.slice(0, 8).map((item, idx) => (
              <div key={idx} className="flex items-center gap-1.5 sm:gap-2 flex-shrink-0">
                <span className="text-gray-400 font-medium text-[11px] sm:text-xs whitespace-nowrap">{item.fullName}</span>
                <span className="text-white tabular-nums font-mono text-[11px] sm:text-xs">{item.score}</span>
                {idx < Math.min(classData.scores.length, 8) - 1 && (
                  <div className="w-px h-3 bg-[#333] ml-0.5 sm:ml-1" />
                )}
              </div>
            ))}
          </>
        );

      case 'soundsport':
        // SoundSport medals
        return (
          <>
            <div className="flex-shrink-0 flex items-center gap-1 sm:gap-1.5 px-1.5 sm:px-2 py-0.5 bg-purple-500/20 border border-purple-500/30 rounded text-[9px] sm:text-[10px] font-bold uppercase tracking-wider">
              <Trophy className="w-3 h-3 text-purple-400" />
              <span className="text-purple-400 whitespace-nowrap">SoundSport Medals</span>
            </div>
            <div className="w-px h-4 bg-[#333]" />
            {tickerData.soundSportMedals?.map((item, idx) => (
              <div key={idx} className="flex items-center gap-1.5 sm:gap-2 flex-shrink-0">
                <span className={`text-[9px] sm:text-[10px] font-bold ${MEDAL_COLORS[item.medal] || 'text-gray-400'}`}>
                  {item.medal}
                </span>
                <span className="text-gray-400 font-medium text-[11px] sm:text-xs whitespace-nowrap">{item.fullName}</span>
                {idx < tickerData.soundSportMedals.length - 1 && (
                  <div className="w-px h-3 bg-[#333] ml-0.5 sm:ml-1" />
                )}
              </div>
            ))}
          </>
        );

      case 'leaders':
        // Class-specific season leaders with trends
        return (
          <>
            <div className={`flex-shrink-0 flex items-center gap-1 sm:gap-1.5 px-1.5 sm:px-2 py-0.5 bg-${colors.bg}-500/20 border border-${colors.bg}-500/30 rounded text-[9px] sm:text-[10px] font-bold uppercase tracking-wider`}>
              <TrendingUp className={`w-3 h-3 text-${colors.text}-400`} />
              <span className={`text-${colors.text}-400 whitespace-nowrap`}>{label} Leaders</span>
            </div>
            <div className="w-px h-4 bg-[#333]" />
            {classData?.leaders?.slice(0, 8).map((item, idx) => (
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
                {idx < Math.min(classData.leaders.length, 8) - 1 && (
                  <div className="w-px h-3 bg-[#333] ml-0.5 sm:ml-1" />
                )}
              </div>
            ))}
          </>
        );

      case 'captions_ge':
        // GE Caption Leaders (combined across all classes)
        return (
          <>
            <div className="flex-shrink-0 flex items-center gap-1 sm:gap-1.5 px-1.5 sm:px-2 py-0.5 bg-amber-500/20 border border-amber-500/30 rounded text-[9px] sm:text-[10px] font-bold uppercase tracking-wider">
              <Sparkles className="w-3 h-3 text-amber-400" />
              <span className="text-amber-400 whitespace-nowrap">GE Caption Leaders</span>
            </div>
            <div className="w-px h-4 bg-[#333]" />
            {tickerData.combinedCaptionLeaders?.ge?.map((item, idx) => (
              <div key={idx} className="flex items-center gap-1.5 sm:gap-2 flex-shrink-0">
                <span className="text-gray-500 text-[9px] sm:text-[10px] font-mono">#{idx + 1}</span>
                <span className="text-gray-400 font-medium text-[11px] sm:text-xs whitespace-nowrap">{item.fullName}</span>
                <span className="text-amber-300 tabular-nums font-mono text-[11px] sm:text-xs">{item.score}</span>
                {idx < tickerData.combinedCaptionLeaders.ge.length - 1 && (
                  <div className="w-px h-3 bg-[#333] ml-0.5 sm:ml-1" />
                )}
              </div>
            ))}
          </>
        );

      case 'captions_vis':
        // Visual Caption Leaders (combined across all classes)
        return (
          <>
            <div className="flex-shrink-0 flex items-center gap-1 sm:gap-1.5 px-1.5 sm:px-2 py-0.5 bg-cyan-500/20 border border-cyan-500/30 rounded text-[9px] sm:text-[10px] font-bold uppercase tracking-wider">
              <Eye className="w-3 h-3 text-cyan-400" />
              <span className="text-cyan-400 whitespace-nowrap">Visual Caption Leaders</span>
            </div>
            <div className="w-px h-4 bg-[#333]" />
            {tickerData.combinedCaptionLeaders?.visual?.map((item, idx) => (
              <div key={idx} className="flex items-center gap-1.5 sm:gap-2 flex-shrink-0">
                <span className="text-gray-500 text-[9px] sm:text-[10px] font-mono">#{idx + 1}</span>
                <span className="text-gray-400 font-medium text-[11px] sm:text-xs whitespace-nowrap">{item.fullName}</span>
                <span className="text-cyan-300 tabular-nums font-mono text-[11px] sm:text-xs">{item.score}</span>
                {idx < tickerData.combinedCaptionLeaders.visual.length - 1 && (
                  <div className="w-px h-3 bg-[#333] ml-0.5 sm:ml-1" />
                )}
              </div>
            ))}
          </>
        );

      case 'captions_mus':
        // Music Caption Leaders (combined across all classes)
        return (
          <>
            <div className="flex-shrink-0 flex items-center gap-1 sm:gap-1.5 px-1.5 sm:px-2 py-0.5 bg-pink-500/20 border border-pink-500/30 rounded text-[9px] sm:text-[10px] font-bold uppercase tracking-wider">
              <Music className="w-3 h-3 text-pink-400" />
              <span className="text-pink-400 whitespace-nowrap">Music Caption Leaders</span>
            </div>
            <div className="w-px h-4 bg-[#333]" />
            {tickerData.combinedCaptionLeaders?.music?.map((item, idx) => (
              <div key={idx} className="flex items-center gap-1.5 sm:gap-2 flex-shrink-0">
                <span className="text-gray-500 text-[9px] sm:text-[10px] font-mono">#{idx + 1}</span>
                <span className="text-gray-400 font-medium text-[11px] sm:text-xs whitespace-nowrap">{item.fullName}</span>
                <span className="text-pink-300 tabular-nums font-mono text-[11px] sm:text-xs">{item.score}</span>
                {idx < tickerData.combinedCaptionLeaders.music.length - 1 && (
                  <div className="w-px h-3 bg-[#333] ml-0.5 sm:ml-1" />
                )}
              </div>
            ))}
          </>
        );

      case 'movers':
        // Class-specific biggest movers (up/down)
        if (!classData?.movers?.length) {
          return (
            <>
              <div className={`flex-shrink-0 flex items-center gap-1 sm:gap-1.5 px-1.5 sm:px-2 py-0.5 bg-${colors.bg}-500/20 border border-${colors.bg}-500/30 rounded text-[9px] sm:text-[10px] font-bold uppercase tracking-wider`}>
                <TrendingUp className={`w-3 h-3 text-${colors.text}-400`} />
                <span className={`text-${colors.text}-400 whitespace-nowrap`}>{label} Movers</span>
              </div>
              <div className="w-px h-4 bg-[#333]" />
              <span className="text-gray-500 text-[11px] sm:text-xs">No significant moves today</span>
            </>
          );
        }

        return (
          <>
            <div className={`flex-shrink-0 flex items-center gap-1 sm:gap-1.5 px-1.5 sm:px-2 py-0.5 bg-${colors.bg}-500/20 border border-${colors.bg}-500/30 rounded text-[9px] sm:text-[10px] font-bold uppercase tracking-wider`}>
              <TrendingUp className={`w-3 h-3 text-${colors.text}-400`} />
              <span className={`text-${colors.text}-400 whitespace-nowrap`}>{label} Movers</span>
            </div>
            <div className="w-px h-4 bg-[#333]" />
            {classData.movers.map((item, idx) => (
              <div key={idx} className="flex items-center gap-1.5 sm:gap-2 flex-shrink-0">
                <span className="text-gray-400 font-medium text-[11px] sm:text-xs whitespace-nowrap">{item.fullName}</span>
                <span className={`tabular-nums font-mono text-[11px] sm:text-xs ${
                  item.direction === 'up' ? 'text-green-400' : 'text-red-400'
                }`}>
                  {item.direction === 'up' ? '+' : ''}{item.change}
                </span>
                <TrendIndicator trend={item.direction} />
                {idx < classData.movers.length - 1 && (
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
      {/* Ticker content */}
      <div
        ref={scrollRef}
        className="flex-1 flex items-center gap-2 sm:gap-3 px-2 sm:px-3 text-xs overflow-x-auto scrollbar-hide"
      >
        {renderSectionContent()}
      </div>
    </div>
  );
};

// =============================================================================
// GAME SHELL COMPONENT
// =============================================================================

const GameShell = ({ children }) => {
  const location = useLocation();

  // Enable fixed one-screen layout for GameShell pages
  useEffect(() => {
    document.documentElement.classList.add('game-shell-active');
    return () => {
      document.documentElement.classList.remove('game-shell-active');
    };
  }, []);

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
        {/* On mobile, bottom accounts for nav height + safe-area-inset-bottom via CSS class */}
        <main
          id="main-content"
          role="main"
          className="fixed top-[84px] sm:top-20 left-0 right-0 bg-[#0a0a0a] scroll-momentum main-content-bottom"
        >
          <div className="h-full w-full overflow-y-auto scroll-contain">
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
