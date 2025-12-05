// src/components/Execution/TransparentGameplay/StaffEffectivenessPanel.jsx
// Premium Staff Effectiveness Visualization
// Exposes: caption match, experience bonus, HoF status, morale

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Users, Star, Award, Heart, Target, CheckCircle, XCircle,
  TrendingUp, ChevronRight, Zap, Music, Info
} from 'lucide-react';
import { CircularProgressRing, StatusLight } from './index';

// Caption labels for display
const CAPTION_LABELS = {
  GE1: 'General Effect 1',
  GE2: 'General Effect 2',
  VP: 'Visual Performance',
  VA: 'Visual Analysis',
  CG: 'Color Guard',
  B: 'Brass',
  MA: 'Music Analysis',
  P: 'Percussion'
};

// Staff specialty icons
const CAPTION_ICONS = {
  GE1: Zap,
  GE2: Zap,
  VP: Star,
  VA: Target,
  CG: Star,
  B: Music,
  MA: Target,
  P: Music
};

/**
 * Individual Staff Card with effectiveness breakdown - Glass Slot Style
 */
const StaffCard = ({ staff, assignedCaption, onBoostMorale, boostCost = 150 }) => {
  const [expanded, setExpanded] = useState(false);

  // Calculate effectiveness components
  const isSpecialtyMatch = staff.caption === assignedCaption;
  const specialtyBonus = isSpecialtyMatch ? 0.15 : -0.05;
  const experienceBonus = Math.min((staff.seasonsCompleted || 0) * 0.01, 0.10);
  const isHallOfFame = (staff.baseValue || 0) > 500;
  const hofBonus = isHallOfFame ? 0.05 : 0;
  const morale = staff.morale || 0.90;

  // Base effectiveness + bonuses, multiplied by morale
  const baseEffectiveness = 0.80 + specialtyBonus + experienceBonus + hofBonus;
  const finalEffectiveness = Math.min(baseEffectiveness * morale, 1.00);

  // Impact on caption score (±8% range)
  const captionImpact = (finalEffectiveness - 0.80) * 0.40; // Range: -0.08 to +0.08

  const getEffectivenessColor = (eff) => {
    if (eff >= 0.95) return 'green';
    if (eff >= 0.85) return 'blue';
    if (eff >= 0.75) return 'orange';
    return 'red';
  };

  const CaptionIcon = CAPTION_ICONS[assignedCaption] || Users;

  return (
    <motion.div
      className="glass-slot overflow-hidden"
    >
      {/* Header - always visible */}
      <div
        className="cursor-pointer hover:bg-white/5 transition-colors -m-4 p-4"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-4">
          {/* Staff avatar/icon */}
          <div className="relative">
            <div className="w-10 h-10 rounded-lg bg-black/40 border border-white/10 flex items-center justify-center">
              <span className="text-xl">{staff.avatar || '👤'}</span>
            </div>
            {isHallOfFame && (
              <div className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-gold-500 flex items-center justify-center">
                <Award className="w-2.5 h-2.5 text-charcoal-900" />
              </div>
            )}
          </div>

          {/* Staff info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-sm font-mono font-bold text-cream-100 truncate">
                {staff.name || 'Unknown Staff'}
              </span>
              {isSpecialtyMatch && (
                <span className="px-1.5 py-0.5 rounded bg-green-500/20 border border-green-500/30 text-[9px] font-bold text-green-400 uppercase">
                  Specialty
                </span>
              )}
            </div>
            <div className="flex items-center gap-2 mt-0.5">
              <CaptionIcon className="w-3 h-3 text-cream-100/50" />
              <span className="data-label-sm">
                Teaching: {CAPTION_LABELS[assignedCaption] || assignedCaption}
              </span>
            </div>
          </div>

          {/* Effectiveness gauge */}
          <CircularProgressRing
            value={finalEffectiveness}
            size={44}
            strokeWidth={4}
            color={getEffectivenessColor(finalEffectiveness)}
            showPercentage={true}
          />

          {/* Expand toggle */}
          <ChevronRight className={`accordion-chevron ${expanded ? 'open' : ''}`} />
        </div>
      </div>

      {/* Expanded details */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="pt-4 mt-4 border-t border-white/5 space-y-3">
              {/* Effectiveness breakdown */}
              <div className="grid grid-cols-2 gap-2">
                {/* Caption Match */}
                <div className={`p-3 rounded-lg ${isSpecialtyMatch ? 'bg-green-500/10 border border-green-500/30' : 'bg-red-500/10 border border-red-500/30'}`}>
                  <div className="flex items-center gap-2 mb-1">
                    {isSpecialtyMatch ? (
                      <CheckCircle className="w-3.5 h-3.5 text-green-400" />
                    ) : (
                      <XCircle className="w-3.5 h-3.5 text-red-400" />
                    )}
                    <span className="data-label-sm">Caption Match</span>
                  </div>
                  <div className={`text-sm font-mono font-bold ${isSpecialtyMatch ? 'text-green-400' : 'text-red-400'}`}>
                    {isSpecialtyMatch ? '+15%' : '-5%'}
                  </div>
                </div>

                {/* Experience */}
                <div className="p-3 rounded-lg bg-blue-500/10 border border-blue-500/30">
                  <div className="flex items-center gap-2 mb-1">
                    <TrendingUp className="w-3.5 h-3.5 text-blue-400" />
                    <span className="data-label-sm">Experience</span>
                  </div>
                  <div className="text-sm font-mono font-bold text-blue-400">
                    +{(experienceBonus * 100).toFixed(0)}%
                  </div>
                </div>

                {/* Hall of Fame */}
                <div className={`p-3 rounded-lg ${isHallOfFame ? 'bg-gold-500/10 border border-gold-500/30' : 'bg-black/40 border border-white/5'}`}>
                  <div className="flex items-center gap-2 mb-1">
                    <Award className={`w-3.5 h-3.5 ${isHallOfFame ? 'text-gold-400' : 'text-cream-100/30'}`} />
                    <span className="data-label-sm">Elite Status</span>
                  </div>
                  <div className={`text-sm font-mono font-bold ${isHallOfFame ? 'text-gold-400' : 'text-cream-100/30'}`}>
                    {isHallOfFame ? '+5%' : '+0%'}
                  </div>
                </div>

                {/* Morale */}
                <div className={`p-3 rounded-lg ${morale >= 0.80 ? 'bg-purple-500/10 border border-purple-500/30' : 'bg-orange-500/10 border border-orange-500/30'}`}>
                  <div className="flex items-center gap-2 mb-1">
                    <Heart className={`w-3.5 h-3.5 ${morale >= 0.80 ? 'text-purple-400' : 'text-orange-400'}`} />
                    <span className="data-label-sm">Morale</span>
                  </div>
                  <div className={`text-sm font-mono font-bold ${morale >= 0.80 ? 'text-purple-400' : 'text-orange-400'}`}>
                    ×{(morale * 100).toFixed(0)}%
                  </div>
                </div>
              </div>

              {/* Final calculation */}
              <div className="p-3 rounded-lg bg-black/40 border border-white/5">
                <div className="flex items-center justify-between mb-2">
                  <span className="section-label mb-0">Final Caption Impact</span>
                  <span className={`text-sm font-mono font-bold ${captionImpact >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                    {captionImpact >= 0 ? '+' : ''}{(captionImpact * 100).toFixed(1)}%
                  </span>
                </div>
                <div className="text-[10px] text-cream-100/50 font-mono">
                  (0.80 {specialtyBonus >= 0 ? '+' : ''}{(specialtyBonus * 100).toFixed(0)}% +{(experienceBonus * 100).toFixed(0)}% +{(hofBonus * 100).toFixed(0)}%) × {(morale * 100).toFixed(0)}% = {(finalEffectiveness * 100).toFixed(0)}%
                </div>
              </div>

              {/* Boost morale button */}
              {morale < 1.00 && onBoostMorale && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onBoostMorale(staff.staffId);
                  }}
                  className="w-full py-2 px-4 rounded-lg bg-purple-500/20 border border-purple-500/40 text-purple-400 hover:border-gold-500/30 transition-colors flex items-center justify-center gap-2"
                >
                  <Heart className="w-4 h-4" />
                  <span className="text-sm font-display font-bold uppercase">Boost Morale (+10%)</span>
                  <span className="text-xs font-mono opacity-75">{boostCost} CC</span>
                </button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

/**
 * Unassigned Caption Card - Glass Slot Style
 */
const UnassignedCaptionCard = ({ caption }) => {
  const CaptionIcon = CAPTION_ICONS[caption] || Users;

  return (
    <div className="glass-slot opacity-60">
      <div className="flex items-center gap-4">
        <div className="w-10 h-10 rounded-lg bg-black/40 border border-dashed border-white/10 flex items-center justify-center">
          <CaptionIcon className="w-5 h-5 text-cream-100/30" />
        </div>
        <div className="flex-1">
          <span className="text-sm font-mono font-bold text-cream-100/50">No Staff Assigned</span>
          <div className="data-label-sm">
            {CAPTION_LABELS[caption] || caption}
          </div>
        </div>
        <div className="text-center">
          <div className="text-sm font-mono font-bold text-red-400">-8%</div>
          <div className="data-label-sm">Penalty</div>
        </div>
      </div>
    </div>
  );
};

/**
 * Staff Effectiveness Panel - Main component
 */
export const StaffEffectivenessPanel = ({
  assignedStaff = [],
  activeCorpsClass,
  onBoostMorale,
  showUnassigned = true
}) => {
  // All possible captions
  const allCaptions = ['GE1', 'GE2', 'VP', 'VA', 'CG', 'B', 'MA', 'P'];

  // Map assigned staff by caption
  const staffByCaption = {};
  assignedStaff.forEach(staff => {
    if (staff.assignedTo?.caption) {
      staffByCaption[staff.assignedTo.caption] = staff;
    }
  });

  // Calculate overall effectiveness
  const assignedCount = assignedStaff.length;
  const maxStaff = 8;
  const staffFillRate = assignedCount / maxStaff;

  // Calculate total effectiveness bonus
  const totalEffectivenessBonus = assignedStaff.reduce((sum, staff) => {
    const caption = staff.assignedTo?.caption;
    if (!caption) return sum;

    const isSpecialtyMatch = staff.caption === caption;
    const specialtyBonus = isSpecialtyMatch ? 0.15 : -0.05;
    const experienceBonus = Math.min((staff.seasonsCompleted || 0) * 0.01, 0.10);
    const isHallOfFame = (staff.baseValue || 0) > 500;
    const hofBonus = isHallOfFame ? 0.05 : 0;
    const morale = staff.morale || 0.90;

    const baseEffectiveness = 0.80 + specialtyBonus + experienceBonus + hofBonus;
    const finalEffectiveness = Math.min(baseEffectiveness * morale, 1.00);
    const captionImpact = (finalEffectiveness - 0.80) * 0.40;

    return sum + captionImpact;
  }, 0);

  // Penalty for unassigned captions (-8% each)
  const unassignedCount = maxStaff - assignedCount;
  const unassignedPenalty = unassignedCount * -0.08;

  return (
    <div className="space-y-4">
      {/* Summary header */}
      <div className="glass-slot">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="section-label mb-0">Staff Effectiveness</h3>
            <p className="data-label-sm">±8% impact per caption</p>
          </div>
          <div className="text-right">
            <div className={`text-xl font-mono font-bold ${totalEffectivenessBonus + unassignedPenalty >= 0 ? 'text-green-400' : 'text-red-400'}`}>
              {(totalEffectivenessBonus + unassignedPenalty) >= 0 ? '+' : ''}{((totalEffectivenessBonus + unassignedPenalty) * 100).toFixed(1)}%
            </div>
            <div className="data-label-sm">Net Impact</div>
          </div>
        </div>

        {/* Staff fill bar */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="data-label-sm">Staff Coverage</span>
            <span className="text-sm font-mono font-bold text-cream-100">{assignedCount}/{maxStaff}</span>
          </div>
          <div className="w-full h-2 bg-charcoal-900 rounded-sm overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${staffFillRate * 100}%` }}
              transition={{ duration: 0.8 }}
              className={`h-full ${staffFillRate >= 0.75 ? 'bg-green-500' : staffFillRate >= 0.5 ? 'bg-yellow-500' : 'bg-red-500'}`}
            />
          </div>
          {unassignedCount > 0 && (
            <div className="flex items-center gap-2 text-xs text-orange-400">
              <Info className="w-3 h-3" />
              <span>{unassignedCount} unassigned = {(unassignedPenalty * 100).toFixed(0)}% total penalty</span>
            </div>
          )}
        </div>
      </div>

      {/* Staff cards */}
      <div className="space-y-2">
        {allCaptions.map(caption => {
          const staff = staffByCaption[caption];

          if (staff) {
            return (
              <StaffCard
                key={caption}
                staff={staff}
                assignedCaption={caption}
                onBoostMorale={onBoostMorale}
              />
            );
          } else if (showUnassigned) {
            return (
              <UnassignedCaptionCard
                key={caption}
                caption={caption}
              />
            );
          }
          return null;
        })}
      </div>

      {/* Tip - Collapsed by default */}
      <div className="glass-slot border-blue-500/20">
        <div className="flex items-start gap-2">
          <Info className="w-4 h-4 text-blue-400 flex-shrink-0 mt-0.5" />
          <div className="text-xs text-cream-100/60">
            <span className="text-blue-400 font-bold">Pro Tip:</span> Assign staff to their specialty captions for +15% bonus. Staff teaching outside their specialty receive -5% penalty.
          </div>
        </div>
      </div>
    </div>
  );
};

export default StaffEffectivenessPanel;
