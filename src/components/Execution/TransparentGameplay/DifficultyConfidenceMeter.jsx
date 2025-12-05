// src/components/Execution/TransparentGameplay/DifficultyConfidenceMeter.jsx
// "Confidence Meter" / "Risk Gauge" for Show Difficulty decision-making
// Visualizes the gap between current readiness and difficulty threshold

import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Target, AlertTriangle, Sparkles, TrendingUp, TrendingDown,
  Shield, Flame, Crown, Zap, ChevronRight, Info, Lock, Calendar
} from 'lucide-react';

// ============================================================================
// SHOW DIFFICULTY PRESETS (from backend execution.js)
// ============================================================================
export const DIFFICULTY_PRESETS = {
  conservative: {
    key: 'conservative',
    difficulty: 3,
    preparednessThreshold: 0.70,
    ceilingBonus: 0.04,
    riskPenalty: -0.05,
    label: 'Conservative',
    description: "Safe show that's easy to execute well",
    icon: Shield,
    color: 'green',
    riskLevel: 'Low Risk',
  },
  moderate: {
    key: 'moderate',
    difficulty: 5,
    preparednessThreshold: 0.80,
    ceilingBonus: 0.08,
    riskPenalty: -0.10,
    label: 'Moderate',
    description: 'Balanced risk and reward',
    icon: Target,
    color: 'blue',
    riskLevel: 'Medium Risk',
  },
  ambitious: {
    key: 'ambitious',
    difficulty: 7,
    preparednessThreshold: 0.85,
    ceilingBonus: 0.12,
    riskPenalty: -0.15,
    label: 'Ambitious',
    description: 'High difficulty with great potential',
    icon: Flame,
    color: 'orange',
    riskLevel: 'High Risk',
  },
  legendary: {
    key: 'legendary',
    difficulty: 10,
    preparednessThreshold: 0.90,
    ceilingBonus: 0.15,
    riskPenalty: -0.20,
    label: 'Legendary',
    description: 'Historic show - huge risk, massive reward',
    icon: Crown,
    color: 'purple',
    riskLevel: 'Extreme Risk',
  },
};

