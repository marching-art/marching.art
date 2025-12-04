// src/components/Execution/TransparentGameplay/StaffEffectivenessPanel.jsx
// Premium Staff Effectiveness Visualization
// Exposes: caption match, experience bonus, HoF status, morale

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Users, Star, Award, Heart, Target, CheckCircle, XCircle,
  TrendingUp, ChevronDown, ChevronUp, Zap, Music, Info
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
 * Individual Staff Card with effectiveness breakdown
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
      layout
      className="glass-dark rounded-xl overflow-hidden"
    >
      {/* Header - always visible */}
      <div
        className="p-4 cursor-pointer hover:bg-white/5 transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-4">
          {/* Staff avatar/icon */}
          <div className="relative">
            <div className="w-12 h-12 rounded-xl bg-charcoal-700 flex items-center justify-center">
              <span className="text-2xl">{staff.avatar || '👤'}</span>
            </div>
            {isHallOfFame && (
              <div className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-gold-500 flex items-center justify-center">
                <Award className="w-3 h-3 text-charcoal-900" />
              </div>
            )}
          </div>

          {/* Staff info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-display font-bold text-cream truncate">
                {staff.name || 'Unknown Staff'}
              </span>
              {isSpecialtyMatch && (
                <span className="px-1.5 py-0.5 rounded bg-green-500/20 text-[9px] font-bold text-green-400 uppercase">
                  Specialty
                </span>
              )}
            </div>
            <div className="flex items-center gap-2 mt-0.5">
              <CaptionIcon className="w-3 h-3 text-cream-muted" />
              <span className="text-xs text-cream-muted">
                Teaching: {CAPTION_LABELS[assignedCaption] || assignedCaption}
              </span>
            </div>
          </div>

          {/* Effectiveness gauge */}
          <CircularProgressRing
            value={finalEffectiveness}
            size={48}
            strokeWidth={4}
            color={getEffectivenessColor(finalEffectiveness)}
            showPercentage={true}
          />

          {/* Expand toggle */}
          <div className="text-cream-muted">
            {expanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
          </div>
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
            <div className="px-4 pb-4 space-y-4">
              {/* Effectiveness breakdown */}
              <div className="grid grid-cols-2 gap-3">
                {/* Caption Match */}
                <div className={`p-3 rounded-lg ${isSpecialtyMatch ? 'bg-green-500/10 border border-green-500/30' : 'bg-red-500/10 border border-red-500/30'}`}>
                  <div className="flex items-center gap-2 mb-1">
                    {isSpecialtyMatch ? (
                      <CheckCircle className="w-4 h-4 text-green-400" />
                    ) : (
                      <XCircle className="w-4 h-4 text-red-400" />
                    )}
                    <span className="text-xs font-display font-bold text-cream uppercase">
                      Caption Match
                    </span>
                  </div>
                  <div className={`font-mono font-bold ${isSpecialtyMatch ? 'text-green-400' : 'text-red-400'}`}>
                    {isSpecialtyMatch ? '+15%' : '-5%'}
                  </div>
                  <div className="text-[9px] text-cream-muted mt-1">
                    Specialty: {staff.caption || 'None'}
                  </div>
                </div>

                {/* Experience */}
                <div className="p-3 rounded-lg bg-blue-500/10 border border-blue-500/30">
                  <div className="flex items-center gap-2 mb-1">
                    <TrendingUp className="w-4 h-4 text-blue-400" />
                    <span className="text-xs font-display font-bold text-cream uppercase">
                      Experience
                    </span>
                  </div>
                  <div className="font-mono font-bold text-blue-400">
                    +{(experienceBonus * 100).toFixed(0)}%
                  </div>
                  <div className="text-[9px] text-cream-muted mt-1">
                    {staff.seasonsCompleted || 0} seasons (max +10%)
                  </div>
                </div>

                {/* Hall of Fame */}
                <div className={`p-3 rounded-lg ${isHallOfFame ? 'bg-gold-500/10 border border-gold-500/30' : 'bg-charcoal-700/50 border border-charcoal-600'}`}>
                  <div className="flex items-center gap-2 mb-1">
                    <Award className={`w-4 h-4 ${isHallOfFame ? 'text-gold-400' : 'text-cream-muted/50'}`} />
                    <span className="text-xs font-display font-bold text-cream uppercase">
                      Elite Status
                    </span>
                  </div>
                  <div className={`font-mono font-bold ${isHallOfFame ? 'text-gold-400' : 'text-cream-muted/50'}`}>
                    {isHallOfFame ? '+5%' : '+0%'}
                  </div>
                  <div className="text-[9px] text-cream-muted mt-1">
                    {isHallOfFame ? 'Hall of Fame' : 'Not elite (500+ value)'}
                  </div>
                </div>

                {/* Morale */}
                <div className={`p-3 rounded-lg ${morale >= 0.80 ? 'bg-purple-500/10 border border-purple-500/30' : 'bg-orange-500/10 border border-orange-500/30'}`}>
                  <div className="flex items-center gap-2 mb-1">
                    <Heart className={`w-4 h-4 ${morale >= 0.80 ? 'text-purple-400' : 'text-orange-400'}`} />
                    <span className="text-xs font-display font-bold text-cream uppercase">
                      Morale
                    </span>
                  </div>
                  <div className={`font-mono font-bold ${morale >= 0.80 ? 'text-purple-400' : 'text-orange-400'}`}>
                    ×{(morale * 100).toFixed(0)}%
                  </div>
                  <div className="text-[9px] text-cream-muted mt-1">
                    Multiplies effectiveness
                  </div>
                </div>
              </div>

              {/* Final calculation */}
              <div className="p-3 rounded-lg bg-charcoal-800 border border-charcoal-700">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-display font-bold text-cream uppercase">
                    Final Caption Impact
                  </span>
                  <span className={`font-mono font-bold text-lg ${captionImpact >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                    {captionImpact >= 0 ? '+' : ''}{(captionImpact * 100).toFixed(1)}%
                  </span>
                </div>
                <div className="text-[10px] text-cream-muted font-mono">
                  (0.80 {specialtyBonus >= 0 ? '+' : ''}{(specialtyBonus * 100).toFixed(0)}% +{(experienceBonus * 100).toFixed(0)}% +{(hofBonus * 100).toFixed(0)}%) × {(morale * 100).toFixed(0)}% = {(finalEffectiveness * 100).toFixed(0)}%
                </div>
                <div className="text-[9px] text-cream-muted/60 mt-1">
                  Range: ±8% on {CAPTION_LABELS[assignedCaption]} score
                </div>
              </div>

              {/* Boost morale button */}
              {morale < 1.00 && onBoostMorale && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onBoostMorale(staff.staffId);
                  }}
                  className="w-full py-2 px-4 rounded-lg bg-purple-500/20 border border-purple-500/40 text-purple-400 hover:bg-purple-500/30 transition-colors flex items-center justify-center gap-2"
                >
                  <Heart className="w-4 h-4" />
                  <span className="text-sm font-display font-bold">Boost Morale (+10%)</span>
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
 * Unassigned Caption Card
 */
const UnassignedCaptionCard = ({ caption }) => {
  const CaptionIcon = CAPTION_ICONS[caption] || Users;

  return (
    <div className="glass-dark rounded-xl p-4 opacity-60">
      <div className="flex items-center gap-4">
        <div className="w-12 h-12 rounded-xl bg-charcoal-800 border-2 border-dashed border-charcoal-600 flex items-center justify-center">
          <CaptionIcon className="w-6 h-6 text-cream-muted/40" />
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <span className="font-display font-bold text-cream-muted">No Staff Assigned</span>
          </div>
          <span className="text-xs text-cream-muted/60">
            {CAPTION_LABELS[caption] || caption}
          </span>
        </div>
        <div className="text-center">
          <div className="text-lg font-mono font-bold text-red-400">-8%</div>
          <div className="text-[9px] text-cream-muted">Penalty</div>
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
    <div className="space-y-6">
      {/* Summary header */}
      <div className="glass-dark rounded-xl p-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-purple-500/20">
              <Users className="w-6 h-6 text-purple-400" />
            </div>
            <div>
              <h3 className="font-display font-bold text-cream uppercase">Staff Effectiveness</h3>
              <p className="text-xs text-cream-muted">±8% impact per caption</p>
            </div>
          </div>
          <div className="text-right">
            <div className={`text-2xl font-mono font-bold ${totalEffectivenessBonus + unassignedPenalty >= 0 ? 'text-green-400' : 'text-red-400'}`}>
              {(totalEffectivenessBonus + unassignedPenalty) >= 0 ? '+' : ''}{((totalEffectivenessBonus + unassignedPenalty) * 100).toFixed(1)}%
            </div>
            <div className="text-[10px] text-cream-muted uppercase">Net Impact</div>
          </div>
        </div>

        {/* Staff fill bar */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="text-cream-muted">Staff Coverage</span>
            <span className="font-mono text-cream">{assignedCount}/{maxStaff}</span>
          </div>
          <div className="w-full h-2 bg-charcoal-800 rounded-full overflow-hidden">
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
      <div className="space-y-3">
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

      {/* Tip */}
      <div className="p-3 rounded-lg bg-blue-500/10 border border-blue-500/30">
        <div className="flex items-start gap-2">
          <Info className="w-4 h-4 text-blue-400 flex-shrink-0 mt-0.5" />
          <div className="text-xs text-cream-muted">
            <span className="text-blue-400 font-bold">Pro Tip:</span> Assign staff to their specialty captions for +15% bonus. Staff teaching outside their specialty receive -5% penalty.
          </div>
        </div>
      </div>
    </div>
  );
};

export default StaffEffectivenessPanel;
