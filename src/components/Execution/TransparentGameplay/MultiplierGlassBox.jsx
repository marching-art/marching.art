// src/components/Execution/TransparentGameplay/MultiplierGlassBox.jsx
// "Glass Box" Multiplier Badge - Shows compact badge with full math breakdown on interaction
// Desktop: Popover | Mobile: Bottom-sheet drawer

import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Target, Heart, Wrench, Users, Zap, AlertTriangle, Sparkles,
  TrendingUp, TrendingDown, Minus, Info, X, ChevronUp, Bus,
  Clock, Trophy, Flame
} from 'lucide-react';

// ============================================================================
// EXECUTION MULTIPLIER FACTORS (from backend executionMultiplier.js)
// ============================================================================
const FACTOR_CONFIG = {
  readiness: {
    label: 'Section Readiness',
    description: 'Rehearsal quality across sections',
    icon: Target,
    range: '±12%',
    baseline: 0.80,
    weight: 0.60,
  },
  staff: {
    label: 'Staff Effectiveness',
    description: 'Coaching quality & specialty match',
    icon: Users,
    range: '±8%',
    baseline: 0.80,
    weight: 0.40,
  },
  equipment: {
    label: 'Equipment Condition',
    description: 'Instruments, uniforms, props',
    icon: Wrench,
    range: '0 to -5%',
    baseline: 1.00,
    weight: 0.50,
  },
  travelCondition: {
    label: 'Travel Health',
    description: 'Bus + truck condition (70%+ = no penalty)',
    icon: Bus,
    range: '-3%',
    threshold: 1.40,
  },
  morale: {
    label: 'Section Morale',
    description: 'Mental state of performers',
    icon: Heart,
    range: '±8%',
    baseline: 0.75,
    weight: 0.32,
  },
  showDifficulty: {
    label: 'Show Difficulty',
    description: 'Risk vs reward based on preparedness',
    icon: Zap,
    range: '±15%',
  },
  randomVariance: {
    label: 'Daily Variance',
    description: 'Weather, nerves, unpredictability',
    icon: Sparkles,
    range: '±2%',
  },
  championshipPressure: {
    label: 'Championship Pressure',
    description: 'Finals week intensity (Days 47-49)',
    icon: Trophy,
    range: '±2%',
  },
  fatigue: {
    label: 'Late Season Fatigue',
    description: 'Corps tiredness (Days 35-49)',
    icon: Flame,
    range: '0 to -5%',
  },
};

// ============================================================================
// MULTIPLIER STATUS BADGE
// ============================================================================
const getMultiplierStatus = (multiplier) => {
  if (multiplier >= 1.05) return { label: 'ELITE', color: 'text-green-400', bg: 'bg-green-500/20', border: 'border-green-500/40' };
  if (multiplier >= 0.95) return { label: 'STRONG', color: 'text-gold-400', bg: 'bg-gold-500/20', border: 'border-gold-500/40' };
  if (multiplier >= 0.85) return { label: 'FAIR', color: 'text-yellow-400', bg: 'bg-yellow-500/20', border: 'border-yellow-500/40' };
  return { label: 'WEAK', color: 'text-red-400', bg: 'bg-red-500/20', border: 'border-red-500/40' };
};

// ============================================================================
// FACTOR ROW COMPONENT
// ============================================================================
const FactorRow = ({ factorKey, value, showDetails = false }) => {
  const config = FACTOR_CONFIG[factorKey];
  if (!config) return null;

  const Icon = config.icon;
  const isPositive = value > 0.005;
  const isNegative = value < -0.005;
  const isNeutral = !isPositive && !isNegative;

  const colorClass = isPositive ? 'text-green-400' : isNegative ? 'text-red-400' : 'text-cream-muted';
  const bgClass = isPositive ? 'bg-green-500/10' : isNegative ? 'bg-red-500/10' : 'bg-white/5';

  const TrendIcon = isPositive ? TrendingUp : isNegative ? TrendingDown : Minus;

  return (
    <motion.div
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      className={`flex items-center justify-between py-2 px-3 rounded-lg ${bgClass}`}
    >
      <div className="flex items-center gap-3">
        <div className={`p-1.5 rounded-lg ${isPositive ? 'bg-green-500/20' : isNegative ? 'bg-red-500/20' : 'bg-white/10'}`}>
          <Icon className={`w-4 h-4 ${colorClass}`} />
        </div>
        <div>
          <div className="text-sm font-display font-bold text-cream">
            {config.label}
          </div>
          {showDetails && (
            <div className="text-[10px] text-cream-muted">
              {config.description}
            </div>
          )}
        </div>
      </div>
      <div className="flex items-center gap-2">
        <TrendIcon className={`w-3 h-3 ${colorClass}`} />
        <span className={`font-mono font-bold text-sm ${colorClass}`}>
          {isPositive ? '+' : ''}{(value * 100).toFixed(1)}%
        </span>
      </div>
    </motion.div>
  );
};

