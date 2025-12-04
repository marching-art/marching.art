// src/components/Execution/TransparentGameplay/SegmentedMetricBar.jsx
// "Split-Signal" Segmented Bars for Readiness & Morale
// Shows 4 subsections (B, P, G, E) in a space-efficient HUD design

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Target, Heart, Music, Zap, Star, Users, AlertTriangle } from 'lucide-react';

// ============================================================================
// SECTION CONFIGURATION - Maps to backend execution system
// ============================================================================
const READINESS_SECTIONS = {
  brass: {
    key: 'brass',
    label: 'Brass',
    abbrev: 'B',
    icon: Music,
    captions: ['B', 'MA'],
    captionNames: 'Brass, Music Analysis',
    description: 'Horn line execution quality',
  },
  percussion: {
    key: 'percussion',
    label: 'Percussion',
    abbrev: 'P',
    icon: Zap,
    captions: ['P'],
    captionNames: 'Percussion',
    description: 'Battery and pit execution',
  },
  guard: {
    key: 'guard',
    label: 'Guard',
    abbrev: 'G',
    icon: Star,
    captions: ['VP', 'VA', 'CG'],
    captionNames: 'Visual Proficiency, Visual Analysis, Color Guard',
    description: 'Color guard and visual execution',
  },
  ensemble: {
    key: 'ensemble',
    label: 'Ensemble',
    abbrev: 'E',
    icon: Users,
    captions: ['GE1', 'GE2'],
    captionNames: 'General Effect 1 & 2',
    description: 'Overall corps cohesion',
  },
};

const MORALE_SECTIONS = {
  brass: {
    key: 'brass',
    label: 'Brass',
    abbrev: 'B',
    icon: Music,
    description: 'Horn line mental state',
    impact: 'Affects brass execution quality',
  },
  percussion: {
    key: 'percussion',
    label: 'Percussion',
    abbrev: 'P',
    icon: Zap,
    description: 'Battery and pit morale',
    impact: 'Affects percussion execution quality',
  },
  guard: {
    key: 'guard',
    label: 'Guard',
    abbrev: 'G',
    icon: Star,
    description: 'Color guard morale',
    impact: 'Affects visual execution quality',
  },
  overall: {
    key: 'overall',
    label: 'Overall',
    abbrev: 'O',
    icon: Heart,
    description: 'Corps-wide morale',
    impact: 'Affects GE scores and pressure handling',
  },
};

// ============================================================================
// SEGMENT TOOLTIP
// ============================================================================
const SegmentTooltip = ({ section, value, type, position }) => {
  const config = type === 'readiness' ? READINESS_SECTIONS[section] : MORALE_SECTIONS[section];
  if (!config) return null;

  const Icon = config.icon;
  const percentage = Math.round(value * 100);

  const getStatusColor = (val) => {
    if (val >= 0.90) return 'text-green-400';
    if (val >= 0.75) return 'text-yellow-400';
    if (val >= 0.60) return 'text-orange-400';
    return 'text-red-400';
  };

  const getStatusLabel = (val) => {
    if (val >= 0.90) return 'Excellent';
    if (val >= 0.75) return 'Good';
    if (val >= 0.60) return 'Fair';
    return 'Needs Work';
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 5, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 5, scale: 0.95 }}
      transition={{ duration: 0.15 }}
      className="absolute z-50 bottom-full left-1/2 -translate-x-1/2 mb-2"
      style={{ minWidth: 200 }}
    >
      <div className="glass-dark rounded-lg shadow-xl border border-white/10 p-3">
        {/* Header */}
        <div className="flex items-center gap-2 mb-2 pb-2 border-b border-white/10">
          <div className={`p-1.5 rounded-lg ${type === 'readiness' ? 'bg-blue-500/20' : 'bg-rose-500/20'}`}>
            <Icon className={`w-4 h-4 ${type === 'readiness' ? 'text-blue-400' : 'text-rose-400'}`} />
          </div>
          <div>
            <div className="text-sm font-display font-bold text-cream">
              {config.label} {type === 'readiness' ? 'Readiness' : 'Morale'}
            </div>
            <div className="text-[9px] text-cream-muted">{config.description}</div>
          </div>
        </div>

        {/* Value */}
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs text-cream-muted">Current Level</span>
          <div className="flex items-center gap-2">
            <span className={`text-lg font-mono font-bold ${getStatusColor(value)}`}>
              {percentage}%
            </span>
            <span className={`text-[9px] font-bold uppercase ${getStatusColor(value)}`}>
              {getStatusLabel(value)}
            </span>
          </div>
        </div>

        {/* Affected Captions (Readiness only) */}
        {type === 'readiness' && config.captions && (
          <div className="pt-2 border-t border-white/10">
            <div className="text-[9px] text-cream-muted mb-1">Affects Captions:</div>
            <div className="flex flex-wrap gap-1">
              {config.captions.map(cap => (
                <span
                  key={cap}
                  className="px-1.5 py-0.5 rounded bg-blue-500/20 text-[9px] font-mono text-blue-400 border border-blue-500/30"
                >
                  {cap}
                </span>
              ))}
            </div>
            <div className="text-[8px] text-cream-muted/60 mt-1">{config.captionNames}</div>
          </div>
        )}

        {/* Impact (Morale only) */}
        {type === 'morale' && config.impact && (
          <div className="pt-2 border-t border-white/10">
            <div className="text-[9px] text-cream-muted">{config.impact}</div>
          </div>
        )}

        {/* Warning if low */}
        {value < 0.60 && (
          <div className="mt-2 pt-2 border-t border-white/10 flex items-center gap-2 text-orange-400">
            <AlertTriangle className="w-3 h-3" />
            <span className="text-[9px]">
              {type === 'readiness' ? 'Schedule rehearsals to improve' : 'Consider morale boost'}
            </span>
          </div>
        )}
      </div>
      {/* Arrow */}
      <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-1">
        <div className="w-2 h-2 bg-charcoal-800 border-r border-b border-white/10 rotate-45" />
      </div>
    </motion.div>
  );
};

