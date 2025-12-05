// src/components/Execution/TransparentGameplay/ExecutionInsightsPanel.jsx
// Master Execution Insights Panel - Combines all Transparent Gameplay components
// "Echelon-Tier" comprehensive game state visualization

import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ChevronRight, ChevronDown, X, Target, Heart, Wrench, Users,
  Zap, Sparkles, Clock, TrendingUp, BarChart3, Eye, AlertTriangle
} from 'lucide-react';

import {
  ThresholdMeter,
  TemporalEffectsBar,
} from './index';
import StaffEffectivenessPanel from './StaffEffectivenessPanel';

// ============================================================================
// SHOW DIFFICULTY PRESETS (must match backend execution.js)
// ============================================================================
const SHOW_DIFFICULTY_PRESETS = {
  conservative: {
    difficulty: 3,
    preparednessThreshold: 0.70,
    ceilingBonus: 0.04,
    riskPenalty: -0.05,
    label: 'Conservative',
    description: "Safe show that's easy to execute well"
  },
  moderate: {
    difficulty: 5,
    preparednessThreshold: 0.80,
    ceilingBonus: 0.08,
    riskPenalty: -0.10,
    label: 'Moderate',
    description: "Balanced risk and reward"
  },
  ambitious: {
    difficulty: 7,
    preparednessThreshold: 0.85,
    ceilingBonus: 0.12,
    riskPenalty: -0.15,
    label: 'Ambitious',
    description: "High difficulty with great potential"
  },
  legendary: {
    difficulty: 10,
    preparednessThreshold: 0.90,
    ceilingBonus: 0.15,
    riskPenalty: -0.20,
    label: 'Legendary',
    description: "Historic show - huge risk, massive reward"
  },
};

/**
 * Collapsible Section Component - Command Console Accordion Style
 */