// ============================================================================
// BREAKDOWN PANEL CONTENT
// ============================================================================
const BreakdownPanel = ({ breakdown, multiplier, currentDay, showDifficultyInfo, onClose }) => {
  const status = getMultiplierStatus(multiplier);

  // Sort factors: significant impacts first
  const sortedFactors = Object.entries(breakdown)
    .filter(([key, val]) => val !== undefined && FACTOR_CONFIG[key])
    .sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]));

  // Calculate totals
  const totalBonus = sortedFactors
    .filter(([, val]) => val > 0)
    .reduce((sum, [, val]) => sum + val, 0);
  const totalPenalty = sortedFactors
    .filter(([, val]) => val < 0)
    .reduce((sum, [, val]) => sum + val, 0);

  return (
    <div className="p-4 space-y-4">
      {/* Header with final multiplier */}
      <div className="flex items-center justify-between pb-3 border-b border-white/10">
        <div>
          <h3 className="text-lg font-display font-black text-cream uppercase tracking-tight">
            Execution Multiplier
          </h3>
          <p className="text-[10px] text-cream-muted mt-0.5">
            How well your corps performs the show
          </p>
        </div>
        <div className="text-right">
          <div className={`text-3xl font-mono font-bold ${status.color}`} style={{ textShadow: '0 0 15px currentColor' }}>
            {multiplier.toFixed(2)}x
          </div>
          <div className={`text-xs font-display font-bold uppercase ${status.color}`}>
            {status.label}
          </div>
        </div>
      </div>

      {/* Summary bar */}
      <div className="flex items-center gap-4 py-2">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-green-500" />
          <span className="text-xs text-cream-muted">Bonuses:</span>
          <span className="text-sm font-mono font-bold text-green-400">
            +{(totalBonus * 100).toFixed(1)}%
          </span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-red-500" />
          <span className="text-xs text-cream-muted">Penalties:</span>
          <span className="text-sm font-mono font-bold text-red-400">
            {(totalPenalty * 100).toFixed(1)}%
          </span>
        </div>
      </div>

      {/* Factor breakdown */}
      <div className="space-y-1.5 max-h-[300px] overflow-y-auto">
        {sortedFactors.map(([key, value], index) => (
          <FactorRow
            key={key}
            factorKey={key}
            value={value}
            showDetails={index < 4}
          />
        ))}
      </div>

      {/* Show difficulty context */}
      {showDifficultyInfo && (
        <div className={`p-3 rounded-lg border ${showDifficultyInfo.isPrepared ? 'bg-green-500/10 border-green-500/30' : 'bg-orange-500/10 border-orange-500/30'}`}>
          <div className="flex items-start gap-2">
            {showDifficultyInfo.isPrepared ? (
              <Sparkles className="w-4 h-4 text-green-400 flex-shrink-0 mt-0.5" />
            ) : (
              <AlertTriangle className="w-4 h-4 text-orange-400 flex-shrink-0 mt-0.5" />
            )}
            <div>
              <div className={`text-xs font-display font-bold uppercase ${showDifficultyInfo.isPrepared ? 'text-green-400' : 'text-orange-400'}`}>
                {showDifficultyInfo.label} Difficulty
              </div>
              <p className="text-[10px] text-cream-muted mt-0.5">
                {showDifficultyInfo.isPrepared
                  ? `Your ${Math.round(showDifficultyInfo.readiness * 100)}% readiness exceeds the ${Math.round(showDifficultyInfo.threshold * 100)}% threshold. Ceiling bonus active!`
                  : `Your ${Math.round(showDifficultyInfo.readiness * 100)}% readiness is below the ${Math.round(showDifficultyInfo.threshold * 100)}% threshold. Risk penalty applied.`
                }
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Day indicator for temporal effects */}
      {currentDay && (currentDay >= 35 || currentDay >= 47) && (
        <div className="flex items-center gap-2 text-[10px] text-cream-muted pt-2 border-t border-white/10">
          <Clock className="w-3 h-3" />
          <span>Day {currentDay}/49</span>
          {currentDay >= 47 && <span className="text-purple-400">• Championship Week</span>}
          {currentDay >= 35 && currentDay < 47 && <span className="text-orange-400">• Late Season</span>}
        </div>
      )}

      {/* Formula hint */}
      <div className="pt-2 border-t border-white/10">
        <p className="text-[9px] text-cream-muted text-center">
          Base (1.00) + Factors = Final • Clamped to 0.70 - 1.10
        </p>
      </div>
    </div>
  );
};