// ============================================================================
// SINGLE SEGMENT BAR
// ============================================================================
const SegmentBar = ({ section, value, type, color, isLast }) => {
  const [showTooltip, setShowTooltip] = useState(false);
  const config = type === 'readiness' ? READINESS_SECTIONS[section] : MORALE_SECTIONS[section];
  if (!config) return null;

  const percentage = Math.round(value * 100);

  // Color gradients based on type and value
  const getBarColor = (val) => {
    if (type === 'readiness') {
      if (val >= 0.90) return 'bg-gradient-to-r from-cyan-500 to-blue-500';
      if (val >= 0.75) return 'bg-gradient-to-r from-blue-400 to-cyan-400';
      if (val >= 0.60) return 'bg-gradient-to-r from-yellow-500 to-orange-500';
      return 'bg-gradient-to-r from-red-500 to-orange-500';
    } else {
      if (val >= 0.90) return 'bg-gradient-to-r from-pink-500 to-rose-500';
      if (val >= 0.75) return 'bg-gradient-to-r from-rose-400 to-pink-400';
      if (val >= 0.60) return 'bg-gradient-to-r from-yellow-500 to-orange-500';
      return 'bg-gradient-to-r from-red-500 to-orange-500';
    }
  };

  const getGlowColor = (val) => {
    if (type === 'readiness') {
      return val >= 0.75 ? 'rgba(59, 130, 246, 0.4)' : 'rgba(239, 68, 68, 0.4)';
    }
    return val >= 0.75 ? 'rgba(244, 63, 94, 0.4)' : 'rgba(239, 68, 68, 0.4)';
  };

  return (
    <div
      className="relative flex items-center gap-2 group cursor-pointer"
      onMouseEnter={() => setShowTooltip(true)}
      onMouseLeave={() => setShowTooltip(false)}
    >
      {/* Section Label */}
      <div className={`w-5 h-5 flex items-center justify-center rounded text-[9px] font-mono font-bold ${
        type === 'readiness' ? 'bg-blue-500/20 text-blue-400' : 'bg-rose-500/20 text-rose-400'
      } group-hover:scale-110 transition-transform`}>
        {config.abbrev}
      </div>

      {/* Bar Track */}
      <div className="flex-1 h-2 bg-charcoal-800 rounded-full overflow-hidden relative">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${percentage}%` }}
          transition={{ duration: 0.6, ease: 'easeOut', delay: 0.1 }}
          className={`absolute inset-y-0 left-0 rounded-full ${getBarColor(value)}`}
          style={{ boxShadow: `0 0 8px ${getGlowColor(value)}` }}
        />
        {/* Threshold markers */}
        <div className="absolute inset-0 flex">
          <div className="w-[60%] border-r border-white/10" />
          <div className="w-[15%] border-r border-white/10" />
          <div className="w-[15%] border-r border-white/20" />
        </div>
      </div>

      {/* Percentage */}
      <div className={`w-10 text-right text-xs font-mono font-bold ${
        value >= 0.75 ? (type === 'readiness' ? 'text-blue-400' : 'text-rose-400') :
        value >= 0.60 ? 'text-yellow-400' : 'text-red-400'
      }`}>
        {percentage}%
      </div>

      {/* Tooltip */}
      <AnimatePresence>
        {showTooltip && (
          <SegmentTooltip section={section} value={value} type={type} />
        )}
      </AnimatePresence>
    </div>
  );
};

// ============================================================================
// SEGMENTED METRIC BAR - Main Component
// ============================================================================
export const SegmentedMetricBar = ({
  type = 'readiness', // 'readiness' | 'morale'
  sections = {},
  label,
  icon: LabelIcon,
  showAverage = true,
  compact = false,
}) => {
  const sectionKeys = type === 'readiness'
    ? ['brass', 'percussion', 'guard', 'ensemble']
    : ['brass', 'percussion', 'guard', 'overall'];

  // Calculate average
  const values = sectionKeys.map(key => sections[key] || 0.75);
  const average = values.reduce((sum, val) => sum + val, 0) / values.length;
  const avgPercentage = Math.round(average * 100);

  // Find weakest section
  const weakestIdx = values.indexOf(Math.min(...values));
  const weakestKey = sectionKeys[weakestIdx];
  const weakestConfig = type === 'readiness' ? READINESS_SECTIONS[weakestKey] : MORALE_SECTIONS[weakestKey];

  const Icon = LabelIcon || (type === 'readiness' ? Target : Heart);
  const colorClass = type === 'readiness' ? 'text-blue-400' : 'text-rose-400';
  const bgClass = type === 'readiness' ? 'bg-blue-500/20' : 'bg-rose-500/20';

  return (
    <div className="space-y-2">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className={`p-1.5 rounded-lg ${bgClass}`}>
            <Icon className={`w-4 h-4 ${colorClass}`} style={{ filter: 'drop-shadow(0 0 4px currentColor)' }} />
          </div>
          <span className="text-xs font-display font-bold uppercase tracking-widest text-cream-muted">
            {label || (type === 'readiness' ? 'Readiness' : 'Morale')}
          </span>
        </div>
        {showAverage && (
          <div className="flex items-center gap-2">
            <span className="text-[9px] text-cream-muted uppercase">Avg</span>
            <span className={`text-lg font-mono font-bold ${colorClass}`} style={{ textShadow: '0 0 10px currentColor' }}>
              {avgPercentage}%
            </span>
          </div>
        )}
      </div>

      {/* Segment Bars */}
      <div className={`space-y-1 ${compact ? 'space-y-0.5' : ''}`}>
        {sectionKeys.map((key, idx) => (
          <SegmentBar
            key={key}
            section={key}
            value={sections[key] || 0.75}
            type={type}
            isLast={idx === sectionKeys.length - 1}
          />
        ))}
      </div>

      {/* Weak Link Warning */}
      {values[weakestIdx] < 0.70 && (
        <div className={`flex items-center gap-2 px-2 py-1.5 rounded-lg ${
          type === 'readiness' ? 'bg-blue-500/10 border border-blue-500/20' : 'bg-rose-500/10 border border-rose-500/20'
        }`}>
          <AlertTriangle className="w-3 h-3 text-orange-400" />
          <span className="text-[9px] text-cream-muted">
            <span className="text-orange-400 font-bold">{weakestConfig?.label}</span> is your weak link ({Math.round(values[weakestIdx] * 100)}%)
          </span>
        </div>
      )}
    </div>
  );
};

// ============================================================================
// COMPACT CLUSTER BAR - Ultra-dense 4-segment inline display
// ============================================================================
export const ClusterBar = ({
  type = 'readiness',
  sections = {},
  showLabel = true,
  onClick,
}) => {
  const [hoveredSection, setHoveredSection] = useState(null);

  const sectionKeys = type === 'readiness'
    ? ['brass', 'percussion', 'guard', 'ensemble']
    : ['brass', 'percussion', 'guard', 'overall'];

  const config = type === 'readiness' ? READINESS_SECTIONS : MORALE_SECTIONS;

  // Calculate average
  const values = sectionKeys.map(key => sections[key] || 0.75);
  const average = values.reduce((sum, val) => sum + val, 0) / values.length;

  const getSegmentColor = (val) => {
    if (val >= 0.90) return type === 'readiness' ? 'bg-cyan-400' : 'bg-pink-400';
    if (val >= 0.75) return type === 'readiness' ? 'bg-blue-400' : 'bg-rose-400';
    if (val >= 0.60) return 'bg-yellow-400';
    return 'bg-red-400';
  };

  const Icon = type === 'readiness' ? Target : Heart;
  const colorClass = type === 'readiness' ? 'text-blue-400' : 'text-rose-400';

  return (
    <div
      className={`relative ${onClick ? 'cursor-pointer' : ''}`}
      onClick={onClick}
    >
      {/* Label Row */}
      {showLabel && (
        <div className="flex items-center justify-between mb-1.5">
          <div className="flex items-center gap-1.5">
            <Icon className={`w-3.5 h-3.5 ${colorClass}`} />
            <span className="text-[10px] font-display font-bold uppercase tracking-wide text-cream-muted">
              {type === 'readiness' ? 'Readiness' : 'Morale'}
            </span>
          </div>
          <span className={`text-sm font-mono font-bold ${colorClass}`}>
            {Math.round(average * 100)}%
          </span>
        </div>
      )}

      {/* Cluster Bar */}
      <div className="flex items-center gap-0.5 h-6 bg-charcoal-800 rounded-lg p-0.5 overflow-hidden">
        {sectionKeys.map((key, idx) => {
          const value = sections[key] || 0.75;
          const sectionConfig = config[key];
          const percentage = Math.round(value * 100);

          return (
            <div
              key={key}
              className="relative flex-1 h-full"
              onMouseEnter={() => setHoveredSection(key)}
              onMouseLeave={() => setHoveredSection(null)}
            >
              {/* Segment Fill */}
              <div className="relative h-full bg-charcoal-700 rounded overflow-hidden">
                <motion.div
                  initial={{ height: 0 }}
                  animate={{ height: `${percentage}%` }}
                  transition={{ duration: 0.5, delay: idx * 0.1 }}
                  className={`absolute bottom-0 left-0 right-0 ${getSegmentColor(value)}`}
                  style={{
                    boxShadow: value >= 0.75 ? `0 0 6px ${type === 'readiness' ? 'rgba(59, 130, 246, 0.5)' : 'rgba(244, 63, 94, 0.5)'}` : 'none'
                  }}
                />
                {/* Label */}
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-[8px] font-mono font-bold text-white/80 drop-shadow-md">
                    {sectionConfig.abbrev}
                  </span>
                </div>
              </div>

              {/* Hover Tooltip */}
              <AnimatePresence>
                {hoveredSection === key && (
                  <SegmentTooltip section={key} value={value} type={type} />
                )}
              </AnimatePresence>
            </div>
          );
        })}
      </div>

      {/* Section Labels Below (optional, very compact) */}
      <div className="flex items-center justify-between mt-1 px-1">
        {sectionKeys.map(key => {
          const value = sections[key] || 0.75;
          return (
            <span
              key={key}
              className={`text-[8px] font-mono ${
                value >= 0.75 ? 'text-cream-muted' : 'text-orange-400'
              }`}
            >
              {Math.round(value * 100)}
            </span>
          );
        })}
      </div>
    </div>
  );
};

// ============================================================================
// DUAL CLUSTER DISPLAY - Side-by-side Readiness & Morale
// ============================================================================
export const DualClusterDisplay = ({
  readiness = {},
  morale = {},
  onReadinessClick,
  onMoraleClick,
}) => {
  return (
    <div className="grid grid-cols-2 gap-4">
      <ClusterBar
        type="readiness"
        sections={readiness}
        onClick={onReadinessClick}
      />
      <ClusterBar
        type="morale"
        sections={morale}
        onClick={onMoraleClick}
      />
    </div>
  );
};

// ============================================================================
// INLINE MINI SEGMENTS - Ultra-compact for tight spaces
// ============================================================================
export const InlineMiniSegments = ({
  type = 'readiness',
  sections = {},
  size = 'sm', // 'xs' | 'sm' | 'md'
}) => {
  const sectionKeys = type === 'readiness'
    ? ['brass', 'percussion', 'guard', 'ensemble']
    : ['brass', 'percussion', 'guard', 'overall'];

  const config = type === 'readiness' ? READINESS_SECTIONS : MORALE_SECTIONS;

  const sizeClasses = {
    xs: 'w-3 h-3 text-[6px]',
    sm: 'w-4 h-4 text-[7px]',
    md: 'w-5 h-5 text-[8px]',
  };

  const getColor = (val) => {
    if (val >= 0.90) return type === 'readiness' ? 'bg-cyan-500 text-white' : 'bg-pink-500 text-white';
    if (val >= 0.75) return type === 'readiness' ? 'bg-blue-500 text-white' : 'bg-rose-500 text-white';
    if (val >= 0.60) return 'bg-yellow-500 text-charcoal-900';
    return 'bg-red-500 text-white';
  };

  return (
    <div className="flex items-center gap-0.5">
      {sectionKeys.map(key => {
        const value = sections[key] || 0.75;
        const sectionConfig = config[key];

        return (
          <div
            key={key}
            className={`${sizeClasses[size]} rounded flex items-center justify-center font-mono font-bold ${getColor(value)}`}
            title={`${sectionConfig.label}: ${Math.round(value * 100)}%`}
          >
            {sectionConfig.abbrev}
          </div>
        );
      })}
    </div>
  );
};

export default SegmentedMetricBar;
