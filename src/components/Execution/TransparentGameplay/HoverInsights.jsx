// src/components/Execution/TransparentGameplay/HoverInsights.jsx
// Compact hover-based tooltips for HUD integration
// "Details on demand" - clean display, rich hover states

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Target, Heart, Wrench, Users, Music, Zap, Star,
  TrendingUp, TrendingDown, Minus, ChevronRight
} from 'lucide-react';

// ============================================================================
// HOVER TOOLTIP WRAPPER - Reusable tooltip container
// ============================================================================
export const HoverTooltip = ({
  children,
  content,
  position = 'top',
  delay = 150,
  maxWidth = 280
}) => {
  const [show, setShow] = useState(false);
  const [timeoutId, setTimeoutId] = useState(null);

  const handleEnter = () => {
    const id = setTimeout(() => setShow(true), delay);
    setTimeoutId(id);
  };

  const handleLeave = () => {
    if (timeoutId) clearTimeout(timeoutId);
    setShow(false);
  };

  const positionClasses = {
    top: 'bottom-full left-1/2 -translate-x-1/2 mb-2',
    bottom: 'top-full left-1/2 -translate-x-1/2 mt-2',
    left: 'right-full top-1/2 -translate-y-1/2 mr-2',
    right: 'left-full top-1/2 -translate-y-1/2 ml-2',
  };

  return (
    <div
      className="relative inline-block"
      onMouseEnter={handleEnter}
      onMouseLeave={handleLeave}
    >
      {children}
      <AnimatePresence>
        {show && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.15 }}
            className={`absolute z-50 ${positionClasses[position]}`}
            style={{ maxWidth, minWidth: 200 }}
          >
            <div className="glass-dark rounded-lg shadow-xl border border-white/10 overflow-hidden">
              {content}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

// ============================================================================
// SECTION BREAKDOWN TOOLTIP - For Readiness/Morale gauges
// ============================================================================
export const SectionBreakdownTooltip = ({
  children,
  type = 'readiness',
  sections = {},
  impact = '±12%'
}) => {
  const sectionConfig = [
    { key: 'brass', label: 'Brass', icon: Music, captions: 'B, MA' },
    { key: 'percussion', label: 'Percussion', icon: Zap, captions: 'P' },
    { key: 'guard', label: 'Guard', icon: Star, captions: 'VP, VA, CG' },
    { key: type === 'readiness' ? 'ensemble' : 'overall', label: type === 'readiness' ? 'Ensemble' : 'Overall', icon: Users, captions: 'GE1, GE2' },
  ];

  const getColor = (val) => {
    if (val >= 0.90) return 'text-green-400';
    if (val >= 0.75) return 'text-yellow-400';
    return 'text-red-400';
  };

  const content = (
    <div className="p-3">
      <div className="flex items-center justify-between mb-2 pb-2 border-b border-white/10">
        <span className="text-xs font-display font-bold text-cream uppercase">
          {type === 'readiness' ? 'Section Readiness' : 'Section Morale'}
        </span>
        <span className="text-[9px] text-gold-400 font-mono">{impact} impact</span>
      </div>
      <div className="space-y-1.5">
        {sectionConfig.map(({ key, label, icon: Icon, captions }) => {
          const value = sections[key] ?? 0.75;
          return (
            <div key={key} className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Icon className="w-3 h-3 text-cream-muted" />
                <span className="text-[11px] text-cream">{label}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[9px] text-cream-muted">{captions}</span>
                <span className={`text-xs font-mono font-bold ${getColor(value)}`}>
                  {Math.round(value * 100)}%
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );

  return (
    <HoverTooltip content={content} position="top">
      {children}
    </HoverTooltip>
  );
};

// ============================================================================
// EQUIPMENT BREAKDOWN TOOLTIP - Shows caption mapping
// ============================================================================
export const EquipmentBreakdownTooltip = ({
  children,
  equipment = {}
}) => {
  const mapping = [
    { id: 'instruments', label: 'Instruments', icon: '🎺', captions: ['B', 'MA', 'P'] },
    { id: 'uniforms', label: 'Uniforms', icon: '👔', captions: ['VP', 'VA'] },
    { id: 'props', label: 'Props', icon: '🎨', captions: ['CG'] },
  ];

  const getColor = (val) => {
    if (val >= 0.90) return 'text-green-400';
    if (val >= 0.75) return 'text-yellow-400';
    return 'text-red-400';
  };

  // Calculate travel health
  const busCondition = equipment?.bus || 0.90;
  const truckCondition = equipment?.truck || 0.90;
  const travelHealth = busCondition + truckCondition;
  const hasTravelPenalty = travelHealth < 1.40;

  const content = (
    <div className="p-3">
      <div className="flex items-center justify-between mb-2 pb-2 border-b border-white/10">
        <span className="text-xs font-display font-bold text-cream uppercase">
          Equipment → Captions
        </span>
        <span className="text-[9px] text-gold-400 font-mono">±5% impact</span>
      </div>
      <div className="space-y-1.5">
        {mapping.map(({ id, label, icon, captions }) => {
          const value = equipment?.[id] || 0.90;
          return (
            <div key={id} className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-sm">{icon}</span>
                <span className="text-[11px] text-cream">{label}</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="flex gap-0.5">
                  {captions.map(c => (
                    <span key={c} className="px-1 py-0.5 bg-charcoal-700 rounded text-[8px] font-mono text-cream-muted">
                      {c}
                    </span>
                  ))}
                </div>
                <span className={`text-xs font-mono font-bold ${getColor(value)}`}>
                  {Math.round(value * 100)}%
                </span>
              </div>
            </div>
          );
        })}
      </div>
      {/* Travel health indicator */}
      <div className={`mt-2 pt-2 border-t border-white/10 flex items-center justify-between ${hasTravelPenalty ? 'text-red-400' : 'text-green-400'}`}>
        <span className="text-[10px]">Travel Health</span>
        <span className="text-[10px] font-mono font-bold">
          {hasTravelPenalty ? '-3% penalty' : 'No penalty'}
        </span>
      </div>
    </div>
  );

  return (
    <HoverTooltip content={content} position="top">
      {children}
    </HoverTooltip>
  );
};

// ============================================================================
// STAFF EFFECTIVENESS TOOLTIP - Quick staff summary
// ============================================================================
export const StaffEffectivenessTooltip = ({
  children,
  assignedStaff = [],
  totalImpact = 0
}) => {
  const maxStaff = 8;
  const assignedCount = assignedStaff.length;
  const unassignedPenalty = (maxStaff - assignedCount) * -0.01; // -1% per missing

  // Count specialty matches
  const specialtyMatches = assignedStaff.filter(s =>
    s.caption === s.assignedTo?.caption
  ).length;

  const content = (
    <div className="p-3">
      <div className="flex items-center justify-between mb-2 pb-2 border-b border-white/10">
        <span className="text-xs font-display font-bold text-cream uppercase">
          Staff Effectiveness
        </span>
        <span className="text-[9px] text-gold-400 font-mono">±8% impact</span>
      </div>
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-[11px] text-cream">Coverage</span>
          <span className={`text-xs font-mono font-bold ${assignedCount >= 6 ? 'text-green-400' : 'text-yellow-400'}`}>
            {assignedCount}/{maxStaff}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-[11px] text-cream">Specialty Matches</span>
          <span className={`text-xs font-mono font-bold ${specialtyMatches >= 4 ? 'text-green-400' : 'text-yellow-400'}`}>
            {specialtyMatches} (+15% each)
          </span>
        </div>
        {assignedCount < maxStaff && (
          <div className="flex items-center justify-between text-red-400">
            <span className="text-[11px]">Unassigned Penalty</span>
            <span className="text-xs font-mono font-bold">
              {(unassignedPenalty * 100).toFixed(0)}%
            </span>
          </div>
        )}
      </div>
      <div className="mt-2 pt-2 border-t border-white/10 flex items-center justify-between">
        <span className="text-[10px] text-cream-muted">Net Impact</span>
        <span className={`text-sm font-mono font-bold ${totalImpact >= 0 ? 'text-green-400' : 'text-red-400'}`}>
          {totalImpact >= 0 ? '+' : ''}{(totalImpact * 100).toFixed(1)}%
        </span>
      </div>
    </div>
  );

  return (
    <HoverTooltip content={content} position="top">
      {children}
    </HoverTooltip>
  );
};

// ============================================================================
// SCORE BREAKDOWN TOOLTIP - Shows score calculation
// ============================================================================
export const ScoreBreakdownTooltip = ({
  children,
  baseScore = 0,
  multiplier = 1.0,
  synergyBonus = 0,
  finalScore = 0
}) => {
  const multiplierEffect = baseScore * (multiplier - 1);

  const content = (
    <div className="p-3">
      <div className="text-xs font-display font-bold text-cream uppercase mb-2 pb-2 border-b border-white/10">
        Score Calculation
      </div>
      <div className="space-y-1.5 font-mono text-[11px]">
        <div className="flex items-center justify-between">
          <span className="text-cream-muted">Base Score</span>
          <span className="text-cream">{baseScore.toFixed(1)}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-cream-muted">× Multiplier ({multiplier.toFixed(2)}x)</span>
          <span className={multiplierEffect >= 0 ? 'text-green-400' : 'text-red-400'}>
            {multiplierEffect >= 0 ? '+' : ''}{multiplierEffect.toFixed(1)}
          </span>
        </div>
        {synergyBonus > 0 && (
          <div className="flex items-center justify-between">
            <span className="text-cream-muted">+ Synergy Bonus</span>
            <span className="text-gold-400">+{synergyBonus.toFixed(1)}</span>
          </div>
        )}
        <div className="flex items-center justify-between pt-2 border-t border-white/10">
          <span className="text-cream font-bold">Final Score</span>
          <span className="text-gold-400 font-bold text-sm">{finalScore.toFixed(1)}</span>
        </div>
      </div>
    </div>
  );

  return (
    <HoverTooltip content={content} position="top">
      {children}
    </HoverTooltip>
  );
};

// ============================================================================
// MULTIPLIER FACTOR PILLS - Compact inline factor display
// ============================================================================
export const MultiplierFactorPills = ({
  breakdown = {},
  compact = true
}) => {
  const factors = [
    { key: 'readiness', label: 'RDY', icon: Target },
    { key: 'morale', label: 'MRL', icon: Heart },
    { key: 'equipment', label: 'EQP', icon: Wrench },
    { key: 'staff', label: 'STF', icon: Users },
    { key: 'showDifficulty', label: 'DIF', icon: Zap },
  ];

  const getFactorColor = (val) => {
    if (val > 0.02) return 'bg-green-500/20 text-green-400 border-green-500/30';
    if (val > 0) return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
    if (val > -0.02) return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30';
    return 'bg-red-500/20 text-red-400 border-red-500/30';
  };

  const getIcon = (val) => {
    if (val > 0) return TrendingUp;
    if (val < 0) return TrendingDown;
    return Minus;
  };

  return (
    <div className="flex flex-wrap gap-1 justify-center">
      {factors.map(({ key, label, icon: Icon }) => {
        const value = breakdown[key];
        if (value === undefined || (compact && Math.abs(value) < 0.005)) return null;

        const TrendIcon = getIcon(value);

        return (
          <div
            key={key}
            className={`flex items-center gap-1 px-1.5 py-0.5 rounded border text-[9px] font-mono ${getFactorColor(value)}`}
            title={`${label}: ${value >= 0 ? '+' : ''}${(value * 100).toFixed(1)}%`}
          >
            <Icon className="w-2.5 h-2.5" />
            <TrendIcon className="w-2 h-2" />
            <span>{Math.abs(value * 100).toFixed(0)}</span>
          </div>
        );
      })}
    </div>
  );
};

// ============================================================================
// ENHANCED TACTICAL GAUGE - With hover breakdown
// ============================================================================
export const TacticalGaugeWithInsight = ({
  value,
  label,
  icon: Icon,
  color = 'blue',
  sections = null,
  equipment = null,
  type = 'default',
  onClick
}) => {
  const percentage = Math.round(value * 100);

  const colorMap = {
    blue: { bar: 'bg-blue-500', glow: 'shadow-blue-500/30', text: 'text-blue-400' },
    red: { bar: 'bg-red-500', glow: 'shadow-red-500/30', text: 'text-red-400' },
    orange: { bar: 'bg-orange-500', glow: 'shadow-orange-500/30', text: 'text-orange-400' },
    green: { bar: 'bg-green-500', glow: 'shadow-green-500/30', text: 'text-green-400' },
    gold: { bar: 'bg-gold-500', glow: 'shadow-gold-500/30', text: 'text-gold-400' },
  };

  const colors = colorMap[color] || colorMap.blue;

  const GaugeContent = (
    <div
      className={`group cursor-pointer transition-transform hover:scale-[1.02] ${onClick ? '' : ''}`}
      onClick={onClick}
    >
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <Icon className={`w-4 h-4 ${colors.text}`} />
          <span className="text-xs font-display font-bold text-cream uppercase tracking-wide">
            {label}
          </span>
        </div>
        <span className={`text-lg font-mono font-bold ${colors.text}`}>
          {percentage}%
        </span>
      </div>
      <div className="relative h-2 bg-charcoal-800 rounded-full overflow-hidden">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${percentage}%` }}
          transition={{ duration: 0.8, ease: 'easeOut' }}
          className={`absolute inset-y-0 left-0 ${colors.bar} rounded-full`}
          style={{ boxShadow: `0 0 10px ${colors.glow}` }}
        />
      </div>
      {/* Hover hint */}
      <div className="flex items-center justify-center mt-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <span className="text-[8px] text-cream-muted uppercase tracking-wider flex items-center gap-1">
          <ChevronRight className="w-2 h-2" /> Hover for breakdown
        </span>
      </div>
    </div>
  );

  // Wrap with appropriate tooltip based on type
  if (type === 'readiness' && sections) {
    return (
      <SectionBreakdownTooltip type="readiness" sections={sections}>
        {GaugeContent}
      </SectionBreakdownTooltip>
    );
  }

  if (type === 'morale' && sections) {
    return (
      <SectionBreakdownTooltip type="morale" sections={sections}>
        {GaugeContent}
      </SectionBreakdownTooltip>
    );
  }

  if (type === 'equipment' && equipment) {
    return (
      <EquipmentBreakdownTooltip equipment={equipment}>
        {GaugeContent}
      </EquipmentBreakdownTooltip>
    );
  }

  return GaugeContent;
};

export default {
  HoverTooltip,
  SectionBreakdownTooltip,
  EquipmentBreakdownTooltip,
  StaffEffectivenessTooltip,
  ScoreBreakdownTooltip,
  MultiplierFactorPills,
  TacticalGaugeWithInsight,
};