// ============================================================================
// MOBILE BOTTOM SHEET DRAWER
// ============================================================================
const BottomSheetDrawer = ({ isOpen, onClose, children }) => {
  const [dragY, setDragY] = useState(0);

  const handleDragEnd = (_, info) => {
    if (info.offset.y > 100 || info.velocity.y > 500) {
      onClose();
    }
    setDragY(0);
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50"
          />
          {/* Drawer */}
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: dragY }}
            exit={{ y: '100%' }}
            drag="y"
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={0.2}
            onDrag={(_, info) => setDragY(Math.max(0, info.offset.y))}
            onDragEnd={handleDragEnd}
            transition={{ type: 'spring', damping: 30, stiffness: 300 }}
            className="fixed bottom-0 left-0 right-0 z-50 bg-surface rounded-t-2xl border-t border-border-default max-h-[85vh] overflow-hidden"
          >
            {/* Drag handle */}
            <div className="flex justify-center py-3">
              <div className="w-12 h-1 rounded-full bg-cream-muted/30" />
            </div>
            {/* Close button */}
            <button
              onClick={onClose}
              className="absolute top-3 right-3 p-2 rounded-lg hover:bg-white/10 text-cream-muted"
            >
              <X className="w-5 h-5" />
            </button>
            {/* Content */}
            <div className="overflow-y-auto max-h-[calc(85vh-60px)]">
              {children}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

// ============================================================================
// DESKTOP POPOVER
// ============================================================================
const DesktopPopover = ({ isOpen, onClose, anchorRef, children }) => {
  const popoverRef = useRef(null);

  // Close on click outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (
        popoverRef.current &&
        !popoverRef.current.contains(e.target) &&
        anchorRef.current &&
        !anchorRef.current.contains(e.target)
      ) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen, onClose, anchorRef]);

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          ref={popoverRef}
          initial={{ opacity: 0, y: 10, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 10, scale: 0.95 }}
          transition={{ duration: 0.15 }}
          className="absolute top-full right-0 mt-2 w-[380px] z-50 glass-dark rounded-xl shadow-2xl border border-white/10 overflow-hidden"
        >
          {children}
        </motion.div>
      )}
    </AnimatePresence>
  );
};