// ============================================================================
// CONFIDENCE GAUGE - Main Visual Component
// ============================================================================
const ConfidenceGauge = ({
  currentReadiness,
  threshold,
  ceilingBonus,
  riskPenalty,
  difficultyLabel,
  color = 'blue',
  compact = false,
}) => {
  const readinessPercent = Math.round(currentReadiness * 100);
  const thresholdPercent = Math.round(threshold * 100);
  const isPrepared = currentReadiness >= threshold;
  const gap = Math.abs(currentReadiness - threshold);
  const gapPercent = Math.round(gap * 100);

  // Color classes based on difficulty
  const colorClasses = {
    green: {
      threshold: 'bg-green-500',
      thresholdGlow: 'shadow-green-500/50',
      prepared: 'from-green-400 to-emerald-500',
      preparedGlow: 'rgba(34, 197, 94, 0.4)',
    },
    blue: {
      threshold: 'bg-blue-500',
      thresholdGlow: 'shadow-blue-500/50',
      prepared: 'from-blue-400 to-cyan-500',
      preparedGlow: 'rgba(59, 130, 246, 0.4)',
    },
    orange: {
      threshold: 'bg-orange-500',
      thresholdGlow: 'shadow-orange-500/50',
      prepared: 'from-orange-400 to-amber-500',
      preparedGlow: 'rgba(249, 115, 22, 0.4)',
    },
    purple: {
      threshold: 'bg-purple-500',
      thresholdGlow: 'shadow-purple-500/50',
      prepared: 'from-purple-400 to-pink-500',
      preparedGlow: 'rgba(168, 85, 247, 0.4)',
    },
  };

  const colors = colorClasses[color] || colorClasses.blue;

  return (
    <div className={`space-y-3 ${compact ? 'space-y-2' : ''}`}>
      {/* Gauge Track */}
      <div className="relative">
        {/* Background track */}
        <div className="h-4 bg-charcoal-800 rounded-full overflow-hidden relative">
          {/* Danger zone (below threshold) */}
          <div
            className="absolute inset-y-0 left-0 bg-gradient-to-r from-red-500/30 to-red-500/10"
            style={{ width: `${thresholdPercent}%` }}
          />

          {/* Safe zone (above threshold) */}
          <div
            className="absolute inset-y-0 bg-gradient-to-r from-green-500/10 to-green-500/30"
            style={{ left: `${thresholdPercent}%`, right: 0 }}
          />

          {/* Current readiness bar */}
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${readinessPercent}%` }}
            transition={{ duration: 0.8, ease: 'easeOut' }}
            className={`absolute inset-y-0 left-0 rounded-full ${
              isPrepared
                ? `bg-gradient-to-r ${colors.prepared}`
                : 'bg-gradient-to-r from-red-500 to-orange-500'
            }`}
            style={{
              boxShadow: isPrepared
                ? `0 0 15px ${colors.preparedGlow}`
                : '0 0 15px rgba(239, 68, 68, 0.4)',
            }}
          />

          {/* Threshold marker */}
          <div
            className="absolute top-0 bottom-0 w-1 z-10"
            style={{ left: `${thresholdPercent}%`, transform: 'translateX(-50%)' }}
          >
            <div className={`h-full ${colors.threshold} rounded-full shadow-lg ${colors.thresholdGlow}`} />
            {/* Threshold label */}
            <div className="absolute -top-7 left-1/2 -translate-x-1/2 whitespace-nowrap">
              <span className="text-[9px] font-mono font-bold text-cream-muted bg-charcoal-800 px-1.5 py-0.5 rounded">
                {thresholdPercent}%
              </span>
            </div>
          </div>

          {/* Current position indicator */}
          <div
            className="absolute top-full mt-1 -translate-x-1/2"
            style={{ left: `${readinessPercent}%` }}
          >
            <div className="w-0 h-0 border-l-4 border-r-4 border-b-4 border-l-transparent border-r-transparent border-b-cream" />
          </div>
        </div>

        {/* Scale markers */}
        <div className="flex justify-between mt-1 px-1">
          {[0, 25, 50, 75, 100].map(mark => (
            <span key={mark} className="text-[8px] text-cream-muted/50 font-mono">
              {mark}
            </span>
          ))}
        </div>
      </div>

      {/* Gap Visualization */}
      <div className={`flex items-center justify-between p-3 rounded-lg border ${
        isPrepared
          ? 'bg-green-500/10 border-green-500/30'
          : 'bg-red-500/10 border-red-500/30'
      }`}>
        <div className="flex items-center gap-3">
          {isPrepared ? (
            <div className="p-2 rounded-lg bg-green-500/20">
              <Sparkles className="w-5 h-5 text-green-400" />
            </div>
          ) : (
            <div className="p-2 rounded-lg bg-red-500/20">
              <AlertTriangle className="w-5 h-5 text-red-400" />
            </div>
          )}
          <div>
            <div className={`text-sm font-display font-bold uppercase ${
              isPrepared ? 'text-green-400' : 'text-red-400'
            }`}>
              {isPrepared ? 'Ceiling Bonus Active' : 'Risk Penalty Active'}
            </div>
            <div className="text-[10px] text-cream-muted">
              {isPrepared
                ? `You're ${gapPercent}% above the ${thresholdPercent}% threshold`
                : `You need ${gapPercent}% more to reach ${thresholdPercent}%`
              }
            </div>
          </div>
        </div>
        <div className="text-right">
          <div className={`text-2xl font-mono font-bold ${
            isPrepared ? 'text-green-400' : 'text-red-400'
          }`} style={{ textShadow: `0 0 10px ${isPrepared ? 'rgba(34, 197, 94, 0.5)' : 'rgba(239, 68, 68, 0.5)'}` }}>
            {isPrepared ? '+' : ''}{Math.round((isPrepared ? ceilingBonus : riskPenalty) * 100)}%
          </div>
          <div className="text-[9px] text-cream-muted uppercase">
            {isPrepared ? 'Score Bonus' : 'Score Penalty'}
          </div>
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// DIFFICULTY CARD - Selectable difficulty option
// ============================================================================
const DifficultyCard = ({
  preset,
  currentReadiness,
  isSelected,
  isLocked,
  lockReason,
  onSelect,
  compact = false,
}) => {
  const Icon = preset.icon;
  const isPrepared = currentReadiness >= preset.preparednessThreshold;
  const thresholdPercent = Math.round(preset.preparednessThreshold * 100);
  const readinessPercent = Math.round(currentReadiness * 100);
  const gap = preset.preparednessThreshold - currentReadiness;
  const gapPercent = Math.round(Math.abs(gap) * 100);

  const colorStyles = {
    green: 'border-green-500/40 bg-green-500/5 hover:border-green-500/60',
    blue: 'border-blue-500/40 bg-blue-500/5 hover:border-blue-500/60',
    orange: 'border-orange-500/40 bg-orange-500/5 hover:border-orange-500/60',
    purple: 'border-purple-500/40 bg-purple-500/5 hover:border-purple-500/60',
  };

  const iconColors = {
    green: 'text-green-400 bg-green-500/20',
    blue: 'text-blue-400 bg-blue-500/20',
    orange: 'text-orange-400 bg-orange-500/20',
    purple: 'text-purple-400 bg-purple-500/20',
  };

  return (
    <motion.button
      onClick={() => !isLocked && onSelect?.(preset.key)}
      disabled={isLocked}
      whileHover={!isLocked ? { scale: 1.02 } : {}}
      whileTap={!isLocked ? { scale: 0.98 } : {}}
      className={`relative w-full p-4 rounded-xl border-2 transition-all text-left ${
        isLocked
          ? 'opacity-50 cursor-not-allowed border-charcoal-700 bg-charcoal-800/50'
          : isSelected
            ? `${colorStyles[preset.color]} ring-2 ring-${preset.color}-500/50`
            : `border-charcoal-700 hover:${colorStyles[preset.color]}`
      }`}
    >
      {/* Lock overlay */}
      {isLocked && (
        <div className="absolute inset-0 flex items-center justify-center bg-charcoal-900/60 rounded-xl z-10">
          <div className="flex items-center gap-2 text-cream-muted">
            <Lock className="w-4 h-4" />
            <span className="text-xs">{lockReason || 'Locked'}</span>
          </div>
        </div>
      )}

      {/* Selected indicator */}
      {isSelected && (
        <div className="absolute -top-2 -right-2 p-1 rounded-full bg-gold-500 text-charcoal-900">
          <Sparkles className="w-3 h-3" />
        </div>
      )}

      <div className="flex items-start gap-3">
        {/* Icon */}
        <div className={`p-2.5 rounded-xl ${iconColors[preset.color]}`}>
          <Icon className="w-6 h-6" />
        </div>

        <div className="flex-1 min-w-0">
          {/* Header */}
          <div className="flex items-center justify-between mb-1">
            <span className="text-sm font-display font-bold text-cream uppercase">
              {preset.label}
            </span>
            <span className={`text-[9px] px-2 py-0.5 rounded-full font-bold uppercase ${
              preset.color === 'green' ? 'bg-green-500/20 text-green-400' :
              preset.color === 'blue' ? 'bg-blue-500/20 text-blue-400' :
              preset.color === 'orange' ? 'bg-orange-500/20 text-orange-400' :
              'bg-purple-500/20 text-purple-400'
            }`}>
              {preset.riskLevel}
            </span>
          </div>

          {/* Description */}
          <p className="text-[10px] text-cream-muted mb-2">{preset.description}</p>

          {/* Mini gauge */}
          <div className="relative h-2 bg-charcoal-800 rounded-full overflow-hidden mb-2">
            {/* Current readiness */}
            <div
              className={`absolute inset-y-0 left-0 rounded-full ${
                isPrepared ? 'bg-green-500' : 'bg-red-500'
              }`}
              style={{ width: `${readinessPercent}%` }}
            />
            {/* Threshold marker */}
            <div
              className="absolute top-0 bottom-0 w-0.5 bg-white"
              style={{ left: `${thresholdPercent}%` }}
            />
          </div>

          {/* Stats row */}
          <div className="flex items-center justify-between text-[9px]">
            <span className="text-cream-muted">
              Threshold: <span className="font-mono font-bold text-cream">{thresholdPercent}%</span>
            </span>
            <div className="flex items-center gap-2">
              <span className={isPrepared ? 'text-green-400' : 'text-red-400'}>
                {isPrepared ? (
                  <span className="flex items-center gap-1">
                    <TrendingUp className="w-3 h-3" />
                    +{Math.round(preset.ceilingBonus * 100)}%
                  </span>
                ) : (
                  <span className="flex items-center gap-1">
                    <TrendingDown className="w-3 h-3" />
                    {Math.round(preset.riskPenalty * 100)}%
                  </span>
                )}
              </span>
            </div>
          </div>
        </div>
      </div>
    </motion.button>
  );
};

// ============================================================================
// MAIN CONFIDENCE METER COMPONENT
// ============================================================================
export const DifficultyConfidenceMeter = ({
  currentDifficulty = 'moderate',
  currentReadiness = 0.75,
  currentDay = 1,
  onChangeDifficulty,
  showSelector = true,
  compact = false,
}) => {
  const [showInfo, setShowInfo] = useState(false);

  // Derive difficulty key from string or numeric difficulty value
  // Must match logic in ExecutionInsightsPanel for consistency
  const difficultyKey = typeof currentDifficulty === 'string'
    ? currentDifficulty
    : currentDifficulty?.key
      ? currentDifficulty.key
      : currentDifficulty?.difficulty <= 3 ? 'conservative'
      : currentDifficulty?.difficulty <= 5 ? 'moderate'
      : currentDifficulty?.difficulty <= 7 ? 'ambitious'
      : 'legendary';
  const config = DIFFICULTY_PRESETS[difficultyKey] || DIFFICULTY_PRESETS.moderate;

  // Check if difficulty is locked (after day 10)
  const isLocked = currentDay > 10;

  const isPrepared = currentReadiness >= config.preparednessThreshold;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className={`p-2 rounded-lg ${
            config.color === 'green' ? 'bg-green-500/20' :
            config.color === 'blue' ? 'bg-blue-500/20' :
            config.color === 'orange' ? 'bg-orange-500/20' :
            'bg-purple-500/20'
          }`}>
            <config.icon className={`w-5 h-5 ${
              config.color === 'green' ? 'text-green-400' :
              config.color === 'blue' ? 'text-blue-400' :
              config.color === 'orange' ? 'text-orange-400' :
              'text-purple-400'
            }`} />
          </div>
          <div>
            <h3 className="text-lg font-display font-bold text-cream uppercase">
              {config.label} Difficulty
            </h3>
            <p className="text-[10px] text-cream-muted">{config.description}</p>
          </div>
        </div>
        <button
          onClick={() => setShowInfo(!showInfo)}
          className="p-2 rounded-lg hover:bg-white/5 text-cream-muted hover:text-cream transition-colors"
        >
          <Info className="w-5 h-5" />
        </button>
      </div>

      {/* Info Panel */}
      <AnimatePresence>
        {showInfo && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="p-3 rounded-lg bg-charcoal-800 border border-white/10 text-[11px] text-cream-muted space-y-2">
              <p>
                <strong className="text-cream">Show Difficulty</strong> determines your scoring potential.
                Higher difficulty = higher ceiling, but requires more preparation.
              </p>
              <p>
                <strong className="text-cream">Threshold:</strong> The readiness level needed to earn the bonus.
                Below threshold = penalty applied instead.
              </p>
              <div className="flex items-center gap-2 pt-1 text-orange-400">
                <Calendar className="w-3 h-3" />
                <span>Difficulty locks on Day 10 - choose wisely!</span>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Lock Warning */}
      {isLocked && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-charcoal-800 border border-white/10">
          <Lock className="w-4 h-4 text-cream-muted" />
          <span className="text-xs text-cream-muted">
            Difficulty locked on Day 10. Current: <span className="text-cream font-bold">{config.label}</span>
          </span>
        </div>
      )}

      {/* Main Gauge */}
      <ConfidenceGauge
        currentReadiness={currentReadiness}
        threshold={config.preparednessThreshold}
        ceilingBonus={config.ceilingBonus}
        riskPenalty={config.riskPenalty}
        difficultyLabel={config.label}
        color={config.color}
        compact={compact}
      />

      {/* Difficulty Selector */}
      {showSelector && !isLocked && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-display font-bold text-cream-muted uppercase">
              Choose Difficulty
            </span>
            <span className="text-[9px] text-cream-muted">
              Day {currentDay}/49 • {currentDay <= 10 ? `${10 - currentDay} days to decide` : 'Locked'}
            </span>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {Object.values(DIFFICULTY_PRESETS).map(preset => (
              <DifficultyCard
                key={preset.key}
                preset={preset}
                currentReadiness={currentReadiness}
                isSelected={difficultyKey === preset.key}
                isLocked={false}
                onSelect={onChangeDifficulty}
                compact={compact}
              />
            ))}
          </div>
        </div>
      )}

      {/* Current Status Summary */}
      <div className="flex items-center justify-between p-3 rounded-lg bg-charcoal-800/50 border border-white/5">
        <div className="flex items-center gap-4">
          <div>
            <div className="text-[9px] text-cream-muted uppercase">Your Readiness</div>
            <div className="text-lg font-mono font-bold text-cream">
              {Math.round(currentReadiness * 100)}%
            </div>
          </div>
          <ChevronRight className="w-4 h-4 text-cream-muted" />
          <div>
            <div className="text-[9px] text-cream-muted uppercase">Threshold</div>
            <div className={`text-lg font-mono font-bold ${
              config.color === 'green' ? 'text-green-400' :
              config.color === 'blue' ? 'text-blue-400' :
              config.color === 'orange' ? 'text-orange-400' :
              'text-purple-400'
            }`}>
              {Math.round(config.preparednessThreshold * 100)}%
            </div>
          </div>
        </div>
        <div className="text-right">
          <div className="text-[9px] text-cream-muted uppercase">
            {isPrepared ? 'Bonus' : 'Penalty'}
          </div>
          <div className={`text-xl font-mono font-bold ${
            isPrepared ? 'text-green-400' : 'text-red-400'
          }`}>
            {isPrepared ? '+' : ''}{Math.round((isPrepared ? config.ceilingBonus : config.riskPenalty) * 100)}%
          </div>
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// COMPACT CONFIDENCE BADGE - For HUD integration
// ============================================================================
export const ConfidenceBadge = ({
  currentDifficulty = 'moderate',
  currentReadiness = 0.75,
  onClick,
}) => {
  // Derive difficulty key from string or numeric difficulty value
  // Must match logic in ExecutionInsightsPanel for consistency
  const difficultyKey = typeof currentDifficulty === 'string'
    ? currentDifficulty
    : currentDifficulty?.key
      ? currentDifficulty.key
      : currentDifficulty?.difficulty <= 3 ? 'conservative'
      : currentDifficulty?.difficulty <= 5 ? 'moderate'
      : currentDifficulty?.difficulty <= 7 ? 'ambitious'
      : 'legendary';
  const config = DIFFICULTY_PRESETS[difficultyKey] || DIFFICULTY_PRESETS.moderate;

  const isPrepared = currentReadiness >= config.preparednessThreshold;
  const Icon = config.icon;

  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 px-3 py-2 rounded-lg border transition-all hover:scale-105 ${
        isPrepared
          ? 'bg-green-500/10 border-green-500/30 hover:border-green-500/50'
          : 'bg-red-500/10 border-red-500/30 hover:border-red-500/50'
      }`}
    >
      <Icon className={`w-4 h-4 ${
        config.color === 'green' ? 'text-green-400' :
        config.color === 'blue' ? 'text-blue-400' :
        config.color === 'orange' ? 'text-orange-400' :
        'text-purple-400'
      }`} />
      <div className="text-left">
        <div className="text-[9px] text-cream-muted uppercase">{config.label}</div>
        <div className={`text-sm font-mono font-bold ${
          isPrepared ? 'text-green-400' : 'text-red-400'
        }`}>
          {isPrepared ? '+' : ''}{Math.round((isPrepared ? config.ceilingBonus : config.riskPenalty) * 100)}%
        </div>
      </div>
      <div className={`w-2 h-2 rounded-full ${isPrepared ? 'bg-green-500' : 'bg-red-500'} animate-pulse`} />
    </button>
  );
};

// ============================================================================
// MINI RISK INDICATOR - Ultra-compact for tight spaces
// ============================================================================
export const MiniRiskIndicator = ({
  currentDifficulty = 'moderate',
  currentReadiness = 0.75,
}) => {
  // Derive difficulty key from string or numeric difficulty value
  // Must match logic in ExecutionInsightsPanel for consistency
  const difficultyKey = typeof currentDifficulty === 'string'
    ? currentDifficulty
    : currentDifficulty?.key
      ? currentDifficulty.key
      : currentDifficulty?.difficulty <= 3 ? 'conservative'
      : currentDifficulty?.difficulty <= 5 ? 'moderate'
      : currentDifficulty?.difficulty <= 7 ? 'ambitious'
      : 'legendary';
  const config = DIFFICULTY_PRESETS[difficultyKey] || DIFFICULTY_PRESETS.moderate;

  const isPrepared = currentReadiness >= config.preparednessThreshold;
  const readinessPercent = Math.round(currentReadiness * 100);
  const thresholdPercent = Math.round(config.preparednessThreshold * 100);

  return (
    <div className="flex items-center gap-2">
      {/* Mini gauge */}
      <div className="relative w-16 h-2 bg-charcoal-800 rounded-full overflow-hidden">
        <div
          className={`absolute inset-y-0 left-0 rounded-full ${isPrepared ? 'bg-green-500' : 'bg-red-500'}`}
          style={{ width: `${readinessPercent}%` }}
        />
        <div
          className="absolute top-0 bottom-0 w-0.5 bg-white/80"
          style={{ left: `${thresholdPercent}%` }}
        />
      </div>
      {/* Status */}
      <span className={`text-[9px] font-mono font-bold ${isPrepared ? 'text-green-400' : 'text-red-400'}`}>
        {isPrepared ? '+' : ''}{Math.round((isPrepared ? config.ceilingBonus : config.riskPenalty) * 100)}%
      </span>
    </div>
  );
};

export default DifficultyConfidenceMeter;
