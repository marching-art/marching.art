// src/components/Dashboard/RichActionModule.jsx
// Rich Action Module - Data-dense action tiles for 3x2 Quick Actions grid
import React from 'react';
import { motion } from 'framer-motion';
import { Check, TrendingUp, TrendingDown, Minus } from 'lucide-react';

// Color configurations
const colorClasses = {
  gold: {
    icon: 'text-gold-400',
    bg: 'bg-gold-500/20',
    border: 'border-gold-500/30',
    hover: 'hover:bg-gold-500/30',
    text: 'text-data-gold',
    fill: 'bg-gold-500',
    ring: 'stroke-gold-500',
    ringBg: 'stroke-gold-500/20',
  },
  blue: {
    icon: 'text-blue-400',
    bg: 'bg-blue-500/20',
    border: 'border-blue-500/30',
    hover: 'hover:bg-blue-500/30',
    text: 'text-data-blue',
    fill: 'bg-blue-500',
    ring: 'stroke-blue-500',
    ringBg: 'stroke-blue-500/20',
  },
  green: {
    icon: 'text-green-400',
    bg: 'bg-green-500/20',
    border: 'border-green-500/30',
    hover: 'hover:bg-green-500/30',
    text: 'text-data-success',
    fill: 'bg-green-500',
    ring: 'stroke-green-500',
    ringBg: 'stroke-green-500/20',
  },
  purple: {
    icon: 'text-purple-400',
    bg: 'bg-purple-500/20',
    border: 'border-purple-500/30',
    hover: 'hover:bg-purple-500/30',
    text: 'text-data-purple',
    fill: 'bg-purple-500',
    ring: 'stroke-purple-500',
    ringBg: 'stroke-purple-500/20',
  },
  orange: {
    icon: 'text-orange-400',
    bg: 'bg-orange-500/20',
    border: 'border-orange-500/30',
    hover: 'hover:bg-orange-500/30',
    text: 'text-data-orange',
    fill: 'bg-orange-500',
    ring: 'stroke-orange-500',
    ringBg: 'stroke-orange-500/20',
  },
};

// ============================================================================
// DATA GRAPHICS - Specific visualizations for each module
// ============================================================================

// Rehearse: Segmented progress bar showing readiness gain
const ReadinessGainBar = ({ currentReadiness = 0.75, potentialGain = 0.05, color = 'blue' }) => {
  const currentPercent = Math.round(currentReadiness * 100);
  const gainPercent = Math.round(potentialGain * 100);
  const totalPercent = Math.min(100, currentPercent + gainPercent);

  return (
    <div className="w-full space-y-1">
      <div className="h-3 bg-white/10 rounded-full overflow-hidden relative">
        {/* Current readiness */}
        <div
          className="absolute h-full bg-blue-500/60 rounded-full"
          style={{ width: `${currentPercent}%` }}
        />
        {/* Potential gain overlay */}
        <motion.div
          className="absolute h-full bg-blue-400 rounded-full"
          style={{ left: `${currentPercent}%`, width: `${gainPercent}%` }}
          animate={{ opacity: [0.5, 1, 0.5] }}
          transition={{ duration: 1.5, repeat: Infinity }}
        />
      </div>
      <div className="flex justify-between text-[9px]">
        <span className="text-cream/40">{currentPercent}%</span>
        <span className="text-blue-400 font-bold">→ {totalPercent}%</span>
      </div>
    </div>
  );
};

// Staff: Roster slots (8 dots)
const RosterSlots = ({ filled = 4, max = 8, color = 'green' }) => {
  const colors = colorClasses[color];
  return (
    <div className="w-full space-y-1.5">
      <div className="flex justify-center gap-1.5">
        {Array.from({ length: max }).map((_, i) => (
          <div
            key={i}
            className={`w-3 h-3 rounded-full border-2 transition-colors ${
              i < filled
                ? `${colors.fill} border-transparent`
                : 'bg-transparent border-white/20'
            }`}
          />
        ))}
      </div>
      <div className="text-center text-[9px] text-cream/40">
        {filled < 4 && <span className="text-orange-400">Need {4 - filled} more</span>}
        {filled >= 4 && filled < 6 && <span className="text-cream/40">+2% bonus</span>}
        {filled >= 6 && <span className="text-green-400">+4% bonus</span>}
      </div>
    </div>
  );
};

// Equipment: Health bar colored by condition
const ConditionHealthBar = ({ condition = 0.89 }) => {
  const percent = Math.round(condition * 100);
  let barColor = 'bg-green-500';
  let textColor = 'text-green-400';
  if (percent < 75) {
    barColor = 'bg-red-500';
    textColor = 'text-red-400';
  } else if (percent < 90) {
    barColor = 'bg-yellow-500';
    textColor = 'text-yellow-400';
  }

  return (
    <div className="w-full space-y-1">
      <div className="h-3 bg-white/10 rounded-full overflow-hidden">
        <motion.div
          className={`h-full ${barColor} rounded-full`}
          initial={{ width: 0 }}
          animate={{ width: `${percent}%` }}
          transition={{ duration: 0.5 }}
        />
      </div>
      <div className="flex justify-between text-[9px]">
        <span className="text-cream/40">Condition</span>
        <span className={`font-bold ${textColor}`}>{percent}%</span>
      </div>
    </div>
  );
};