// ============================================================================
// MAIN GLASS BOX COMPONENT
// ============================================================================
export const MultiplierGlassBox = ({
  multiplier = 1.0,
  breakdown = {},
  currentDay = 1,
  showDifficulty = null,
  avgReadiness = 0.75,
  compact = false,
  className = '',
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const anchorRef = useRef(null);

  // Detect mobile
  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const status = getMultiplierStatus(multiplier);

  // Build show difficulty info
  const showDifficultyInfo = showDifficulty ? {
    label: showDifficulty.label || 'Moderate',
    threshold: showDifficulty.preparednessThreshold || 0.80,
    readiness: avgReadiness,
    isPrepared: avgReadiness >= (showDifficulty.preparednessThreshold || 0.80),
  } : null;

  const handleToggle = () => setIsOpen(!isOpen);
  const handleClose = () => setIsOpen(false);

  // Panel content
  const panelContent = (
    <BreakdownPanel
      breakdown={breakdown}
      multiplier={multiplier}
      currentDay={currentDay}
      showDifficultyInfo={showDifficultyInfo}
      onClose={handleClose}
    />
  );

  return (
    <div className={`relative ${className}`}>
      {/* Compact Badge */}
      <button
        ref={anchorRef}
        onClick={handleToggle}
        className={`group flex items-center gap-2 px-3 py-2 rounded-lg border transition-all cursor-pointer ${status.bg} ${status.border} hover:scale-105`}
      >
        {/* Multiplier value */}
        <span className={`text-xl font-mono font-bold ${status.color}`} style={{ textShadow: '0 0 10px currentColor' }}>
          {multiplier.toFixed(2)}x
        </span>

        {/* Divider */}
        <div className="w-px h-5 bg-white/20" />

        {/* Status label */}
        <span className={`text-xs font-display font-bold uppercase tracking-wider ${status.color}`}>
          {status.label}
        </span>

        {/* Info indicator */}
        <div className="ml-1 opacity-60 group-hover:opacity-100 transition-opacity">
          <Info className="w-3.5 h-3.5 text-cream-muted" />
        </div>

        {/* Dotted underline hint */}
        <div className="absolute -bottom-0.5 left-3 right-3 border-b border-dashed border-cream-muted/30 group-hover:border-cream-muted/60 transition-colors" />
      </button>

      {/* Desktop Popover */}
      {!isMobile && (
        <DesktopPopover
          isOpen={isOpen}
          onClose={handleClose}
          anchorRef={anchorRef}
        >
          {panelContent}
        </DesktopPopover>
      )}

      {/* Mobile Bottom Sheet */}
      {isMobile && (
        <BottomSheetDrawer isOpen={isOpen} onClose={handleClose}>
          {panelContent}
        </BottomSheetDrawer>
      )}
    </div>
  );
};

// ============================================================================
// LARGE VARIANT - For prominent display in hero sections
// ============================================================================
export const MultiplierGlassBoxLarge = ({
  multiplier = 1.0,
  breakdown = {},
  currentDay = 1,
  showDifficulty = null,
  avgReadiness = 0.75,
  className = '',
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const anchorRef = useRef(null);

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const status = getMultiplierStatus(multiplier);

  const showDifficultyInfo = showDifficulty ? {
    label: showDifficulty.label || 'Moderate',
    threshold: showDifficulty.preparednessThreshold || 0.80,
    readiness: avgReadiness,
    isPrepared: avgReadiness >= (showDifficulty.preparednessThreshold || 0.80),
  } : null;

  const handleToggle = () => setIsOpen(!isOpen);
  const handleClose = () => setIsOpen(false);

  const panelContent = (
    <BreakdownPanel
      breakdown={breakdown}
      multiplier={multiplier}
      currentDay={currentDay}
      showDifficultyInfo={showDifficultyInfo}
      onClose={handleClose}
    />
  );

  return (
    <div className={`relative ${className}`}>
      {/* Large Badge */}
      <button
        ref={anchorRef}
        onClick={handleToggle}
        className="group flex flex-col items-center cursor-pointer transition-transform hover:scale-105"
      >
        {/* Multiplier label */}
        <div className="text-[8px] text-cream-muted uppercase tracking-[0.25em] font-display font-bold mb-1">
          Multiplier
        </div>

        {/* Large value with glow */}
        <div className={`text-4xl md:text-5xl font-mono font-bold ${status.color}`} style={{ textShadow: '0 0 20px currentColor' }}>
          {multiplier.toFixed(2)}x
        </div>

        {/* Status with icon */}
        <div className={`flex items-center gap-1 mt-1 ${status.color}`}>
          <TrendingUp className="w-3 h-3" style={{ filter: 'drop-shadow(0 0 4px currentColor)' }} />
          <span className="text-xs font-display font-bold uppercase tracking-wider">
            {status.label}
          </span>
        </div>

        {/* Click hint */}
        <div className="mt-2 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <Info className="w-3 h-3 text-cream-muted" />
          <span className="text-[9px] text-cream-muted uppercase tracking-wider">
            View Breakdown
          </span>
        </div>

        {/* Dotted underline */}
        <div className="absolute -bottom-1 left-1/4 right-1/4 border-b-2 border-dashed border-cream-muted/20 group-hover:border-cream-muted/50 transition-colors" />
      </button>

      {/* Desktop Popover */}
      {!isMobile && (
        <DesktopPopover
          isOpen={isOpen}
          onClose={handleClose}
          anchorRef={anchorRef}
        >
          {panelContent}
        </DesktopPopover>
      )}

      {/* Mobile Bottom Sheet */}
      {isMobile && (
        <BottomSheetDrawer isOpen={isOpen} onClose={handleClose}>
          {panelContent}
        </BottomSheetDrawer>
      )}
    </div>
  );
};

export default MultiplierGlassBox;
