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
  SectionGauges,
  ExecutionMultiplierBreakdown,
  ThresholdMeter,
  TemporalEffectsBar,
  CircularProgressRing
} from './index';
import StaffEffectivenessPanel from './StaffEffectivenessPanel';
import SynergyVisualization from './SynergyVisualization';

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
 * Collapsible Section Component
 */
const InsightSection = ({ title, icon: Icon, children, defaultOpen = false, badge }) => {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div className="bg-white/5 border border-white/10 overflow-hidden" style={{ borderRadius: '4px' }}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full p-4 flex items-center justify-between hover:bg-white/5 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 flex items-center justify-center bg-gold-500/20 border border-gold-500/40" style={{ borderRadius: '4px' }}>
            <Icon className="w-4 h-4 text-gold-400" />
          </div>
          <span className="font-display font-bold text-cream-100 uppercase tracking-wide text-sm">
            {title}
          </span>
          {badge && (
            <span className={`px-2 py-0.5 text-[10px] font-mono font-bold uppercase border ${badge.color}`} style={{ borderRadius: '2px' }}>
              {badge.text}
            </span>
          )}
        </div>
        <ChevronRight className={`w-5 h-5 text-cream-muted transition-transform ${isOpen ? 'rotate-90' : ''}`} />
      </button>
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 border-t border-white/10">
              {children}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

/**
 * Quick Stats Summary Bar
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

  const stats = [
    { label: 'Readiness', value: readiness, color: 'blue', icon: Target },
    { label: 'Morale', value: morale, color: 'red', icon: Heart },
    { label: 'Equipment', value: avgEquipment, color: 'orange', icon: Wrench },
  ];

  const getValueColor = (val) => {
    if (val >= 0.90) return 'text-green-400';
    if (val >= 0.75) return 'text-yellow-400';
    return 'text-red-400';
  };

  return (
    <div className="bg-white/5 border border-white/10 p-4" style={{ borderRadius: '4px' }}>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <BarChart3 className="w-5 h-5 text-gold-400" />
          <span className="font-display font-bold text-gold-400 uppercase text-sm">Quick Overview</span>
        </div>
        <div className="text-right">
          <div className="text-2xl font-mono font-bold text-gold-400" style={{ textShadow: '0 0 15px rgba(255, 215, 0, 0.4)' }}>
            {multiplier.toFixed(2)}x
          </div>
          <div className="text-[9px] font-display font-bold text-cream-muted uppercase">Multiplier</div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        {stats.map(({ label, value, color, icon: Icon }) => (
          <div key={label} className="text-center">
            <CircularProgressRing
              value={value}
              size={56}
              strokeWidth={5}
              color={color}
              showPercentage={true}
            />
            <div className="flex items-center justify-center gap-1 mt-2">
              <Icon className="w-3 h-3 text-cream-muted" />
              <span className="text-[10px] font-display font-bold uppercase text-cream-muted">
                {label}
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* Day indicator - Segmented Progress */}
      <div className="mt-4 pt-3 border-t border-white/10 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Clock className="w-4 h-4 text-cream-muted" />
          <span className="text-xs font-display font-bold text-cream-muted uppercase">Season</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-24 h-2 bg-charcoal-900 overflow-hidden flex gap-px" style={{ borderRadius: '2px' }}>
            {[...Array(7)].map((_, i) => (
              <div
                key={i}
                className={`flex-1 ${
                  i < Math.ceil((currentDay / 49) * 7)
                    ? 'bg-gold-500 shadow-[0_0_4px_rgba(234,179,8,0.6)]'
                    : 'bg-charcoal-800'
                }`}
              />
            ))}
          </div>
          <span className="text-xs font-mono text-gold-400">{currentDay}/49</span>
        </div>
      </div>
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
  showConcept,
  lineup,
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
    { id: 'synergy', label: 'Synergy', icon: Sparkles },
  ];

  return (
    <div className="h-full flex flex-col bg-charcoal-950/95">
      {/* Header */}
      <div className="sticky top-0 bg-charcoal-950/95 backdrop-blur-xl border-b border-gold-500/30 p-4 flex items-center justify-between z-10">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 flex items-center justify-center bg-gold-500/20 border border-gold-500/40" style={{ borderRadius: '4px' }}>
            <Eye className="w-5 h-5 text-gold-400" />
          </div>
          <div>
            <h2 className="text-lg font-display font-black text-gold-400 uppercase tracking-tight">
              Execution Insights
            </h2>
            <p className="text-xs text-cream-muted">Full transparency on your corps performance</p>
          </div>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="p-2 border border-transparent hover:border-red-500/50 hover:bg-red-500/20 text-cream-muted hover:text-red-400 transition-colors"
            style={{ borderRadius: '4px' }}
          >
            <X className="w-6 h-6" />
          </button>
        )}
      </div>

      {/* Tab Navigation */}
      <div className="flex items-center gap-1 p-2 bg-black/40 border-b border-white/10 overflow-x-auto">
        {tabs.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setActiveTab(id)}
            className={`flex items-center gap-2 px-3 py-2 text-xs font-display font-bold uppercase transition-all whitespace-nowrap border ${
              activeTab === id
                ? 'bg-gold-500/20 text-gold-400 border-gold-500/40'
                : 'text-cream-muted hover:text-cream-100 border-transparent hover:border-white/20'
            }`}
            style={{ borderRadius: '4px' }}
          >
            <Icon className="w-3.5 h-3.5" />
            {label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
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
              <div className="p-4 rounded-xl bg-orange-500/10 border border-orange-500/30">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="w-5 h-5 text-orange-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <div className="font-display font-bold text-orange-400 uppercase mb-1">
                      Underprepared Warning
                    </div>
                    <p className="text-xs text-cream-muted">
                      Your readiness ({Math.round(avgReadiness * 100)}%) is below the {Math.round(difficultyConfig.preparednessThreshold * 100)}% threshold for {difficultyConfig.label} difficulty.
                      You'll receive a {(difficultyConfig.riskPenalty * 100).toFixed(0)}% penalty instead of the +{(difficultyConfig.ceilingBonus * 100).toFixed(0)}% bonus.
                    </p>
                  </div>
                </div>
              </div>
            )}
          </>
        )}

        {/* Breakdown Tab */}
        {activeTab === 'breakdown' && (
          <ExecutionMultiplierBreakdown
            breakdown={multiplierBreakdown}
            finalMultiplier={finalMultiplier}
            isExpanded={true}
          />
        )}

        {/* Sections Tab */}
        {activeTab === 'sections' && (
          <div className="space-y-6">
            {/* Readiness by Section */}
            <InsightSection title="Section Readiness" icon={Target} defaultOpen={true}>
              <div className="space-y-4">
                <p className="text-xs text-cream-muted">
                  Each section's readiness affects specific captions. Higher readiness = better execution on those captions (±12% range).
                </p>
                <SectionGauges
                  data={typeof executionState?.readiness === 'object' ? executionState.readiness : {
                    brass: executionState?.readiness || 0.75,
                    percussion: executionState?.readiness || 0.75,
                    guard: executionState?.readiness || 0.75,
                    ensemble: executionState?.readiness || 0.75
                  }}
                  type="readiness"
                  showLabels={true}
                />
              </div>
            </InsightSection>

            {/* Morale by Section */}
            <InsightSection title="Section Morale" icon={Heart}>
              <div className="space-y-4">
                <p className="text-xs text-cream-muted">
                  Morale affects execution quality. Low morale hurts performance (±8% range). Rehearsals cost morale.
                </p>
                <SectionGauges
                  data={typeof executionState?.morale === 'object' ? executionState.morale : {
                    brass: executionState?.morale || 0.80,
                    percussion: executionState?.morale || 0.80,
                    guard: executionState?.morale || 0.80,
                    overall: executionState?.morale || 0.80
                  }}
                  type="morale"
                  showLabels={true}
                />
              </div>
            </InsightSection>
          </div>
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

        {/* Synergy Tab */}
        {activeTab === 'synergy' && (
          <SynergyVisualization
            showConcept={showConcept}
            lineup={lineup}
            showDetails={true}
          />
        )}
      </div>

      {/* Footer with legend */}
      <div className="border-t border-white/10 p-3 bg-black/40">
        <div className="flex items-center justify-center gap-6 text-[10px] font-mono text-cream-muted">
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 bg-green-500 shadow-[0_0_6px_rgba(34,197,94,0.6)]" style={{ borderRadius: '2px' }} />
            <span>90%+</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 bg-yellow-500 shadow-[0_0_6px_rgba(234,179,8,0.6)]" style={{ borderRadius: '2px' }} />
            <span>75-89%</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 bg-red-500 shadow-[0_0_6px_rgba(239,68,68,0.6)]" style={{ borderRadius: '2px' }} />
            <span>&lt;75%</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ExecutionInsightsPanel;
