// src/components/Execution/ExecutionDashboard.jsx
import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Target, Heart, Wrench, TrendingUp, TrendingDown,
  Minus, Sparkles, AlertCircle, Users,
  ChevronDown, ChevronUp, Award
} from 'lucide-react';

const ExecutionDashboard = ({ executionState, multiplier, assignedStaffCount = 0 }) => {
  const [showBreakdown, setShowBreakdown] = useState(false);

  if (!executionState) {
    return (
      <div className="card p-6">
        <p className="text-cream-500/60 text-center">Loading execution status...</p>
      </div>
    );
  }

  const {
    readiness: rawReadiness = 0,
    morale: rawMorale = 0,
    equipment = {},
    showDesign = {}
  } = executionState;

  // Handle both object structure (from Cloud Function) and number structure
  const readiness = typeof rawReadiness === 'object'
    ? Object.values(rawReadiness).reduce((sum, v) => sum + v, 0) / Object.values(rawReadiness).length
    : rawReadiness;

  const morale = typeof rawMorale === 'object'
    ? Object.values(rawMorale).reduce((sum, v) => sum + v, 0) / Object.values(rawMorale).length
    : rawMorale;

  // Helper to extract condition value from either flat number or object format
  const getConditionValue = (value) => {
    if (typeof value === 'number') return value;
    if (typeof value === 'object' && value?.condition !== undefined) return value.condition;
    return 0;
  };

  // Calculate average equipment condition (handles both flat numbers and objects)
  // Filter out "Max" keys which store upgrade limits
  const equipmentConditions = Object.entries(equipment)
    .filter(([key]) => !key.includes('Max') && !key.includes('bus') && !key.includes('truck'))
    .map(([, value]) => getConditionValue(value))
    .filter(v => v > 0);
  const avgEquipment = equipmentConditions.length > 0
    ? equipmentConditions.reduce((sum, c) => sum + c, 0) / equipmentConditions.length
    : 0.90;

  // Calculate multiplier breakdown factors - matches actual formula in useExecution.calculateMultiplier
  // Actual formula: baseMultiplier = (readiness * 0.4) + (morale * 0.3) + (equipment * 0.3) + staffBonus
  // Then clamped to 0.70 - 1.10
  const getMultiplierBreakdown = () => {
    const breakdown = [];
    // Use assignedStaffCount from marketplace instead of executionState.staff
    const staffCount = assignedStaffCount;
    const staffBonusValue = Math.min(staffCount * 0.01, 0.05);

    // Factor 1: Readiness (40% weight)
    const readinessContribution = readiness * 0.40;
    const readinessDelta = (readiness - 1.0) * 0.40;
    breakdown.push({
      name: 'Section Readiness',
      value: readinessContribution,
      delta: readinessDelta,
      weight: 40,
      current: readiness,
      max: 0.40,
      min: 0,
      icon: Target,
      description: `${Math.round(readiness * 100)}% readiness × 40% weight`,
      color: readiness >= 0.95 ? 'text-green-400' : readiness >= 0.80 ? 'text-yellow-400' : 'text-red-400'
    });

    // Factor 2: Morale (30% weight)
    const moraleContribution = morale * 0.30;
    const moraleDelta = (morale - 1.0) * 0.30;
    breakdown.push({
      name: 'Section Morale',
      value: moraleContribution,
      delta: moraleDelta,
      weight: 30,
      current: morale,
      max: 0.30,
      min: 0,
      icon: Heart,
      description: `${Math.round(morale * 100)}% morale × 30% weight`,
      color: morale >= 0.95 ? 'text-green-400' : morale >= 0.80 ? 'text-yellow-400' : 'text-red-400'
    });

    // Factor 3: Equipment Condition (30% weight)
    const equipmentContribution = avgEquipment * 0.30;
    const equipmentDelta = (avgEquipment - 1.0) * 0.30;
    breakdown.push({
      name: 'Equipment Condition',
      value: equipmentContribution,
      delta: equipmentDelta,
      weight: 30,
      current: avgEquipment,
      max: 0.30,
      min: 0,
      icon: Wrench,
      description: `${Math.round(avgEquipment * 100)}% condition × 30% weight`,
      color: avgEquipment >= 0.95 ? 'text-green-400' : avgEquipment >= 0.80 ? 'text-yellow-400' : 'text-red-400'
    });

    // Factor 4: Staff Bonus (1% per staff, max 5%)
    breakdown.push({
      name: 'Staff Bonus',
      value: staffBonusValue,
      delta: staffBonusValue, // Always positive
      weight: null, // Not weight-based
      current: staffCount,
      max: 0.05,
      min: 0,
      icon: Users,
      description: `${staffCount} staff member${staffCount !== 1 ? 's' : ''} (+1% each, max 5%)`,
      color: staffBonusValue > 0 ? 'text-blue-400' : 'text-cream-500/40'
    });

    return breakdown;
  };

  const multiplierBreakdown = getMultiplierBreakdown();

  // Get status color based on value
  const getStatusColor = (value) => {
    if (value >= 0.85) return 'text-green-500';
    if (value >= 0.70) return 'text-yellow-500';
    return 'text-red-500';
  };

  // Get status background color
  const getStatusBg = (value) => {
    if (value >= 0.85) return 'bg-green-500/20 border-green-500/30';
    if (value >= 0.70) return 'bg-yellow-500/20 border-yellow-500/30';
    return 'bg-red-500/20 border-red-500/30';
  };

  // Get trend icon
  const getTrendIcon = (value) => {
    if (value >= 0.90) return <TrendingUp className="w-4 h-4 text-green-500" />;
    if (value >= 0.70) return <Minus className="w-4 h-4 text-yellow-500" />;
    return <TrendingDown className="w-4 h-4 text-red-500" />;
  };

  // Get multiplier color and label
  const getMultiplierStatus = () => {
    if (multiplier >= 1.05) return { color: 'text-green-500', label: 'Excellent', icon: Sparkles };
    if (multiplier >= 0.95) return { color: 'text-blue-500', label: 'Good', icon: TrendingUp };
    if (multiplier >= 0.85) return { color: 'text-yellow-500', label: 'Fair', icon: Minus };
    return { color: 'text-red-500', label: 'Poor', icon: AlertCircle };
  };

  const multiplierStatus = getMultiplierStatus();
  const MultiplierIcon = multiplierStatus.icon;

  return (
    <div className="space-y-4">
      {/* Overall Execution Multiplier */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="card-premium p-6"
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-cream-100">
            Execution Multiplier
          </h3>
          <MultiplierIcon className={`w-5 h-5 ${multiplierStatus.color}`} />
        </div>

        <div className="flex items-end gap-3 mb-4">
          <div className="text-5xl font-bold text-gradient">
            {multiplier.toFixed(2)}x
          </div>
          <div className="pb-2">
            <span className={`text-sm font-semibold ${multiplierStatus.color}`}>
              {multiplierStatus.label}
            </span>
            <p className="text-xs text-cream-500/60">Performance Impact</p>
          </div>
        </div>

        {/* Multiplier Bar */}
        <div className="mb-4">
          <div className="flex justify-between text-xs text-cream-500/60 mb-2">
            <span>0.70x (Poor)</span>
            <span>1.00x (Perfect)</span>
            <span>1.10x (Elite)</span>
          </div>
          <div className="w-full h-3 bg-charcoal-800 rounded-full overflow-hidden relative">
            <div className="absolute inset-0 flex">
              <div className="w-[25%] bg-red-500/20" />
              <div className="w-[25%] bg-yellow-500/20" />
              <div className="w-[25%] bg-green-500/20" />
              <div className="w-[25%] bg-blue-500/20" />
            </div>
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${((multiplier - 0.70) / 0.40) * 100}%` }}
              transition={{ duration: 0.8, ease: 'easeOut' }}
              className={`h-full ${
                multiplier >= 1.05 ? 'bg-blue-500' :
                multiplier >= 0.95 ? 'bg-green-500' :
                multiplier >= 0.85 ? 'bg-yellow-500' :
                'bg-red-500'
              } shadow-lg`}
            />
          </div>
        </div>

        {/* Toggle Breakdown Button */}
        <button
          onClick={() => setShowBreakdown(!showBreakdown)}
          className="w-full flex items-center justify-between px-4 py-3 bg-charcoal-900/30 hover:bg-charcoal-900/50 rounded-lg transition-colors"
        >
          <span className="text-sm font-semibold text-cream-100">
            View Detailed Breakdown
          </span>
          {showBreakdown ? (
            <ChevronUp className="w-5 h-5 text-cream-500" />
          ) : (
            <ChevronDown className="w-5 h-5 text-cream-500" />
          )}
        </button>

        {/* Detailed Breakdown */}
        <AnimatePresence>
          {showBreakdown && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.3 }}
              className="mt-4 space-y-3 overflow-hidden"
            >
              <div className="p-3 bg-blue-500/10 border-2 border-blue-500/30 rounded-lg">
                <p className="text-xs text-blue-400 font-semibold mb-1">
                  Multiplier Components
                </p>
                <p className="text-xs text-cream-300">
                  Each factor contributes to your overall execution score. Green values are positive, red are negative.
                </p>
              </div>

              {/* Formula explanation */}
              <div className="p-3 bg-charcoal-900/30 rounded-lg mb-2">
                <p className="text-xs text-cream-500/60">
                  Multiplier = (Readiness × 40%) + (Morale × 30%) + (Equipment × 30%) + Staff Bonus
                </p>
              </div>

              {multiplierBreakdown.map((factor, index) => {
                const Icon = factor.icon;
                const fillPercentage = factor.weight
                  ? (factor.current * 100) // For weighted factors, show current value as percentage
                  : ((factor.value / factor.max) * 100); // For staff bonus, show progress to max

                return (
                  <motion.div
                    key={factor.name}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.05 }}
                    className="p-4 bg-charcoal-900/50 rounded-lg"
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <Icon className={`w-5 h-5 ${factor.color}`} />
                        <div>
                          <p className="text-sm font-semibold text-cream-100">
                            {factor.name}
                            {factor.weight && (
                              <span className="text-cream-500/40 font-normal ml-1">({factor.weight}% weight)</span>
                            )}
                          </p>
                          <p className="text-xs text-cream-500/60">
                            {factor.description}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className={`text-lg font-bold ${factor.color}`}>
                          +{(factor.value * 100).toFixed(1)}%
                        </p>
                        {factor.delta < 0 && (
                          <p className="text-xs text-red-400/60">
                            ({(factor.delta * 100).toFixed(1)}% from max)
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Factor Bar - shows how full the contribution is */}
                    <div className="w-full h-2 bg-charcoal-800 rounded-full overflow-hidden relative">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${Math.min(fillPercentage, 100)}%` }}
                        transition={{ duration: 0.5, delay: index * 0.05 }}
                        className={`h-full ${
                          factor.current >= 0.95 ? 'bg-green-500' :
                          factor.current >= 0.80 ? 'bg-yellow-500' :
                          factor.current >= 0.70 ? 'bg-orange-500' :
                          'bg-red-500'
                        }`}
                      />
                    </div>
                  </motion.div>
                );
              })}

              {/* Total row */}
              <div className="p-4 bg-charcoal-800/50 rounded-lg border border-cream-500/20">
                <div className="flex justify-between items-center">
                  <span className="font-semibold text-cream-100">Total Multiplier</span>
                  <span className={`text-xl font-bold ${multiplier >= 1.0 ? 'text-green-400' : 'text-yellow-400'}`}>
                    {multiplier.toFixed(2)}x
                  </span>
                </div>
                <p className="text-xs text-cream-500/40 mt-1">
                  Clamped to range 0.70x - 1.10x
                </p>
              </div>

              <div className="p-4 bg-gold-500/10 border-2 border-gold-500/30 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <Award className="w-5 h-5 text-gold-500" />
                  <p className="text-sm font-semibold text-cream-100">
                    Pro Tip
                  </p>
                </div>
                <p className="text-xs text-cream-300 leading-relaxed">
                  Readiness has the biggest impact (40% weight) - keep up with daily rehearsals!
                  Morale and equipment each contribute 30%. Hire up to 5 staff members for a bonus
                  +5% to reach the elite 1.10x multiplier!
                </p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      {/* Execution Metrics */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="grid grid-cols-1 md:grid-cols-3 gap-4"
      >
        {/* Readiness */}
        <div className={`card border-2 ${getStatusBg(readiness)}`}>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Target className={`w-5 h-5 ${getStatusColor(readiness)}`} />
              <span className="font-semibold text-cream-100">Readiness</span>
            </div>
            {getTrendIcon(readiness)}
          </div>

          <div className="mb-3">
            <div className="flex items-end gap-1">
              <span className={`text-3xl font-bold ${getStatusColor(readiness)}`}>
                {(readiness * 100).toFixed(0)}
              </span>
              <span className="text-lg text-cream-500/60 pb-1">%</span>
            </div>
          </div>

          <div className="w-full h-2 bg-charcoal-800 rounded-full overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${readiness * 100}%` }}
              transition={{ duration: 0.5, delay: 0.2 }}
              className={`h-full ${
                readiness >= 0.85 ? 'bg-green-500' :
                readiness >= 0.70 ? 'bg-yellow-500' :
                'bg-red-500'
              }`}
            />
          </div>

          <p className="text-xs text-cream-500/60 mt-2">
            Improved through daily rehearsals
          </p>
        </div>

        {/* Morale */}
        <div className={`card border-2 ${getStatusBg(morale)}`}>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Heart className={`w-5 h-5 ${getStatusColor(morale)}`} />
              <span className="font-semibold text-cream-100">Morale</span>
            </div>
            {getTrendIcon(morale)}
          </div>

          <div className="mb-3">
            <div className="flex items-end gap-1">
              <span className={`text-3xl font-bold ${getStatusColor(morale)}`}>
                {(morale * 100).toFixed(0)}
              </span>
              <span className="text-lg text-cream-500/60 pb-1">%</span>
            </div>
          </div>

          <div className="w-full h-2 bg-charcoal-800 rounded-full overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${morale * 100}%` }}
              transition={{ duration: 0.5, delay: 0.3 }}
              className={`h-full ${
                morale >= 0.85 ? 'bg-green-500' :
                morale >= 0.70 ? 'bg-yellow-500' :
                'bg-red-500'
              }`}
            />
          </div>

          <p className="text-xs text-cream-500/60 mt-2">
            Affected by performance outcomes
          </p>
        </div>

        {/* Equipment Condition */}
        <div className={`card border-2 ${getStatusBg(avgEquipment)}`}>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Wrench className={`w-5 h-5 ${getStatusColor(avgEquipment)}`} />
              <span className="font-semibold text-cream-100">Equipment</span>
            </div>
            {getTrendIcon(avgEquipment)}
          </div>

          <div className="mb-3">
            <div className="flex items-end gap-1">
              <span className={`text-3xl font-bold ${getStatusColor(avgEquipment)}`}>
                {(avgEquipment * 100).toFixed(0)}
              </span>
              <span className="text-lg text-cream-500/60 pb-1">%</span>
            </div>
          </div>

          <div className="w-full h-2 bg-charcoal-800 rounded-full overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${avgEquipment * 100}%` }}
              transition={{ duration: 0.5, delay: 0.4 }}
              className={`h-full ${
                avgEquipment >= 0.85 ? 'bg-green-500' :
                avgEquipment >= 0.70 ? 'bg-yellow-500' :
                'bg-red-500'
              }`}
            />
          </div>

          <p className="text-xs text-cream-500/60 mt-2">
            Degrades over time, repair regularly
          </p>
        </div>
      </motion.div>

      {/* Status Messages */}
      {(readiness < 0.70 || morale < 0.70 || avgEquipment < 0.70) && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="card-warning"
        >
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-yellow-500 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-cream-100 mb-1">Action Required</p>
              <ul className="text-sm text-cream-300 space-y-1">
                {readiness < 0.70 && (
                  <li>• Readiness is low - schedule daily rehearsals to improve</li>
                )}
                {morale < 0.70 && (
                  <li>• Morale needs attention - consider boosting morale</li>
                )}
                {avgEquipment < 0.70 && (
                  <li>• Equipment condition is poor - repair or upgrade equipment</li>
                )}
              </ul>
            </div>
          </div>
        </motion.div>
      )}
    </div>
  );
};

export default ExecutionDashboard;
