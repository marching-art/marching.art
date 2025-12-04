// src/components/Execution/TransparentGameplay/index.jsx
// Premium "Echelon-Tier" Transparent Gameplay Components
// Exposes all Ghost Mechanics with data visualization best practices

import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Target, Heart, Wrench, Users, Music, Zap, AlertTriangle,
  TrendingUp, TrendingDown, Minus, Info, ChevronRight,
  Lock, Unlock, Clock, Flame, Snowflake, Award, Star,
  CheckCircle, XCircle, HelpCircle, Sparkles, Bus, Truck
} from 'lucide-react';

// ============================================================================
// CIRCULAR PROGRESS RING - For percentage values
// ============================================================================
export const CircularProgressRing = ({
  value,
  max = 1,
  size = 64,
  strokeWidth = 6,
  color = 'gold',
  label,
  sublabel,
  showPercentage = true,
  glowIntensity = 'medium'
}) => {
  const percentage = Math.round((value / max) * 100);
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const offset = circumference - (value / max) * circumference;

  const colorMap = {
    gold: { stroke: '#FFD700', glow: 'rgba(255, 215, 0, 0.4)', text: 'text-gold-400' },
    blue: { stroke: '#60A5FA', glow: 'rgba(96, 165, 250, 0.4)', text: 'text-blue-400' },
    red: { stroke: '#F87171', glow: 'rgba(248, 113, 113, 0.4)', text: 'text-red-400' },
    green: { stroke: '#4ADE80', glow: 'rgba(74, 222, 128, 0.4)', text: 'text-green-400' },
    purple: { stroke: '#C084FC', glow: 'rgba(192, 132, 252, 0.4)', text: 'text-purple-400' },
    orange: { stroke: '#FB923C', glow: 'rgba(251, 146, 60, 0.4)', text: 'text-orange-400' },
  };

  const colors = colorMap[color] || colorMap.gold;
  const glowSize = glowIntensity === 'high' ? 12 : glowIntensity === 'medium' ? 8 : 4;

  return (
    <div className="flex flex-col items-center gap-1">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="transform -rotate-90">
          {/* Background circle */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="currentColor"
            strokeWidth={strokeWidth}
            className="text-charcoal-800"
          />
          {/* Progress circle */}
          <motion.circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={colors.stroke}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeDasharray={circumference}
            initial={{ strokeDashoffset: circumference }}
            animate={{ strokeDashoffset: offset }}
            transition={{ duration: 1, ease: "easeOut" }}
            style={{
              filter: `drop-shadow(0 0 ${glowSize}px ${colors.glow})`
            }}
          />
        </svg>
        {/* Center value */}
        {showPercentage && (
          <div className="absolute inset-0 flex items-center justify-center">
            <span className={`font-mono font-bold text-sm ${colors.text}`}>
              {percentage}%
            </span>
          </div>
        )}
      </div>
      {label && (
        <span className="text-[10px] font-display font-bold uppercase tracking-wider text-cream-muted text-center">
          {label}
        </span>
      )}
      {sublabel && (
        <span className="text-[9px] text-cream-muted/60 text-center">
          {sublabel}
        </span>
      )}
    </div>
  );
};

// ============================================================================
// SECTION GAUGES - 4-section readiness/morale display
// ============================================================================
export const SectionGauges = ({
  data,
  type = 'readiness',
  showLabels = true
}) => {
  const sections = [
    { key: 'brass', label: 'Brass', icon: Music, captions: 'B, MA' },
    { key: 'percussion', label: 'Percussion', icon: Zap, captions: 'P' },
    { key: 'guard', label: 'Guard', icon: Star, captions: 'VP, VA, CG' },
    { key: 'ensemble', label: 'Ensemble', icon: Users, captions: 'GE1, GE2' },
  ];

  const getColor = (value) => {
    if (value >= 0.90) return 'green';
    if (value >= 0.80) return 'blue';
    if (value >= 0.70) return 'orange';
    return 'red';
  };

  return (
    <div className="grid grid-cols-4 gap-3">
      {sections.map(({ key, label, icon: Icon, captions }) => {
        const value = data?.[key] ?? 0.75;
        return (
          <div key={key} className="flex flex-col items-center group relative">
            <CircularProgressRing
              value={value}
              size={52}
              strokeWidth={5}
              color={getColor(value)}
              showPercentage={true}
            />
            {showLabels && (
              <>
                <div className="flex items-center gap-1 mt-1">
                  <Icon className="w-3 h-3 text-cream-muted" />
                  <span className="text-[10px] font-display font-bold uppercase text-cream-muted">
                    {label}
                  </span>
                </div>
                <span className="text-[8px] text-cream-muted/50">{captions}</span>
              </>
            )}
            {/* Tooltip */}
            <div className="absolute -top-16 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50">
              <div className="glass-dark px-3 py-2 rounded-lg text-xs whitespace-nowrap">
                <div className="font-bold text-cream">{label} {type === 'readiness' ? 'Readiness' : 'Morale'}</div>
                <div className="text-cream-muted">Affects: {captions}</div>
                <div className={`font-mono ${getColor(value) === 'green' ? 'text-green-400' : getColor(value) === 'red' ? 'text-red-400' : 'text-gold-400'}`}>
                  {type === 'readiness' ? '±12%' : '±8%'} caption impact
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};

// ============================================================================
// MULTIPLIER BREAKDOWN BADGE - Shows factor with tooltip explanation
// ============================================================================
export const MultiplierBadge = ({
  value,
  label,
  description,
  maxImpact,
  icon: Icon,
  showSign = true
}) => {
  const [showTooltip, setShowTooltip] = useState(false);

  const getColor = () => {
    if (value > 0.02) return { bg: 'bg-green-500/20', border: 'border-green-500/40', text: 'text-green-400' };
    if (value > 0) return { bg: 'bg-blue-500/20', border: 'border-blue-500/40', text: 'text-blue-400' };
    if (value > -0.02) return { bg: 'bg-yellow-500/20', border: 'border-yellow-500/40', text: 'text-yellow-400' };
    return { bg: 'bg-red-500/20', border: 'border-red-500/40', text: 'text-red-400' };
  };

  const colors = getColor();
  const displayValue = showSign
    ? `${value >= 0 ? '+' : ''}${(value * 100).toFixed(1)}%`
    : `${(value * 100).toFixed(1)}%`;

  return (
    <div
      className="relative"
      onMouseEnter={() => setShowTooltip(true)}
      onMouseLeave={() => setShowTooltip(false)}
    >
      <div className={`flex items-center gap-2 px-3 py-2 rounded-lg border ${colors.bg} ${colors.border} cursor-help transition-all hover:scale-105`}>
        {Icon && <Icon className={`w-4 h-4 ${colors.text}`} />}
        <span className="text-xs font-display font-bold text-cream-muted uppercase">{label}</span>
        <span className={`font-mono font-bold ${colors.text}`}>{displayValue}</span>
      </div>

      {/* Detailed Tooltip */}
      <AnimatePresence>
        {showTooltip && (
          <motion.div
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 5 }}
            className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-50 pointer-events-none"
          >
            <div className="glass-dark px-4 py-3 rounded-xl min-w-[200px] shadow-xl border border-white/10">
              <div className="flex items-center gap-2 mb-2">
                {Icon && <Icon className={`w-5 h-5 ${colors.text}`} />}
                <span className="font-display font-bold text-cream">{label}</span>
              </div>
              <p className="text-xs text-cream-muted mb-2">{description}</p>
              <div className="flex items-center justify-between text-xs">
                <span className="text-cream-muted">Max Impact:</span>
                <span className="font-mono text-gold-400">±{maxImpact}%</span>
              </div>
              <div className="flex items-center justify-between text-xs mt-1">
                <span className="text-cream-muted">Current:</span>
                <span className={`font-mono font-bold ${colors.text}`}>{displayValue}</span>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

// ============================================================================
// EXECUTION MULTIPLIER BREAKDOWN - Full factor visualization
// ============================================================================
export const ExecutionMultiplierBreakdown = ({
  breakdown = {},
  finalMultiplier = 1.0,
  isExpanded = false,
  onToggle
}) => {
  const factors = [
    { key: 'readiness', label: 'Readiness', icon: Target, maxImpact: 12, description: 'Section preparedness from rehearsals' },
    { key: 'staff', label: 'Staff', icon: Users, maxImpact: 8, description: 'Coaching quality and specialization' },
    { key: 'equipment', label: 'Equipment', icon: Wrench, maxImpact: 5, description: 'Instrument and uniform condition' },
    { key: 'morale', label: 'Morale', icon: Heart, maxImpact: 8, description: 'Corps mental state and energy' },
    { key: 'showDifficulty', label: 'Difficulty', icon: Zap, maxImpact: 15, description: 'Risk/reward from show design' },
    { key: 'randomVariance', label: 'Daily Luck', icon: Sparkles, maxImpact: 2, description: 'Unpredictable factors (weather, nerves)' },
    { key: 'championshipPressure', label: 'Pressure', icon: Flame, maxImpact: 2, description: 'Finals week pressure handling' },
    { key: 'fatigue', label: 'Fatigue', icon: Snowflake, maxImpact: 5, description: 'Late season exhaustion' },
    { key: 'travelCondition', label: 'Travel', icon: Bus, maxImpact: 3, description: 'Bus and truck condition' },
  ];

  const getMultiplierStatus = () => {
    if (finalMultiplier >= 1.05) return { label: 'ELITE', color: 'text-green-400', bg: 'bg-green-500/20' };
    if (finalMultiplier >= 0.95) return { label: 'STRONG', color: 'text-gold-400', bg: 'bg-gold-500/20' };
    if (finalMultiplier >= 0.85) return { label: 'FAIR', color: 'text-yellow-400', bg: 'bg-yellow-500/20' };
    return { label: 'WEAK', color: 'text-red-400', bg: 'bg-red-500/20' };
  };

  const status = getMultiplierStatus();
  const totalBonus = Object.values(breakdown).reduce((sum, val) => sum + (val || 0), 0);

  return (
    <div className="space-y-4">
      {/* Header with final multiplier */}
      <div
        className="flex items-center justify-between cursor-pointer group"
        onClick={onToggle}
      >
        <div className="flex items-center gap-3">
          <div className={`px-3 py-1.5 rounded-lg ${status.bg} border border-white/10`}>
            <span className={`text-xs font-display font-bold uppercase tracking-wider ${status.color}`}>
              {status.label}
            </span>
          </div>
          <div>
            <div className={`text-3xl font-display font-bold ${status.color}`} style={{ textShadow: '0 0 20px currentColor' }}>
              {finalMultiplier.toFixed(2)}x
            </div>
            <div className="text-[10px] text-cream-muted uppercase tracking-wider">
              Execution Multiplier
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 text-cream-muted group-hover:text-gold-400 transition-colors">
          <span className="text-xs font-display uppercase">
            {isExpanded ? 'Hide' : 'Show'} Breakdown
          </span>
          <ChevronRight className={`w-5 h-5 transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
        </div>
      </div>

      {/* Expanded breakdown */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="glass-dark rounded-xl p-4 space-y-4">
              {/* Formula visualization */}
              <div className="flex items-center gap-2 text-sm text-cream-muted font-mono overflow-x-auto pb-2">
                <span className="text-cream">1.00</span>
                {factors.map(({ key }) => {
                  const val = breakdown[key];
                  if (val === undefined || val === 0) return null;
                  return (
                    <span key={key} className={val >= 0 ? 'text-green-400' : 'text-red-400'}>
                      {val >= 0 ? '+' : ''}{(val * 100).toFixed(1)}%
                    </span>
                  );
                })}
                <span className="text-cream">=</span>
                <span className={`font-bold ${status.color}`}>{finalMultiplier.toFixed(2)}</span>
              </div>

              {/* Factor badges grid */}
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                {factors.map(({ key, label, icon, maxImpact, description }) => {
                  const value = breakdown[key];
                  if (value === undefined) return null;
                  return (
                    <MultiplierBadge
                      key={key}
                      value={value}
                      label={label}
                      icon={icon}
                      maxImpact={maxImpact}
                      description={description}
                    />
                  );
                })}
              </div>

              {/* Summary bar */}
              <div className="flex items-center justify-between pt-2 border-t border-white/10">
                <span className="text-xs text-cream-muted">Net Effect from Base</span>
                <span className={`font-mono font-bold ${totalBonus >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                  {totalBonus >= 0 ? '+' : ''}{(totalBonus * 100).toFixed(1)}%
                </span>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

// ============================================================================
// THRESHOLD METER - Shows current vs required threshold
// ============================================================================
export const ThresholdMeter = ({
  current,
  threshold,
  label,
  bonusValue,
  penaltyValue,
  description
}) => {
  const isPrepared = current >= threshold;
  const percentage = Math.round(current * 100);
  const thresholdPercentage = Math.round(threshold * 100);
  const gap = Math.round((threshold - current) * 100);

  return (
    <div className="glass-dark rounded-xl p-4 space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-sm font-display font-bold text-cream uppercase">{label}</span>
        <div className={`flex items-center gap-2 px-2 py-1 rounded-lg ${isPrepared ? 'bg-green-500/20' : 'bg-red-500/20'}`}>
          {isPrepared ? (
            <CheckCircle className="w-4 h-4 text-green-400" />
          ) : (
            <XCircle className="w-4 h-4 text-red-400" />
          )}
          <span className={`text-xs font-bold ${isPrepared ? 'text-green-400' : 'text-red-400'}`}>
            {isPrepared ? 'PREPARED' : `NEED ${gap}% MORE`}
          </span>
        </div>
      </div>

      {/* Progress bar with threshold marker */}
      <div className="relative">
        <div className="w-full h-4 bg-charcoal-800 rounded-full overflow-hidden">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${percentage}%` }}
            transition={{ duration: 0.8, ease: 'easeOut' }}
            className={`h-full ${isPrepared ? 'bg-green-500' : 'bg-orange-500'}`}
            style={{
              boxShadow: isPrepared
                ? '0 0 10px rgba(74, 222, 128, 0.5)'
                : '0 0 10px rgba(251, 146, 60, 0.5)'
            }}
          />
        </div>
        {/* Threshold marker */}
        <div
          className="absolute top-0 h-4 w-1 bg-white rounded-full shadow-lg"
          style={{ left: `${thresholdPercentage}%`, transform: 'translateX(-50%)' }}
        />
        {/* Threshold label */}
        <div
          className="absolute -bottom-5 text-[9px] text-cream-muted font-mono"
          style={{ left: `${thresholdPercentage}%`, transform: 'translateX(-50%)' }}
        >
          {thresholdPercentage}%
        </div>
      </div>

      {/* Current value */}
      <div className="flex items-center justify-between text-sm pt-2">
        <span className="text-cream-muted">Your Readiness</span>
        <span className={`font-mono font-bold ${isPrepared ? 'text-green-400' : 'text-orange-400'}`}>
          {percentage}%
        </span>
      </div>

      {/* Outcome preview */}
      <div className="grid grid-cols-2 gap-2 pt-2 border-t border-white/10">
        <div className={`p-2 rounded-lg ${isPrepared ? 'bg-green-500/10 border border-green-500/30' : 'bg-charcoal-800/50'}`}>
          <div className="text-[10px] text-cream-muted uppercase">If Prepared</div>
          <div className={`font-mono font-bold ${isPrepared ? 'text-green-400' : 'text-cream-muted/50'}`}>
            +{(bonusValue * 100).toFixed(0)}% Bonus
          </div>
        </div>
        <div className={`p-2 rounded-lg ${!isPrepared ? 'bg-red-500/10 border border-red-500/30' : 'bg-charcoal-800/50'}`}>
          <div className="text-[10px] text-cream-muted uppercase">If Unprepared</div>
          <div className={`font-mono font-bold ${!isPrepared ? 'text-red-400' : 'text-cream-muted/50'}`}>
            {(penaltyValue * 100).toFixed(0)}% Penalty
          </div>
        </div>
      </div>

      {description && (
        <p className="text-[10px] text-cream-muted/60 italic">{description}</p>
      )}
    </div>
  );
};

// ============================================================================
// STATUS LIGHT - For boolean states (on/off, locked/unlocked)
// ============================================================================
export const StatusLight = ({
  isActive,
  activeLabel,
  inactiveLabel,
  activeColor = 'green',
  inactiveColor = 'gray',
  icon: Icon,
  pulse = true,
  size = 'md'
}) => {
  const colorMap = {
    green: { bg: 'bg-green-500', glow: 'shadow-green-500/50' },
    red: { bg: 'bg-red-500', glow: 'shadow-red-500/50' },
    gold: { bg: 'bg-gold-500', glow: 'shadow-gold-500/50' },
    blue: { bg: 'bg-blue-500', glow: 'shadow-blue-500/50' },
    orange: { bg: 'bg-orange-500', glow: 'shadow-orange-500/50' },
    gray: { bg: 'bg-gray-600', glow: '' },
  };

  const sizeMap = {
    sm: 'w-2 h-2',
    md: 'w-3 h-3',
    lg: 'w-4 h-4',
  };

  const activeColors = colorMap[activeColor];
  const inactiveColors = colorMap[inactiveColor];
  const current = isActive ? activeColors : inactiveColors;

  return (
    <div className="flex items-center gap-2">
      <div className="relative">
        <div
          className={`${sizeMap[size]} rounded-full ${current.bg} ${isActive && pulse ? 'animate-pulse' : ''}`}
          style={{ boxShadow: isActive ? `0 0 8px 2px ${current.glow}` : undefined }}
        />
      </div>
      {Icon && <Icon className={`w-4 h-4 ${isActive ? 'text-cream' : 'text-cream-muted/50'}`} />}
      <span className={`text-xs font-display font-bold uppercase ${isActive ? 'text-cream' : 'text-cream-muted/50'}`}>
        {isActive ? activeLabel : inactiveLabel}
      </span>
    </div>
  );
};

// ============================================================================
// RATE OF CHANGE INDICATOR - For resource flows
// ============================================================================
export const RateIndicator = ({
  value,
  rate,
  unit = '',
  rateUnit = '/day',
  label,
  icon: Icon,
  color = 'gold'
}) => {
  const isPositive = rate > 0;
  const isNeutral = rate === 0;

  const colorMap = {
    gold: 'text-gold-400',
    blue: 'text-blue-400',
    green: 'text-green-400',
    purple: 'text-purple-400',
  };

  return (
    <div className="flex items-center gap-3">
      {Icon && <Icon className={`w-5 h-5 ${colorMap[color]}`} />}
      <div>
        <div className="flex items-center gap-2">
          <span className={`text-xl font-mono font-bold ${colorMap[color]}`}>
            {typeof value === 'number' ? value.toLocaleString() : value}{unit}
          </span>
          {rate !== undefined && (
            <span className={`text-xs font-mono flex items-center gap-0.5 ${
              isPositive ? 'text-green-400' : isNeutral ? 'text-cream-muted' : 'text-red-400'
            }`}>
              {isPositive ? <TrendingUp className="w-3 h-3" /> :
               isNeutral ? <Minus className="w-3 h-3" /> :
               <TrendingDown className="w-3 h-3" />}
              {isPositive ? '+' : ''}{rate}{rateUnit}
            </span>
          )}
        </div>
        {label && (
          <span className="text-[10px] font-display uppercase tracking-wider text-cream-muted">
            {label}
          </span>
        )}
      </div>
    </div>
  );
};

// ============================================================================
// TEMPORAL EFFECTS BAR - Fatigue, pressure, locks
// ============================================================================
export const TemporalEffectsBar = ({
  currentDay,
  showDifficulty,
  morale
}) => {
  // Calculate fatigue (days 35-49)
  const isFatigueActive = currentDay > 35;
  const fatigueLevel = isFatigueActive ? Math.min((currentDay - 35) / 14, 1) : 0;
  const fatiguePenalty = -(fatigueLevel * 0.05);

  // Championship pressure (days 47-49)
  const isChampionshipWeek = currentDay >= 47 && currentDay <= 49;
  const pressureHandling = morale?.overall || 0.80;
  const pressureEffect = isChampionshipWeek ? (pressureHandling - 0.80) * 0.10 : 0;

  // Difficulty lock (after day 10)
  const isDifficultyLocked = currentDay > 10;

  return (
    <div className="glass-dark rounded-xl p-4">
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm font-display font-bold text-cream uppercase">Temporal Effects</span>
        <span className="text-xs text-cream-muted font-mono">Day {currentDay}/49</span>
      </div>

      <div className="grid grid-cols-3 gap-4">
        {/* Fatigue */}
        <div className="space-y-2">
          <StatusLight
            isActive={isFatigueActive}
            activeLabel="ACTIVE"
            inactiveLabel="INACTIVE"
            activeColor="orange"
            icon={Snowflake}
            size="sm"
          />
          <div className="text-[10px] text-cream-muted">Late Season Fatigue</div>
          {isFatigueActive && (
            <div className="text-xs font-mono text-orange-400">
              {(fatiguePenalty * 100).toFixed(1)}% penalty
            </div>
          )}
          <div className="text-[9px] text-cream-muted/50">Days 35-49</div>
        </div>

        {/* Championship Pressure */}
        <div className="space-y-2">
          <StatusLight
            isActive={isChampionshipWeek}
            activeLabel="FINALS"
            inactiveLabel="OFF"
            activeColor="red"
            icon={Flame}
            size="sm"
          />
          <div className="text-[10px] text-cream-muted">Championship Pressure</div>
          {isChampionshipWeek && (
            <div className={`text-xs font-mono ${pressureEffect >= 0 ? 'text-green-400' : 'text-red-400'}`}>
              {pressureEffect >= 0 ? '+' : ''}{(pressureEffect * 100).toFixed(1)}%
            </div>
          )}
          <div className="text-[9px] text-cream-muted/50">Days 47-49</div>
        </div>

        {/* Difficulty Lock */}
        <div className="space-y-2">
          <StatusLight
            isActive={isDifficultyLocked}
            activeLabel="LOCKED"
            inactiveLabel="OPEN"
            activeColor="red"
            inactiveColor="green"
            icon={isDifficultyLocked ? Lock : Unlock}
            size="sm"
            pulse={false}
          />
          <div className="text-[10px] text-cream-muted">Show Difficulty</div>
          <div className="text-xs font-mono text-cream-muted">
            {showDifficulty?.difficulty || 'moderate'}
          </div>
          <div className="text-[9px] text-cream-muted/50">Locks day 10</div>
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// CAPTION-EQUIPMENT MAPPING - Shows which equipment affects which captions
// ============================================================================
export const CaptionEquipmentMap = ({ equipment }) => {
  const mapping = [
    {
      type: 'instruments',
      label: 'Instruments',
      icon: '🎺',
      captions: ['B', 'MA', 'P'],
      condition: equipment?.instruments || 0.90
    },
    {
      type: 'uniforms',
      label: 'Uniforms',
      icon: '👔',
      captions: ['VP', 'VA'],
      condition: equipment?.uniforms || 0.90
    },
    {
      type: 'props',
      label: 'Props',
      icon: '🎨',
      captions: ['CG'],
      condition: equipment?.props || 0.90
    },
  ];

  const getConditionColor = (cond) => {
    if (cond >= 0.90) return 'text-green-400';
    if (cond >= 0.70) return 'text-yellow-400';
    return 'text-red-400';
  };

  return (
    <div className="space-y-2">
      <div className="text-[10px] font-display font-bold uppercase text-cream-muted mb-2">
        Equipment → Caption Impact
      </div>
      {mapping.map(({ type, label, icon, captions, condition }) => (
        <div key={type} className="flex items-center justify-between py-1.5 border-b border-white/5 last:border-0">
          <div className="flex items-center gap-2">
            <span className="text-lg">{icon}</span>
            <span className="text-xs text-cream">{label}</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex gap-1">
              {captions.map(cap => (
                <span key={cap} className="px-1.5 py-0.5 rounded bg-charcoal-700 text-[9px] font-mono text-cream-muted">
                  {cap}
                </span>
              ))}
            </div>
            <span className={`font-mono text-sm font-bold ${getConditionColor(condition)}`}>
              {Math.round(condition * 100)}%
            </span>
          </div>
        </div>
      ))}
    </div>
  );
};

// Re-export HoverInsights for HUD integration
export {
  HoverTooltip,
  SectionBreakdownTooltip,
  EquipmentBreakdownTooltip,
  StaffEffectivenessTooltip,
  ScoreBreakdownTooltip,
  MultiplierFactorPills,
  TacticalGaugeWithInsight,
} from './HoverInsights';

export default {
  CircularProgressRing,
  SectionGauges,
  MultiplierBadge,
  ExecutionMultiplierBreakdown,
  ThresholdMeter,
  StatusLight,
  RateIndicator,
  TemporalEffectsBar,
  CaptionEquipmentMap,
};
