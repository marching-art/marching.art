// src/components/Execution/ExecutionDashboard.jsx
import React from 'react';
import { motion } from 'framer-motion';
import {
  Target, Heart, Wrench, TrendingUp, TrendingDown,
  Minus, Sparkles, AlertCircle
} from 'lucide-react';

const ExecutionDashboard = ({ executionState, multiplier }) => {
  if (!executionState) {
    return (
      <div className="card p-6">
        <p className="text-cream-500/60 text-center">Loading execution status...</p>
      </div>
    );
  }

  const { readiness = 0, morale = 0, equipment = {} } = executionState;

  // Calculate average equipment condition
  const equipmentConditions = Object.values(equipment).map(e => e.condition || 0);
  const avgEquipment = equipmentConditions.length > 0
    ? equipmentConditions.reduce((sum, c) => sum + c, 0) / equipmentConditions.length
    : 0;

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

        <div className="flex items-end gap-3">
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

        <div className="mt-4 p-3 bg-charcoal-900/30 rounded-lg">
          <p className="text-xs text-cream-500/80 leading-relaxed">
            Your execution multiplier affects all performance scores.
            Keep readiness, morale, and equipment in top condition to maximize results!
          </p>
        </div>
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
