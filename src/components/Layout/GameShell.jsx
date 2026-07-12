// =============================================================================
// GAME SHELL - ESPN DATA GRID LAYOUT
// =============================================================================
// Strict data terminal layout: fixed headers, scrollable content
// Laws enforced: No glow, no shadow, tight spacing

import React, { useEffect, useState, useRef, useMemo } from 'react';
import { Link, useLocation, NavLink } from 'react-router-dom';
import { analyticsHelpers, adminHelpers } from '../../api';
import { ShellContext } from './shellContext';
import { useAuth } from '../../context/AuthContext';
import BottomNav from '../BottomNav';
import { useTickerData } from '../../hooks/useTickerData';
import { useReducedMotion } from '../../hooks/useReducedMotion';
import {
  LayoutDashboard,
  Calendar,
  Trophy,
  User,
  TrendingUp,
  TrendingDown,
  Minus,
  Music,
  Eye,
  Sparkles,
  Shield,
  Newspaper,
  HelpCircle,
  MessageCircle,
} from 'lucide-react';

// =============================================================================
// TOP NAV - Clean, minimal header focused on navigation
// =============================================================================

const TopNav = () => {
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

  return (
    <nav className="fixed top-0 w-full h-14 bg-surface-card border-b border-line z-50">
      <div className="w-full h-full flex items-center px-4 lg:px-6">
        {/* Logo + Brand - OPTIMIZATION #7: Added eager loading for LCP */}
        <Link to="/dashboard" className="flex items-center gap-2.5 mr-4">
          <div className="w-8 h-8 rounded-none overflow-hidden">
            <img
              src="/logo192.svg"
              alt="marching.art"
              className="w-full h-full object-cover"
              loading="eager"
              decoding="async"
              fetchPriority="high"
            />
          </div>
          <span className="text-base font-bold text-white tracking-wider">marching.art</span>
        </Link>

        {/* Spacer */}
        <div className="flex-1" />

        {/* Desktop Nav Links - centered feel */}
        <div className="hidden lg:flex items-center gap-1">
          <NavItem to="/" icon={Newspaper} label="News" />
          <NavItem to="/dashboard" icon={LayoutDashboard} label="Dashboard" />
          <NavItem to="/schedule" icon={Calendar} label="Schedule" />
          <NavItem to="/scores" icon={Trophy} label="Scores" />
          <NavItem to="/profile" icon={User} label="Profile" />
          {isAdmin && <NavItem to="/admin" icon={Shield} label="Admin" />}
        </div>

        {/* Discord — kept in the persistent header so the community link is
            reachable from every page (it used to live only on the home header). */}
        <a
          href="https://discord.gg/YvFRJ97A5H"
          target="_blank"
          rel="noopener noreferrer"
          className="ml-2 p-2 text-muted hover:text-[#5865F2] hover:bg-white/10 rounded-none transition-colors"
          title="Join our Discord"
          aria-label="Join our Discord"
        >
          <MessageCircle className="w-5 h-5" />
        </a>

        {/* Help Icon */}
        <Link
          to="/guide"
          className="ml-1 p-2 text-muted hover:text-white hover:bg-white/10 rounded-none transition-colors"
          title="Game Guide"
        >
          <HelpCircle className="w-5 h-5" />
        </Link>
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
        isActive ? 'text-white' : 'text-muted hover:text-white'
      }`
    }
  >
    {({ isActive }) => (
      <>
        <Icon
          className={`w-5 h-5 transition-colors duration-150 ${isActive ? 'text-yellow-400' : ''}`}
        />
        <span>{label}</span>
        {/* Active indicator - bottom bar */}
        {isActive && (
          <span className="absolute bottom-0 left-3 right-3 h-0.5 bg-yellow-400 rounded-none" />
        )}
      </>
    )}
  </NavLink>
);

// =============================================================================
// TICKER BAR - Fixed h-8 (Sub Nav) - Sports Stats Style
// =============================================================================

// Class colors for styling.
// IMPORTANT: these must be complete, static class strings — Tailwind's JIT
// compiler only sees class names that appear verbatim in the source. The old
// interpolated form (`bg-${color}-500/20`) was purged from the build, so the
// Open Class (emerald) chips in particular rendered with no color at all.
const CLASS_STYLES = {
  worldClass: { chip: 'bg-blue-500/20 border-blue-500/30', text: 'text-blue-400' },
  openClass: { chip: 'bg-emerald-500/20 border-emerald-500/30', text: 'text-emerald-400' },
  aClass: { chip: 'bg-orange-500/20 border-orange-500/30', text: 'text-orange-400' },
};
const DEFAULT_CLASS_STYLE = {
  chip: 'bg-purple-500/20 border-purple-500/30',
  text: 'text-purple-400',
};

// Medal colors for SoundSport
const MEDAL_COLORS = {
  Gold: 'text-yellow-400',
  Silver: 'text-secondary',
  Bronze: 'text-amber-600',
};

const TickerBar = () => {
  const { tickerData, loading, hasData } = useTickerData();
  const { prefersReducedMotion } = useReducedMotion();

  // Measure the width of one content copy so the marquee scrolls at a
  // consistent speed regardless of how many items are present.
  const trackRef = useRef(null);
  const [duration, setDuration] = useState(40);

  // Pause the scroll while the user is hovering (desktop) or touching
  // (mobile) so they can read a specific item.
  const [isPaused, setIsPaused] = useState(false);
  const resumeTimer = useRef(null);
  const pauseNow = () => {
    clearTimeout(resumeTimer.current);
    setIsPaused(true);
  };
  const resumeSoon = () => {
    clearTimeout(resumeTimer.current);
    resumeTimer.current = setTimeout(() => setIsPaused(false), 2000);
  };
  useEffect(() => () => clearTimeout(resumeTimer.current), []);

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

  // Scale the marquee duration to the content width for a constant scroll
  // speed (~60px/s), regardless of how many items the season produced.
  // Re-measures when the data or the viewport width changes.
  useEffect(() => {
    if (prefersReducedMotion) return;

    const measure = () => {
      const width = trackRef.current?.scrollWidth || 0;
      if (width > 0) {
        const SPEED = 60; // pixels per second
        setDuration(Math.max(20, width / SPEED));
      }
    };

    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, [tickerSections, prefersReducedMotion]);

  // Trend indicator component
  const TrendIndicator = ({ trend }) => {
    if (trend === 'up') return <TrendingUp className="w-3 h-3 text-green-500" />;
    if (trend === 'down') return <TrendingDown className="w-3 h-3 text-red-500" />;
    return <Minus className="w-3 h-3 text-muted" />;
  };

  // Loading state
  if (loading) {
    return (
      <div className="fixed top-14 w-full h-10 sm:h-8 bg-black border-b border-line z-40 flex items-center overflow-hidden">
        <div className="flex items-center gap-4 px-4 text-xs">
          <span className="text-muted animate-pulse">Loading scores...</span>
        </div>
      </div>
    );
  }

  // No data state
  if (!hasData || tickerSections.length === 0) {
    return (
      <div className="fixed top-14 w-full h-10 sm:h-8 bg-black border-b border-line z-40 flex items-center overflow-hidden">
        <div className="flex items-center gap-4 px-4 text-xs">
          <span className="text-muted">No scores available yet</span>
        </div>
      </div>
    );
  }

  // Render one section (label chip + its items) as an inline segment of the
  // continuous ticker stream.
  const renderSegment = (section) => {
    if (!section) return null;

    const { type, classKey, label } = section;
    const classData = classKey ? tickerData.byClass?.[classKey] : null;
    const colors = (classKey && CLASS_STYLES[classKey]) || DEFAULT_CLASS_STYLE;

    switch (type) {
      case 'scores':
        // Class-specific scores
        return (
          <>
            <div
              className={`flex-shrink-0 flex items-center gap-1.5 px-2 py-0.5 border ${colors.chip} rounded-none text-[11px] sm:text-[10px] font-bold uppercase tracking-wider`}
            >
              <Trophy className={`w-3.5 h-3.5 sm:w-3 sm:h-3 ${colors.text}`} />
              <span className={`${colors.text} whitespace-nowrap`}>
                {label} {tickerData.dayLabel}
              </span>
            </div>
            <div className="w-px h-4 bg-line" />
            {/* OPTIMIZATION #10: Use stable key based on item identity */}
            {classData?.scores?.slice(0, 8).map((item, idx) => (
              <div
                key={`${item.fullName}-${item.score}`}
                className="flex items-center gap-2 flex-shrink-0"
              >
                <span className="text-muted font-medium text-xs whitespace-nowrap">
                  {item.fullName}
                </span>
                <span className="text-white tabular-nums font-mono text-xs">{item.score}</span>
                {idx < Math.min(classData.scores.length, 8) - 1 && (
                  <div className="w-px h-3 bg-line ml-1" />
                )}
              </div>
            ))}
          </>
        );

      case 'soundsport':
        // SoundSport medals
        return (
          <>
            <div className="flex-shrink-0 flex items-center gap-1.5 px-2 py-0.5 bg-purple-500/20 border border-purple-500/30 rounded-none text-[11px] sm:text-[10px] font-bold uppercase tracking-wider">
              <Trophy className="w-3.5 h-3.5 sm:w-3 sm:h-3 text-purple-400" />
              <span className="text-purple-400 whitespace-nowrap">SoundSport Medals</span>
            </div>
            <div className="w-px h-4 bg-line" />
            {tickerData.soundSportMedals?.map((item, idx) => (
              <div
                key={`${item.medal}-${item.fullName}`}
                className="flex items-center gap-2 flex-shrink-0"
              >
                <span
                  className={`text-[11px] sm:text-[10px] font-bold ${MEDAL_COLORS[item.medal] || 'text-muted'}`}
                >
                  {item.medal}
                </span>
                <span className="text-muted font-medium text-xs whitespace-nowrap">
                  {item.fullName}
                </span>
                {idx < tickerData.soundSportMedals.length - 1 && (
                  <div className="w-px h-3 bg-line ml-1" />
                )}
              </div>
            ))}
          </>
        );

      case 'leaders':
        // Class-specific season leaders with trends
        return (
          <>
            <div
              className={`flex-shrink-0 flex items-center gap-1.5 px-2 py-0.5 border ${colors.chip} rounded-none text-[11px] sm:text-[10px] font-bold uppercase tracking-wider`}
            >
              <TrendingUp className={`w-3.5 h-3.5 sm:w-3 sm:h-3 ${colors.text}`} />
              <span className={`${colors.text} whitespace-nowrap`}>{label} Leaders</span>
            </div>
            <div className="w-px h-4 bg-line" />
            {classData?.leaders?.slice(0, 8).map((item, idx) => (
              <div
                key={`${item.fullName}-${item.score}`}
                className="flex items-center gap-2 flex-shrink-0"
              >
                <span className="text-muted text-[11px] sm:text-[10px] font-mono">#{idx + 1}</span>
                <span className="text-muted font-medium text-xs whitespace-nowrap">
                  {item.fullName}
                </span>
                <span
                  className={`tabular-nums font-mono text-xs ${
                    item.trend === 'up'
                      ? 'text-green-400'
                      : item.trend === 'down'
                        ? 'text-red-400'
                        : 'text-white'
                  }`}
                >
                  {item.score}
                </span>
                <TrendIndicator trend={item.trend} />
                {idx < Math.min(classData.leaders.length, 8) - 1 && (
                  <div className="w-px h-3 bg-line ml-1" />
                )}
              </div>
            ))}
          </>
        );

      case 'captions_ge':
        // GE Caption Leaders (combined across all classes)
        return (
          <>
            <div className="flex-shrink-0 flex items-center gap-1.5 px-2 py-0.5 bg-amber-500/20 border border-amber-500/30 rounded-none text-[11px] sm:text-[10px] font-bold uppercase tracking-wider">
              <Sparkles className="w-3.5 h-3.5 sm:w-3 sm:h-3 text-amber-400" />
              <span className="text-amber-400 whitespace-nowrap">GE Leaders</span>
            </div>
            <div className="w-px h-4 bg-line" />
            {tickerData.combinedCaptionLeaders?.ge?.map((item, idx) => (
              <div
                key={`ge-${item.fullName}-${item.score}`}
                className="flex items-center gap-2 flex-shrink-0"
              >
                <span className="text-muted text-[11px] sm:text-[10px] font-mono">#{idx + 1}</span>
                <span className="text-muted font-medium text-xs whitespace-nowrap">
                  {item.fullName}
                </span>
                <span className="text-amber-300 tabular-nums font-mono text-xs">{item.score}</span>
                {idx < tickerData.combinedCaptionLeaders.ge.length - 1 && (
                  <div className="w-px h-3 bg-line ml-1" />
                )}
              </div>
            ))}
          </>
        );

      case 'captions_vis':
        // Visual Caption Leaders (combined across all classes)
        return (
          <>
            <div className="flex-shrink-0 flex items-center gap-1.5 px-2 py-0.5 bg-cyan-500/20 border border-cyan-500/30 rounded-none text-[11px] sm:text-[10px] font-bold uppercase tracking-wider">
              <Eye className="w-3.5 h-3.5 sm:w-3 sm:h-3 text-cyan-400" />
              <span className="text-cyan-400 whitespace-nowrap">Visual Leaders</span>
            </div>
            <div className="w-px h-4 bg-line" />
            {tickerData.combinedCaptionLeaders?.visual?.map((item, idx) => (
              <div
                key={`vis-${item.fullName}-${item.score}`}
                className="flex items-center gap-2 flex-shrink-0"
              >
                <span className="text-muted text-[11px] sm:text-[10px] font-mono">#{idx + 1}</span>
                <span className="text-muted font-medium text-xs whitespace-nowrap">
                  {item.fullName}
                </span>
                <span className="text-cyan-300 tabular-nums font-mono text-xs">{item.score}</span>
                {idx < tickerData.combinedCaptionLeaders.visual.length - 1 && (
                  <div className="w-px h-3 bg-line ml-1" />
                )}
              </div>
            ))}
          </>
        );

      case 'captions_mus':
        // Music Caption Leaders (combined across all classes)
        return (
          <>
            <div className="flex-shrink-0 flex items-center gap-1.5 px-2 py-0.5 bg-pink-500/20 border border-pink-500/30 rounded-none text-[11px] sm:text-[10px] font-bold uppercase tracking-wider">
              <Music className="w-3.5 h-3.5 sm:w-3 sm:h-3 text-pink-400" />
              <span className="text-pink-400 whitespace-nowrap">Music Leaders</span>
            </div>
            <div className="w-px h-4 bg-line" />
            {tickerData.combinedCaptionLeaders?.music?.map((item, idx) => (
              <div
                key={`mus-${item.fullName}-${item.score}`}
                className="flex items-center gap-2 flex-shrink-0"
              >
                <span className="text-muted text-[11px] sm:text-[10px] font-mono">#{idx + 1}</span>
                <span className="text-muted font-medium text-xs whitespace-nowrap">
                  {item.fullName}
                </span>
                <span className="text-pink-300 tabular-nums font-mono text-xs">{item.score}</span>
                {idx < tickerData.combinedCaptionLeaders.music.length - 1 && (
                  <div className="w-px h-3 bg-line ml-1" />
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
              <div
                className={`flex-shrink-0 flex items-center gap-1.5 px-2 py-0.5 border ${colors.chip} rounded-none text-[11px] sm:text-[10px] font-bold uppercase tracking-wider`}
              >
                <TrendingUp className={`w-3.5 h-3.5 sm:w-3 sm:h-3 ${colors.text}`} />
                <span className={`${colors.text} whitespace-nowrap`}>{label} Movers</span>
              </div>
              <div className="w-px h-4 bg-line" />
              <span className="text-muted text-xs">No significant moves today</span>
            </>
          );
        }

        return (
          <>
            <div
              className={`flex-shrink-0 flex items-center gap-1.5 px-2 py-0.5 border ${colors.chip} rounded-none text-[11px] sm:text-[10px] font-bold uppercase tracking-wider`}
            >
              <TrendingUp className={`w-3.5 h-3.5 sm:w-3 sm:h-3 ${colors.text}`} />
              <span className={`${colors.text} whitespace-nowrap`}>{label} Movers</span>
            </div>
            <div className="w-px h-4 bg-line" />
            {classData.movers.map((item, idx) => (
              <div
                key={`mover-${item.fullName}-${item.change}`}
                className="flex items-center gap-2 flex-shrink-0"
              >
                <span className="text-muted font-medium text-xs whitespace-nowrap">
                  {item.fullName}
                </span>
                <span
                  className={`tabular-nums font-mono text-xs ${
                    item.direction === 'up' ? 'text-green-400' : 'text-red-400'
                  }`}
                >
                  {item.direction === 'up' ? '+' : ''}
                  {item.change}
                </span>
                <TrendIndicator trend={item.direction} />
                {idx < classData.movers.length - 1 && <div className="w-px h-3 bg-line ml-1" />}
              </div>
            ))}
          </>
        );

      default:
        return null;
    }
  };

  // Render one full pass of every section as a single inline row. Two of
  // these sit side by side inside the marquee track so the loop is seamless.
  const renderTrack = (copyKey) => (
    <div
      ref={copyKey === 'a' ? trackRef : undefined}
      className="flex items-center gap-4 sm:gap-6 pr-4 sm:pr-6 shrink-0"
      // The second copy is purely decorative duplication for the loop.
      aria-hidden={copyKey === 'b' ? true : undefined}
    >
      {tickerSections.map((section, idx) => (
        <div key={`${copyKey}-${idx}`} className="flex items-center gap-2 sm:gap-3 shrink-0">
          {renderSegment(section)}
        </div>
      ))}
    </div>
  );

  // Reduced-motion users get a manually scrollable row instead of an
  // auto-scrolling marquee (the OS media query also freezes CSS animations).
  if (prefersReducedMotion) {
    return (
      <div className="fixed top-14 w-full h-10 sm:h-8 bg-black border-b border-line z-40 flex items-center overflow-hidden">
        <div className="relative flex-1 min-w-0 h-full flex items-center">
          <div className="flex-1 flex items-center gap-4 sm:gap-6 px-3 text-xs overflow-x-auto scrollbar-hide">
            {renderTrack('a')}
          </div>
          <div
            className="absolute top-0 right-0 bottom-0 w-6 pointer-events-none bg-gradient-to-l from-black to-transparent"
            aria-hidden="true"
          />
        </div>
      </div>
    );
  }

  return (
    <div className="fixed top-14 w-full h-10 sm:h-8 bg-black border-b border-line z-40 flex items-center overflow-hidden">
      <div className="relative flex-1 min-w-0 h-full flex items-center overflow-hidden">
        {/* Continuous marquee: two identical copies scroll left together,
            looping seamlessly. Duration scales with content width. */}
        <div
          className="flex items-center text-xs animate-marquee shrink-0 will-change-transform"
          style={{
            animationDuration: `${duration}s`,
            animationPlayState: isPaused ? 'paused' : 'running',
          }}
          onMouseEnter={pauseNow}
          onMouseLeave={resumeSoon}
          onTouchStart={pauseNow}
          onTouchEnd={resumeSoon}
        >
          {renderTrack('a')}
          {renderTrack('b')}
        </div>

        {/* Edge fades hint that the row continues beyond the viewport. */}
        <div
          className="absolute top-0 left-0 bottom-0 w-6 pointer-events-none bg-gradient-to-r from-black to-transparent"
          aria-hidden="true"
        />
        <div
          className="absolute top-0 right-0 bottom-0 w-6 pointer-events-none bg-gradient-to-l from-black to-transparent"
          aria-hidden="true"
        />
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
    // 56px top nav + ticker: 32px (h-8) on sm+, 40px (h-10) on mobile.
    // Currently unconsumed — if you use it, prefer the responsive values.
    headerHeight: 88,
    headerHeightMobile: 96,
  };

  return (
    <ShellContext.Provider value={shellContextValue}>
      <div className="min-h-screen w-full bg-background text-white font-sans">
        {/* Fixed Top Navigation */}
        <TopNav />

        {/* Fixed Ticker Bar */}
        <TickerBar />

        {/* Main Content Area - Fixed position fills space between headers and footer */}
        {/* On mobile: top-nav (56px) + ticker (40px) = 96px */}
        {/* On desktop: top-nav (56px) + ticker (32px) = 88px */}
        <main
          id="main-content"
          role="main"
          className="fixed top-[96px] sm:top-[88px] left-0 right-0 bg-background overflow-hidden main-content-bottom"
        >
          {/* Full-width wrapper so each page's own scroll container spans the
              viewport — this keeps scrollbars flush against the right edge of
              the screen instead of inset from a centered max-width column. */}
          <div className="w-full h-full">{children}</div>
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