const InsightSection = ({ title, icon: Icon, children, defaultOpen = false, badge }) => {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div className="accordion-section">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="accordion-header"
      >
        <div className="flex items-center gap-3">
          <Icon className="w-4 h-4 text-gold-500" />
          <span className="text-xs font-bold text-gold-500 uppercase tracking-widest">
            {title}
          </span>
          {badge && (
            <span className={`px-2 py-0.5 text-[10px] font-mono font-bold uppercase border ${badge.color}`} style={{ borderRadius: '2px' }}>
              {badge.text}
            </span>
          )}
        </div>
        <ChevronRight className={`accordion-chevron ${isOpen ? 'open' : ''}`} />
      </button>
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="accordion-content pt-3">
              {children}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

/**
 * Segmented Stat Bar Component - Horizontal bar with segments
 */
const SegmentedStatBar = ({ value, label, icon: Icon, colorClass = 'gold' }) => {
  const percentage = Math.round(value * 100);
  const getBarColor = (val) => {
    if (val >= 0.90) return 'bg-green-500';
    if (val >= 0.75) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <Icon className="w-3.5 h-3.5 text-cream/50" />
          <span className="text-[10px] text-cream/50 uppercase">{label}</span>
        </div>
        <span className={`text-sm font-mono font-bold ${
          value >= 0.90 ? 'text-green-400' : value >= 0.75 ? 'text-yellow-400' : 'text-red-400'
        }`}>
          {percentage}%
        </span>
      </div>
      <div className="h-1.5 bg-charcoal-900 rounded-sm overflow-hidden flex gap-px">
        {[...Array(10)].map((_, i) => (
          <div
            key={i}
            className={`flex-1 transition-all duration-300 ${
              i < Math.round(value * 10) ? getBarColor(value) : 'bg-charcoal-800'
            }`}
          />
        ))}
      </div>
    </div>
  );
};

/**
 * Quick Stats Summary Bar - Analytics Dashboard Style
 */
const QuickStatsSummary = ({ executionState, multiplier, currentDay }) => {
  const readiness = executionState?.readiness ?? 0.75;
  const morale = executionState?.morale ?? 0.80;

  // Calculate average equipment
  const equipment = executionState?.equipment || {};
  const equipmentValues = Object.entries(equipment)
    .filter(([k, v]) => typeof v === 'number' && !k.includes('Max') && !k.includes('bus') && !k.includes('truck'))
    .map(([, v]) => v);
  const avgEquipment = equipmentValues.length > 0
    ? equipmentValues.reduce((a, b) => a + b, 0) / equipmentValues.length
    : 0.90;

  return (
    <div className="glass-slot">
      {/* Header with multiplier */}
      <div className="flex items-center justify-between mb-4">
        <span className="section-label mb-0">Quick Overview</span>
        <div className="text-right">
          <div className="text-2xl font-mono font-bold text-gold-400" style={{ textShadow: '0 0 15px rgba(255, 215, 0, 0.4)' }}>
            {multiplier.toFixed(2)}x
          </div>
          <div className="data-label-sm">Multiplier</div>
        </div>
      </div>

      {/* Segmented Stat Bars */}
      <div className="space-y-3">
        <SegmentedStatBar value={readiness} label="Readiness" icon={Target} />
        <SegmentedStatBar value={morale} label="Morale" icon={Heart} />
        <SegmentedStatBar value={avgEquipment} label="Equipment" icon={Wrench} />
      </div>

      {/* Season Progress - Thin Timeline Rail */}
      <div className="mt-4 pt-3 border-t border-white/5">
        <div className="flex items-center justify-between mb-1.5">
          <div className="flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5 text-cream/50" />
            <span className="text-[10px] text-cream/50 uppercase">Season Progress</span>
          </div>
          <span className="text-xs font-mono text-cream/60">Day {currentDay}/49</span>
        </div>
        <div className="h-1 bg-charcoal-900 rounded-full overflow-hidden">
          <div
            className="h-full bg-gold-500 transition-all duration-500"
            style={{ width: `${(currentDay / 49) * 100}%` }}
          />
        </div>
      </div>
    </div>
  );
};

/**
 * Section Bar with Segmented Progress
 */
const SectionBar = ({ label, value, captions, icon: Icon }) => {
  const percentage = Math.round(value * 100);
  const getBarColor = (val) => {
    if (val >= 0.90) return 'bg-green-500';
    if (val >= 0.75) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  return (
    <div className="py-2.5 border-b border-white/5 last:border-0">
      <div className="flex items-center justify-between mb-1.5">
        <div className="flex items-center gap-2">
          <Icon className="w-3.5 h-3.5 text-cream/50" />
          <span className="text-sm text-cream-100">{label}</span>
          <span className="text-[9px] text-cream/40">{captions}</span>
        </div>
        <span className={`text-sm font-mono font-bold ${
          value >= 0.90 ? 'text-green-400' : value >= 0.75 ? 'text-yellow-400' : 'text-red-400'
        }`}>
          {percentage}%
        </span>
      </div>
      <div className="h-1.5 bg-charcoal-900 rounded-sm overflow-hidden flex gap-px">
        {[...Array(10)].map((_, i) => (
          <div
            key={i}
            className={`flex-1 transition-all duration-300 ${
              i < Math.round(value * 10) ? getBarColor(value) : 'bg-charcoal-800'
            }`}
          />
        ))}
      </div>
    </div>
  );
};

/**
 * Sections Tab Content - Auto-expands lowest performing section
 */
const SectionsTabContent = ({ executionState }) => {
  const sections = [
    { key: 'brass', label: 'Brass', icon: Zap, captions: 'B, MA' },
    { key: 'percussion', label: 'Percussion', icon: Zap, captions: 'P' },
    { key: 'guard', label: 'Guard', icon: Eye, captions: 'VP, VA, CG' },
    { key: 'ensemble', label: 'Ensemble', icon: Users, captions: 'GE1, GE2' },
  ];

  // Get readiness values
  const readinessData = typeof executionState?.readiness === 'object'
    ? executionState.readiness
    : {
        brass: executionState?.readiness || 0.75,
        percussion: executionState?.readiness || 0.75,
        guard: executionState?.readiness || 0.75,
        ensemble: executionState?.readiness || 0.75
      };

  // Get morale values
  const moraleData = typeof executionState?.morale === 'object'
    ? executionState.morale
    : {
        brass: executionState?.morale || 0.80,
        percussion: executionState?.morale || 0.80,
        guard: executionState?.morale || 0.80,
        overall: executionState?.morale || 0.80
      };

  // Find lowest performing section for readiness
  const lowestReadiness = sections.reduce((lowest, section) => {
    const value = readinessData[section.key] || 0.75;
    return value < (readinessData[lowest] || 0.75) ? section.key : lowest;
  }, 'brass');

  // Find lowest performing section for morale
  const lowestMorale = sections.reduce((lowest, section) => {
    const value = moraleData[section.key] || moraleData.overall || 0.80;
    return value < (moraleData[lowest] || moraleData.overall || 0.80) ? section.key : lowest;
  }, 'brass');

  // Determine which accordion to open (the one with biggest problem)
  const lowestReadinessValue = readinessData[lowestReadiness] || 0.75;
  const lowestMoraleValue = moraleData[lowestMorale] || moraleData.overall || 0.80;
  const openReadiness = lowestReadinessValue < lowestMoraleValue;

  return (
    <div className="space-y-4">
      {/* Readiness by Section */}
      <InsightSection
        title="Section Readiness"
        icon={Target}
        defaultOpen={openReadiness}
        badge={lowestReadinessValue < 0.75 ? { text: 'Low', color: 'bg-red-500/20 border-red-500/40 text-red-400' } : undefined}
      >
        <div className="space-y-0">
          {sections.map(({ key, label, icon, captions }) => (
            <SectionBar
              key={key}
              label={label}
              value={readinessData[key] || 0.75}
              captions={captions}
              icon={icon}
            />
          ))}
        </div>
      </InsightSection>

      {/* Morale by Section */}
      <InsightSection
        title="Section Morale"
        icon={Heart}
        defaultOpen={!openReadiness}
        badge={lowestMoraleValue < 0.75 ? { text: 'Low', color: 'bg-red-500/20 border-red-500/40 text-red-400' } : undefined}
      >
        <div className="space-y-0">
          {sections.map(({ key, label, icon, captions }) => (
            <SectionBar
              key={key}
              label={label}
              value={moraleData[key] || moraleData.overall || 0.80}
              captions={captions}
              icon={icon}
            />
          ))}
        </div>
      </InsightSection>
    </div>
  );
};

/**
 * Main Execution Insights Panel
 */
export const ExecutionInsightsPanel = ({
  executionState,
  multiplierBreakdown = {},
  finalMultiplier = 1.0,
  currentDay = 1,
  showDifficulty,
  assignedStaff = [],
  activeCorpsClass,
  onBoostStaffMorale,
  onClose
}) => {
  const [activeTab, setActiveTab] = useState('overview');

  // Get show difficulty config
  const difficultyKey = typeof showDifficulty === 'string'
    ? showDifficulty
    : showDifficulty?.difficulty <= 3 ? 'conservative'
    : showDifficulty?.difficulty <= 5 ? 'moderate'
    : showDifficulty?.difficulty <= 7 ? 'ambitious'
    : 'legendary';
  const difficultyConfig = SHOW_DIFFICULTY_PRESETS[difficultyKey] || SHOW_DIFFICULTY_PRESETS.moderate;

  // Calculate average readiness for threshold comparison
  const readiness = executionState?.readiness;
  const avgReadiness = typeof readiness === 'number'
    ? readiness
    : readiness
      ? (readiness.brass + readiness.percussion + readiness.guard + readiness.ensemble) / 4
      : 0.75;

  // Check if prepared for difficulty
  const isPrepared = avgReadiness >= difficultyConfig.preparednessThreshold;

  // Calculate potential score impact
  const potentialImpact = isPrepared
    ? `+${(difficultyConfig.ceilingBonus * 100).toFixed(0)}%`
    : `${(difficultyConfig.riskPenalty * 100).toFixed(0)}%`;

  const tabs = [
    { id: 'overview', label: 'Overview', icon: BarChart3 },
    { id: 'breakdown', label: 'Multiplier', icon: TrendingUp },
    { id: 'sections', label: 'Sections', icon: Target },
    { id: 'staff', label: 'Staff', icon: Users },
  ];

  return (
    <div className="panel-shell tactical-grid">
      {/* Header - Command Console Style */}
      <div className="panel-header">
        <h2 className="panel-title">Execution Insights</h2>
        {onClose && (
          <button onClick={onClose} className="panel-close">
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* Tab Navigation */}
      <div className="flex items-center gap-1 p-2 bg-black/40 border-b border-white/10 overflow-x-auto">
        {tabs.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setActiveTab(id)}
            className={`flex items-center gap-2 px-3 py-2 text-xs font-display font-bold uppercase transition-all whitespace-nowrap border rounded-lg ${
              activeTab === id
                ? 'bg-gold-500/20 text-gold-400 border-gold-500/40'
                : 'text-cream-100/50 hover:text-cream-100 border-transparent hover:border-white/20'
            }`}
          >
            <Icon className="w-3.5 h-3.5" />
            {label}
          </button>
        ))}
      </div>

      {/* Content - Panel Body with tactical grid */}
      <div className="panel-body space-y-4 relative z-10">
        {/* Overview Tab */}
        {activeTab === 'overview' && (
          <>
            <QuickStatsSummary
              executionState={executionState}
              multiplier={finalMultiplier}
              currentDay={currentDay}
            />

            {/* Difficulty Threshold */}
            <ThresholdMeter
              current={avgReadiness}
              threshold={difficultyConfig.preparednessThreshold}
              label={`${difficultyConfig.label} Difficulty`}
              bonusValue={difficultyConfig.ceilingBonus}
              penaltyValue={difficultyConfig.riskPenalty}
              description={difficultyConfig.description}
            />

            {/* Temporal Effects */}
            <TemporalEffectsBar
              currentDay={currentDay}
              showDifficulty={showDifficulty}
              morale={executionState?.morale}
            />

            {/* Warnings */}
            {!isPrepared && (
              <div className="glass-slot border-orange-500/30">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="w-5 h-5 text-orange-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <div className="section-label text-orange-400 mb-1">
                      Underprepared Warning
                    </div>
                    <p className="text-xs text-cream-100/60">
                      Your readiness ({Math.round(avgReadiness * 100)}%) is below the {Math.round(difficultyConfig.preparednessThreshold * 100)}% threshold for {difficultyConfig.label} difficulty.
                      You'll receive a {(difficultyConfig.riskPenalty * 100).toFixed(0)}% penalty instead of the +{(difficultyConfig.ceilingBonus * 100).toFixed(0)}% bonus.
                    </p>
                  </div>
                </div>
              </div>
            )}
          </>
        )}

        {/* Breakdown Tab - Receipt/Invoice Style */}
        {activeTab === 'breakdown' && (
          <div className="glass-slot">
            <span className="section-label">Multiplier Breakdown</span>

            {/* Stacked Factors - Receipt Style */}
            <div className="space-y-0 mt-3 border-t border-white/10">
              {/* Base */}
              <div className="flex items-center justify-between py-2.5 border-b border-white/5">
                <span className="text-sm text-cream/60">Base</span>
                <span className="text-sm font-mono text-cream-100">1.00</span>
              </div>

              {/* Readiness */}
              {multiplierBreakdown.readiness !== undefined && (
                <div className="flex items-center justify-between py-2.5 border-b border-white/5">
                  <div className="flex items-center gap-2">
                    <Target className="w-3.5 h-3.5 text-blue-400" />
                    <span className="text-sm text-cream/60">Readiness</span>
                  </div>
                  <span className={`text-sm font-mono font-bold ${multiplierBreakdown.readiness >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                    {multiplierBreakdown.readiness >= 0 ? '+' : ''}{(multiplierBreakdown.readiness * 100).toFixed(1)}%
                  </span>
                </div>
              )}

              {/* Staff */}
              {multiplierBreakdown.staff !== undefined && (
                <div className="flex items-center justify-between py-2.5 border-b border-white/5">
                  <div className="flex items-center gap-2">
                    <Users className="w-3.5 h-3.5 text-purple-400" />
                    <span className="text-sm text-cream/60">Staff</span>
                  </div>
                  <span className={`text-sm font-mono font-bold ${multiplierBreakdown.staff >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                    {multiplierBreakdown.staff >= 0 ? '+' : ''}{(multiplierBreakdown.staff * 100).toFixed(1)}%
                  </span>
                </div>
              )}

              {/* Morale */}
              {multiplierBreakdown.morale !== undefined && (
                <div className="flex items-center justify-between py-2.5 border-b border-white/5">
                  <div className="flex items-center gap-2">
                    <Heart className="w-3.5 h-3.5 text-red-400" />
                    <span className="text-sm text-cream/60">Morale</span>
                  </div>
                  <span className={`text-sm font-mono font-bold ${multiplierBreakdown.morale >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                    {multiplierBreakdown.morale >= 0 ? '+' : ''}{(multiplierBreakdown.morale * 100).toFixed(1)}%
                  </span>
                </div>
              )}

              {/* Equipment */}
              {multiplierBreakdown.equipment !== undefined && (
                <div className="flex items-center justify-between py-2.5 border-b border-white/5">
                  <div className="flex items-center gap-2">
                    <Wrench className="w-3.5 h-3.5 text-orange-400" />
                    <span className="text-sm text-cream/60">Equipment</span>
                  </div>
                  <span className={`text-sm font-mono font-bold ${multiplierBreakdown.equipment >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                    {multiplierBreakdown.equipment >= 0 ? '+' : ''}{(multiplierBreakdown.equipment * 100).toFixed(1)}%
                  </span>
                </div>
              )}

              {/* Show Difficulty */}
              {multiplierBreakdown.showDifficulty !== undefined && (
                <div className="flex items-center justify-between py-2.5 border-b border-white/5">
                  <div className="flex items-center gap-2">
                    <Zap className="w-3.5 h-3.5 text-yellow-400" />
                    <span className="text-sm text-cream/60">Difficulty</span>
                  </div>
                  <span className={`text-sm font-mono font-bold ${multiplierBreakdown.showDifficulty >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                    {multiplierBreakdown.showDifficulty >= 0 ? '+' : ''}{(multiplierBreakdown.showDifficulty * 100).toFixed(1)}%
                  </span>
                </div>
              )}

              {/* Random Variance */}
              {multiplierBreakdown.randomVariance !== undefined && multiplierBreakdown.randomVariance !== 0 && (
                <div className="flex items-center justify-between py-2.5 border-b border-white/5">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
                    <span className="text-sm text-cream/60">Daily Luck</span>
                  </div>
                  <span className={`text-sm font-mono font-bold ${multiplierBreakdown.randomVariance >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                    {multiplierBreakdown.randomVariance >= 0 ? '+' : ''}{(multiplierBreakdown.randomVariance * 100).toFixed(1)}%
                  </span>
                </div>
              )}

              {/* Fatigue */}
              {multiplierBreakdown.fatigue !== undefined && multiplierBreakdown.fatigue !== 0 && (
                <div className="flex items-center justify-between py-2.5 border-b border-white/5">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="w-3.5 h-3.5 text-orange-400" />
                    <span className="text-sm text-cream/60">Fatigue</span>
                  </div>
                  <span className="text-sm font-mono font-bold text-red-400">
                    {(multiplierBreakdown.fatigue * 100).toFixed(1)}%
                  </span>
                </div>
              )}

              {/* Total - Highlighted */}
              <div className="flex items-center justify-between py-3 mt-2 bg-gold-500/10 border border-gold-500/30 rounded-lg px-3 -mx-1">
                <span className="text-sm font-bold text-gold-400 uppercase">Total</span>
                <span className="text-xl font-mono font-bold text-gold-400" style={{ textShadow: '0 0 10px rgba(255, 215, 0, 0.4)' }}>
                  {finalMultiplier.toFixed(2)}x
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Sections Tab - Auto-expand lowest performing */}
        {activeTab === 'sections' && (
          <SectionsTabContent executionState={executionState} />
        )}

        {/* Staff Tab */}
        {activeTab === 'staff' && (
          <StaffEffectivenessPanel
            assignedStaff={assignedStaff}
            activeCorpsClass={activeCorpsClass}
            onBoostMorale={onBoostStaffMorale}
            showUnassigned={true}
          />
        )}
      </div>

      {/* Footer with legend */}
      <div className="border-t border-white/10 p-3 bg-charcoal-950/95 flex-shrink-0">
        <div className="flex items-center justify-center gap-6 text-[10px] font-mono text-cream-100/50">
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 bg-green-500 shadow-[0_0_6px_rgba(34,197,94,0.6)] rounded-sm" />
            <span>90%+</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 bg-yellow-500 shadow-[0_0_6px_rgba(234,179,8,0.6)] rounded-sm" />
            <span>75-89%</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 bg-red-500 shadow-[0_0_6px_rgba(239,68,68,0.6)] rounded-sm" />
            <span>&lt;75%</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ExecutionInsightsPanel;