// Synergy: Glowing multiplier value
const SynergyMultiplier = ({ bonus = 0.5, themeName = '' }) => {
  const isPositive = bonus > 0;
  return (
    <div className="w-full space-y-1">
      <div className="flex items-center justify-center">
        <motion.div
          className={`text-xl font-display font-black ${
            isPositive ? 'text-purple-400' : 'text-cream/40'
          }`}
          animate={isPositive ? { textShadow: ['0 0 10px rgba(168,85,247,0.5)', '0 0 20px rgba(168,85,247,0.8)', '0 0 10px rgba(168,85,247,0.5)'] } : {}}
          transition={{ duration: 2, repeat: Infinity }}
        >
          {isPositive ? '+' : ''}{bonus.toFixed(1)}x
        </motion.div>
      </div>
      <div className="text-center text-[9px] text-cream/40 truncate px-2">
        {themeName ? (themeName.length > 16 ? `${themeName.slice(0, 14)}...` : themeName) : 'abstract'}
      </div>
    </div>
  );
};

// Activities: Circular progress ring (donut chart)
const CircularProgress = ({ completed = 1, total = 3, color = 'gold' }) => {
  const colors = colorClasses[color];
  const percent = total > 0 ? (completed / total) * 100 : 0;
  const circumference = 2 * Math.PI * 20; // radius = 20
  const strokeDashoffset = circumference - (percent / 100) * circumference;

  return (
    <div className="w-full flex flex-col items-center gap-1">
      <div className="relative w-12 h-12">
        <svg className="w-full h-full -rotate-90" viewBox="0 0 48 48">
          {/* Background ring */}
          <circle
            cx="24"
            cy="24"
            r="20"
            fill="none"
            className={colors.ringBg}
            strokeWidth="4"
          />
          {/* Progress ring */}
          <motion.circle
            cx="24"
            cy="24"
            r="20"
            fill="none"
            className={colors.ring}
            strokeWidth="4"
            strokeLinecap="round"
            strokeDasharray={circumference}
            initial={{ strokeDashoffset: circumference }}
            animate={{ strokeDashoffset }}
            transition={{ duration: 0.8, ease: 'easeOut' }}
          />
        </svg>
        {/* Center text */}
        <div className="absolute inset-0 flex items-center justify-center">
          <span className={`text-xs font-bold ${colors.text}`}>
            {completed}/{total}
          </span>
        </div>
      </div>
      <div className="text-[9px] text-cream/40">Daily Tasks</div>
    </div>
  );
};

// Insights: Trend arrow with projected score
const TrendIndicator = ({ trend = 'up', projectedScore = 62.5 }) => {
  const TrendIcon = trend === 'up' ? TrendingUp : trend === 'down' ? TrendingDown : Minus;
  const trendColor = trend === 'up' ? 'text-green-400' : trend === 'down' ? 'text-red-400' : 'text-cream/40';
  const bgColor = trend === 'up' ? 'bg-green-500/20' : trend === 'down' ? 'bg-red-500/20' : 'bg-white/10';

  return (
    <div className="w-full flex items-center justify-center gap-3">
      <div className={`p-1.5 rounded-lg ${bgColor}`}>
        <TrendIcon className={`w-5 h-5 ${trendColor}`} />
      </div>
      <div>
        <div className="text-base font-display font-bold text-cream">
          {projectedScore.toFixed(1)}
        </div>
        <div className="text-[9px] text-cream/40">Projected</div>
      </div>
    </div>
  );
};

// ============================================================================
// MAIN COMPONENT
// ============================================================================

const RichActionModule = ({
  icon: Icon,
  label,
  onClick,
  disabled = false,
  processing = false,
  completed = false,
  color = 'gold',
  // Module-specific props
  moduleType,
  moduleData = {},
}) => {
  const colors = colorClasses[color];

  // Render the appropriate data graphic based on module type
  const renderGraphic = () => {
    switch (moduleType) {
      case 'rehearse':
        return (
          <ReadinessGainBar
            currentReadiness={moduleData.currentReadiness}
            potentialGain={moduleData.potentialGain}
            color={color}
          />
        );
      case 'staff':
        return (
          <RosterSlots
            filled={moduleData.filled}
            max={moduleData.max}
            color={color}
          />
        );
      case 'equipment':
        return (
          <ConditionHealthBar
            condition={moduleData.condition}
          />
        );
      case 'synergy':
        return (
          <SynergyMultiplier
            bonus={moduleData.bonus}
            themeName={moduleData.themeName}
          />
        );
      case 'activities':
        return (
          <CircularProgress
            completed={moduleData.completed}
            total={moduleData.total}
            color={color}
          />
        );
      case 'insights':
        return (
          <TrendIndicator
            trend={moduleData.trend}
            projectedScore={moduleData.projectedScore}
          />
        );
      default:
        return null;
    }
  };

  return (
    <motion.button
      onClick={onClick}
      disabled={disabled || processing}
      whileHover={!disabled && !processing ? { scale: 1.02 } : {}}
      whileTap={!disabled && !processing ? { scale: 0.98 } : {}}
      className={`
        h-full w-full flex flex-col p-4
        bg-black/40 backdrop-blur-md border border-white/10 rounded-lg
        transition-all duration-200
        ${disabled ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer hover:border-white/20'}
        ${completed ? 'border-green-500/40 bg-green-500/10' : ''}
      `}
    >
      {/* Header: Icon + Label */}
      <div className="flex items-center gap-2 mb-3">
        <div className={`p-1.5 rounded-lg ${completed ? 'bg-green-500/20' : colors.bg}`}>
          {processing ? (
            <div className="w-6 h-6 border-2 border-gold-500 border-t-transparent rounded-full animate-spin" />
          ) : completed ? (
            <Check className="w-6 h-6 text-green-400" />
          ) : (
            <Icon className={`w-6 h-6 ${colors.icon}`} />
          )}
        </div>
        <span className="text-sm font-display font-bold text-cream uppercase tracking-wide">
          {label}
        </span>
      </div>

      {/* Data Graphic */}
      <div className="flex-1 flex items-center justify-center">
        {renderGraphic()}
      </div>
    </motion.button>
  );
};

export default RichActionModule;
