// =============================================================================
// GLOBAL TICKER COMPONENT (Header Zone)
// =============================================================================
// Persistent header bar displaying "Game Loop" metrics:
// - Season Clock (Season X, Week Y: Event Name)
// - Resource Tickers (Funds, Influence Points, Staff Stamina)
// - Alerts (System messages)
//
// This component NEVER scrolls. It's fixed at 56px height.

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  DollarSign,
  Star,
  Zap,
  Calendar,
  Bell,
  AlertTriangle,
  ChevronRight,
  TrendingUp,
  TrendingDown,
} from 'lucide-react';
import { useUserStore } from '../../store/userStore';
import { useSeasonStore } from '../../store/seasonStore';

// =============================================================================
// RESOURCE TICKER ITEM
// =============================================================================

const ResourceTicker = ({ icon: Icon, label, value, trend, color = 'gold' }) => {
  const colorClasses = {
    gold: 'text-gold-400',
    green: 'text-green-400',
    blue: 'text-blue-400',
    red: 'text-red-400',
    purple: 'text-purple-400',
  };

  const TrendIcon = trend > 0 ? TrendingUp : trend < 0 ? TrendingDown : null;

  return (
    <div className="flex items-center gap-2 px-3 py-1.5 bg-white/5 rounded-lg">
      <Icon className={`w-3.5 h-3.5 ${colorClasses[color]} opacity-70`} />
      <div className="flex flex-col">
        <span className="text-[9px] uppercase tracking-wider text-cream/40 leading-none">
          {label}
        </span>
        <div className="flex items-center gap-1">
          <span className={`text-sm font-mono font-bold ${colorClasses[color]} tabular-nums`}>
            {value}
          </span>
          {TrendIcon && (
            <TrendIcon
              className={`w-2.5 h-2.5 ${trend > 0 ? 'text-green-400' : 'text-red-400'}`}
            />
          )}
        </div>
      </div>
    </div>
  );
};

// =============================================================================
// SEASON CLOCK
// =============================================================================

const SeasonClock = ({ season, week, eventName }) => {
  return (
    <div className="flex items-center gap-2">
      <Calendar className="w-4 h-4 text-gold-400" />
      <div className="flex items-center gap-1.5">
        <span className="text-xs font-display font-bold uppercase text-cream/80">
          Season {season}
        </span>
        <span className="text-cream/30">•</span>
        <span className="text-xs font-mono text-gold-400">
          Week {week}
        </span>
        {eventName && (
          <>
            <ChevronRight className="w-3 h-3 text-cream/30" />
            <span className="text-xs text-cream/60 truncate max-w-[200px]">
              {eventName}
            </span>
          </>
        )}
      </div>
    </div>
  );
};

// =============================================================================
// ALERT BADGE
// =============================================================================

const AlertBadge = ({ alerts = [] }) => {
  const [currentAlertIndex, setCurrentAlertIndex] = useState(0);

  useEffect(() => {
    if (alerts.length > 1) {
      const interval = setInterval(() => {
        setCurrentAlertIndex((prev) => (prev + 1) % alerts.length);
      }, 5000);
      return () => clearInterval(interval);
    }
  }, [alerts.length]);

  if (alerts.length === 0) return null;

  const currentAlert = alerts[currentAlertIndex];

  return (
    <motion.div
      className="flex items-center gap-2 px-3 py-1.5 bg-red-500/10 border border-red-500/30 rounded-lg"
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
    >
      <AlertTriangle className="w-3.5 h-3.5 text-red-400 animate-pulse" />
      <AnimatePresence mode="wait">
        <motion.span
          key={currentAlertIndex}
          className="text-xs text-red-300 truncate max-w-[200px]"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
        >
          {currentAlert}
        </motion.span>
      </AnimatePresence>
      {alerts.length > 1 && (
        <span className="text-[10px] text-red-400/60 font-mono">
          {currentAlertIndex + 1}/{alerts.length}
        </span>
      )}
    </motion.div>
  );
};

// =============================================================================
// NOTIFICATION BELL
// =============================================================================

const NotificationBell = ({ count = 0 }) => {
  return (
    <button className="relative p-2 rounded-lg hover:bg-white/5 transition-colors">
      <Bell className="w-4 h-4 text-cream/60" />
      {count > 0 && (
        <span className="absolute -top-0.5 -right-0.5 w-4 h-4 flex items-center justify-center bg-red-500 text-white text-[10px] font-bold rounded-full">
          {count > 9 ? '9+' : count}
        </span>
      )}
    </button>
  );
};

// =============================================================================
// GLOBAL TICKER COMPONENT
// =============================================================================

const GlobalTicker = ({ className = '' }) => {
  // Get data from stores
  const user = useUserStore((state) => state.user);
  const season = useSeasonStore((state) => state.season);

  // Extract user resources (with fallbacks)
  const funds = user?.currency ?? 0;
  const xp = user?.xp ?? 0;
  const stamina = 100; // Placeholder - would come from game state

  // Extract season info
  const seasonNumber = season?.seasonNumber ?? 1;
  const currentWeek = season?.currentWeek ?? 1;
  const currentEvent = season?.currentEventName ?? '';

  // Mock alerts (would come from game state)
  const alerts = [];

  return (
    <header
      className={`
        flex items-center justify-between
        h-14 px-4
        bg-black/40 backdrop-blur-xl
        border-b border-white/5
        ${className}
      `}
      style={{ gridArea: 'header' }}
    >
      {/* Left: Season Clock */}
      <div className="flex items-center gap-4">
        <SeasonClock
          season={seasonNumber}
          week={currentWeek}
          eventName={currentEvent}
        />
      </div>

      {/* Center: Resource Tickers */}
      <div className="hidden md:flex items-center gap-2">
        <ResourceTicker
          icon={DollarSign}
          label="Funds"
          value={`$${funds.toLocaleString()}`}
          color="gold"
        />
        <ResourceTicker
          icon={Star}
          label="XP"
          value={xp.toLocaleString()}
          color="purple"
        />
        <ResourceTicker
          icon={Zap}
          label="Stamina"
          value={`${stamina}%`}
          color="green"
        />
      </div>

      {/* Right: Alerts & Notifications */}
      <div className="flex items-center gap-3">
        <AlertBadge alerts={alerts} />
        <NotificationBell count={0} />
      </div>
    </header>
  );
};

export default GlobalTicker;
